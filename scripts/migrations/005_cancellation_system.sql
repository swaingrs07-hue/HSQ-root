-- Migration: Booking Cancellation System
-- Creates enums, tables, and column required for cancellation workflows.
-- All statements are idempotent (DO $$ ... END $$ blocks / IF NOT EXISTS).

-- ── Enums ────────────────────────────────────────────────────────────────────

DO $$ BEGIN
  CREATE TYPE cancellation_request_status AS ENUM ('pending', 'approved', 'rejected');
EXCEPTION WHEN duplicate_object THEN NULL;
END $$;

DO $$ BEGIN
  CREATE TYPE cancellation_initiated_by AS ENUM ('student', 'admin');
EXCEPTION WHEN duplicate_object THEN NULL;
END $$;

-- ── cancellation_policies ─────────────────────────────────────────────────────
-- Refund-tier policies; propertyId NULL = global default.

CREATE TABLE IF NOT EXISTS cancellation_policies (
  id                  VARCHAR PRIMARY KEY DEFAULT gen_random_uuid(),
  property_id         VARCHAR REFERENCES properties(id) ON DELETE CASCADE,
  label               TEXT NOT NULL,
  days_before_move_in INTEGER NOT NULL,
  refund_percentage   INTEGER NOT NULL DEFAULT 0,
  sort_order          INTEGER NOT NULL DEFAULT 0,
  created_at          TIMESTAMP NOT NULL DEFAULT NOW()
);

-- ── cancellation_requests ─────────────────────────────────────────────────────
-- Records every student-initiated or admin-initiated cancellation request.

CREATE TABLE IF NOT EXISTS cancellation_requests (
  id                    VARCHAR PRIMARY KEY DEFAULT gen_random_uuid(),
  booking_id            VARCHAR NOT NULL REFERENCES bookings(id) ON DELETE CASCADE,
  requested_by          VARCHAR NOT NULL REFERENCES users(id),
  initiated_by          cancellation_initiated_by NOT NULL DEFAULT 'student',
  reason                TEXT NOT NULL,
  proof_image_url       TEXT,
  status                cancellation_request_status NOT NULL DEFAULT 'pending',
  policy_snapshot       JSONB,
  refund_breakdown      JSONB,
  override_refund_amount INTEGER,
  rejection_reason      TEXT,
  processed_by          VARCHAR REFERENCES users(id),
  processed_at          TIMESTAMP,
  created_at            TIMESTAMP NOT NULL DEFAULT NOW()
);

-- ── bookings.cancellation_request_id FK ──────────────────────────────────────
-- Links a booking back to its cancellation request after it is processed.

DO $$ BEGIN
  ALTER TABLE bookings ADD COLUMN cancellation_request_id VARCHAR REFERENCES cancellation_requests(id);
EXCEPTION WHEN duplicate_column THEN NULL;
END $$;
