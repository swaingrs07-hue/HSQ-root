# Hsquareliving - Student Accommodation Management System

## Overview

Hsquareliving is a full-stack hostel and student living management application designed for "Hsquareliving Pvt Ltd". Its purpose is to streamline the entire student accommodation process, from property discovery and room selection to registration, flexible payment management, and digital agreement signing. The platform includes a comprehensive admin dashboard for property, student, and financial oversight. The business vision is to modernize student living management, offering a seamless experience for students and efficient operations for property managers, with significant market potential in the student housing sector.

## User Preferences

Preferred communication style: Simple, everyday language.

## System Architecture

### Frontend
- **Framework**: React with TypeScript, using Vite.
- **Routing**: Wouter.
- **State Management**: TanStack React Query.
- **UI Components**: shadcn/ui built on Radix UI, styled with Tailwind CSS, custom design tokens, and CSS variables.
- **Typography**: Inter (body) and Manrope (headings).
- **Animations**: Framer Motion.
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
- **Roles**: "user", "admin", "sales_executive", "student" (PostgreSQL enum).
- **Session Management**: Express sessions with `connect-pg-simple`.
- **Security**: Hashed passwords.
- **Access Control**: Role-based access control implemented via frontend route protection and backend middleware.

### Core Features

#### Sales Executive Panel
- **Management**: Admin functions for creating sales executives, assigning properties and leads.
- **Sales Dashboard**: Lead management, status updates, follow-ups for sales executives.
- **Lead Sourcing**: Manual entry from various sources, budget tracking.
- **Lead Assignment**: Admins assign leads, sales executives manage only their assigned leads.
- **Activity Logging**: Immutable audit trail for all lead interactions.
- **Follow-up System**: Scheduled follow-ups with notes, tracking upcoming and overdue tasks, calendar integration (ICS, Google Calendar).
- **Deal Closure**: Process for closing deals, including room type, final amount, payment plan, and lead auto-locking.

#### Kanban Requests Board
- **Purpose**: Visual pipeline management for lead requests using a drag-and-drop Kanban interface.
- **Stages**: Unqualified → Qualified → Viewing → Negotiating → Won.
- **Features**: Status color indicators, priority badges, quick actions menu, search/filter, column totals.
- **Access**: Role-scoped; sales executives see only assigned leads, admins see all.

#### Lead Scoring System
- **Mechanism**: Property-wise scoring (0-100) with priority classification (Cold, Warm, Hot).
- **Rules**: Points awarded for actions like signup (+5), property view (+10), enquiry (+20), site visit (+25), booking initiated (+30), booking confirmed (+40).
- **Dashboard**: Admin view for priority distribution, averages, and top property analysis.

#### Virtual Property Tour & Bed Booking
- **Property Page**: Dedicated page (`/properties/:id`) with integrated virtual tour and booking.
- **Tour Gallery**: Categorized image viewer with advanced features.
- **Booking Hierarchy**: Interactive Floor → Room → Bed selection.
- **Room Typology**: System for defining bed configurations (simple, combo rooms with sections A, B, C).
- **Admin Management**: Tools for floor/room/bed auto-generation, visual management, status updates, and virtual tour image uploads (Matterport, Kuula, CloudPano integration).
- **Plan Assignment on Floors & Beds**: Room cards on `/admin/floors-beds` show linked plan badges (violet) or "Assign Plan" button; clicking opens dialog to link/unlink housing plans to the room type. Plans linked to other room types shown as dimmed "In use".
- **Tier-Specific Bed Highlighting**: Each plan tier has a distinct color palette on the booking page — tier 0 (base): emerald/teal, tier 1 (mid): violet/purple, tier 2 (premium): amber/gold. Plan banner, room card borders, plan badges, and bed glow effects all use the tier's palette. Non-matching rooms are dimmed. Plan name badge with crown icon shown on matching room cards.
- **Auto Plan Detection in Booking Summary**: When a bed is selected from a plan-assigned room (even without clicking "Book Now" on a plan), the sidebar auto-detects and displays the plan with a rich "Active Plan" card showing tier-colored border, crown icon, plan name, tagline, price (₹/year), and top 3 features. Plan price is used as the Total Price and flows into the booking payload.
- **Image Handling**: Direct file upload with WebP compression, object storage, secure image import from URLs.

