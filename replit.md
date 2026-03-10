# Hsquareliving - Student Accommodation Management System

## Overview
Hsquareliving is a full-stack hostel and student living management application for "Hsquareliving Pvt Ltd". It aims to streamline student accommodation from property discovery and room selection to registration, flexible payments, and digital agreement signing. The platform includes a comprehensive admin dashboard for property, student, and financial oversight. The business vision is to modernize student living management, offering a seamless experience for students and efficient operations for property managers, with significant market potential in the student housing sector.

## User Preferences
Preferred communication style: Simple, everyday language.

## System Architecture

### Frontend
- **Framework**: React with TypeScript, using Vite.
- **Routing**: Wouter.
- **State Management**: TanStack React Query.
- **UI Components**: shadcn/ui built on Radix UI, styled with Tailwind CSS, custom design tokens, and CSS variables.
- **Typography**: Inter (body) and Manrope (headings).
- **Animations**: Framer Motion, custom canvas-based particle effects.
- **Homepage Theme**: Premium dark 3D immersive design (`bg-[#0a0a0a]`) with canvas particle backgrounds, glassmorphism cards, animated counters, gradient glow dividers, and scroll-triggered Framer Motion animations. Particle system supports `hero`, `section`, and `sparse` presets with IntersectionObserver-based pause for performance and `prefers-reduced-motion` support.
- **Forms**: React Hook Form with Zod validation.

### Backend
- **Runtime**: Node.js with Express 5.x.
- **Language**: TypeScript with ES modules.
- **API Design**: RESTful endpoints under `/api`.
- **Build System**: Custom esbuild for server, Vite for client.

### Data Storage
- **Database**: PostgreSQL with Drizzle ORM.
- **Schema**: Defined in `shared/schema.ts`, managed with Drizzle Kit migrations.
- **Key Entities**: Users, students, properties, rooms, bookings, payments, audit logs, leads, sales activities, packages.

### Authentication & Authorization
- **Roles**: "user", "admin", "sales_executive", "student".
- **Session Management**: Express sessions with `connect-pg-simple`.
- **Security**: Hashed passwords.
- **Access Control**: Role-based via frontend route protection and backend middleware.

### Core Features
- **Sales Executive Panel**: Admin functions for sales executive and lead management, including lead sourcing, assignment, activity logging, follow-up systems, and deal closure.
- **Kanban Requests Board**: Visual drag-and-drop pipeline for lead management with stages (Unqualified to Won), status indicators, and role-scoped access.
- **Lead Scoring System**: Property-wise scoring (0-100) and priority classification (Cold, Warm, Hot) based on user actions.
- **Virtual Property Tour & Bed Booking**: Dedicated property pages with virtual tours, interactive floor/room/bed selection, room typology, and admin tools for visual management. Includes plan assignment (plans can be linked to multiple room types via `linkedRoomTypeIds` array) and tier-specific bed highlighting. Duplicate booking prevention blocks same phone number from having multiple active bookings per property and prevents double-booking of beds. Registered student search cross-references with local active bookings (by phone/email) and shows "Active Booking" badge on already-booked students, preventing their selection.
- **Booking Tree (Bed-wise Booking Details)**: Admin view for hierarchical display of property → floor → room → bed with live booking status, occupant details, allocation timeline, and block/unblock history. Features auto-scroll and performance optimizations.
- **Housing Plans (Property Service Tiers)**: Management of property-specific housing plans (tiers) with comparison tables, feature listings, and integration into the booking process. Features premium visuals and direct booking from plan cards.
- **Season/Batch CRM Module**: Management of academic seasons/batches as CRM source-of-truth, including CRUD operations, resident status tracking, and an "End Season" flow for booking processing.
- **HMS Property Sync**: Functionality to link/unlink properties to an external Hostel Management System, including verification and auto-matching. Includes **CRM → HMS Season Sync** that pushes active bookings to HMS by matching residents via phone/email, with sync status tracking (synced/partial/failed) on season cards. **Auto-sync**: After booking confirmation, payment activation, or admin status change to active/confirmed, the system automatically syncs the booking to HMS — matching by phone/email, or creating the resident in HMS if not found. Auto-sync runs in background via `autoSyncBookingToHMS()` in `server/routes.ts`.
- **Package Upgrade System**: Allows admins to upgrade a booking's active package to a higher-tier, with transaction safety, price calculation, and upgrade history tracking.
- **Property Add-On Services**: Management of property-specific add-on services (e.g., meal plans, laundry) using the packages table with distinct categorization and booking integration.
- **Property Included Services**: Admin can configure services included with all housing plans via a "Services" tab in the property edit dialog. Supports service types (meals, shuttle, EV bike, laundry, housekeeping, locker, custom) with named meal schedule toggles (Breakfast/Lunch/Evening Snacks/Dinner) per day group (Mon–Fri, Saturday, Sunday). Stored as JSONB `includedServices` on the properties table.
- **Homepage Amenities & Facilities Control**: Admin panel to manage amenities displayed on the homepage, including title, description, image, icon, and sort order.
- **Logo Control Panel**: Admin-only panel to upload custom header, footer, and admin sidebar logos, stored dynamically.
- **Gyan AI Chatbot (HMS-Connected)**: AI chatbot powered by OpenAI GPT-4o-mini, integrated with live HMS data for personalized responses, lead capture, and context caching.
- **Instagram Live Feed**: Integration with Instagram Graph API to display recent posts on the homepage with daily caching.
- **Target & Achievement Dashboard**: Admin-only CRM tab showing property-wise sales targets vs achievements. Features auto-calculated targets from bed inventory × pricing × occupancy %, admin-configurable target overrides, summary KPI cards, property-wise detail rows with progress bars and color indicators (green/yellow/red), filters (property/month/status), Recharts bar and area charts (Target vs Achievement, Occupancy %, Monthly Trend), and top/bottom performer highlights. Data stored in `propertyTargets` table; API endpoints protected with auth middleware and Zod validation.

