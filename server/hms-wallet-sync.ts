import { db } from "./db";
import * as schema from "@shared/schema";
import { eq, and, sql } from "drizzle-orm";

const HMS_WALLET_SYNC_INTERVAL_MS = 30 * 60 * 1000;

// ── Module-level state ────────────────────────────────────────────────────────
// Only set when the run completed without a fatal error and at least one property
// fetch succeeded — not on purely errored / no-properties-found runs.
export let lastHmsWalletSyncAt: Date | null = null;

// JWT cache — mirrors the pattern in registerRoutes() so this module is
// self-contained without depending on closure variables from routes.ts.
let cachedJwt: string | null = null;
let jwtExpiresAt = 0;

// ── Auth helpers (full API-key + JWT-login fallback, including 401 retry) ─────
function getHmsBaseUrl(): string {
  return (process.env.HMS_API_URL || "https://hostel-flow--swaingrs07.replit.app").replace(/\/+$/, "");
}

async function getHmsToken(): Promise<string> {
  const apiKey = process.env.HMS_API_KEY || process.env.HOSTEL_FLOW_API_KEY;
  if (apiKey) return apiKey;

  // JWT login fallback
  if (cachedJwt && Date.now() < jwtExpiresAt) return cachedJwt;

  const email = process.env.HOSTEL_FLOW_EMAIL;
  const password = process.env.HOSTEL_FLOW_PASSWORD;
  if (!email || !password) {
    throw new Error("No HMS auth configured — set HMS_API_KEY, HOSTEL_FLOW_API_KEY, or HOSTEL_FLOW_EMAIL + HOSTEL_FLOW_PASSWORD");
  }

  const loginRes = await fetch(`${getHmsBaseUrl()}/api/auth/login`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ email, password }),
    signal: AbortSignal.timeout(10000),
  });
  if (!loginRes.ok) {
    const errText = await loginRes.text().catch(() => "");
    throw new Error(`HMS login failed (${loginRes.status}): ${errText.slice(0, 200)}`);
  }
  const data = await loginRes.json() as any;
  cachedJwt = data.jwtToken || data.token || null;
  if (!cachedJwt) throw new Error("No token returned from HMS login");
  jwtExpiresAt = Date.now() + 23 * 60 * 60 * 1000;
  return cachedJwt;
}

async function hmsAuthHeaders(): Promise<Record<string, string>> {
  const token = await getHmsToken();
  return { Authorization: `Bearer ${token}`, "Content-Type": "application/json" };
}

/** Fetch a URL with automatic 401 retry (re-login once, then fail). */
async function hmsFetch(url: string): Promise<any> {
  const headers = await hmsAuthHeaders();
  let res = await fetch(url, { headers, signal: AbortSignal.timeout(15000) });

  if (res.status === 401 && !(process.env.HMS_API_KEY || process.env.HOSTEL_FLOW_API_KEY)) {
    // Stale JWT — force re-login and retry once
    cachedJwt = null;
    jwtExpiresAt = 0;
    const fresh = await hmsAuthHeaders();
    res = await fetch(url, { headers: fresh, signal: AbortSignal.timeout(15000) });
  }

  if (!res.ok) throw new Error(`HMS HTTP ${res.status} for ${url}`);
  return res.json();
}

// ── Wallet balance extraction ─────────────────────────────────────────────────
function extractWalletBalance(resident: any): number | null {
  for (const key of ["walletBalance", "wallet_balance", "walletCredit", "wallet_credit", "balance"]) {
    const v = resident[key];
    if (typeof v === "number" && !isNaN(v)) return v;
    if (typeof v === "string" && v !== "" && !isNaN(Number(v))) return Number(v);
  }
  if (resident.wallet && typeof resident.wallet === "object") {
    for (const key of ["balance", "walletBalance", "credit"]) {
      const v = resident.wallet[key];
      if (typeof v === "number" && !isNaN(v)) return v;
      if (typeof v === "string" && v !== "" && !isNaN(Number(v))) return Number(v);
    }
  }
  return null;
}