#### Booking Tree (Bed-wise Booking Details)
- **Admin View**: Hierarchical display (`/admin/booking-tree`) of property → floor → room → bed with live booking status.
- **Bed Detail Drawer**: Displays occupant details, booking history, allocation timeline, block/unblock history.
- **Allocation System**: Admin ability to allocate/deallocate bookings to beds, preventing overlaps.
- **Stats**: Real-time counts for Total, Available, Occupied, Reserved, Blocked, With Booking.
- **Auto-Scroll Building View**: Floor cards auto-scroll upward (elevator effect) with requestAnimationFrame; pauses on hover/mouse-wheel; Play/Pause button (`btn-auto-scroll`), Speed control (`btn-scroll-speed`, 0.5x–3x), Fullscreen button.
- **Fullscreen Fix**: Sidebar (Floors panel) has `overflow-y-auto` with `maxHeight: calc(100vh - 140px)` in fullscreen to prevent getting stuck.
- **Performance**: Continuous CSS animations (bedGlow, floatLabelSimple, bedCardFloat, bedSceneFloat) converted to hover-only transitions; `contain: layout style` on bed wrappers.

#### Housing Plans (Property Service Tiers)
- **Admin Route**: `/admin/packages` — manage property-specific housing plans (tiers)
- **User-facing**: Comparison table on `/properties/:id` showing active plans for that property
- **Concept**: Each property has multiple service tiers (e.g., THE HIGHLANDER, THE STERLING, THE ROYAL) with different pricing and lifestyle features displayed as a side-by-side comparison table
- **Schema**: `packages` table has `propertyId`, `tagline`, `tierLevel`, `isHighlighted`, `occupancy`, `locationInfo`; `package_items` has `featureValue` for display text
- **Public API**: `GET /api/properties/:propertyId/plans` returns active plans with features; `GET /api/plans/featured` returns all active plans across properties for homepage showcase
- **Booking Integration**: Attach/detach plans to bookings, track usage with progress bars, calculate extra charges, and manage an Ala Carte wallet
- **Direct Booking**: "Book Now" button on each plan card scrolls to bed selector with plan pre-selected; selected plan shown in Booking Summary sidebar and passed to booking generation
- **Premium Visuals**: Tier-specific styling (gold shimmer for top tier, silver for mid, neutral for base); gradient bed buttons with glass-morphism, spring animations, and animated shimmer effects on premium plan cards

#### Season/Batch CRM Module
- **Admin Route**: `/admin/seasons` — manage academic seasons/batches as CRM source-of-truth
- **Schema**: `seasons` table (name, propertyId, startDate, endDate, graceDays, status: UPCOMING/ACTIVE/ENDED, nextSeasonId), `resident_season_status` (bookingId, seasonId, status: RETAINED/NOT_RETAINED/PENDING, graceUntil, decisionReason), `season_close_jobs` + `season_close_job_items` for End Season flow
- **Season CRUD**: Create, update, delete, activate (auto-ends previous ACTIVE), end seasons; only one ACTIVE allowed per property
- **Property Scoping**: Seasons can be scoped to a specific property via propertyId; season create/edit dialog includes property selector
- **Resident Tracking**: Per-season resident status management with bulk update, individual status changes, grace period tracking
- **End Season Flow**: Generate Close Report (snapshots all active bookings into job items) → Preview (grouped by RETAINED/NOT_RETAINED/PENDING) → Apply & Sync (calls internal `/api/sync/season-close` endpoint to process bookings) → Retry on failure
- **HMS Sync**: Internal endpoint processes season close by completing NOT_RETAINED bookings; secured with internal token
- **Audit Logging**: All season operations logged via `logActivity`
- **API Endpoints**: ~15 endpoints under `/api/admin/seasons/` for full lifecycle management

