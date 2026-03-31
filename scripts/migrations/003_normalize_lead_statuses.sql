-- Migration: Normalize legacy lead statuses to the 7-stage pipeline
-- Pipeline statuses: new, contacted, interested, site_visit, negotiation, converted, lost
-- Temperature (cold/warm/hot) belongs in the priority field only, not status
-- This migration is idempotent and safe to run multiple times

UPDATE leads SET status = 'site_visit' WHERE status = 'visit_scheduled';
UPDATE leads SET status = 'converted' WHERE status = 'deal_closed';
UPDATE leads SET status = 'new' WHERE status IN ('cold', 'warm', 'hot');
