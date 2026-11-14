-- Preserve the existing operational-audit event allow-list and extend it with
-- ARCHIVED. The archive workflow writes an ARCHIVED operational audit event,
-- but the deployed check constraint currently rejects that value.
--
-- This migration reads the existing check expression and ORs in ARCHIVED,
-- avoiding the risk of accidentally removing other event types from the list.

DO $migration$
DECLARE
  existing_definition text;
  existing_expression text;
BEGIN
  SELECT pg_get_constraintdef(c.oid)
    INTO existing_definition
  FROM pg_constraint c
  JOIN pg_class t ON t.oid = c.conrelid
  JOIN pg_namespace n ON n.oid = t.relnamespace
  WHERE n.nspname = 'public'
    AND t.relname = 'advertisement_operational_audit'
    AND c.conname = 'chk_advertisement_operational_audit_event_type'
    AND c.contype = 'c';

  IF existing_definition IS NULL THEN
    RAISE EXCEPTION
      'Expected check constraint public.advertisement_operational_audit.chk_advertisement_operational_audit_event_type was not found';
  END IF;

  -- Make the migration safe to re-run after the constraint has been updated.
  IF position('ARCHIVED' IN upper(existing_definition)) > 0 THEN
    RAISE NOTICE 'Operational audit event constraint already mentions ARCHIVED; no change made';
    RETURN;
  END IF;

  -- pg_get_constraintdef returns CHECK (<expression>). Keep that expression
  -- intact and add ARCHIVED as an allowed alternative.
  existing_expression := substring(
    existing_definition
    FROM 8
    FOR char_length(existing_definition) - 8
  );

  EXECUTE 'ALTER TABLE public.advertisement_operational_audit '
       || 'DROP CONSTRAINT chk_advertisement_operational_audit_event_type';

  EXECUTE format(
    'ALTER TABLE public.advertisement_operational_audit '
    || 'ADD CONSTRAINT chk_advertisement_operational_audit_event_type '
    || 'CHECK ((%s) OR (event_type = %L))',
    existing_expression,
    'ARCHIVED'
  );
END;
$migration$;
