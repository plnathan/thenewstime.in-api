-- Advertisement delivery readiness
WITH ad AS (
    SELECT
        a.*,
        f.batch_id,
        f.rate_card_id,
        f.assigned_rate_amount,
        f.reserved_start_at,
        f.reserved_end_at,
        f.activated_at,
        b.code AS batch_code,
        b.display_name AS batch_name,
        b.is_enabled AS batch_enabled,
        cl.status AS client_status,
        c.advertisement_id IS NOT NULL AS has_card_content
    FROM advertisements a
    LEFT JOIN advertisement_feed_assignments f
        ON f.advertisement_id = a.id
    LEFT JOIN advertisement_feed_batches b
        ON b.id = f.batch_id
    LEFT JOIN advertisement_clients cl
        ON cl.id = a.client_id
    LEFT JOIN advertisement_card_contents c
        ON c.advertisement_id = a.id
    WHERE a.id = 2842
),
checks AS (
    SELECT
        ad.*,
        now() AS checked_at,
        now() AT TIME ZONE 'Asia/Kolkata' AS checked_at_ist,

        COALESCE((
            SELECT SUM(p.amount)
            FROM advertisement_payments p
            WHERE p.advertisement_id = ad.id
              AND p.payment_status IN ('VERIFIED', 'REFUNDED')
        ), 0) AS verified_payment_total,

        COALESCE((
            SELECT SUM(r.amount)
            FROM advertisement_payment_refunds r
            JOIN advertisement_payments p
              ON p.id = r.payment_id
            WHERE p.advertisement_id = ad.id
        ), 0) AS refunded_total,

        COALESCE((
            SELECT CASE
                WHEN fa.status = 'APPROVED'
                 AND fa.revoked_at IS NULL
                 AND fa.expected_payment_due_date >=
                     (now() AT TIME ZONE 'Asia/Kolkata')::date
                THEN fa.approved_amount
                ELSE 0
            END
            FROM advertisement_financial_approvals fa
            WHERE fa.advertisement_id = ad.id
              AND fa.approval_type = 'CREDIT_EXCEPTION'
            ORDER BY fa.requested_at DESC, fa.id DESC
            LIMIT 1
        ), 0) AS approved_credit,

        EXISTS (
            SELECT 1
            FROM advertisement_feed_upgrades u
            WHERE u.advertisement_id = ad.id
              AND u.status = 'PENDING'
              AND u.charged_at IS NOT NULL
        ) AS has_pending_charged_upgrade,

        EXISTS (
            SELECT 1
            FROM advertisement_financial_approvals fa
            WHERE fa.advertisement_id = ad.id
              AND fa.approval_type IN ('DISCOUNT', 'ADJUSTMENT')
              AND fa.status IN ('SUBMITTED', 'HOLD')
        ) AS has_blocking_financial_approval

    FROM ad
),
result AS (
    SELECT
        *,
        GREATEST(
            0,
            advertisement_amount
            - adjustment_amount
            - GREATEST(
                0,
                verified_payment_total - refunded_total
              )
        ) AS outstanding_amount
    FROM checks
)
SELECT
    id AS advertisement_id,
    checked_at_ist,
    workflow_status,
    status AS advertisement_status,
    batch_id,
    batch_code,
    batch_name,
    batch_enabled,
    client_status,

    start_at,
    end_at,
    reserved_start_at,
    reserved_end_at,
    activated_at,

    advertisement_amount,
    assigned_rate_amount,
    verified_payment_total,
    refunded_total,
    approved_credit,
    outstanding_amount,

    has_card_content,

    (workflow_status = 'APPROVED') AS workflow_ready,
    (status = 'ACTIVE') AS activation_ready,
    (advertisement_type = 'NATIVE'
        AND is_house_ad IS FALSE) AS ad_type_ready,
    (client_status = 'ACTIVE') AS client_ready,
    (batch_enabled IS TRUE) AS batch_ready,

    (activated_at IS NOT NULL
        AND activated_at <= now()) AS feed_activation_ready,

    (start_at <= now()
        AND end_at > now()) AS campaign_window_ready,

    (reserved_start_at <= now()
        AND reserved_end_at > now()) AS reservation_window_ready,

    (rate_card_id IS NOT NULL
        AND assigned_rate_amount > 0
        AND advertisement_amount > 0) AS pricing_ready,

    (outstanding_amount <= approved_credit) AS payment_ready,

    (NOT has_pending_charged_upgrade) AS upgrade_ready,

    (NOT has_blocking_financial_approval) AS finance_ready,

    CASE
        WHEN workflow_status = 'APPROVED'
         AND status = 'ACTIVE'
         AND advertisement_type = 'NATIVE'
         AND is_house_ad IS FALSE
         AND client_status = 'ACTIVE'
         AND batch_enabled IS TRUE
         AND activated_at IS NOT NULL
         AND activated_at <= now()
         AND start_at <= now()
         AND end_at > now()
         AND reserved_start_at <= now()
         AND reserved_end_at > now()
         AND rate_card_id IS NOT NULL
         AND assigned_rate_amount > 0
         AND advertisement_amount > 0
         AND outstanding_amount <= approved_credit
         AND NOT has_pending_charged_upgrade
         AND NOT has_blocking_financial_approval
         AND has_card_content
        THEN 'READY - CHECK NEWS TARGETING'
        ELSE 'NOT READY'
    END AS delivery_readiness

FROM result;
-----------------------------
-- Check sponsored card content

SELECT
    a.id AS advertisement_id,
    c.headline,
    c.description,
    c.sponsor_display_name,
    c.cta_label,
    c.image_url,
    c.headline_url,
    c.description_url,
    c.sponsor_url,
    c.cta_url,
    a.destination_url,
    a.is_clickable,
    a.open_in_new_tab
FROM advertisements a
LEFT JOIN advertisement_card_contents c
    ON c.advertisement_id = a.id
WHERE a.id = 2842;
-----------------------------
-- Check advertisement targeting

SELECT
    t.advertisement_id,
    t.target_type,
    t.target_value,
    t.is_include,
    CASE
        WHEN t.is_include THEN 'INCLUDE'
        ELSE 'EXCLUDE'
    END AS targeting_rule
FROM advertisement_targets t
WHERE t.advertisement_id = 2842
ORDER BY t.target_type, t.is_include DESC;
-----------------------

http://localhost:5000/api/v1/advertisements/sponsored-feed/public/news/733

http://localhost:5000/api/v1/advertisements/sponsored-feed/public/news/733

Get a valid published News ID:

SELECT
    id,
    title,
    status,
    published_at
FROM news
WHERE status = 'PUBLISHED'
  AND published_at <= NOW()
ORDER BY published_at DESC
LIMIT 5;

------------------------
-- To verify the impressions:

SELECT
    id,
    advertisement_id,
    feed_batch_id,
    feed_position,
    impression_at
FROM advertisement_impressions
WHERE advertisement_id = 2842
ORDER BY impression_at DESC
LIMIT 20;
------------------------