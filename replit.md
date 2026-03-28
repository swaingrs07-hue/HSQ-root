# Hsquareliving - Student Accommodation Management System

## Overview
Hsquareliving is a full-stack hostel and student living management application for "Hsquareliving Pvt Ltd." It aims to modernize student accommodation by streamlining property discovery, room selection, registration, flexible payments, and digital agreement signing. The platform includes a comprehensive admin dashboard for property, student, and financial oversight, offering a seamless experience for students and efficient operations for property managers.

## User Preferences
Preferred communication style: Simple, everyday language.

## System Architecture

### Frontend
-   **Framework**: React with TypeScript, using Vite.
-   **UI/UX**: shadcn/ui built on Radix UI, styled with Tailwind CSS. Features a premium dark 3D immersive homepage (`bg-[#0a0a0a]`) with canvas particle backgrounds, glassmorphism cards, animated counters, gradient glow dividers, and scroll-triggered Framer Motion animations. Consistent dark themes for all user-facing pages.
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
-   **Roles**: "user", "admin", "manager", "staff", "sales_executive", "receptionist".
-   **Security**: Hashed passwords, role-based access control.
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