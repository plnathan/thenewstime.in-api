BEGIN;

-- ============================================================
-- 1. Add house-ad flag
-- ============================================================

ALTER TABLE public.advertisements
ADD COLUMN IF NOT EXISTS is_house_ad boolean NOT NULL DEFAULT false;

-- ============================================================
-- 2. Preserve the existing client relationship
--
-- Existing schema contains both:
--   advertiser_id
--   client_id
--
-- Current application behavior has been populating both from
-- the same advertisement client.
--
-- Fill missing client_id values from advertiser_id before
-- removing advertiser_id.
-- ============================================================

UPDATE public.advertisements
SET client_id = advertiser_id
WHERE client_id IS NULL;


-- ============================================================
-- 3. Validate that both legacy columns never disagree
-- ============================================================

DO $$
BEGIN
  IF EXISTS (
    SELECT 1
    FROM public.advertisements
    WHERE client_id IS DISTINCT FROM advertiser_id
  ) THEN
    RAISE EXCEPTION
      'Advertisement client mismatch: client_id and advertiser_id contain different values.';
  END IF;
END
$$;


-- ============================================================
-- 4. Remove the duplicate advertiser relationship
-- ============================================================

ALTER TABLE public.advertisements
DROP CONSTRAINT IF EXISTS fk_advertisements_advertiser;


ALTER TABLE public.advertisements
DROP CONSTRAINT IF EXISTS fk_advertisements_client;


-- ============================================================
-- 5. Remove legacy advertiser_id column
-- ============================================================

ALTER TABLE public.advertisements
DROP COLUMN IF EXISTS advertiser_id;


-- ============================================================
-- 6. Recreate the canonical client_id foreign key
-- ============================================================

ALTER TABLE public.advertisements
ADD CONSTRAINT fk_advertisements_client
FOREIGN KEY (client_id)
REFERENCES public.advertisement_clients (id)
ON UPDATE NO ACTION
ON DELETE RESTRICT;


-- ============================================================
-- 7. House-ad/client consistency
--
-- Paid advertisements:
--   is_house_ad = false
--   client_id must exist
--
-- House advertisements:
--   is_house_ad = true
--   client_id may be NULL
--
-- This prevents a normal paid advertisement from accidentally
-- being created without a client.
-- ============================================================

ALTER TABLE public.advertisements
DROP CONSTRAINT IF EXISTS chk_advertisements_client_house_ad;


ALTER TABLE public.advertisements
ADD CONSTRAINT chk_advertisements_client_house_ad
CHECK (
  (
    is_house_ad = true
    AND client_id IS NULL
  )
  OR
  (
    is_house_ad = false
    AND client_id IS NOT NULL
  )
);


-- ============================================================
-- 8. Expand placement fallback behavior
-- ============================================================

ALTER TABLE public.advertisement_placements
DROP CONSTRAINT IF EXISTS chk_advertisement_placements_fallback;


ALTER TABLE public.advertisement_placements
ADD CONSTRAINT chk_advertisement_placements_fallback
CHECK (
  fallback_behavior IN ('HIDE', 'HOUSE_AD')
);


-- ============================================================
-- 9. Add NEWS_LIST_SIDEBAR placement type
--
-- The exact existing CHECK constraint name can differ between
-- environments, so both the expected current name and the
-- common alternative are removed safely.
-- ============================================================

ALTER TABLE public.advertisement_placements
DROP CONSTRAINT IF EXISTS chk_advertisement_placements_type;

ALTER TABLE public.advertisement_placements
DROP CONSTRAINT IF EXISTS chk_advertisement_placements_placement_type;


ALTER TABLE public.advertisement_placements
ADD CONSTRAINT chk_advertisement_placements_type
CHECK (
  placement_type IN (
    'HOME_BANNER',
    'HOME_TOP',
    'HOME_BETWEEN_SECTIONS',
    'HOME_SIDEBAR',
    'NEWS_LIST_TOP',
    'NEWS_LIST_BETWEEN',
    'NEWS_LIST_BOTTOM',
    'NEWS_LIST_SIDEBAR',
    'NEWS_DETAIL_TOP',
    'NEWS_DETAIL_BETWEEN',
    'NEWS_DETAIL_SIDEBAR',
    'NEWS_DETAIL_BOTTOM',
    'NEWS_DETAIL_MODAL'
  )
);


COMMIT;