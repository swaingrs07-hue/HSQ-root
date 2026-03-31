-- Migration: Backfill leads.created_by for remaining leads without attribution
-- Date: 2026-03-31
-- Context: For leads created before the attribution feature, set created_by
-- from audit logs first, then fall back to the admin user who manages the system.

-- Step 1: Backfill from audit logs (CREATE_LEAD events)
UPDATE leads l SET created_by = (
  SELECT al.admin_id FROM audit_logs al 
  WHERE al.entity_type = 'lead' AND al.entity_id = l.id AND al.action = 'CREATE_LEAD' 
  LIMIT 1
)
WHERE l.created_by IS NULL
  AND EXISTS (
    SELECT 1 FROM audit_logs al WHERE al.entity_type = 'lead' AND al.entity_id = l.id AND al.action = 'CREATE_LEAD'
  );

-- Step 2: For any remaining leads without created_by, set to the first admin user
UPDATE leads l SET created_by = (
  SELECT u.id FROM users u WHERE u.role = 'admin' ORDER BY u.created_at ASC LIMIT 1
)
WHERE l.created_by IS NULL;
