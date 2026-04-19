import { db } from "./db";
import * as schema from "@shared/schema";
import { and, eq, inArray, notInArray } from "drizzle-orm";
import { sendBedReconciliationSummary } from "./email-service";

function log(message: string, source = "bed-reconcile") {
  const formattedTime = new Date().toLocaleTimeString("en-US", {
    hour: "numeric",
    minute: "2-digit",
    second: "2-digit",
    hour12: true,
  });
  console.log(`${formattedTime} [${source}] ${message}`);
}

export interface ReconcileResult {
  totalBedsScanned: number;
  totalCorrected: number;
  perProperty: Array<{
    propertyId: string;
    propertyName: string;
    corrected: number;
    toAvailable: number;
    toOccupied: number;
    toReserved: number;
  }>;
  affectedFloors: number;
  affectedRoomTypes: number;
}

const ACTIVE_BOOKING_STATUSES = ["confirmed", "active"] as const;
const RESERVED_BOOKING_STATUSES = ["draft", "pending_payment", "pending_approval"] as const;
const HOLDING_BOOKING_STATUSES = [
  ...ACTIVE_BOOKING_STATUSES,
  ...RESERVED_BOOKING_STATUSES,
] as const;

export async function reconcileBedStatuses(): Promise<ReconcileResult> {
  const props = await db
    .select({ id: schema.properties.id, name: schema.properties.name })
    .from(schema.properties);

  const allBeds = await db
    .select({
      id: schema.beds.id,
      propertyId: schema.beds.propertyId,
      floorId: schema.beds.floorId,
      roomTypeId: schema.beds.roomTypeId,
      status: schema.beds.status,
    })
    .from(schema.beds)
    .where(notInArray(schema.beds.status, ["maintenance", "blocked"]));

  const allHoldingBookings = await db
    .select({
      bedId: schema.bookings.bedId,
      status: schema.bookings.status,
    })
    .from(schema.bookings)
    .where(inArray(schema.bookings.status, HOLDING_BOOKING_STATUSES as unknown as string[]));

  const bedToBookingStatus = new Map<string, "active" | "reserved">();
  for (const b of allHoldingBookings) {
    if (!b.bedId) continue;
    const isActive = (ACTIVE_BOOKING_STATUSES as readonly string[]).includes(b.status);
    const desired: "active" | "reserved" = isActive ? "active" : "reserved";
    const current = bedToBookingStatus.get(b.bedId);
    if (current !== "active") {
      bedToBookingStatus.set(b.bedId, desired);
    }
  }

  const toAvailable: string[] = [];
  const toOccupied: string[] = [];
  const toReserved: string[] = [];

  const perPropertyCounts = new Map<string, { corrected: number; toAvailable: number; toOccupied: number; toReserved: number }>();
  const affectedFloorIds = new Set<string>();
  const affectedRoomTypeIds = new Set<string>();

  for (const bed of allBeds) {
    const bookingState = bedToBookingStatus.get(bed.id);
    let expected: "available" | "occupied" | "reserved";
    if (!bookingState) expected = "available";
    else if (bookingState === "active") expected = "occupied";
    else expected = "reserved";

    if (bed.status === expected) continue;

    if (expected === "available") toAvailable.push(bed.id);
    else if (expected === "occupied") toOccupied.push(bed.id);
    else toReserved.push(bed.id);

    affectedFloorIds.add(bed.floorId);
    if (bed.roomTypeId) affectedRoomTypeIds.add(bed.roomTypeId);

    const counts = perPropertyCounts.get(bed.propertyId) || { corrected: 0, toAvailable: 0, toOccupied: 0, toReserved: 0 };
    counts.corrected++;
    if (expected === "available") counts.toAvailable++;
    else if (expected === "occupied") counts.toOccupied++;
    else counts.toReserved++;
    perPropertyCounts.set(bed.propertyId, counts);
  }

  if (toAvailable.length > 0) {
    await db.update(schema.beds).set({ status: "available" }).where(inArray(schema.beds.id, toAvailable));
  }
  if (toOccupied.length > 0) {
    await db.update(schema.beds).set({ status: "occupied" }).where(inArray(schema.beds.id, toOccupied));
  }
  if (toReserved.length > 0) {
    await db.update(schema.beds).set({ status: "reserved" }).where(inArray(schema.beds.id, toReserved));
  }

  for (const fid of Array.from(affectedFloorIds)) {
    const floorBeds = await db.select({ status: schema.beds.status }).from(schema.beds).where(eq(schema.beds.floorId, fid));
    const availCount = floorBeds.filter((b) => b.status === "available").length;
    await db.update(schema.floors).set({ availableBeds: availCount }).where(eq(schema.floors.id, fid));
  }

  for (const rtId of Array.from(affectedRoomTypeIds)) {
    const rtBeds = await db.select({ status: schema.beds.status }).from(schema.beds).where(eq(schema.beds.roomTypeId, rtId));
    const rtAvail = rtBeds.filter((b) => b.status === "available").length;
    await db.update(schema.roomTypes).set({ availableBeds: rtAvail }).where(eq(schema.roomTypes.id, rtId));
  }

  const perProperty = props
    .map((p) => {
      const c = perPropertyCounts.get(p.id);
      if (!c) return null;
      return {
        propertyId: p.id,
        propertyName: p.name,
        corrected: c.corrected,
        toAvailable: c.toAvailable,
        toOccupied: c.toOccupied,
        toReserved: c.toReserved,
      };
    })
    .filter((x): x is NonNullable<typeof x> => x !== null);

  const totalCorrected = toAvailable.length + toOccupied.length + toReserved.length;

  if (totalCorrected > 0) {
    log(
      `Bed status reconciliation: corrected ${totalCorrected} bed(s) across ${perProperty.length} property(ies) (→available: ${toAvailable.length}, →occupied: ${toOccupied.length}, →reserved: ${toReserved.length})`,
      "bed-reconcile",
    );
    for (const pp of perProperty) {
      log(
        `  • ${pp.propertyName}: ${pp.corrected} corrected (→available: ${pp.toAvailable}, →occupied: ${pp.toOccupied}, →reserved: ${pp.toReserved})`,
        "bed-reconcile",
      );
    }
  } else {
    log(`Bed status reconciliation: scanned ${allBeds.length} bed(s), no corrections needed`, "bed-reconcile");
  }

  if (totalCorrected > 0 && perProperty.length > 0) {
    try {
      const result = await sendBedReconciliationSummary({
        runAt: new Date(),
        totalCorrected,
        totalBedsScanned: allBeds.length,
        perProperty,
      });
      if (result.success) {
        log(`Summary delivered to ${result.recipients ?? 0} superadmin(s)`, "bed-reconcile");
      } else {
        log(`Summary delivery reported failure: ${result.error || "unknown"}`, "bed-reconcile");
      }
    } catch (err) {
      log(`Failed to deliver reconciliation summary: ${err}`, "bed-reconcile");
    }
  }

  return {
    totalBedsScanned: allBeds.length,
    totalCorrected,
    perProperty,
    affectedFloors: affectedFloorIds.size,
    affectedRoomTypes: affectedRoomTypeIds.size,
  };
}

export function startBedStatusReconcileJob() {
  const ONE_HOUR_MS = 60 * 60 * 1000;

  function msUntilNext0230(): number {
    const now = new Date();
    const next = new Date(now);
    next.setHours(2, 30, 0, 0);
    if (next.getTime() <= now.getTime()) {
      next.setDate(next.getDate() + 1);
    }
    return next.getTime() - now.getTime();
  }

  async function runOnce() {
    try {
      await reconcileBedStatuses();
    } catch (err) {
      log(`Bed status reconciliation failed: ${err}`, "bed-reconcile");
    }
  }

  const initialDelay = msUntilNext0230();
  setTimeout(function tick() {
    void runOnce();
    setTimeout(tick, 24 * 60 * 60 * 1000);
  }, initialDelay);

  log(
    `Bed status reconciliation job scheduled (next run in ${Math.round(initialDelay / ONE_HOUR_MS * 10) / 10}h, then every 24h)`,
    "bed-reconcile",
  );
}
