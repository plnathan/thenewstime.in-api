UPDATE public.advertisements
SET
    pricing_placement_id = 514,
    pricing_unit = 'DAY',
    pricing_quantity = 9,
    standard_amount = 45000,
    advertisement_amount = 45000,
    discount_percentage = 0,
    discount_amount = 0,
    advance_percentage = 0,
    advance_amount = 0,
    adjustment_amount = 0,
    currency_code = 'INR',
    updated_at = CURRENT_TIMESTAMP
WHERE id = 1525;
--------------------------------------
INSERT INTO public.advertisement_placement_rules
(
    advertisement_id,
    placement_id,
    display_order,
    insertion_type,
    insertion_position,
    max_impressions,
    status,
    created_by,
    updated_by
)
VALUES
(
    1525,
    514,
    0,
    'FIXED',
    NULL,
    NULL,
    'ACTIVE',
    1,
    1
)
ON CONFLICT (advertisement_id, placement_id)
DO UPDATE
SET
    status = 'ACTIVE',
    updated_by = 1,
    updated_at = CURRENT_TIMESTAMP;
--------------------------------------    
INSERT INTO public.advertisement_placement_rules
(
    advertisement_id,
    placement_id,
    display_order,
    insertion_type,
    insertion_position,
    max_impressions,
    status,
    created_by,
    updated_by
)
VALUES
(
    1525,
    514,
    0,
    'FIXED',
    NULL,
    NULL,
    'ACTIVE',
    1,
    1
)
ON CONFLICT (advertisement_id, placement_id)
DO UPDATE
SET
    status = 'ACTIVE',
    updated_by = 1,
    updated_at = CURRENT_TIMESTAMP;

SELECT
    r.id,
    r.advertisement_id,
    r.placement_id,
    p.code,
    p.display_name,
    p.page_type,
    p.placement_type,
    p.format_id,
    r.status
FROM public.advertisement_placement_rules r
INNER JOIN public.advertisement_placements p
    ON p.id = r.placement_id
WHERE r.advertisement_id = 1525
ORDER BY r.display_order, r.id;	
-------------------------------------