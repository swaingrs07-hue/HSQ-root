-- Migration: Per-booking service overrides + role-permission feature flags
-- Adds booking_services JSONB column and seeds two feature-flag rows.
-- All statements are idempotent (DO $$ ... END $$ / ON CONFLICT).

-- ── bookings.booking_services ─────────────────────────────────────────────────
-- Nullable JSONB column; NULL = inherit property.includedServices.
-- Non-null = per-booking service override (ServiceItem[]).

DO $$ BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM information_schema.columns
    WHERE table_name = 'bookings' AND column_name = 'booking_services'
  ) THEN
    ALTER TABLE bookings ADD COLUMN booking_services JSONB NULL;
  END IF;
END $$;

-- ── feature_flags seed ────────────────────────────────────────────────────────
-- booking_services_edit_admin   : true  (admin users can edit booking services by default)
-- booking_services_edit_frontdesk: false (frontdesk cannot, until superadmin enables)

INSERT INTO feature_flags (id, key, enabled, created_at, updated_at)
VALUES
  (gen_random_uuid(), 'booking_services_edit_admin',    TRUE,  NOW(), NOW()),
  (gen_random_uuid(), 'booking_services_edit_frontdesk', FALSE, NOW(), NOW())
ON CONFLICT (key) DO NOTHING;
