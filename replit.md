# Hsquareliving - Student Accommodation Management System

## Overview

Hsquareliving is a full-stack hostel and student living management application built for "Hsquareliving Pvt Ltd". The platform enables students to discover properties, select rooms, complete registrations, manage payments through flexible installment plans, and digitally sign rental agreements. It includes an admin dashboard for property management, student oversight, and financial tracking.

## User Preferences

Preferred communication style: Simple, everyday language.

## System Architecture

### Frontend Architecture
- **Framework**: React with TypeScript, using Vite as the build tool
- **Routing**: Wouter for lightweight client-side routing
- **State Management**: TanStack React Query for server state management and caching
- **UI Components**: shadcn/ui component library built on Radix UI primitives
- **Styling**: Tailwind CSS with custom design tokens and CSS variables for theming
- **Fonts**: Inter (body text) and Manrope (headings) from Google Fonts
- **Animations**: Framer Motion for page transitions and micro-interactions
- **Forms**: React Hook Form with Zod validation schemas

### Backend Architecture
- **Runtime**: Node.js with Express 5.x
- **Language**: TypeScript with ES modules
- **API Design**: RESTful endpoints under `/api` prefix
- **Build System**: Custom build script using esbuild for server bundling and Vite for client

### Data Storage
- **Database**: PostgreSQL with Drizzle ORM
- **Schema Location**: `shared/schema.ts` - defines all tables with proper relations
- **Migrations**: Drizzle Kit for schema migrations (`drizzle-kit push`)
- **Key Tables**: users, students, properties, roomTypes, bookings, installments, payments, auditLogs, leads, salesExecPropertyAssignments, leadActivities, leadRemarks

### Authentication & Authorization
- **User Roles**: Four roles defined via PostgreSQL enum - "user", "admin", "sales_executive", "student"
- **Session Management**: Express sessions with connect-pg-simple for PostgreSQL-backed sessions
- **Password Security**: Passwords stored (implementation uses standard hashing practices)
- **Role-Based Access Control**: Frontend route protection in AuthProvider with role-specific redirects

### Key Application Flows
1. **Student Registration**: Multi-step form collecting personal details, address, emergency contacts, and academic information
2. **Property Selection**: Browse properties with room types, availability, and pricing
3. **Payment Plans**: Three installment options (full settlement, two, or three installments) with booking amount of ₹100,000
4. **Digital Agreement**: Signature capture using react-signature-canvas with PDF generation

### Sales Executive Panel System
- **Admin Sales Management** (`/admin/sales-management`): Create sales executives, assign properties, assign leads
- **Sales Dashboard** (`/sales`): Sales executive portal with lead management, status updates, follow-ups
- **Manual Lead Entry**: Walk-in, phone call, WhatsApp sources with budget tracking
- **Lead Assignment**: Admin assigns leads to sales executives; execs can only view/manage their assigned leads
- **Activity Logging**: Immutable audit trail for all status changes, assignments, and remarks
- **Follow-up System**: Schedule follow-ups with notes, track upcoming (7 days) and overdue follow-ups
- **Deal Closure**: Close deals with room type, final amount, payment plan; auto-locks lead after closure
- **Calendar Integration**: Monthly calendar view at `/admin/calendar` showing follow-ups and site visits; ICS file download and Google Calendar link generation; "Add to Calendar" buttons in follow-up dialogs and edit-lead-modal
- **Key Tables**: salesExecPropertyAssignments, leadActivities, leadRemarks

### Kanban Requests Board
- **Route**: `/admin/requests` (Admin), `/sales/requests` (Sales Executive)
- **Purpose**: Visual pipeline management for lead requests using drag-and-drop Kanban interface
- **Stages**: Unqualified → Qualified → Viewing → Negotiating → Won
- **Features**:
  - Drag-and-drop cards between columns with smooth animations (@dnd-kit)
  - Status color indicators and priority badges
  - 3-dot menu for quick actions (View, Edit, Move, Delete)
  - Search and filter by property/sales executive
  - Add new request modal with customer details
  - Column totals showing request count and value
- **Role Scoping**: Sales executives see only assigned leads; admins see all
- **Stage-to-Status Mapping**:
  - Unqualified: new, cold
  - Qualified: contacted, warm, interested
  - Viewing: site_visit, visit_scheduled
  - Negotiating: negotiation, hot
  - Won: converted, deal_closed

