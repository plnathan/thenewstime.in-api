
BEGIN;

DO $$
DECLARE
    v_ad RECORD;
BEGIN
    SELECT
        id,
        workflow_status,
        status,
        is_house_ad
    INTO v_ad
    FROM advertisements
    WHERE id = 1
    FOR UPDATE;

    IF NOT FOUND THEN
        RAISE EXCEPTION 'Advertisement ID 1 does not exist.';
    END IF;

    IF v_ad.workflow_status <> 'DRAFT'
       OR v_ad.status <> 'DRAFT' THEN
        RAISE EXCEPTION
            'Advertisement 1 must be DRAFT. Current workflow: %, status: %',
            v_ad.workflow_status,
            v_ad.status;
    END IF;

    IF EXISTS (
        SELECT 1
        FROM advertisement_payments
        WHERE advertisement_id = 1
    ) THEN
        RAISE EXCEPTION
            'Advertisement 1 has payment records. Conversion stopped.';
    END IF;

    IF EXISTS (
        SELECT 1
        FROM advertisement_financial_approvals
        WHERE advertisement_id = 1
    ) THEN
        RAISE EXCEPTION
            'Advertisement 1 has financial approval records. Conversion stopped.';
    END IF;

    DELETE FROM advertisement_pricing_snapshots
    WHERE advertisement_id = 1;

    UPDATE advertisements
    SET
        is_house_ad = TRUE,
        client_id = NULL,
        campaign_id = NULL,

        advertisement_amount = 0,
        standard_amount = NULL,
        pricing_placement_id = NULL,
        pricing_unit = NULL,
        pricing_quantity = NULL,

        discount_percentage = 0,
        discount_amount = 0,
        advance_percentage = 0,
        advance_amount = 0,
        adjustment_amount = 0

    WHERE id = 1;

    RAISE NOTICE
        'Advertisement ID 1 converted to House Advertisement.';
END $$;

SELECT
    id,
    name,
    is_house_ad,
    client_id,
    campaign_id,
    workflow_status,
    status,
    advertisement_amount,
    standard_amount,
    pricing_placement_id,
    pricing_unit,
    pricing_quantity,
    discount_percentage,
    discount_amount,
    advance_percentage,
    advance_amount,
    adjustment_amount
FROM advertisements
WHERE id = 1;

COMMIT;
