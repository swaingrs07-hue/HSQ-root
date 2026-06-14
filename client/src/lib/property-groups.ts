// Groups properties wing-wise. Properties sharing the same `propertyGroup`
// label (case-insensitive) are bundled into one group, sorted by `wing`.
// Properties without a `propertyGroup` are returned as standalone single-member
// groups so callers can render them flat exactly as before.

export interface WingLike {
  id: string;
  name: string;
  propertyGroup?: string | null;
  wing?: string | null;
}

export interface PropertyGroup<T extends WingLike> {
  // Stable key for React lists.
  key: string;
  // Display name for the group header (the shared building name), or null for
  // a standalone/ungrouped property.
  groupName: string | null;
  // True when this group bundles wings under a shared propertyGroup label.
  isGroup: boolean;
  properties: T[];
}

export function groupPropertiesByWing<T extends WingLike>(
  properties: T[],
): PropertyGroup<T>[] {
  const groups: PropertyGroup<T>[] = [];
  const indexByKey = new Map<string, number>();

  for (const property of properties) {
    const rawGroup = property.propertyGroup?.trim();

    if (!rawGroup) {
      // Ungrouped property — its own standalone bucket.
      groups.push({
        key: `solo:${property.id}`,
        groupName: null,
        isGroup: false,
        properties: [property],
      });
      continue;
    }

    const key = `group:${rawGroup.toLowerCase()}`;
    const existing = indexByKey.get(key);
    if (existing === undefined) {
      indexByKey.set(key, groups.length);
      groups.push({
        key,
        groupName: rawGroup,
        isGroup: true,
        properties: [property],
      });
    } else {
      groups[existing].properties.push(property);
    }
  }

  // Sort wings within each multi-member group by their wing label (then name).
  for (const group of groups) {
    if (group.properties.length > 1) {
      group.properties.sort((a, b) =>
        (a.wing || a.name).localeCompare(b.wing || b.name, undefined, {
          numeric: true,
          sensitivity: "base",
        }),
      );
    }
  }

  return groups;
}
