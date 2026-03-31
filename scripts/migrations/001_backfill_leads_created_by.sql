-- Migration: Backfill leads.created_by from assigned_to_id for manual entries
-- Date: 2026-03-31
-- Context: Task #39 - Sales lead visibility scoping & 'Lead by' attribution
-- 
-- The created_by column was added to the leads table to track who created each lead.
-- For existing manual entries (is_manual_entry = true), we backfill created_by
-- from assigned_to_id since the assigning user was the creator.

UPDATE leads 
SET created_by = assigned_to_id 
WHERE is_manual_entry = true 
  AND assigned_to_id IS NOT NULL 
  AND created_by IS NULL;
