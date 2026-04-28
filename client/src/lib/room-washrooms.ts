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

export type WashroomSummary = {
  show: boolean;
  isCombo: boolean;
  text: string;
  variant: "shared-all" | "shared-some" | "attached" | "none";
};

export function getWashroomSummary(room: RoomWashroomLike): WashroomSummary {
  const isCombo = !!room.typology?.includes("+");
  if (!isCombo) {
    if (room.hasSharedWashroom) return { show: true, isCombo, text: "Shared WC", variant: "shared-all" };
    return { show: false, isCombo, text: "Attached WC", variant: "attached" };
  }
  const sections = getSectionLabels(room.typology);
  const shared = getSharedSectionLetters(room);
  if (shared.length === 0) return { show: false, isCombo, text: "Attached WC", variant: "attached" };
  if (shared.length === sections.length) return { show: true, isCombo, text: "Shared WC", variant: "shared-all" };
  return { show: true, isCombo, text: `Shared WC: ${shared.join(", ")}`, variant: "shared-some" };
}
