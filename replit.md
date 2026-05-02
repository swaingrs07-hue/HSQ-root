# Hsquareliving - Student Accommodation Management System

## Overview
Hsquareliving is a full-stack hostel and student living management application designed to modernize student accommodation management for "Hsquareliving Pvt Ltd." It streamlines property discovery, room selection, registration, flexible payments, and digital agreement signing. The platform provides a seamless experience for students and an efficient admin dashboard for property, student, and financial oversight.

## User Preferences
Preferred communication style: Simple, everyday language.

## System Architecture

### Frontend
-   **Framework**: React with TypeScript and Vite.
-   **UI/UX**: shadcn/ui built on Radix UI, styled with Tailwind CSS, featuring a dark 3D immersive homepage with optimized particle backgrounds, glassmorphism cards, animated elements, and scroll-triggered Framer Motion animations.
-   **Performance**: Utilizes image lazy loading, async decoding, thumbnail windowing, word-level text animations, and immutable cache headers.
-   **State Management**: TanStack React Query.
-   **Forms**: React Hook Form with Zod validation.

### Backend
-   **Runtime**: Node.js with Express 5.x.
-   **Language**: TypeScript with ES modules.
-   **API Design**: RESTful endpoints.

### Data Storage
-   **Database**: PostgreSQL with Drizzle ORM.
-   **Key Entities**: Users, students, properties, rooms, bookings, payments, audit logs, leads, sales activities, packages, registration requests.

### Authentication & Authorization
-   **Roles**: "user", "admin", "superadmin", "manager", "staff", "sales_executive", "receptionist".
-   **Security**: Hashed passwords, role-based access control.

