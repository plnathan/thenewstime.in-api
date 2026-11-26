BEGIN;
-- Dedicated pricing-only inventory; never use a normal banner placement.
ALTER TABLE advertisement_placements DROP CONSTRAINT chk_advertisement_placements_type;
ALTER TABLE advertisement_placements ADD CONSTRAINT chk_advertisement_placements_type CHECK (placement_type IN ('HOME_TOP','HOME_BANNER','HOME_BETWEEN_SECTIONS','HOME_SIDEBAR','HOME_BOTTOM','HOME_MODAL','NEWS_LIST_TOP','NEWS_LIST_BANNER','NEWS_LIST_BETWEEN','NEWS_LIST_SIDEBAR','NEWS_LIST_BOTTOM','NEWS_LIST_MODAL','NEWS_DETAIL_TOP','NEWS_DETAIL_BANNER','NEWS_DETAIL_BETWEEN','NEWS_DETAIL_SIDEBAR','NEWS_DETAIL_BOTTOM','NEWS_DETAIL_MODAL','NEWS_DETAIL_SPONSORED_FEED'));
ALTER TABLE advertisement_feed_assignments ADD COLUMN rate_card_id bigint REFERENCES advertisement_rate_cards(id), ADD COLUMN reserved_start_at timestamptz, ADD COLUMN reserved_end_at timestamptz;
ALTER TABLE advertisement_feed_assignments ADD CONSTRAINT chk_feed_reservation CHECK ((reserved_start_at IS NULL AND reserved_end_at IS NULL AND rate_card_id IS NULL) OR (reserved_start_at IS NOT NULL AND reserved_end_at IS NOT NULL AND reserved_end_at > reserved_start_at AND rate_card_id IS NOT NULL));
CREATE INDEX idx_feed_reservation ON advertisement_feed_assignments(batch_id,reserved_start_at,reserved_end_at);
-- Interim safety gate: prevent legacy activation or repricing until lifecycle integration.
CREATE FUNCTION guard_sponsored_feed_inventory() RETURNS trigger LANGUAGE plpgsql AS $$
BEGIN
 IF EXISTS (SELECT 1 FROM advertisement_feed_assignments WHERE advertisement_id=OLD.id) THEN
  IF NEW.workflow_status='SUBMITTED' AND OLD.workflow_status IS DISTINCT FROM NEW.workflow_status THEN RAISE EXCEPTION 'Sponsored feed submission is not yet enabled' USING ERRCODE='23514'; END IF;
  IF NEW.status='ACTIVE' AND OLD.status IS DISTINCT FROM NEW.status THEN RAISE EXCEPTION 'Sponsored feed activation is not yet enabled' USING ERRCODE='23514'; END IF;
  IF ROW(NEW.start_at,NEW.end_at,NEW.pricing_placement_id,NEW.pricing_unit,NEW.pricing_quantity,NEW.standard_amount,NEW.advertisement_type,NEW.is_house_ad) IS DISTINCT FROM ROW(OLD.start_at,OLD.end_at,OLD.pricing_placement_id,OLD.pricing_unit,OLD.pricing_quantity,OLD.standard_amount,OLD.advertisement_type,OLD.is_house_ad) THEN RAISE EXCEPTION 'Sponsored reservation pricing and dates are locked until lifecycle integration' USING ERRCODE='23514'; END IF;
 END IF;
 RETURN NEW;
END $$;
CREATE TRIGGER trg_guard_sponsored_feed_inventory BEFORE UPDATE ON advertisements FOR EACH ROW EXECUTE FUNCTION guard_sponsored_feed_inventory();
COMMIT;
