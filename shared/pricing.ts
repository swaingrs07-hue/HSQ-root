// Shared price-resolution logic used by both client and server.
//
// Pricing precedence (highest first):
//   1. Per-section override on the room   (room.sectionPriceOverrides[section])
//   2. Per-room override                   (room.basePriceOverride / academicYearPriceOverride / depositOverride)
//   3. Room-type "shared WC" variant       (roomType.basePriceShared / academicYearPriceShared / depositShared)
//                                          ...applied only when the room/section has a shared washroom
//   4. Room-type default                   (roomType.basePrice / academicYearPrice / deposit)
//
// `monthlyPrice` on the rooms table is treated as a legacy alias for basePriceOverride
// (kept for back-compat — existing rows continue to work).

export type SectionPriceOverride = {
  basePrice?: number | null;
  academicYearPrice?: number | null;
  deposit?: number | null;
};

export type SectionPriceOverrideMap = Record<string, SectionPriceOverride>;

type RoomLike = {
  hasSharedWashroom?: boolean | null;
  sharedWashroomSections?: string[] | null;
  monthlyPrice?: number | null;
  basePriceOverride?: number | null;
  academicYearPriceOverride?: number | null;
  depositOverride?: number | null;
  sectionPriceOverrides?: SectionPriceOverrideMap | null;
} | null | undefined;

type RoomTypeLike = {
  basePrice?: number | null;
  academicYearPrice?: number | null;
  deposit?: number | null;
  basePriceShared?: number | null;
  academicYearPriceShared?: number | null;
  depositShared?: number | null;
} | null | undefined;

export type ResolvedPrice = {
  basePrice: number;          // monthly base price (₹/month)
  academicYearPrice: number;  // yearly price (₹/year)
  deposit: number;
  isShared: boolean;          // whether the shared-WC variant was applied
  source: "section" | "room" | "roomTypeShared" | "roomTypeDefault" | "none";
};

function firstNumber(...vals: Array<number | null | undefined>): number | null {
  for (const v of vals) {
    if (typeof v === "number" && !isNaN(v) && v > 0) return v;
  }
  return null;
}

/**
 * Returns true if the given section letter (e.g. "A") of the room has a shared washroom.
 * For non-combo rooms (no section), falls back to the room's `hasSharedWashroom` flag.
 */
export function isSectionShared(room: RoomLike, section?: string | null): boolean {
  if (!room) return false;
  if (section) {
    return Array.isArray(room.sharedWashroomSections)
      && room.sharedWashroomSections.includes(section);
  }
  return !!room.hasSharedWashroom;
}

/**
 * Extract the section letter (A/B/C/...) from a bedNumber, given the room's roomNumber.
 * Returns null if the bed isn't part of a sectioned (combo) room.
 *
 * Examples:
 *   getBedSection("1101A-1", "1101")  -> "A"
 *   getBedSection("1102C-3", "1102")  -> "C"
 *   getBedSection("1103-A", "1103")   -> "A"   (legacy format)
 *   getBedSection("1104",   "1104")   -> null  (single bed, no section)
 */
export function getBedSection(bedNumber?: string | null, roomNumber?: string | null): string | null {
  if (!bedNumber || !roomNumber) return null;
  const after = bedNumber.startsWith(roomNumber) ? bedNumber.slice(roomNumber.length) : bedNumber;
  const m = after.match(/^[-]?([A-Z])/);
  return m ? m[1] : null;
}

/**
 * Resolve the effective price for a room (or one section of a combo room).
 *
 * @param room       The rooms record (may be null/undefined; in that case only the room type is consulted).
 * @param roomType   The roomTypes record. Provides default + optional shared-WC variant.
 * @param section    Optional section letter (A/B/C/...) for combo rooms.
 */
export function resolveRoomPrice(
  room: RoomLike,
  roomType: RoomTypeLike,
  section?: string | null,
): ResolvedPrice {
  const isShared = isSectionShared(room, section);

  const sectionOverride: SectionPriceOverride | undefined =
    section && room?.sectionPriceOverrides
      ? (room.sectionPriceOverrides as any)[section]
      : undefined;

  const sharedRoomType = isShared ? {
    basePrice: roomType?.basePriceShared,
    academicYearPrice: roomType?.academicYearPriceShared,
    deposit: roomType?.depositShared,
  } : null;

  const basePrice =
    firstNumber(sectionOverride?.basePrice) ??
    firstNumber(room?.basePriceOverride, room?.monthlyPrice) ??
    firstNumber(sharedRoomType?.basePrice) ??
    firstNumber(roomType?.basePrice) ??
    0;

  const academicYearPrice =
    firstNumber(sectionOverride?.academicYearPrice) ??
    firstNumber(room?.academicYearPriceOverride) ??
    firstNumber(sharedRoomType?.academicYearPrice) ??
    firstNumber(roomType?.academicYearPrice) ??
    (basePrice > 0 ? basePrice * 11 : 0);

  // Deposit can legitimately be 0, so treat null/undefined separately from numeric 0.
  const pickDeposit = (...vals: Array<number | null | undefined>): number | null => {
    for (const v of vals) {
      if (typeof v === "number" && !isNaN(v)) return v;
    }
    return null;
  };
  const deposit =
    pickDeposit(sectionOverride?.deposit) ??
    pickDeposit(room?.depositOverride) ??
    pickDeposit(sharedRoomType?.deposit) ??
    pickDeposit(roomType?.deposit) ??
    0;

  let source: ResolvedPrice["source"] = "none";
  if (sectionOverride && (sectionOverride.basePrice || sectionOverride.academicYearPrice || sectionOverride.deposit != null)) {
    source = "section";
  } else if (room?.basePriceOverride || room?.monthlyPrice || room?.academicYearPriceOverride || room?.depositOverride != null) {
    source = "room";
  } else if (isShared && (sharedRoomType?.basePrice || sharedRoomType?.academicYearPrice || sharedRoomType?.deposit != null)) {
    source = "roomTypeShared";
  } else if (roomType?.basePrice) {
    source = "roomTypeDefault";
  }

  return { basePrice, academicYearPrice, deposit, isShared, source };
}

/**
 * Convenience helper that picks the right number to charge based on bookingMode.
 */
export function priceForBookingMode(
  resolved: ResolvedPrice,
  bookingMode: "monthly" | "academic_year" | string | null | undefined,
): number {
  return bookingMode === "academic_year" ? resolved.academicYearPrice : resolved.basePrice;
}
