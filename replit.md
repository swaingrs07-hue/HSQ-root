# Hsquareliving - Student Accommodation Management System

## Overview
Hsquareliving is a full-stack hostel and student living management application for "Hsquareliving Pvt Ltd." It aims to modernize student accommodation by streamlining property discovery, room selection, registration, flexible payments, and digital agreement signing. The platform includes a comprehensive admin dashboard for property, student, and financial oversight, offering a seamless experience for students and efficient operations for property managers.

## User Preferences
Preferred communication style: Simple, everyday language.

## System Architecture

### Frontend
-   **Framework**: React with TypeScript, using Vite.
-   **UI/UX**: shadcn/ui built on Radix UI, styled with Tailwind CSS. Features a premium dark 3D immersive homepage (`bg-[#0a0a0a]`) with optimized canvas particle backgrounds (frame-skipping, reduced particle counts), glassmorphism cards, animated counters, gradient glow dividers, and scroll-triggered Framer Motion animations. Consistent dark themes for all user-facing pages.
-   **Performance**: Image lazy loading via IntersectionObserver (`LazyImage` component in property-booking.tsx), `decoding="async"` on images, thumbnail windowing (only renders thumbnails near current index), word-level text animations instead of per-character, 30-day immutable cache headers for images, simplified particle system (no radial gradients/shooting stars/aurora per frame).
-   **State Management**: TanStack React Query.
-   **Forms**: React Hook Form with Zod validation.

### Backend
-   **Runtime**: Node.js with Express 5.x.
-   **Language**: TypeScript with ES modules.
-   **API Design**: RESTful endpoints under `/api`.

### Data Storage
-   **Database**: PostgreSQL with Drizzle ORM.
-   **Key Entities**: Users, students, properties, rooms, bookings, payments, audit logs, leads, sales activities, packages, registration requests.

### Authentication & Authorization
-   **Roles**: "user", "admin", "superadmin", "manager", "staff", "sales_executive", "receptionist".
-   **Security**: Hashed passwords, role-based access control.
-   **Superadmin Role**: Full admin access plus exclusive abilities: cross-room-type bed shifting. `roleMiddleware` auto-includes `superadmin` whenever `admin` is allowed. `gyan@hsquareliving.com` is seeded as superadmin.
-   **Receptionist Role**: Limited admin access focused on bookings, requests, registrations, calendar, floors & beds, and booking tree, without access to financial data or system configuration.