#### HMS Property Sync
- **Admin Route**: `/admin/hms-sync` — link/unlink properties to external Hostel Management System
- **External HMS**: `https://hostel-flow--swaingrs07.replit.app` with JWT auth (cached 23hrs)
- **Property Fields**: `propertyCode` (for HMS matching), `hmsPropertyId`, `hmsPropertyName`, `hmsLinked` on properties table
- **Features**: Link/unlink/re-link properties to HMS, verify HMS connections, auto-match by propertyCode or name
- **API Endpoints**: `GET /api/admin/hms/properties`, `POST /api/admin/properties/:id/link-hms`, `POST .../unlink-hms`, `GET .../verify-hms`
- **Property Code**: Optional field in Add Property form (Basic Details step) for HMS identification

#### Package Upgrade System
- **Purpose**: Admin can upgrade a booking's active package to a higher-tier package
- **Schema**: `package_upgrades` table tracks upgrade history (fromPackageId, toPackageId, priceDifference, upgradeReason, upgradedBy); `packages` table has `upgradeDescription` and `upgradeFee` columns
- **Upgrade Flow**: End current active package → Attach new higher-tier package → Record upgrade → Credit wallet (if ala carte)
- **Price Calculation**: Uses `upgradeFee` override if set, otherwise auto-calculates as `targetBasePrice - currentBasePrice` (floor 0)
- **Transaction Safety**: Upgrade operation is wrapped in a DB transaction for atomicity
- **API**: `GET /api/admin/bookings/:id/packages/upgrade-options`, `POST .../upgrade`, `GET .../upgrade-history`
- **Admin UI**: Upgrade dialog in completed-bookings page with comparison table (SERVICE TIER | UPGRADE FEE | KEY UPGRADES), recommended badge, upgrade history timeline
- **Admin Package Editor**: `upgradeDescription` and `upgradeFee` fields in admin-packages.tsx create/edit form

#### Homepage Amenities & Facilities Control
- **Admin Route**: `/admin/amenities` — manage amenities shown on homepage "Amenities & Facilities" section
- **Schema**: `homepage_amenities` table (title, description, imageUrl, icon, sortOrder, isActive)
- **Public API**: `GET /api/homepage-amenities` returns active amenities for homepage rendering
- **Admin API**: CRUD at `/api/admin/homepage-amenities` with Zod validation
- **Homepage**: Dynamically loads amenities from DB; falls back to hardcoded defaults if none exist
- **Icons**: Configurable from 16 Lucide icon options (Star, Dumbbell, BookOpen, Utensils, etc.)

#### Logo Control Panel
- **Admin Route**: `/admin/logo-control` — upload custom header, footer, and admin sidebar logos
- **Access**: Main admin only (gyan@hsquareliving.com)
- **Storage**: Logo URLs stored in `footer_settings` table (headerLogo, footerLogo, adminLogo columns)
- **Dynamic Loading**: Public site and admin layouts fetch logos from `/api/logo-settings`, falling back to built-in PNG

#### Gyan AI Chatbot (HMS-Connected)
- **Engine**: OpenAI GPT-4o-mini via Replit AI Integrations, streaming via SSE
- **HMS Integration**: Chatbot system prompt is enriched with live data from the HMS system including:
  - All property details (location, amenities, rules, contact info, Google Maps links)
  - Housing plans with tier levels, pricing (yearly + monthly breakdown), and feature inclusions
  - Bed availability counts from room configurations
  - Active academic seasons and booking statistics
- **Lead Capture**: Automatically extracts contact info from conversations and creates leads in the CRM
- **Context Caching**: Chat context refreshed every 5 minutes for up-to-date data
- **Rate Limiting**: 30 messages/min per IP, 50KB request size limit
- **Files**: `server/chatbot.ts` (core AI logic, prompt building), `client/src/components/chatbot-widget.tsx` (UI)

#### Instagram Live Feed
- **Integration**: Instagram Graph API for displaying recent posts.
- **Caching**: Daily caching of posts in the database for performance.
- **Frontend**: Premium slideshow section on the homepage.

### Code Organization
- **Client**: `components/`, `pages/`, `hooks/`, `lib/`, `assets/` for React frontend.
- **Server**: `index.ts`, `routes.ts`, `storage.ts`, `db.ts`, `seed.ts` for Node.js backend.
- **Shared**: `schema.ts` for shared Drizzle schema and Zod validators.

## External Dependencies

### Database
- **PostgreSQL**: Primary data store.
- **Drizzle ORM**: Type-safe database queries.

### Payment
- **Razorpay**: Configured for Indian payment methods.

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