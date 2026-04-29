// Single source of truth for our canonical apex hostname.
// SEO best practice: serve the site from one canonical hostname so Google
// doesn't see duplicate content across the four linked domains
// (hsquare.in, www.hsquare.in, hsquareliving.com, www.hsquareliving.com).
// Both the canonical-host redirect middleware (server/index.ts) AND the
// HMS health diagnostic (server/routes.ts) read this resolver so they
// always agree on what "canonical" means.

const FALLBACK_APEX = "hsquare.in";

/**
 * Resolve the canonical apex hostname from APP_PUBLIC_URL.
 *
 * Forgiving on input (accepts any of these and returns "hsquare.in"):
 *   "https://hsquare.in"
 *   "https://hsquare.in/"
 *   "https://www.hsquare.in"
 *   "  HTTPS://HSquare.IN/foo  "
 *   "hsquare.in"
 *   "https://hsquare.in:443"
 *
 * Never returns an empty string, never returns a value containing a port,
 * scheme, path, or whitespace. If parsing fails for any reason it
 * silently falls back to "hsquare.in" so the redirect middleware can't
 * be put into a broken state by a malformed env var.
 */
export function resolveCanonicalApex(rawEnvValue?: string | null): string {
  const raw = (rawEnvValue ?? "").trim();
  if (!raw) return FALLBACK_APEX;

  // Try strict URL parsing first — handles ports, paths, userinfo cleanly.
  try {
    const withScheme = /^https?:\/\//i.test(raw) ? raw : `https://${raw}`;
    const url = new URL(withScheme);
    const host = url.hostname.toLowerCase();
    if (!host || !host.includes(".")) return FALLBACK_APEX;
    return host.startsWith("www.") ? host.slice(4) : host;
  } catch {
    // Fall through to the manual stripper for anything URL can't parse.
  }

  // Manual fallback: lowercase, strip scheme, strip path, strip port,
  // strip leading www., reject empty / dot-less results.
  const host = raw
    .replace(/^https?:\/\//i, "")
    .replace(/\/.*$/, "")
    .replace(/:\d+$/, "")
    .toLowerCase();
  if (!host || !host.includes(".")) return FALLBACK_APEX;
  return host.startsWith("www.") ? host.slice(4) : host;
}

/** Cached at process boot — env vars don't change at runtime. */
export const CANONICAL_APEX = resolveCanonicalApex(process.env.APP_PUBLIC_URL);
