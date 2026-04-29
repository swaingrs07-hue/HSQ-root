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
-   **Lead-to-Booking Attribution Chain**: Full attribution tracking from lead creation through booking completion.
-   **Lead Assignment Notifications**: In-app notifications for sales executives regarding lead assignments.
-   **Calendar Device Sync**: Live iCal subscription feed for sales executive follow-ups and site visits.
-   **Follow-up Email Reminders**: Background job for email reminders to sales executives for upcoming follow-ups.
-   **Per-Floor Gender Restriction**: Floors can be marked for specific genders, blocking cross-gender bed allocations.
-   **Per-Room / Per-Section Pricing Overrides**: Allows different pricing for rooms or sections within the same typology.
-   **Property Brochure Downloads**: On-demand PDF and PowerPoint generation for property brochures.
-   **Persistent Tubes Background Across Navigation**: Reuses the Three.js WebGL background across SPA navigations for performance.
-   **Canonical Host Redirect**: Consolidates multiple domains to a single canonical apex (`hsquare.in`) for SEO.

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