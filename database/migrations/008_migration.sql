BEGIN;

CREATE OR REPLACE FUNCTION public.guard_sponsored_feed_inventory()
RETURNS trigger
LANGUAGE plpgsql
AS $function$
DECLARE
    v_has_assignment BOOLEAN;
    v_is_draft BOOLEAN;
BEGIN
    SELECT EXISTS (
        SELECT 1
        FROM public.advertisement_feed_assignments
        WHERE advertisement_id = OLD.id
    )
    INTO v_has_assignment;

    IF NOT v_has_assignment THEN
        RETURN NEW;
    END IF;

    -- Preserve the existing submission restriction.
    IF NEW.workflow_status = 'SUBMITTED'
       AND OLD.workflow_status IS DISTINCT FROM NEW.workflow_status
    THEN
        RAISE EXCEPTION
            'Sponsored feed submission is not yet enabled'
            USING ERRCODE = '23514';
    END IF;

    -- Preserve the existing activation restriction.
    IF NEW.status = 'ACTIVE'
       AND OLD.status IS DISTINCT FROM NEW.status
    THEN
        RAISE EXCEPTION
            'Sponsored feed activation is not yet enabled'
            USING ERRCODE = '23514';
    END IF;

    v_is_draft :=
        OLD.workflow_status = 'DRAFT'
        AND NEW.workflow_status = 'DRAFT'
        AND OLD.status IS DISTINCT FROM 'ACTIVE'
        AND NEW.status IS DISTINCT FROM 'ACTIVE';

    -- Keep the batch pricing identity and advertisement type locked.
    IF ROW(
        NEW.pricing_placement_id,
        NEW.pricing_unit,
        NEW.advertisement_type,
        NEW.is_house_ad
    ) IS DISTINCT FROM ROW(
        OLD.pricing_placement_id,
        OLD.pricing_unit,
        OLD.advertisement_type,
        OLD.is_house_ad
    ) THEN
        RAISE EXCEPTION
            'Sponsored reservation pricing identity is locked'
            USING ERRCODE = '23514';
    END IF;

    -- Permit schedule-related pricing changes only in Draft.
    IF ROW(
        NEW.start_at,
        NEW.end_at,
        NEW.pricing_quantity,
        NEW.standard_amount
    ) IS DISTINCT FROM ROW(
        OLD.start_at,
        OLD.end_at,
        OLD.pricing_quantity,
        OLD.standard_amount
    )
    AND NOT v_is_draft
    THEN
        RAISE EXCEPTION
            'Sponsored reservation dates and amounts can only be changed in Draft'
            USING ERRCODE = '23514';
    END IF;

    RETURN NEW;
END;
$function$;

COMMIT;