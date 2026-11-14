-- Review the matching report before applying to UAT/production.
-- Targets only Tamil Nadu districts. Aborts if the eight priority districts cannot be identified.
BEGIN;

CREATE TEMP TABLE district_priority_map (
  position integer PRIMARY KEY,
  tamil_name varchar(100) NOT NULL,
  name_pattern text NOT NULL
) ON COMMIT DROP;
INSERT INTO district_priority_map VALUES
  (1, 'சென்னை', 'chennai|madras'),
  (2, 'செங்கல்பட்டு', 'chengalpattu|chengalpet'),
  (3, 'காஞ்சிபுரம்', 'kanchipuram|kancheepuram|kanchipur'),
  (4, 'திருவள்ளூர்', 'tiruvallur|thiruvallur'),
  (5, 'கோயம்புத்தூர்', 'coimbatore|kovai'),
  (6, 'திருச்சிராப்பள்ளி', 'tiruchirappalli|tiruchirapalli|trichy|tiruchi'),
  (7, 'மதுரை', 'madurai'),
  (8, 'திருநெல்வேலி', 'tirunelveli|tirunelveli|nellai');

CREATE TEMP TABLE district_priority_resolved ON COMMIT DROP AS
SELECT p.position, p.tamil_name, d.id
FROM district_priority_map p
JOIN public.districts d ON (
  lower(d.code) ~ p.name_pattern OR
  lower(d.url_name) ~ p.name_pattern OR
  lower(d.display_name) ~ p.name_pattern OR
  d.display_name = p.tamil_name
)
JOIN public.states s ON s.id = d.state_id AND upper(s.code) = 'TN';

DO $$ BEGIN
  IF (SELECT COUNT(*) FROM district_priority_resolved) <> 8
     OR (SELECT COUNT(DISTINCT position) FROM district_priority_resolved) <> 8
     OR (SELECT COUNT(DISTINCT id) FROM district_priority_resolved) <> 8 THEN
    RAISE EXCEPTION 'Priority district lookup ambiguous/incomplete. Inspect district codes before migration.';
  END IF;
END $$;

-- Move other TN districts to positions 9 onward first to prevent temporary ordering collisions.
WITH others AS (
 SELECT d.id, ROW_NUMBER() OVER (ORDER BY d.display_order, d.id) + 8 AS new_order
 FROM public.districts d JOIN public.states s ON s.id = d.state_id
 WHERE upper(s.code) = 'TN'
   AND d.id NOT IN (SELECT id FROM district_priority_resolved)
)
UPDATE public.districts d SET display_order = o.new_order, updated_at = NOW()
FROM others o WHERE d.id = o.id;

UPDATE public.districts d SET
  display_name = p.tamil_name,
  display_order = p.position,
  updated_at = NOW()
FROM district_priority_resolved p WHERE d.id = p.id;

-- Remaining districts retain their existing names until their approved Tamil translations are supplied.
-- Do not translate code or url_name; existing links depend on them.
SELECT d.id, d.code, d.display_name, d.display_order
FROM public.districts d JOIN public.states s ON s.id = d.state_id
WHERE upper(s.code) = 'TN' ORDER BY d.display_order;

CREATE INDEX IF NOT EXISTS idx_news_district_public_feed
  ON public.news (district_id, published_at DESC, id DESC)
  WHERE status = 'PUBLISHED' AND news_scope = 'DISTRICT';
COMMIT;
