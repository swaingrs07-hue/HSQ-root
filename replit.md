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
- **Key Tables**: users, students, properties, roomTypes, bookings, installments, payments, auditLogs

### Authentication & Authorization
- **User Roles**: Two roles defined via PostgreSQL enum - "student" and "admin"
- **Session Management**: Express sessions with connect-pg-simple for PostgreSQL-backed sessions
- **Password Security**: Passwords stored (implementation uses standard hashing practices)

### Key Application Flows
1. **Student Registration**: Multi-step form collecting personal details, address, emergency contacts, and academic information
2. **Property Selection**: Browse properties with room types, availability, and pricing
3. **Payment Plans**: Three installment options (full settlement, two, or three installments) with booking amount of ₹100,000
4. **Digital Agreement**: Signature capture using react-signature-canvas with PDF generation

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