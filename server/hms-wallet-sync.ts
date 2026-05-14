import { db } from "./db";
import * as schema from "@shared/schema";
import { eq, and, sql, inArray } from "drizzle-orm";

const HMS_WALLET_SYNC_INTERVAL_MS = 30 * 60 * 1000;

// Module-level state: last successful sync timestamp + job handle
export let lastHmsWalletSyncAt: Date | null = null;
let walletSyncTimer: ReturnType<typeof setInterval> | null = null;

function getHmsBaseUrl(): string {
  return (process.env.HMS_API_URL || "https://hostel-flow--swaingrs07.replit.app").replace(/\/+$/, "");
}

function getHmsAuthHeaders(): Record<string, string> {
  const apiKey = process.env.HMS_API_KEY || process.env.HOSTEL_FLOW_API_KEY;
  if (apiKey) {
    return { Authorization: `Bearer ${apiKey}`, "Content-Type": "application/json" };
  }
  return { "Content-Type": "application/json" };
}

// Read wallet balance from an HMS resident object — tries all known field name variants.
function extractWalletBalance(resident: any): number | null {
  for (const key of ["walletBalance", "wallet_balance", "walletCredit", "wallet_credit", "balance"]) {
    const v = resident[key];
    if (typeof v === "number" && !isNaN(v)) return v;
    if (typeof v === "string" && v !== "" && !isNaN(Number(v))) return Number(v);
  }
  // Nested wallet object: { wallet: { balance: N } }
  if (resident.wallet && typeof resident.wallet === "object") {
    for (const key of ["balance", "walletBalance", "credit"]) {
      const v = resident.wallet[key];
      if (typeof v === "number" && !isNaN(v)) return v;
      if (typeof v === "string" && v !== "" && !isNaN(Number(v))) return Number(v);
    }
  }
  return null;
}

// Fetch wallet balance for a single resident via /api/residents/:id/wallet (fallback path)
async function fetchResidentWalletFallback(residentId: string): Promise<number | null> {
  try {
    const res = await fetch(`${getHmsBaseUrl()}/api/residents/${residentId}/wallet`, {
      headers: getHmsAuthHeaders(),
      signal: AbortSignal.timeout(8000),
    });
    if (!res.ok) return null;
    const data = await res.json();
    const v = extractWalletBalance(data);
    if (v !== null) return v;
    // Some HMS implementations return { balance: N } at the top level
    if (typeof data === "number") return data;
    return null;
  } catch {
    return null;
  }
}

function normalizePhone(phone: string | null | undefined): string {
  if (!phone) return "";
  let c = phone.replace(/[\s\-\(\)\+]/g, "");
  if (c.startsWith("91") && c.length > 10) c = c.slice(2);
  else if (c.startsWith("0")) c = c.slice(1);
  return c.slice(-10);
}

export interface WalletSyncResult {
  synced: number;
  skipped: number;
  errors: number;
  noWalletField: number;
  details: Array<{
    bookingCode: string;
    name: string;
    status: "synced" | "skipped" | "error" | "no_wallet_field";
    previousBalance?: number;
    newBalance?: number;
    delta?: number;
    error?: string;
  }>;
}

