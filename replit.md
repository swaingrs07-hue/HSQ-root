# Hsquareliving - Student Accommodation Management System

## Overview
Hsquareliving is a full-stack application designed to modernize student accommodation management for "Hsquareliving Pvt Ltd." It aims to streamline property discovery, room selection, registration, flexible payments, and digital agreement signing. It provides a seamless experience for students and an efficient admin dashboard for comprehensive oversight. Key capabilities include sales and lead management, virtual property tours, and integration with an external Hostel Management System. The project's vision is to enhance efficiency, user experience, and overall management for student accommodations.

## User Preferences
Preferred communication style: Simple, everyday language.

## System Architecture

### Frontend
-   **Framework**: React with TypeScript and Vite.
-   **UI/UX**: shadcn/ui built on Radix UI, styled with Tailwind CSS, featuring a dark 3D immersive homepage with optimized particle backgrounds, glassmorphism cards, animated elements, and scroll-triggered Framer Motion animations. Performance optimizations include image lazy loading and async decoding.
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
-   **Roles**: "user", "admin", "superadmin", "manager", "staff", "sales_executive", "receptionist", "hotel_admin", "hotel_staff".
-   **Security**: Hashed passwords, role-based access control.

### Core Features
-   **Property & Student Management**: Tools for managing properties, rooms, students, and bookings.
-   **Payment & Booking System**: Flexible payment options, digital agreement signing, and booking management.
-   **Admin Dashboard**: Centralized platform for comprehensive oversight.
-   **Sales & Lead Management**: Sales Executive Panel with lead sourcing, assignment, activity logging, follow-up systems, Kanban Requests Board, and Lead Scoring.
-   **Virtual Property Tour & Bed Booking**: Interactive floor/room/bed selection with duplicate booking prevention and a hierarchical booking tree view.
-   **Housing Plans & Services**: Management of property-specific housing plans and services.
-   **Season/Batch CRM Module**: Academic season/batch management and resident status tracking.
-   **HMS Property Sync**: Bidirectional synchronization with an external Hostel Management System.
-   **Package Upgrade System**: Allows upgrading booking packages with price calculation.
-   **Gyan AI Chatbot**: AI chatbot powered by OpenAI GPT-4o-mini, integrated with live HMS data.
-   **Public Registration Form**: Shareable `/apply` page for pre-registration with admin review.
-   **SEO**: Human-readable URL slugs, dynamic sitemap, JSON-LD, Open Graph/Twitter Card tags, and server-side meta tag injection.
-   **Scoped Access**: Sales executives and receptionists have property-specific visibility based on assignments.
-   **Calendar & Email Integration**: iCal subscription for follow-ups and email reminders for sales executives.
-   **Property Rules**: Per-floor gender restriction and per-room/section pricing overrides.
-   **Property Brochures**: On-demand PDF and PowerPoint generation.
-   **Hotels Module (`/hotels/*`)**: A separate luxury Valora-style guest portal that lives alongside the hostel app and reuses the existing `properties` table (filtered by `category="hotel"`), `roomTypes`, `bookings`, and `payments` — no duplicate entities. Includes:
    - Floating glassmorphism "Switch to Hotels" pill in the main app navbar (always visible, gold #c5a059) and a back-link in the Hotels mobile menu.
    - `/hotels` Valora-style landing (parallax hero, glass booking bar, experience/dining splits, 3-card featured rooms with elevated middle, oversized "HSQUARE" CTA).
    - `/hotels/rooms` filterable room grid (search, location, max-price slider).
    - `/hotels/rooms/:slug` property detail with selectable room types — "Reserve" CTA hands off to the existing `/properties/:slug` booking flow (agreements + Razorpay) so the guest journey stays consistent.
    - `/hotels/dashboard` is role-aware: `admin`/`superadmin`/`hotel_admin` see a 4-tab admin (overview, bookings, rooms, housekeeping) with stat cards (today's check-ins, occupancy %, 30-day revenue, pending housekeeping) and a "New Task" modal. `hotel_staff` see a personal shift view limited to their assigned housekeeping tasks plus their own check-in/out counts.
    - Backend: new `housekeepingTasks` table + `housekeeping_task_status/type/priority` enums. New endpoints: `GET/POST/PATCH/DELETE /api/housekeeping/tasks` (staff scoped to their own tasks server-side via `assignedTo` injection) and `GET /api/hotels/dashboard-stats` (aggregates check-ins, occupancy from `beds`, last-30d revenue from `payments`, pending housekeeping count — all scoped to hotel-category property IDs).
    - New roles `hotel_admin` and `hotel_staff` redirect to `/hotels/dashboard` on login. Routing in `App.tsx` mounts everything under `/hotels` inside `HotelsLayout`, completely bypassing the main `Layout` and `AdminLayout` so the luxury aesthetic stays isolated.
-   **Homepage Enhancements**: Animated splash screen, optimized hero video pipeline with server-side transcoding, and a card-swipe hero where the sticky hero is covered by the next section while the global iridescent tubes layer (driven by `--tubes-reveal-opacity` CSS variable) stays hidden through the swipe and fades in from the "Why Choose" section onward. On small viewports (`<768px`) and for `prefers-reduced-motion` users, the hero falls back to `position: relative` with an IntersectionObserver hard-switch on `--tubes-reveal-opacity` instead of a sticky pin + scroll-tied fade — this avoids visible jumps caused by Android Chrome / iOS Safari URL-bar resize changing `window.innerHeight` mid-scroll (Task #148). The hero handoff itself is fully compositor-driven (Task #149): the desktop scroll handler writes three CSS custom properties on `documentElement` (`--hero-handoff-cover` for hero opacity, `--hero-handoff-post-cover` for the stats-bg crossfade, and `--tubes-reveal-opacity` for the tubes ramp) instead of triggering a React re-render per scroll tick. The hero hides via `opacity: 0` (compositor-only, no main-thread paint invalidation like `visibility: hidden` would cause), the stats section's bg crossfades from opaque `#050505` to `#050505` at alpha 0.4 only AFTER the hero is hidden, and the tubes ramp in behind that still-opaque stats card — guaranteeing the three writes can never disagree on a single paint frame on Windows-Chrome. The post-hero wrapper has a `bg-[#050505]` safety floor so even a worst-case sub-pixel mis-sync shows the page background instead of a black band or hero leak.

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