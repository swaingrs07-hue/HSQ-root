-- Migration: Backfill leads.created_by for leads without attribution
-- Date: 2026-03-31
-- Context: For leads created before the attribution feature, set created_by
-- from the best available source. DO NOT blanket-assign to admin.

-- Step 1: For manual entries (walk-in, on-spot), the assigned sales exec
-- is the person who entered the lead, so use assigned_to_id
UPDATE leads SET created_by = assigned_to_id 
WHERE created_by IS NULL 
  AND is_manual_entry = true 
  AND assigned_to_id IS NOT NULL;

-- Step 2: Backfill from audit logs (CREATE_LEAD events) for remaining leads
UPDATE leads l SET created_by = (
  SELECT al.admin_id FROM audit_logs al 
  WHERE al.entity_type = 'lead' AND al.entity_id = l.id AND al.action = 'CREATE_LEAD' 
  ORDER BY al.created_at ASC LIMIT 1
)
WHERE l.created_by IS NULL
  AND EXISTS (
    SELECT 1 FROM audit_logs al WHERE al.entity_type = 'lead' AND al.entity_id = l.id AND al.action = 'CREATE_LEAD'
  );

-- NOTE: Leads that still have created_by = NULL after this migration
-- were created before attribution tracking. The UI will simply not
-- show "Lead by" for these leads. This is correct behavior.
