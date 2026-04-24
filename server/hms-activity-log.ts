// Inbound HMS API hit log.
//
// Two sinks:
//   1. In-memory ring buffer (capped at 100, sub-second freshness, lost
//      on restart). Used so the diagnostics page reflects a hit
//      instantly, even before the DB write commits.
//   2. Persistent `hms_activity_log` table (survives restarts and deploys,
//      trimmed to ~30 days by a daily cleanup job). Primary source for
//      `/api/admin/hms-health/recent-activity`.
//
// Both writes are best-effort and never throw out of recordHmsHit().

import { db } from "./db";
import { hmsActivityLog } from "@shared/schema";
import { desc, lt, eq, sql } from "drizzle-orm";

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
  userAgent?: string;
  hasApiKey?: boolean;
}

const MAX_ENTRIES = 100;
const buffer: HmsHit[] = [];

export function recordHmsHit(hit: HmsHit): void {
  // 1) In-memory ring (instant, never throws).
  buffer.unshift(hit);
  if (buffer.length > MAX_ENTRIES) {
    buffer.length = MAX_ENTRIES;
  }

  // 2) Persistent DB write — fire-and-forget. Failures must never crash
  // the request or even surface as unhandled rejections.
  try {
    db.insert(hmsActivityLog).values({
      route: String(hit.route).slice(0, 500),
      method: String(hit.method).slice(0, 16),
      status: Number.isFinite(hit.status) ? hit.status : 0,
      latencyMs: Number.isFinite(hit.durationMs) ? Math.max(0, Math.round(hit.durationMs)) : 0,
      ip: hit.ip ? String(hit.ip).slice(0, 100) : null,
      userAgent: hit.userAgent ? String(hit.userAgent).slice(0, 500) : null,
      hasApiKey: !!hit.hasApiKey,
      identifier: hit.identifier ? String(hit.identifier).slice(0, 200) : null,
      path: hit.path ? String(hit.path).slice(0, 1000) : null,
      query: hit.query ?? null,
      timestamp: new Date(hit.timestamp || Date.now()),
    }).then(undefined, () => { /* swallow — diagnostics must not crash requests */ });
  } catch {
    /* swallow — diagnostics must not crash requests */
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

// ---------- Persistent (DB-backed) accessors ----------

function toDate(value: Date | string | number | null | undefined): Date | null {
  if (value === null || value === undefined) return null;
  if (value instanceof Date) return value;
  const d = new Date(value);
  return Number.isNaN(d.getTime()) ? null : d;
}

function rowToHit(row: typeof hmsActivityLog.$inferSelect): HmsHit {
  const ts = toDate(row.timestamp) ?? new Date();
  const query = row.query && typeof row.query === "object" && !Array.isArray(row.query)
    ? (row.query as Record<string, string>)
    : undefined;
  return {
    timestamp: ts.toISOString(),
    method: row.method,
    route: row.route,
    path: row.path || row.route,
    status: row.status,
    durationMs: row.latencyMs,
    ip: row.ip || undefined,
    identifier: row.identifier || undefined,
    query,
    userAgent: row.userAgent || undefined,
    hasApiKey: !!row.hasApiKey,
  };
}

export async function getRecentHitsFromDb(limit = 100): Promise<HmsHit[]> {
  const cap = Math.max(1, Math.min(limit, 500));
  const rows = await db
    .select()
    .from(hmsActivityLog)
    .orderBy(desc(hmsActivityLog.timestamp))
    .limit(cap);
  return rows.map(rowToHit);
}

export async function getLastHitsByRoute(routes: string[]): Promise<Record<string, { timestamp: string; status: number } | null>> {
  const out: Record<string, { timestamp: string; status: number } | null> = {};
  for (const r of routes) out[r] = null;
  if (routes.length === 0) return out;
  // One indexed query per route — keeps the query simple and avoids
  // window-function complexity. Routes list is tiny (<20).
  await Promise.all(routes.map(async (r) => {
    try {
      const [row] = await db
        .select({ timestamp: hmsActivityLog.timestamp, status: hmsActivityLog.status })
        .from(hmsActivityLog)
        .where(eq(hmsActivityLog.route, r))
        .orderBy(desc(hmsActivityLog.timestamp))
        .limit(1);
      const ts = row ? toDate(row.timestamp) : null;
      if (row && ts) {
        out[r] = { timestamp: ts.toISOString(), status: row.status };
      }
    } catch {
      /* leave null on error */
    }
  }));
  return out;
}

export async function pruneOldHmsActivity(olderThan: Date): Promise<number> {
  const result = await db
    .delete(hmsActivityLog)
    .where(lt(hmsActivityLog.timestamp, olderThan))
    .returning({ id: hmsActivityLog.id });
  return result.length;
}

export async function getDbStats(): Promise<{ total: number; oldest: string | null }> {
  const [row] = await db
    .select({
      total: sql<number>`count(*)::int`,
      oldest: sql<Date | string | null>`min(${hmsActivityLog.timestamp})`,
    })
    .from(hmsActivityLog);
  const oldest = toDate(row?.oldest ?? null);
  return {
    total: Number(row?.total ?? 0),
    oldest: oldest ? oldest.toISOString() : null,
  };
}