### Core Features
-   **Student & Property Management**: Tools for managing properties, rooms, students, and their bookings.
-   **Payment & Booking System**: Flexible payment options, digital agreement signing, and comprehensive booking management.
-   **Admin Dashboard**: Centralized platform for property, student, and financial oversight.
-   **Sales & Lead Management**: Sales Executive Panel with lead sourcing, assignment, activity logging, follow-up systems, Kanban Requests Board, and Lead Scoring.
-   **Virtual Property Tour & Bed Booking**: Interactive floor/room/bed selection, plan assignment, and duplicate booking prevention.
-   **Booking Tree**: Hierarchical view of property, floor, room, and bed with live booking status.
-   **Housing Plans & Services**: Management of property-specific housing plans (tiers), add-on services, and included services with detailed configurations.
-   **Season/Batch CRM Module**: Management of academic seasons/batches, resident status tracking, and "End Season" flow.
-   **HMS Property Sync**: Integration with an external Hostel Management System for property linking, auto-matching, and bidirectional booking/resident synchronization.
-   **Package Upgrade System**: Allows upgrading booking packages with price calculation and history tracking.
-   **Homepage Customization**: Admin controls for hero video slides, amenities, and logos.
-   **Wallet Credit Auto-Renewal**: Automated monthly renewal of à la carte wallet credits.
-   **Gyan AI Chatbot**: AI chatbot powered by OpenAI GPT-4o-mini, integrated with live HMS data.
-   **Target & Achievement Dashboard**: Admin-only CRM tab for property-wise sales targets vs achievements, with KPIs, progress bars, and charts.
-   **Public Registration Form**: Shareable `/apply` page for pre-registration; admin review and proceed-to-booking workflow at `/admin/registrations`.
-   **Property URL Slugs**: Human-readable URL slugs for properties (e.g., `/properties/hsquare-bayview` instead of UUIDs). Auto-generated on creation with duplicate protection. Used in sitemap, canonical URLs, JSON-LD, and all frontend links.
-   **SEO Foundations**: Dynamic sitemap, JSON-LD, Open Graph/Twitter Card tags, keyword-rich content, and server-side meta tag injection (`server/seo-meta.ts`) for all public pages to ensure Google crawls unique title/description/canonical per route.
-   **Sales Lead Visibility Scoping**: Sales execs only see their assigned properties in the property switcher (via `/api/sales/properties`). Leads are scoped to assigned properties. "Lead by [name]" attribution shown on admin and sales lead views. Leads have `createdBy` field tracking who created them.
-   **Lead-to-Booking Attribution Chain**: Full attribution tracking from lead creation through booking completion. Real-time lead matching by phone/email during walk-in booking (via `/api/leads/match`). Auto-links leads to bookings with `linkedBookingId`. Tracks `convertedByUserId` (who initiated booking) and `confirmedBy` (who confirmed). Shows "Lead by", "Booking by", and "Confirmed by" attribution labels in admin and sales views. Lead status auto-updates on booking confirmation (`converted`) and cancellation (`lost`).
-   **Lead Assignment Notifications**: In-app notifications for sales executives across all lead creation/assignment paths (website leads, tour enquiries, manual creation, admin assign/reassign, bulk assign). Admins notified of new website/enquiry leads.
-   **Calendar Device Sync**: Live iCal subscription feed (`/api/calendar/feed/:userId/:token`) with HMAC token auth. Sales execs subscribe once in Google Calendar, Apple Calendar, or any iCal client to auto-sync all follow-ups and site visits with 30-min and 10-min VALARM reminders. "Sync to Device" UI panel on calendar page.
-   **Follow-up Email Reminders**: Background job sends email reminders (via Resend) to sales executives when follow-ups are due within the next hour, with lead details table and direct calendar link.
-   **Per-Floor Gender Restriction**: Floors can be marked Any / Male only / Female only (`floors.gender`). Cross-gender bed allocation is blocked at the API in `POST /api/bookings/generate`, `POST /api/admin/bookings/:id/shift-bed`, and `POST /api/admin/beds/:id/allocate` via `assertGenderCompatible(bedId, guestGender)`. All beds remain visible everywhere; mismatched-gender beds are greyed/disabled with explanatory tooltips. Public booking page (`property-booking.tsx`) shows a Male/Female chip selector before allowing bed picking when the property has any gender-restricted floors; selection is persisted to `localStorage.booking_guest_gender` and pre-fills `residentGender` on `/booking/generate`. Admin UI in `admin-floors-beds.tsx` adds a gender Select to the Add Floor dialog and a new Edit Floor dialog (with gender + name + floor number), plus blue/pink badges on floor cards. PATCH `/api/admin/floors/:id` (admin only) updates floor gender/name/number.
-   **Per-Room / Per-Section Pricing Overrides**: Same-typology rooms can carry different prices based on washroom attachment or any other reason. Pricing precedence (resolved by `shared/pricing.ts` → `resolveRoomPrice()`): per-section override (combo rooms) > per-room override (`rooms.basePriceOverride` / `academicYearPriceOverride` / `depositOverride`, plus legacy `rooms.monthlyPrice`) > room-type Shared-WC variant (`roomTypes.basePriceShared` / `academicYearPriceShared` / `depositShared`, used when the resolved section is shared) > room-type default (`roomTypes.basePrice` / `academicYearPrice` / `deposit`). Combo-room sections are derived from typology positions A/B/C... and stored in `rooms.sectionPriceOverrides` (jsonb). Admin UI: Room Types form on `/admin` ("Shared WC pricing" amber subsection) for room-type variants, and `/admin/floors-beds` Room card "Set pricing" / "Pricing override" pill opens a dialog for whole-room and per-section overrides. Public booking page (`property-booking.tsx`) uses the resolver via `priceForBookingMode()` so the price shown to the resident depends on which bed they pick.
-   **Property Brochure Downloads**: On-demand PDF (landscape A4, Arvane-inspired editorial layout — large serif headlines with italic accent word, photography on the right with rounded-corner clipping via `saveGraphicsState`/`clip`/`restoreGraphicsState`, floating fact cards, dark CTA pill) and PowerPoint generation per property (`server/property-collateral.ts`) using jsPDF + pptxgenjs with luxury palette (cream/charcoal/taupe/gold). Authenticated endpoint `GET /api/properties/:id/download/:format` (id can be UUID or slug, format `pdf`|`pptx`). Reusable `<PropertyBrochureButtons>` component (panel/compact/row variants) with auth-gating via `useAuthGuard` — opens login modal if user is not signed in. Integrated on property detail pages only (panel above main grid). The homepage "Property Resources" grid was removed for performance.
-   **Persistent Tubes Background Across Navigation**: The iridescent Three.js WebGL "tubes" cursor background (`TubesCursorBackground` from `client/src/components/tubes-cursor-background.tsx`, loaded from CDN `tubes1.min.js`) is mounted ONCE inside `Layout` (`client/src/components/layout.tsx`) and exposed to children via `TubesContext` (`client/src/contexts/tubes-context.tsx` with `useTubesActive()` hook). Because `Layout` wraps all public routes via wouter and is never unmounted on route change, the canvas DOM node and its WebGL context are reused across every SPA navigation — no more re-loading the CDN script or re-initializing the WebGL context when clicking Properties / Contact / etc. Activation is deferred via `requestIdleCallback` after `window.load` (1.5s desktop / 3.5s mobile post-LCP), with a hard ceiling fallback (3.5s desktop / 6s mobile from Layout mount) so heavy pages still get the background. Per-page local mounts in `home.tsx` (`TubesCursorBackgroundLazy`) and `apply.tsx` (`TubesLayer`) were removed; both pages now read `useTubesActive()` for any conditional UI and let the global canvas show through (their wrapper `bg-[#050505]` was dropped — Layout's outer div already provides the dark fallback). Layout root carries `data-testid="layout-root"` for e2e persistence assertions.
-   **Canonical Host Redirect**: All four linked domains (`hsquare.in`, `www.hsquare.in`, `hsquareliving.com`, `www.hsquareliving.com`) collapse to a single canonical apex `hsquare.in` so Google doesn't see duplicate content. Shared resolver in `server/canonical-host.ts` exports `resolveCanonicalApex()` and a cached `CANONICAL_APEX` (reads `APP_PUBLIC_URL`, falls back to `hsquare.in`, forgiving of port/path/www/whitespace). Middleware in `server/index.ts` 301-redirects any non-canonical hostname to the canonical apex with path+query preserved (GET/HEAD → 301, other methods → 308 per RFC 7538). Localhost and `*.replit.app`/`*.replit.dev` preview hosts are exempt so dev/staging keep working. The Domain Canonicality card on `/admin/hms-health` (superadmin) actively HEAD-probes each non-canonical hostname (5s timeout, parallel) and reports `tls_ok_redirect` / `tls_failed` / `no_redirect` / `redirect_wrong_target` per row with remediation hints. Probe list lives in one constant inside `/api/admin/hms-health/status` for easy extension.

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
-   **Resend**: Email delivery service for automated booking confirmations and receipts.