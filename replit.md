# Hsquareliving - Student Accommodation Management System

## Overview
Hsquareliving is a full-stack application designed to modernize student accommodation management for "Hsquareliving Pvt Ltd." It aims to streamline property discovery, room selection, registration, flexible payments, and digital agreement signing, offering a seamless experience for students and an efficient admin dashboard for comprehensive oversight. The project includes features for sales and lead management, virtual property tours, and integration with an external Hostel Management System.

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
-   **Sales & Lead Management**: Sales Executive Panel with lead sourcing, assignment, activity logging, follow-up systems, Kanban Requests Board, and Lead Scoring. Includes lead attribution tracking and assignment notifications.
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
-   **Homepage Enhancements**: Animated splash screen and optimized hero video pipeline with server-side transcoding.
-   **Windows-Chrome Performance Invariants** (added because the hero video plays smoothly on iOS but the homepage + plans-hallway noticeably lagged on Windows-Chrome even on a decent gaming laptop — Apple's compositor handles patterns Windows-Chrome cannot). Touch any of these at your own risk:
    1.  **Plans-hallway backdrop video**: MUST be ≤2 MB / ≤2 Mbps / ≤1280×720 / 24 fps / closed GOP / faststart / no audio. Source asset (`attached_assets/Make_it_loop_smooth_*.mp4`) is checked in pre-optimised — if you ever replace it, re-run the same encoder profile (`-c:v libx264 -profile:v main -level 4.0 -pix_fmt yuv420p -vf "scale='min(1280,iw)':-2:flags=lanczos,fps=24" -r 24 -g 48 -keyint_min 48 -sc_threshold 0 -crf 28 -maxrate 1400k -bufsize 2800k -preset slow -an -movflags +faststart`).
    2.  **Plans-hallway backdrop video**: MUST NOT have `mask-image` / `WebkitMaskImage` applied directly to the `<video>` element. Use sibling gradient `<div>` overlays instead. `mask-image` on a playing video forces Windows-Chrome's compositor onto a software path that visibly tanks framerate of the entire page (any test that re-introduces it will reproduce the original lag report — verified May 2026).
    3.  **Plans-hallway backdrop video**: MUST be paused via `IntersectionObserver` whenever the section scrolls off-screen. The autoplay/loop attributes alone don't pause when off-screen, and a continuous looping video behind a CSS-3D perspective transform stays expensive even when invisible.
    4.  **Tubes WebGL background** (`client/src/components/tubes-cursor-background.tsx`): MUST run an adaptive baseline-FPS measurement (currently 900 ms sample, ≥45 fps threshold) BEFORE instantiating the heavy WebGL context. On Windows + integrated/older discrete GPU the iridescent shader stacked with everything else can't sustain 60 fps and the user perceives the whole site as laggy. Falling below the threshold MUST call `onFailure` (the existing graceful-fallback path that disables the tubes for the rest of the session). Skip the gate when `document.visibilityState !== 'visible'` to avoid false positives on hidden tabs / headless test environments where RAF rate is throttled.
-   **Hero Video Encoding Checklist**: Every MP4 stored in `hero_slides.video_url` MUST satisfy ALL of the following. Enforced in code by `server/lib/hero-video-optimizer.ts` (in-request, wired into POST/PUT `/api/hero-slides`) and `scripts/optimize-hero-video.ts` (one-off backfill / rollback) — keep their constants and ffmpeg args in lock-step.
    1. **Codec**: H.264 main profile, level 4.0, `yuv420p`
    2. **Resolution**: ≤ 1600×900 (1280×720 also accepted); `scale='min(1600,iw)':-2:flags=lanczos`
    3. **Frame rate**: exactly 24 fps (±0.1 tolerance); `-r 24`
    4. **Video stream bitrate**: ≤ **2.5 Mbps** (stream-level via ffprobe `streams[].bit_rate`, NOT just overall)
    5. **Overall file bitrate**: ≤ **2.7 Mbps** (video + 96 kbps AAC + container overhead)
    6. **Total file size**: ≤ **2.5 MB**
    7. **GOP**: closed every 2 s (`-g 48 -keyint_min 48 -sc_threshold 0`) so the loop seam re-decodes from a clean keyframe and the browser stops re-firing `canplay` on every loop
    8. **Audio**: AAC LC 96 kbps stereo 48 kHz (`-c:a aac -b:a 96k -ar 48000 -ac 2`)
    9. **Container**: `-movflags +faststart` (moov before mdat — verified by walking the top-level atom list)
    10. **Metadata stripped**: `-map_metadata -1` AND no top-level `uuid` atom AND no `c2pa` / `C2PA` / `jumb` byte markers anywhere (Task #144 invariant — Chrome refuses some C2PA-tagged MP4s with `MEDIA_ERR_SRC_NOT_SUPPORTED`)
    11. **Recommended encoder settings**: CRF 26 with `-maxrate 2200k -bufsize 4400k` (300 kbps headroom under the 2.5 Mbps stream cap so the verifier never trips); `-preset slow` for the offline script, `-preset medium` for the in-request server module
    12. **Forbidden encoder flags**: do **NOT** add `-flags +bitexact` / `-fflags +bitexact` — they appeared to produce an MP4 some browsers refused with `MEDIA_ERR_SRC_NOT_SUPPORTED` (code 4); their determinism is irrelevant for a hero loop

    Server-side wiring details: `safeOptimizeHeroVideoIfMp4` reads the object's content-type from object-storage metadata FIRST and cleanly skips anything that isn't `video/mp4` (WebM is the common case — already-efficient codec, no transcode needed). For MP4 inputs it ALWAYS re-encodes — there is intentionally no source-skip fast-pass, because partial probe-based skipping (codec/dims/bitrate + structural scan) cannot prove every checklist item (closed-GOP cadence in particular is not robustly observable from ffprobe), and the only way to guarantee a deterministic compliant output is to produce it ourselves. Cost: ~10–20 s of CPU per admin save (admin uploads are rare and authenticated). PUT pre-fetches the row first (404s before running ffmpeg on a non-existent slide) and only fires when the `videoUrl` actually changed. On any failure (ffmpeg missing, network error, verifier trip) the route handler logs and falls back to the original path so the admin's upload is never lost. Active hero slide currently points at `/objects/uploads/389e5936-c501-4278-b1c0-c64dfb0cad53` (2.33 MB / 2.44 Mbps overall / 2.34 Mbps video / 1600×900 / 24.00 fps / closed GOP 48 / faststart held / no C2PA / no uuid). Source-of-truth original kept at `/objects/uploads/00cd147c-9161-42e4-a63d-c97be0c0a7e7` for audit / rollback. **The headless chromium used by the Replit screenshot tool cannot decode H.264** (it reports `[hero-video] fallback-shown video-error code= 4` for every MP4 source) — verify hero-video changes by reading `[hero-video] canplay -> play()` lines from the **live browser console** (forwarded into the workflow logs), not from screenshot-tool browser logs.

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