## External Dependencies

### Database
- **PostgreSQL**: Primary data store.
- **Drizzle ORM**: Type-safe database queries.

### Payment
- **Razorpay**: For Indian payment methods.

### UI Libraries & Tools
- **Radix UI**: Headless component primitives.
- **shadcn/ui**: Pre-built UI components.
- **Lucide React**: Icon library.
- **Embla Carousel**: Image carousels.
- **react-signature-canvas**: Digital signature capture.
- **date-fns**: Date manipulation.

### Development & Deployment
- **Vite**: Frontend build tool.
- **esbuild**: Backend compilation.
- **Replit Plugins**: Specific tools for the Replit environment.
- **Instagram Graph API**: For Instagram feed integration.
- **OpenAI GPT-4o-mini**: Via Replit AI Integrations for the chatbot.
- **Hostel Management System (HMS)**: External system for property syncing. Base URL configured via `HMS_API_URL` env var (default: `https://hsquarehostels.com`). Auth uses `HMS_API_KEY` (`Authorization: Bearer` header) with fallback to legacy `HOSTEL_FLOW_EMAIL`/`HOSTEL_FLOW_PASSWORD` JWT login. Centralized via `getHMSAuthHeaders()` in `server/routes.ts`. Auto-sync uses dedicated `syncBookingToHMS()` helper in `server/hms-sync.ts` which calls `/sync/create-resident` endpoint for upsert-based resident sync. **Bidirectional sync**: HMS can push resident edits back to CRM via `PUT /api/hms/residents/update` (matches by phone/email, updates residentDetails + booking fields, logs to audit trail). **HMS API endpoints** (auth: `hmsApiKeyAuth` via `Authorization: Bearer <HMS_API_KEY>`): `GET /api/hms/bookings` (list), `GET /api/hms/bookings/:identifier` (single by code/phone), `GET /api/hms/bookings/:identifier/receipt` (HTML or `?format=json`), `PUT /api/hms/residents/update`. All booking endpoints include full package details with `features` array (from `package_items` table: type, label, value, includedQty, unit, isOptional) alongside package metadata (tagline, occupancy, locationInfo). Each booking also returns `hmsStatus` (HMS-friendly display label) derived from CRM status + season retention: "Retained" (season RETAINED), "Not Retained" (season NOT_RETAINED), "New Booking" (confirmed), "Active", "Completed", etc.
- **Resend**: Email delivery service for automated booking confirmation emails. Service module at `server/email-service.ts`, sends branded HTML emails on booking confirmation. Email status (sent/failed) logged to CRM activity logs.