BEGIN;

DO $do$
DECLARE
    v_definition TEXT;
    v_pattern TEXT;
    v_matches INTEGER;
BEGIN
    SELECT pg_get_functiondef(
        'public.guard_sponsored_feed_inventory()'::regprocedure
    )
    INTO v_definition;

    v_pattern :=
        'IF[[:space:]]+NEW\.workflow_status[[:space:]]*=[[:space:]]*''SUBMITTED''' ||
        '[[:space:]]+AND[[:space:]]+OLD\.workflow_status' ||
        '[[:space:]]+IS[[:space:]]+DISTINCT[[:space:]]+FROM' ||
        '[[:space:]]+NEW\.workflow_status[[:space:]]+THEN' ||
        '[[:space:]]+RAISE[[:space:]]+EXCEPTION' ||
        '[[:space:]]+''Sponsored feed submission is not yet enabled''' ||
        '[[:space:]]+USING[[:space:]]+ERRCODE[[:space:]]*=' ||
        '[[:space:]]*''23514''[[:space:]]*;' ||
        '[[:space:]]+END[[:space:]]+IF[[:space:]]*;';

    SELECT COUNT(*)
    INTO v_matches
    FROM regexp_matches(v_definition, v_pattern, 'g');

    IF v_matches <> 1 THEN
        RAISE EXCEPTION
            'Expected exactly one submission restriction, found %. No changes applied.',
            v_matches;
    END IF;

    v_definition := regexp_replace(
        v_definition,
        v_pattern,
        '-- Sponsored submission restriction removed; workflow validation remains in the application.'
    );

    EXECUTE v_definition;

    RAISE NOTICE 'Submission restriction removed successfully.';
END;
$do$;

COMMIT;