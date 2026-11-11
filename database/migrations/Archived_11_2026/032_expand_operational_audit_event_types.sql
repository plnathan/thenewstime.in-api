-- thenewstime.in: align operational audit event types with existing backend writes.
-- The application writes ACTIVATED, ARCHIVED, PAUSED, STOPPED and HELD.
-- This migration changes ONLY the audit event_type CHECK constraint.
BEGIN;
ALTER TABLE public.advertisement_operational_audit
  DROP CONSTRAINT IF EXISTS chk_advertisement_operational_audit_event_type;
ALTER TABLE public.advertisement_operational_audit
  ADD CONSTRAINT chk_advertisement_operational_audit_event_type
  CHECK (event_type IN ('ACTIVATED', 'ARCHIVED', 'PAUSED', 'STOPPED', 'HELD'));
COMMIT;
-- Confirm:
SELECT pg_get_constraintdef(oid) AS constraint_definition
FROM pg_constraint
WHERE conrelid = 'public.advertisement_operational_audit'::regclass
  AND conname = 'chk_advertisement_operational_audit_event_type';