async function fetchResidentWalletFallback(residentId: string): Promise<number | null> {
  try {
    const data = await hmsFetch(`${getHmsBaseUrl()}/api/residents/${residentId}/wallet`);
    const v = extractWalletBalance(data);
    if (v !== null) return v;
    if (typeof data === "number") return data;
    return null;
  } catch {
    return null;
  }
}

// ── Phone normalisation ───────────────────────────────────────────────────────
function normalizePhone(phone: string | null | undefined): string {
  if (!phone) return "";
  let c = phone.replace(/[\s\-\(\)\+]/g, "");
  if (c.startsWith("91") && c.length > 10) c = c.slice(2);
  else if (c.startsWith("0")) c = c.slice(1);
  return c.slice(-10);
}

// ── Types ─────────────────────────────────────────────────────────────────────
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

// ── Core pull function ────────────────────────────────────────────────────────
export async function pullHmsWalletBalances(propertyIds?: string[]): Promise<WalletSyncResult> {
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

  const result: WalletSyncResult = { synced: 0, skipped: 0, errors: 0, noWalletField: 0, details: [] };

  if (targetProps.length === 0) return result;

  let atLeastOnePropertyFetched = false;
  let firstProbeLogged = false;

  for (const prop of targetProps) {
    // ── Fetch residents for this property from HMS ──────────────────────────
    let hmsResidents: any[] = [];
    try {
      const data = await hmsFetch(`${getHmsBaseUrl()}/api/residents?propertyId=${prop.hmsPropertyId}`);
      hmsResidents = Array.isArray(data) ? data : (data.residents || data.data || []);
      atLeastOnePropertyFetched = true;
    } catch (fetchErr: any) {
      console.warn(`[HMS Wallet Sync] Property "${prop.name}": fetch failed — ${fetchErr.message}`);
      result.errors++;
      result.details.push({ bookingCode: "-", name: prop.name, status: "error", error: fetchErr.message });
      continue;
    }

    // Log field shape on first successful probe
    if (!firstProbeLogged && hmsResidents.length > 0) {
      firstProbeLogged = true;
      const sample = hmsResidents[0];
      const walletKeys = Object.keys(sample).filter(k =>
        k.toLowerCase().includes("wallet") || k.toLowerCase().includes("balance") || k.toLowerCase().includes("credit")
      );
      console.log(`[HMS Wallet Sync] Sample resident keys: ${Object.keys(sample).join(", ")}`);
      console.log(`[HMS Wallet Sync] Wallet-related keys found: ${walletKeys.join(", ") || "(none — wallet sync may be a no-op)"}`);
    }

    // ── Load bookings scoped to THIS property only ──────────────────────────
    // Intentionally constrained by propertyId to avoid matching the same
    // phone/email across multiple properties and writing corrections to the
    // wrong resident's ledger.
    const propBookings = await db.select().from(schema.bookings).where(
      and(
        eq(schema.bookings.propertyId, prop.id),
        sql`${schema.bookings.status} IN ('confirmed', 'active', 'pending_payment', 'completed')`
      )
    );

    for (const hmsResident of hmsResidents) {
      // Each resident is wrapped in its own try/catch so one bad record never
      // aborts the rest of the property or the overall job.
      try {
        const hmsPhone = normalizePhone(hmsResident.phone);
        const hmsEmail = (hmsResident.email || "").toLowerCase().trim();

        // Match within this property only
        const booking = propBookings.find((b: any) => {
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

        // ── Wallet balance extraction hierarchy ──────────────────────────────
        // We probe the following field names in order because HostelFlow's API
        // shape is not fixed in a published contract:
        //   1. Inline resident object: walletBalance → wallet_balance →
        //      walletCredit → wallet_credit → balance
        //   2. Nested wallet sub-object: resident.wallet.balance / .walletBalance / .credit
        //   3. Per-resident endpoint: GET /api/residents/:id/wallet
        // If none yield a number, we record status "no_wallet_field" and skip.
        // Check server startup log "[HMS Wallet Sync] Wallet-related keys found:"
        // to see what HostelFlow actually sends for your deployment.
        let hmsBalance = extractWalletBalance(hmsResident);
        if (hmsBalance === null && hmsResident.id) {
          hmsBalance = await fetchResidentWalletFallback(hmsResident.id);
        }

        if (hmsBalance === null) {
          result.noWalletField++;
          result.details.push({ bookingCode: booking.bookingCode || "-", name: guestName, status: "no_wallet_field" });
          continue;
        }

        // Compute local balance from ledger
        const entries = await db.select().from(schema.walletLedger)
          .where(eq(schema.walletLedger.bookingId, booking.id));
        const localBalance = entries.reduce((acc: number, e: any) => acc + (e.credit || 0) - (e.debit || 0), 0);

        // CRM is the credit source — credits are added here and HMS only reads/uses
        // the balance. We only apply POSITIVE corrections (HMS has more than CRM,
        // meaning an external credit happened in HMS that we missed). Negative
        // deltas mean HMS shows a lower balance than CRM, which is expected normal
        // usage — we never debit the CRM to chase HMS down.
        const delta = Math.round(hmsBalance - localBalance);
        if (delta <= 0) {
          result.skipped++;
          result.details.push({ bookingCode: booking.bookingCode || "-", name: guestName, status: "skipped", previousBalance: localBalance, newBalance: localBalance, delta });
          continue;
        }

        await db.insert(schema.walletLedger).values({
          bookingId: booking.id,
          credit: delta,
          debit: 0,
          refType: "balance_correction",
          note: `HMS wallet sync (auto) — target ₹${hmsBalance}`,
        });

        const newBalance = localBalance + delta;
        console.log(`[HMS Wallet Sync] ${booking.bookingCode}: corrected ₹${localBalance} → ₹${newBalance} (${delta > 0 ? "+" : ""}${delta})`);
        result.synced++;
        result.details.push({ bookingCode: booking.bookingCode || "-", name: guestName, status: "synced", previousBalance: localBalance, newBalance, delta });
      } catch (residentErr: any) {
        // One bad resident must not abort the rest
        console.warn(`[HMS Wallet Sync] Skipping resident (error): ${residentErr.message}`);
        result.errors++;
        result.details.push({ bookingCode: "-", name: hmsResident.name || hmsResident.email || "?", status: "error", error: residentErr.message });
      }
    }
  }

  if (result.synced > 0 || result.errors > 0) {
    console.log(`[HMS Wallet Sync] Done — synced: ${result.synced}, skipped: ${result.skipped}, errors: ${result.errors}, noWalletField: ${result.noWalletField}`);
  }

  // Only mark last-sync timestamp when at least one property was successfully
  // fetched from HMS (i.e., the run was not entirely a network/auth failure).
  if (atLeastOnePropertyFetched) {
    lastHmsWalletSyncAt = new Date();
  }

  return result;
}

// ── Background job ────────────────────────────────────────────────────────────
export function startHmsWalletSyncJob() {
  async function run() {
    try {
      const r = await pullHmsWalletBalances();
      if (r.synced > 0) {
        console.log(`[background] HMS wallet sync: applied ${r.synced} balance correction(s)`);
      }
    } catch (err: any) {
      console.error(`[background] HMS wallet sync failed: ${err.message}`);
    }
  }

  // Delay first run by 2 min so the server is fully warmed up
  setTimeout(async () => {
    await run();
    setInterval(run, HMS_WALLET_SYNC_INTERVAL_MS);
  }, 2 * 60 * 1000);

  console.log(`[background] HMS wallet sync job started (runs every 30 min, first run in 2 min)`);
}
