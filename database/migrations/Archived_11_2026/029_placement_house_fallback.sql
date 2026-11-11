-- Run before deploying the updated backend. Review and back up your database.
BEGIN;
ALTER TABLE advertisement_placements
  ADD COLUMN IF NOT EXISTS fallback_advertisement_id BIGINT NULL;

CREATE INDEX IF NOT EXISTS idx_advertisement_placements_fallback_ad_id
  ON advertisement_placements(fallback_advertisement_id)
  WHERE fallback_advertisement_id IS NOT NULL;

CREATE OR REPLACE FUNCTION validate_placement_house_fallback()
RETURNS trigger LANGUAGE plpgsql AS $$
BEGIN
  IF NEW.fallback_advertisement_id IS NOT NULL THEN
    IF NEW.fallback_behavior <> 'HOUSE_AD' THEN
      RAISE EXCEPTION 'fallback_advertisement_id requires HOUSE_AD fallback behavior';
    END IF;
    IF NOT EXISTS (
      SELECT 1 FROM advertisements a
      WHERE a.id = NEW.fallback_advertisement_id AND a.is_house_ad IS TRUE
    ) THEN
      RAISE EXCEPTION 'fallback_advertisement_id must reference an existing house advertisement';
    END IF;
  END IF;
  RETURN NEW;
END;
$$;
DROP TRIGGER IF EXISTS trg_validate_placement_house_fallback ON advertisement_placements;
CREATE TRIGGER trg_validate_placement_house_fallback
  BEFORE INSERT OR UPDATE OF fallback_advertisement_id, fallback_behavior
  ON advertisement_placements
  FOR EACH ROW EXECUTE FUNCTION validate_placement_house_fallback();
COMMIT;

-----------------------------------
BEGIN;

ALTER TABLE public.advertisement_placements
DROP CONSTRAINT IF EXISTS chk_advertisement_placements_type;

ALTER TABLE public.advertisement_placements
ADD CONSTRAINT chk_advertisement_placements_type
CHECK (
    placement_type IN (
        'HOME_BANNER',
        'HOME_TOP',
        'HOME_BETWEEN_SECTIONS',
        'HOME_SIDEBAR',
        'HOME_BOTTOM',
        'HOME_MODAL',

        'NEWS_LIST_TOP',
        'NEWS_LIST_BETWEEN',
        'NEWS_LIST_BOTTOM',
        'NEWS_LIST_SIDEBAR',
        'NEWS_LIST_MODAL',

        'NEWS_DETAIL_TOP',
        'NEWS_DETAIL_BETWEEN',
        'NEWS_DETAIL_SIDEBAR',
        'NEWS_DETAIL_BOTTOM',
        'NEWS_DETAIL_MODAL'
    )
);

COMMIT;
----------------------------------