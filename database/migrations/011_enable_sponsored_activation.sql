-- Apply to staging first. Review existing function and take a backup before production.
BEGIN;
DO $do$
DECLARE
  v_def text;
  v_pattern text;
  v_count integer;
BEGIN
  SELECT pg_get_functiondef('public.guard_sponsored_feed_inventory()'::regprocedure) INTO v_def;
  v_pattern := 'IF[[:space:]]+NEW\.status[[:space:]]*=[[:space:]]*''ACTIVE''[[:space:]]+AND[[:space:]]+OLD\.status[[:space:]]+IS[[:space:]]+DISTINCT[[:space:]]+FROM[[:space:]]+NEW\.status[[:space:]]+THEN[[:space:]]+RAISE[[:space:]]+EXCEPTION[[:space:]]+''Sponsored feed activation is not yet enabled''[[:space:]]+USING[[:space:]]+ERRCODE[[:space:]]*=[[:space:]]*''23514''[[:space:]]*;[[:space:]]+END[[:space:]]+IF[[:space:]]*;';
  SELECT count(*) INTO v_count FROM regexp_matches(v_def, v_pattern, 'g');
  IF v_count <> 1 THEN
    RAISE EXCEPTION 'Expected one activation guard, found %. No changes applied. Inspect current function.', v_count;
  END IF;
  v_def := regexp_replace(v_def, v_pattern, '-- Legacy sponsored activation prohibition removed; activation validated in service.');
  EXECUTE v_def;
  RAISE NOTICE 'Removed one legacy activation prohibition';
END;
$do$;
COMMIT;
