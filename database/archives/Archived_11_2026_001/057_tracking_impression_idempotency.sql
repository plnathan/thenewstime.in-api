-- Apply to UAT first. Existing impressions retain NULL client_event_id.
ALTER TABLE advertisement_impressions
  ADD COLUMN IF NOT EXISTS client_event_id UUID;
CREATE UNIQUE INDEX IF NOT EXISTS ux_advertisement_impressions_client_event_id
  ON advertisement_impressions (client_event_id)
  WHERE client_event_id IS NOT NULL;