### Core Features
-   **Living Archive**: 3D housing-plans hallway on the homepage with interactive property plan frames.
-   **Student & Property Management**: Tools for managing properties, rooms, students, and bookings.
-   **Payment & Booking System**: Flexible payment options, digital agreement signing, and booking management.
-   **Admin Dashboard**: Centralized platform for comprehensive oversight.
-   **Sales & Lead Management**: Sales Executive Panel with lead sourcing, assignment, activity logging, follow-up systems, Kanban Requests Board, and Lead Scoring.
-   **Virtual Property Tour & Bed Booking**: Interactive floor/room/bed selection with duplicate booking prevention.
-   **Booking Tree**: Hierarchical view of property, floor, room, and bed statuses.
-   **Housing Plans & Services**: Management of property-specific housing plans, add-on, and included services.
-   **Season/Batch CRM Module**: Academic season/batch management, resident status tracking, and "End Season" flow.
-   **HMS Property Sync**: Integration with an external Hostel Management System for property linking and bidirectional synchronization.
-   **Package Upgrade System**: Allows upgrading booking packages with price calculation and history tracking.
-   **Homepage Customization**: Admin controls for hero video slides, amenities, and logos.
-   **Wallet Credit Auto-Renewal**: Automated monthly renewal of wallet credits.
-   **Gyan AI Chatbot**: AI chatbot powered by OpenAI GPT-4o-mini, integrated with live HMS data.
-   **Target & Achievement Dashboard**: Admin-only CRM tab for sales targets vs achievements.
-   **Public Registration Form**: Shareable `/apply` page for pre-registration with admin review workflow.
-   **Property URL Slugs**: Human-readable URL slugs for properties to improve SEO.
-   **SEO Foundations**: Dynamic sitemap, JSON-LD, Open Graph/Twitter Card tags, and server-side meta tag injection for public pages.
-   **Sales Lead Visibility Scoping**: Sales executives see leads and properties based on their assignments.
-   **Receptionist Property Scoping**: Admins assign properties to receptionists via the Sales Management → Receptionists tab (reusing the `sales_exec_properties` junction). Scoped receptionists only see their assigned properties in dropdowns and only access bookings/registrations/registration-requests/booking-tree/floors-beds for those properties; receptionists with zero assignments see everything (backward compat).
-   **Lead-to-Booking Attribution Chain**: Full attribution tracking from lead creation through booking completion.
-   **Lead Assignment Notifications**: In-app notifications for sales executives regarding lead assignments.
-   **Calendar Device Sync**: Live iCal subscription feed for sales executive follow-ups and site visits.
-   **Follow-up Email Reminders**: Background job for email reminders to sales executives for upcoming follow-ups.
-   **Per-Floor Gender Restriction**: Floors can be marked for specific genders, blocking cross-gender bed allocations.
-   **Per-Room / Per-Section Pricing Overrides**: Allows different pricing for rooms or sections within the same typology.
-   **Property Brochure Downloads**: On-demand PDF and PowerPoint generation for property brochures.
-   **Persistent Tubes Background Across Navigation**: Reuses the Three.js WebGL background across SPA navigations for performance.
-   **Canonical Host Redirect**: Consolidates multiple domains to a single canonical apex (`hsquare.in`) for SEO.
-   **HSQUARE LIVING Animated Splash**: First-load splash on the homepage with gradient "HSQUARE LIVING" headline, animated 0%->100% counter, magenta/cyan progress bar, 1.4s zoom-in exit. Covers real hero load time (hero `<video>` `canplay` + Three.js Tubes background ready), with a 2s minimum hold and 10s safety cap. Honors `prefers-reduced-motion` (skipped), shown once per tab session via a module-level flag, and rendered through `createPortal` to escape the `<main>` z-10 stacking context so it covers the fixed header.
-   **Hero Video Pipeline Smoothness**: Every hero-video slide always renders a visible poster image (active slide's `image_url` → first published property's `image_url` → baked-in dark-gradient SVG fallback) so the hero is never black behind the splash, even when the admin-set slide has no `image_url`. The `<video>` uses `preload="metadata"` (not `"auto"`) so it doesn't greedily download the full MP4 in parallel with the slide API, Tubes WebGL init, fonts, and splash. Signed object-storage URLs for every slide are pre-warmed in parallel (cap 3 concurrent) the moment `/api/hero-slides` returns, and a `signedUrlInFlight` ref-map deduplicates concurrent fetches so the active-slide resolver and the prewarm pump never double-fetch the same object path. Video event listeners (`canplay`/`loadeddata`/`error`) are attached BEFORE `video.src` is set and `video.load()` is called — otherwise an immediate sync/microtask error event can fire before the listener attaches, leaving `video.error` set with nobody to react to it. We deliberately do NOT call `video.play()` ourselves after `load()`; the `autoPlay` attribute handles initial playback so we don't race with the browser's own autoplay logic and produce spurious aborted-play errors. The failsafe is **progressive, not one-shot**: at 12s we re-check `video.error`/`readyState`/`networkState` once, then poll every 4s for buffered-end progress; we give up after 2 consecutive idle windows OR a 30s hard cap, so users on truly slow networks aren't stuck on a poster forever and we never deadlock in "video mode but never ready". The playback-quality watchdog skips the first 4s after `canplay` (decoder warm-up) and now requires `>40 dropped frames AND >15% drop rate AND ≥3 consecutive bad windows` before flipping to the static fallback (was `>20 AND >10% AND ≥2`), so it no longer fires on warm-up and read to users as "the video hangs". The bottom-feather alpha mask is deferred from the `<video>` until the placeholder `<img>` unmounts (now 500ms post `canplay`, aligned with the placeholder's `transition-opacity duration-500` — was 800ms which left a ~300ms unmasked window where the bottom of the hero showed a hard edge). `console.debug('[hero-video] …')` breadcrumbs at every state branch (`slide-picked`, `signed-url-prewarmed`, `signed-url-cache-hit`, `signed-url-ok`, `signed-url-fail`, `canplay`, `failsafe-fired keep-waiting / readyState>=2 / fallback-shown video-error+code / no-source / no-progress / hard-cap`, `quality-watchdog-fired`, `fallback-shown …`) make future "hero hangs" reports triageable from devtools at a glance. Note: the original hero MP4 in object storage had a 6KB C2PA content-credentials UUID box (`d8fe c3d6 1b0e 483c 9297 5828 877e c481`) right after `ftyp` that crashed Chrome's decoder with `MEDIA_ERR_SRC_NOT_SUPPORTED` (code 4). Task #144 re-exported the MP4 with `ffmpeg -map_metadata -1 -movflags +faststart -c copy` (strips C2PA, also moves `moov` to the front for progressive playback), uploaded it as a new private object, and pointed the active `hero_slides` row at it. The active video is now `/objects/uploads/7ced44a0-5fb4-4329-831c-5889424d8af8` (atom layout: `ftyp / moov / free / mdat`, no C2PA markers anywhere). The original broken object `/objects/uploads/4a07bb84-6ffb-4f8a-a8f7-61b274fa4810` is left intact in storage for audit.

### Production incident — 2026-04-30
-   The deployment was returning Replit's generic load-balancer 500 page on `hsquare.in` even though the Node app booted cleanly (admin-user verification, background jobs, request handling all visible in deployment logs). Root cause: the canonical-host redirect middleware in `server/index.ts` was 301-redirecting Replit's autoscale health probes — which hit the container at `127.0.0.1:5000/` — to `https://hsquare.in/`. The probe expects `2xx`, got a `301`, every instance was marked unhealthy, and the load balancer served its generic 500 page. Telltale signature: deployment logs show a flood of `[canonical-redirect] 301 GET 127.0.0.1/ -> https://hsquare.in/` lines.
-   Fix: extended the safelist in the canonical-redirect middleware so `127.0.0.1`, `::1`, and `[::1]` are passed straight through to the route handlers (alongside the existing `localhost`, `*.replit.app`, `*.replit.dev`, and dotless-host entries). SEO behaviour for real cross-domain traffic is unchanged.
-   Debug guide for any future load-balancer 500 page: if deployment logs show a flood of `[canonical-redirect] 301 ... 127.0.0.1 ...` lines, the canonical-host middleware safelist has regressed — investigate it first. If deployment logs are silent or end immediately after process start, the Node process is failing to listen — verify `JWT_SECRET` / `SESSION_SECRET` are set in the deployment environment (`server/auth.ts` throws at module load when both are missing in production).

## External Dependencies

### Database
-   **PostgreSQL**: Primary data store.
-   **Drizzle ORM**: Type-safe database queries.

### Payment
-   **Razorpay**: For Indian payment methods.

### UI Libraries & Tools
-   **Radix UI**: Headless component primitives.
-   **shadcn/ui**: Pre-built UI components.
-   **Framer Motion**: Animations.
-   **react-signature-canvas**: Digital signature capture.

### Integrations
-   **Instagram Graph API**: For Instagram feed integration.
-   **OpenAI GPT-4o-mini**: For the Gyan AI Chatbot.
-   **Hostel Management System (HMS)**: External system for property and booking synchronization.
-   **Resend**: Email delivery service.