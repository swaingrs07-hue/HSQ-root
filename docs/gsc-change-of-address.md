# Google Search Console — Change of Address: hsquareliving.com → hsquare.in

## Why this exists
The site moved from `hsquareliving.com` to `hsquare.in`. The server already
301-redirects every visit on the old domain (and its `www` variant) to the
equivalent path on the new domain — see `server/canonical-host.ts` and the
canonical-host middleware in `server/index.ts`.

The redirect is the technical half. The other half is telling Google so it
consolidates ranking signals onto the new domain instead of splitting authority
between two URLs that serve identical content. The fastest way to do that is
the **Change of address** tool in Google Search Console (GSC). Google then
migrates rankings within roughly a few weeks.

## Prerequisites
- A Google account that has **Owner** access on both GSC properties (not just
  "Full user" — the Change of address tool requires Owner).
- Both source and destination already exist as **verified** properties in GSC:
  - `hsquareliving.com` (Domain property — covers `www` and non-`www`)
  - `hsquare.in`        (Domain property — covers `www` and non-`www`)
  - If they were added as **URL-prefix** properties instead, then `www`
    variants are tracked separately and the Change of address must also be
    repeated for the `www.hsquareliving.com` → `www.hsquare.in` pair.
- The 301 redirect from `hsquareliving.com` to `hsquare.in` is live in
  production. Confirm with:
  ```
  curl -I https://hsquareliving.com/
  curl -I https://www.hsquareliving.com/
  ```
  Both should return `HTTP/2 301` with `location: https://hsquare.in/`.
  (The Domain Canonicality card on `/admin/hms-health` also probes this.)

## Procedure

1. Sign in to https://search.google.com/search-console with an Owner account.
2. From the property switcher (top-left), select **`hsquareliving.com`** — the
   OLD property. The Change of address tool lives on the *source* property,
   not the destination.
3. Click the gear/cog icon → **Settings** → **Change of address**.
4. Under "Step 1: Select the new site", pick **`hsquare.in`** from the
   dropdown of verified properties you own.
5. Click **Validate** under "Step 2: Confirm 301 redirect". Google will fetch
   `https://hsquareliving.com/` and assert it returns a 301 to `hsquare.in`.
   If validation fails, re-run the curl checks above first.
6. Click **Validate** under "Step 3: Confirm verification of new site". This
   just re-checks that you still own the destination property.
7. Click **Confirm move**. Google will start showing a notice on the old
   property and begin migrating rankings.
8. **Repeat for `www` URL-prefix properties if applicable.** If GSC lists
   `www.hsquareliving.com` and/or `www.hsquare.in` as separate URL-prefix
   properties (rather than rolled into Domain properties), redo steps 2–7
   pointing `www.hsquareliving.com` → `www.hsquare.in`.
9. **Submit the new sitemap.** Switch to the `hsquare.in` property →
   **Sitemaps** in the left nav → enter `sitemap.xml` → **Submit**. Full URL
   is `https://hsquare.in/sitemap.xml` (served by `server/routes.ts`).
10. Record the date below.

## Filing log

- Change of address filed on: _YYYY-MM-DD — fill in once submitted_
- Filed by: _name / email of the GSC Owner who clicked Confirm move_
- Sitemap submitted under hsquare.in on: _YYYY-MM-DD_
- Expected migration window: ~2–4 weeks after filing. Old hsquareliving.com
  results should gradually be replaced by hsquare.in results in Google search.
  No action required during the wait — keep the 301 live indefinitely.

## Out of scope (explicitly do NOT do)
- Do **not** repoint or remove email/MX records on `hsquareliving.com`.
  Mail to `@hsquareliving.com` must keep working.
- Do **not** let the `hsquareliving.com` domain registration lapse. The 301
  only works as long as we own the domain — keep paying renewals
  indefinitely so the redirect (and therefore the Change of address signal)
  keeps flowing.

## Related code
- `server/canonical-host.ts` — single source of truth for the canonical apex.
- `server/index.ts` — canonical-host redirect middleware (the thing GSC probes
  during validation in step 5).
- `server/routes.ts` — `/sitemap.xml` and `/robots.txt` endpoints.
- `/admin/hms-health` (superadmin) — Domain Canonicality card actively probes
  every non-canonical hostname and reports redirect health, useful for
  diagnosing GSC validation failures.