### Lead Scoring System (Property-Wise)
- **Score Range**: 0-100 per property
- **Priority Classification**: Cold (0-30), Warm (31-60), Hot (61-100)
- **Scoring Rules**:
  - Signup/Lead Creation: +5 points
  - Property View: +10 points per view
  - Multiple Views (3+): +15 bonus
  - Enquiry Submitted: +20 points
  - Site Visit Scheduled: +25 points
  - Booking Initiated: +30 points
  - Booking Confirmed: +40 points
  - Discount Request: +10 points
  - Lost Status: Score reset to 0
- **Admin Dashboard**: Lead Scoring Dashboard with priority distribution, averages, and top property analysis

### Virtual Property Tour & Floor/Bed Booking
- **Route**: `/properties/:id` — dedicated property detail page with integrated tour + booking
- **Tour Gallery**: Categorized image viewer (Overview/Rooms/Amenities/Location) with Ken Burns effect, auto-play, fullscreen, swipe support, keyboard navigation, thumbnail filmstrip
- **Floor & Bed Selection**: Interactive floor picker with expandable cards showing bed grids; color-coded beds (green=available, red=occupied, yellow=reserved, gray=maintenance); click to select and see booking summary
- **Booking Summary Panel**: Sticky sidebar showing selected property, floor, bed, room type, and price; "Proceed to Book" navigates to student registration
- **Admin Floor Management** (`/admin/floors-beds`): Property selector, auto-generate floors/beds from room types, visual floor/bed grid, status management
- **Schema Tables**: `floors` (propertyId, floorNumber, name, totalBeds, availableBeds, layoutImage), `beds` (propertyId, floorId, roomTypeId, bedNumber, status enum, monthlyPrice, position jsonb)
- **API Endpoints**: 
  - `GET /api/properties/:id/floors` (public, floors with beds)
  - `POST /api/admin/properties/:id/auto-generate-floors` (admin, auto-generate)
  - `POST /api/admin/properties/:id/floors` (admin, create floor)
  - `PATCH /api/admin/beds/:id` (admin, update bed status)
  - `POST /api/admin/import-tour-images` (admin, import images from external URLs to object storage)
  - `POST /api/admin/import-image-from-url` (admin, import single image from URL)
- **Image Import Security**: Domain allowlist (Unsplash, Google, Imgur, Wikimedia), HTTPS-only, content-type validation, 20MB size limit, 15s timeout, max 20 URLs per batch
- **Navigation**: Property cards on home page and property listing link to `/properties/:id`; "Virtual Tour" hero button navigates to `/properties`

### Instagram Live Feed
- **API**: Instagram Graph API integration with daily caching
- **Tables**: `instagramPosts` (cached media), `instagramSyncLog` (sync history)
- **Endpoints**: `GET /api/instagram/posts` (public, auto-syncs if stale), `POST /api/instagram/sync` (admin manual), `GET /api/instagram/sync-status` (admin)
- **Caching**: Posts cached in DB, refreshed once per 24 hours automatically
- **Frontend**: Premium slideshow section on homepage between amenities and featured residences
- **Environment**: Requires `INSTAGRAM_ACCESS_TOKEN` secret for Instagram Graph API

### Code Organization
```
client/src/
├── components/     # Reusable UI components
├── pages/          # Route-level page components
├── hooks/          # Custom React hooks
├── lib/            # Utilities, API client, query configuration
└── assets/         # Static images

server/
├── index.ts        # Express app setup and middleware
├── routes.ts       # API route definitions
├── storage.ts      # Database access layer (repository pattern)
├── db.ts           # Database connection setup
└── seed.ts         # Initial data seeding

shared/
└── schema.ts       # Drizzle schema definitions and Zod validators
```

## External Dependencies

### Database
- **PostgreSQL**: Primary data store, connection via `DATABASE_URL` environment variable
- **Drizzle ORM**: Type-safe database queries and schema management

### Payment Integration
- **Razorpay**: Configured for Indian payment methods (UPI, cards, net banking) - integration points exist but require API keys

### Third-Party UI Libraries
- **Radix UI**: Headless accessible component primitives
- **shadcn/ui**: Pre-built component library (new-york style variant)
- **Lucide React**: Icon library
- **Embla Carousel**: For image carousels
- **react-signature-canvas**: Digital signature capture
- **date-fns**: Date formatting and manipulation

### Development Tools
- **Vite**: Development server with HMR and production bundling
- **esbuild**: Fast server-side TypeScript compilation
- **Replit Plugins**: Dev banner, error overlay, and cartographer for Replit environment