export async function pullHmsWalletBalances(propertyIds?: string[]): Promise<WalletSyncResult> {
  const baseUrl = getHmsBaseUrl();
  const authHeaders = getHmsAuthHeaders();
  const hasAuth = !!(process.env.HMS_API_KEY || process.env.HOSTEL_FLOW_API_KEY);
  if (!hasAuth) {
    return { synced: 0, skipped: 0, errors: 1, noWalletField: 0, details: [{ bookingCode: "-", name: "-", status: "error", error: "HMS API key not configured" }] };
  }

  // Fetch HMS-linked properties
  const linkedProps = await db.select({
    id: schema.properties.id,
    name: schema.properties.name,
    hmsPropertyId: schema.properties.hmsPropertyId,
  }).from(schema.properties).where(
    and(
      eq(schema.properties.hmsLinked, true),
      sql`${schema.properties.hmsPropertyId} IS NOT NULL`,
    )
  );

  const targetProps = propertyIds
    ? linkedProps.filter(p => propertyIds.includes(p.id))
    : linkedProps;

  if (targetProps.length === 0) {
    return { synced: 0, skipped: 0, errors: 0, noWalletField: 0, details: [] };
  }

  // Pre-load all active+completed bookings once
  const allBookings = await db.select().from(schema.bookings).where(
    sql`${schema.bookings.status} IN ('confirmed', 'active', 'pending_payment', 'completed')`
  );

  const result: WalletSyncResult = { synced: 0, skipped: 0, errors: 0, noWalletField: 0, details: [] };
  let firstProbeLogged = false;

  for (const prop of targetProps) {
    let hmsResidents: any[] = [];
    try {
      const res = await fetch(`${baseUrl}/api/residents?propertyId=${prop.hmsPropertyId}`, {
        headers: authHeaders,
        signal: AbortSignal.timeout(15000),
      });
      if (!res.ok) {
        console.warn(`[HMS Wallet Sync] Property ${prop.name}: HMS returned ${res.status}`);
        result.errors++;
        result.details.push({ bookingCode: "-", name: prop.name, status: "error", error: `HMS ${res.status}` });
        continue;
      }
      const data = await res.json();
      hmsResidents = Array.isArray(data) ? data : (data.residents || data.data || []);
    } catch (fetchErr: any) {
      console.warn(`[HMS Wallet Sync] Property ${prop.name}: fetch failed — ${fetchErr.message}`);
      result.errors++;
      result.details.push({ bookingCode: "-", name: prop.name, status: "error", error: fetchErr.message });
      continue;
    }

    // Log available fields on first probe so admins can see the HMS shape
    if (!firstProbeLogged && hmsResidents.length > 0) {
      firstProbeLogged = true;
      const sample = hmsResidents[0];
      const walletKeys = Object.keys(sample).filter(k =>
        k.toLowerCase().includes("wallet") || k.toLowerCase().includes("balance") || k.toLowerCase().includes("credit")
      );
      console.log(`[HMS Wallet Sync] Sample resident keys: ${Object.keys(sample).join(", ")}`);
      console.log(`[HMS Wallet Sync] Wallet-related keys found: ${walletKeys.join(", ") || "(none)"}`);
    }

    for (const hmsResident of hmsResidents) {
      // Match local booking by phone or email
      const hmsPhone = normalizePhone(hmsResident.phone);
      const hmsEmail = (hmsResident.email || "").toLowerCase().trim();

      const booking = allBookings.find((b: any) => {
        const rd = b.residentDetails as any;
        if (hmsPhone) {
          const bPhone = normalizePhone(b.walkInPhone || rd?.phone || "");
          if (bPhone && bPhone === hmsPhone) return true;
        }
        if (hmsEmail) {
          const bEmail = (b.walkInEmail || rd?.email || "").toLowerCase().trim();
          if (bEmail && bEmail === hmsEmail) return true;
        }
        return false;
      });

      if (!booking) continue;

      const rd = booking.residentDetails as any;
      const guestName = booking.walkInName || rd?.name || rd?.fullName || booking.bookingCode || "Unknown";

      // Get wallet balance from resident data (or fallback per-resident endpoint)
      let hmsBalance = extractWalletBalance(hmsResident);
      if (hmsBalance === null && hmsResident.id) {
        hmsBalance = await fetchResidentWalletFallback(hmsResident.id);
      }

      if (hmsBalance === null) {
        result.noWalletField++;
        result.details.push({ bookingCode: booking.bookingCode || "-", name: guestName, status: "no_wallet_field" });
        continue;
      }

      // Compute local balance
      const entries = await db.select().from(schema.walletLedger)
        .where(eq(schema.walletLedger.bookingId, booking.id));
      const localBalance = entries.reduce((acc: number, e: any) => acc + (e.credit || 0) - (e.debit || 0), 0);

      const delta = hmsBalance - localBalance;
      if (delta === 0) {
        result.skipped++;
        result.details.push({ bookingCode: booking.bookingCode || "-", name: guestName, status: "skipped", previousBalance: localBalance, newBalance: localBalance, delta: 0 });
        continue;
      }

      try {
        await db.insert(schema.walletLedger).values({
          bookingId: booking.id,
          credit: delta > 0 ? delta : 0,
          debit: delta < 0 ? Math.abs(delta) : 0,
          refType: "balance_correction",
          note: `HMS wallet sync (auto) — target ₹${hmsBalance}`,
        });

        const newBalance = localBalance + delta;
        console.log(`[HMS Wallet Sync] ${booking.bookingCode}: corrected ₹${localBalance} → ₹${newBalance} (delta ${delta > 0 ? "+" : ""}${delta})`);
        result.synced++;
        result.details.push({ bookingCode: booking.bookingCode || "-", name: guestName, status: "synced", previousBalance: localBalance, newBalance, delta });
      } catch (insertErr: any) {
        result.errors++;
        result.details.push({ bookingCode: booking.bookingCode || "-", name: guestName, status: "error", error: insertErr.message });
      }
    }
  }

  if (result.synced > 0 || result.errors > 0) {
    console.log(`[HMS Wallet Sync] Done — synced: ${result.synced}, skipped: ${result.skipped}, errors: ${result.errors}, noWalletField: ${result.noWalletField}`);
  }

  lastHmsWalletSyncAt = new Date();
  return result;
}

export function startHmsWalletSyncJob() {
  async function run() {
    try {
      const r = await pullHmsWalletBalances();
      if (r.synced > 0) {
        console.log(`[background] HMS wallet sync: applied ${r.synced} correction(s)`, "background");
      }
    } catch (err: any) {
      console.error(`[background] HMS wallet sync failed: ${err.message}`);
    }
  }

  // Delay first run by 2 min so the server is fully warmed up
  setTimeout(async () => {
    await run();
    walletSyncTimer = setInterval(run, HMS_WALLET_SYNC_INTERVAL_MS);
  }, 2 * 60 * 1000);

  console.log(`[background] HMS wallet sync job started (runs every 30 min, first run in 2 min)`);
}
