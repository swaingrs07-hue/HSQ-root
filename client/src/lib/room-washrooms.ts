export type RoomWashroomLike = {
  typology?: string | null;
  hasSharedWashroom?: boolean | null;
  sharedWashroomSections?: string[] | null;
};

export function getSectionLabels(typology?: string | null): string[] {
  if (!typology || !typology.includes("+")) return [];
  return typology.split("+").map((_, i) => String.fromCharCode(65 + i));
}

export function getSharedSectionLetters(room: RoomWashroomLike): string[] {
  const sections = getSectionLabels(room.typology);
  if (sections.length === 0) return [];
  const explicit = (room.sharedWashroomSections ?? []).filter((s) => sections.includes(s));
  if (explicit.length > 0) return explicit;
  return room.hasSharedWashroom ? sections : [];
}

export function isSectionShared(room: RoomWashroomLike, sectionLabel: string): boolean {
  return getSharedSectionLetters(room).includes(sectionLabel);
}

export type WashroomPill = {
  text: string;
  kind: "shared" | "attached";
};

export function getWashroomPills(room: RoomWashroomLike): WashroomPill[] {
  const isCombo = !!room.typology?.includes("+");
  if (!isCombo) {
    return room.hasSharedWashroom
      ? [{ text: "Shared WC", kind: "shared" }]
      : [{ text: "Attached WC", kind: "attached" }];
  }
  const sections = getSectionLabels(room.typology);
  const shared = getSharedSectionLetters(room);
  const attached = sections.filter((s) => !shared.includes(s));
  const pills: WashroomPill[] = [];
  if (shared.length === sections.length) {
    pills.push({ text: "Shared WC", kind: "shared" });
  } else if (shared.length > 0) {
    pills.push({ text: `Shared WC: ${shared.join(", ")}`, kind: "shared" });
  }
  if (attached.length === sections.length) {
    pills.push({ text: "Attached WC", kind: "attached" });
  } else if (attached.length > 0) {
    pills.push({ text: `Attached WC: ${attached.join(", ")}`, kind: "attached" });
  }
  return pills;
}
