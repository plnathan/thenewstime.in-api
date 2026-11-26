BEGIN;

-- =========================================================
-- 1. Verify dependent tables
-- =========================================================

DO $$
BEGIN
    IF to_regclass('public.advertisements') IS NULL THEN
        RAISE EXCEPTION
            'Missing table: public.advertisements';
    END IF;

    IF to_regclass(
        'public.advertisement_feed_assignments'
    ) IS NULL THEN
        RAISE EXCEPTION
            'Missing table: public.advertisement_feed_assignments';
    END IF;

    IF to_regclass(
        'public.advertisement_feed_upgrades'
    ) IS NULL THEN
        RAISE EXCEPTION
            'Missing table: public.advertisement_feed_upgrades';
    END IF;
END;
$$;


-- =========================================================
-- 2. Sponsored commercial amount guard
-- =========================================================

CREATE OR REPLACE FUNCTION public.guard_feed_upgrade_amount()
RETURNS trigger
LANGUAGE plpgsql
AS $function$
BEGIN

    IF NEW.advertisement_amount
        IS DISTINCT FROM OLD.advertisement_amount

        AND EXISTS (
            SELECT 1
            FROM public.advertisement_feed_assignments
            WHERE advertisement_id = OLD.id
        )
    THEN

        -- Allow authorized Draft rescheduling.

        IF current_setting(
            'app.sponsored_draft_reschedule',
            true
        ) = OLD.id::text

            AND OLD.workflow_status = 'DRAFT'
            AND NEW.workflow_status = 'DRAFT'
            AND OLD.status = 'DRAFT'
            AND NEW.status = 'DRAFT'
            AND NEW.advertisement_amount >= 0
            AND NEW.start_at IS NOT NULL
            AND NEW.end_at > NEW.start_at

        THEN
            RETURN NEW;
        END IF;

        -- Otherwise, allow only authorized upgrade charges.

        IF NOT EXISTS (
            SELECT 1
            FROM public.advertisement_feed_upgrades u
            WHERE u.advertisement_id = OLD.id
              AND u.status = 'PENDING'
              AND u.charged_at IS NOT NULL
              AND u.amount_before_charge =
                  OLD.advertisement_amount
              AND NEW.advertisement_amount =
                  OLD.advertisement_amount
                  + u.additional_amount
        )
        THEN
            RAISE EXCEPTION
                'Sponsored commercial amount is managed by upgrade workflow'
                USING ERRCODE = '23514';
        END IF;

    END IF;

    RETURN NEW;

END;
$function$;


-- =========================================================
-- 3. Sponsored inventory protection guard
-- =========================================================

CREATE OR REPLACE FUNCTION public.guard_sponsored_feed_inventory()
RETURNS trigger
LANGUAGE plpgsql
AS $function$

DECLARE
    v_authorized boolean;
    v_changed boolean;

BEGIN

    -- Ignore advertisements without sponsored assignments.

    IF NOT EXISTS (
        SELECT 1
        FROM public.advertisement_feed_assignments
        WHERE advertisement_id = OLD.id
    )
    THEN
        RETURN NEW;
    END IF;

    -- Submission and activation are validated
    -- by the application workflow service.

    v_changed := ROW(
        NEW.start_at,
        NEW.end_at,
        NEW.pricing_placement_id,
        NEW.pricing_unit,
        NEW.pricing_quantity,
        NEW.standard_amount,
        NEW.advertisement_type,
        NEW.is_house_ad
    )
    IS DISTINCT FROM ROW(
        OLD.start_at,
        OLD.end_at,
        OLD.pricing_placement_id,
        OLD.pricing_unit,
        OLD.pricing_quantity,
        OLD.standard_amount,
        OLD.advertisement_type,
        OLD.is_house_ad
    );

    IF NOT v_changed THEN
        RETURN NEW;
    END IF;

    -- Allow only authorized Draft rescheduling.

    v_authorized :=
        current_setting(
            'app.sponsored_draft_reschedule',
            true
        ) = OLD.id::text

        AND OLD.workflow_status = 'DRAFT'
        AND NEW.workflow_status = 'DRAFT'
        AND OLD.status = 'DRAFT'
        AND NEW.status = 'DRAFT'

        AND ROW(
            NEW.pricing_placement_id,
            NEW.pricing_unit,
            NEW.advertisement_type,
            NEW.is_house_ad
        )
        IS NOT DISTINCT FROM ROW(
            OLD.pricing_placement_id,
            OLD.pricing_unit,
            OLD.advertisement_type,
            OLD.is_house_ad
        )

        AND NEW.start_at IS NOT NULL
        AND NEW.end_at > NEW.start_at
        AND NEW.pricing_quantity > 0
        AND NEW.standard_amount >= 0;

    -- Reject FALSE and NULL authorization results.

    IF v_authorized IS NOT TRUE THEN
        RAISE EXCEPTION
            'Sponsored reservation pricing and dates are locked outside authorized Draft rescheduling'
            USING ERRCODE = '23514';
    END IF;

    RETURN NEW;

END;
$function$;


-- =========================================================
-- 4. Create or replace commercial amount guard trigger
-- =========================================================

DROP TRIGGER IF EXISTS
    trg_guard_feed_upgrade_amount
    ON public.advertisements;

CREATE TRIGGER trg_guard_feed_upgrade_amount
BEFORE UPDATE ON public.advertisements
FOR EACH ROW
EXECUTE FUNCTION public.guard_feed_upgrade_amount();


-- =========================================================
-- 5. Create or replace sponsored inventory guard trigger
-- =========================================================

DROP TRIGGER IF EXISTS
    trg_guard_sponsored_feed_inventory
    ON public.advertisements;

CREATE TRIGGER trg_guard_sponsored_feed_inventory
BEFORE UPDATE ON public.advertisements
FOR EACH ROW
EXECUTE FUNCTION public.guard_sponsored_feed_inventory();


-- =========================================================
-- 6. Commit migration
-- =========================================================

COMMIT;