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
-   **Roles**: "user", "admin", "superadmin", "manager", "staff", "sales_executive", "receptionist".
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
-   **Homepage Enhancements**: Animated splash screen, optimized hero video pipeline with server-side transcoding, and a card-swipe hero where the sticky hero is covered by the next section while the global iridescent tubes layer (driven by `--tubes-reveal-opacity` CSS variable) stays hidden through the swipe and fades in from the "Why Choose" section onward. On small viewports (`<768px`) and for `prefers-reduced-motion` users, the hero falls back to `position: relative` with an IntersectionObserver hard-switch on `--tubes-reveal-opacity` instead of a sticky pin + scroll-tied fade — this avoids visible jumps caused by Android Chrome / iOS Safari URL-bar resize changing `window.innerHeight` mid-scroll (Task #148).

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