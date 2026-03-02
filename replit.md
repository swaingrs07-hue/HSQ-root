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
- **Image Handling**: Direct file upload with WebP compression, object storage, secure image import from URLs.

#### Booking Tree (Bed-wise Booking Details)
- **Admin View**: Hierarchical display (`/admin/booking-tree`) of property → floor → room → bed with live booking status.
- **Bed Detail Drawer**: Displays occupant details, booking history, allocation timeline, block/unblock history.
- **Allocation System**: Admin ability to allocate/deallocate bookings to beds, preventing overlaps.
- **Stats**: Real-time counts for Total, Available, Occupied, Reserved, Blocked, With Booking.

#### Package Management System
- **Admin Features**: Create, edit, delete, activate/deactivate service packages with various service items (Laundry, Meals Plan, etc.).
- **Pricing**: Flexible price types (ONE_TIME, PER_DAY, PER_MONTH) with tax.
- **Booking Integration**: Attach/detach packages to bookings, track usage with progress bars, calculate extra charges, and manage an Ala Carte wallet.

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