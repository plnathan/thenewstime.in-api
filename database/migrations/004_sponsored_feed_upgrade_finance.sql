BEGIN;
ALTER TABLE advertisement_feed_upgrades ADD COLUMN charged_at timestamptz,
 ADD COLUMN charged_by bigint REFERENCES users(id), ADD COLUMN amount_before_charge numeric(14,2),
 ADD CONSTRAINT chk_feed_charge_audit CHECK ((charged_at IS NULL AND charged_by IS NULL AND amount_before_charge IS NULL) OR (charged_at IS NOT NULL AND charged_by IS NOT NULL AND amount_before_charge IS NOT NULL AND financial_approval_id IS NOT NULL));
ALTER TABLE advertisement_feed_assignments ADD COLUMN assigned_rate_amount numeric(14,2) CHECK (assigned_rate_amount > 0);
UPDATE advertisement_feed_assignments f SET assigned_rate_amount=s.rate_amount FROM advertisement_pricing_snapshots s WHERE s.advertisement_id=f.advertisement_id AND s.rate_card_id=f.rate_card_id;
-- Protect the negotiated amount from generic updates while this feature is being integrated.
CREATE FUNCTION guard_feed_upgrade_amount() RETURNS trigger LANGUAGE plpgsql AS $$
BEGIN
 IF NEW.advertisement_amount IS DISTINCT FROM OLD.advertisement_amount AND EXISTS (SELECT 1 FROM advertisement_feed_assignments WHERE advertisement_id=OLD.id) THEN
  IF NOT EXISTS (SELECT 1 FROM advertisement_feed_upgrades u WHERE u.advertisement_id=OLD.id AND u.status='PENDING' AND u.charged_at IS NOT NULL AND u.amount_before_charge=OLD.advertisement_amount AND NEW.advertisement_amount=OLD.advertisement_amount+u.additional_amount) THEN
   RAISE EXCEPTION 'Sponsored commercial amount is managed by upgrade workflow' USING ERRCODE='23514';
  END IF;
 END IF;
 RETURN NEW;
END $$;
CREATE TRIGGER trg_guard_feed_upgrade_amount BEFORE UPDATE ON advertisements FOR EACH ROW EXECUTE FUNCTION guard_feed_upgrade_amount();
COMMIT;
