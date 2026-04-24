// In-memory ring buffer for inbound HMS API hits. Used by the
// /api/admin/hms-health/recent-activity endpoint so a superadmin can
// see live HMS traffic without us creating a new DB table.
//
// Capped at 100 entries; oldest rolls off as new ones arrive. State
// resets on every server restart, which is acceptable for diagnostics.

export interface HmsHit {
  timestamp: string;
  method: string;
  route: string;
  path: string;
  status: number;
  durationMs: number;
  ip?: string;
  identifier?: string;
  query?: Record<string, string>;
}

const MAX_ENTRIES = 100;
const buffer: HmsHit[] = [];

export function recordHmsHit(hit: HmsHit): void {
  buffer.unshift(hit);
  if (buffer.length > MAX_ENTRIES) {
    buffer.length = MAX_ENTRIES;
  }
}

export function getRecentHits(limit = 20): HmsHit[] {
  return buffer.slice(0, Math.max(1, Math.min(limit, MAX_ENTRIES)));
}

export function getLastHitForRoute(route: string): HmsHit | null {
  return buffer.find((h) => h.route === route) || null;
}

export function getStats(): { total: number; capacity: number } {
  return { total: buffer.length, capacity: MAX_ENTRIES };
}
