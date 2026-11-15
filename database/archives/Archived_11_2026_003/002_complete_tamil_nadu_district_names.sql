-- Review on UAT first. Only Tamil Nadu districts are updated.
-- Does not change district IDs, codes, URLs, state IDs or status.
-- Unmatched district names are left unchanged and listed at the end.
BEGIN;

CREATE TEMP TABLE tn_district_translation (
  sort_order integer PRIMARY KEY,
  tamil_name varchar(100) NOT NULL,
  aliases text[] NOT NULL
) ON COMMIT DROP;

INSERT INTO tn_district_translation(sort_order, tamil_name, aliases) VALUES
(1, 'சென்னை', ARRAY['chennai','madras']),
(2, 'செங்கல்பட்டு', ARRAY['chengalpattu','chengalpet','chengai']),
(3, 'காஞ்சிபுரம்', ARRAY['kanchipuram','kancheepuram','kanchi']),
(4, 'திருவள்ளூர்', ARRAY['tiruvallur','thiruvallur']),
(5, 'கோயம்புத்தூர்', ARRAY['coimbatore','kovai']),
(6, 'திருச்சிராப்பள்ளி', ARRAY['tiruchirappalli','tiruchirapalli','tiruchirappaly','trichy','tiruchi']),
(7, 'மதுரை', ARRAY['madurai']),
(8, 'திருநெல்வேலி', ARRAY['tirunelveli','tirunelvelli','nellai']),
(9, 'அரியலூர்', ARRAY['ariyalur']),
(10, 'கடலூர்', ARRAY['cuddalore','kadalur']),
(11, 'தர்மபுரி', ARRAY['dharmapuri','dharumapuri']),
(12, 'திண்டுக்கல்', ARRAY['dindigul']),
(13, 'ஈரோடு', ARRAY['erode']),
(14, 'கள்ளக்குறிச்சி', ARRAY['kallakurichi','kallakurichi']),
(15, 'கன்னியாகுமரி', ARRAY['kanyakumari','kanniyakumari','kanyakumari','nagercoil']),
(16, 'கரூர்', ARRAY['karur']),
(17, 'கிருஷ்ணகிரி', ARRAY['krishnagiri']),
(18, 'மயிலாடுதுறை', ARRAY['mayiladuthurai','mayiladuthurai']),
(19, 'நாகப்பட்டினம்', ARRAY['nagapattinam','nagapatinam']),
(20, 'நாமக்கல்', ARRAY['namakkal']),
(21, 'நீலகிரி', ARRAY['nilgiris','nilgiri','the nilgiris','udhagamandalam']),
(22, 'பெரம்பலூர்', ARRAY['perambalur']),
(23, 'புதுக்கோட்டை', ARRAY['pudukkottai','pudukottai']),
(24, 'இராமநாதபுரம்', ARRAY['ramanathapuram','ramnad']),
(25, 'ராணிப்பேட்டை', ARRAY['ranipet','ranipettai']),
(26, 'சேலம்', ARRAY['salem']),
(27, 'சிவகங்கை', ARRAY['sivaganga','sivagangai']),
(28, 'தென்காசி', ARRAY['tenkasi']),
(29, 'தஞ்சாவூர்', ARRAY['thanjavur','tanjore']),
(30, 'தேனி', ARRAY['theni']),
(31, 'தூத்துக்குடி', ARRAY['thoothukudi','tuticorin','thoothukkudi']),
(32, 'திருப்பத்தூர்', ARRAY['tirupathur','tirupattur','tirupaththur','thirupathur']),
(33, 'திருப்பூர்', ARRAY['tiruppur','tirupur']),
(34, 'திருவண்ணாமலை', ARRAY['tiruvannamalai','thiruvannamalai']),
(35, 'திருவாரூர்', ARRAY['tiruvarur','thiruvarur']),
(36, 'வேலூர்', ARRAY['vellore']),
(37, 'விழுப்புரம்', ARRAY['viluppuram','villupuram']),
(38, 'விருதுநகர்', ARRAY['virudhunagar','virudunagar']);

-- Normalize only Latin aliases, avoiding changes to existing Tamil values.
CREATE TEMP TABLE tn_resolved ON COMMIT DROP AS
SELECT d.id, t.sort_order, t.tamil_name
FROM public.districts d
JOIN public.states s ON s.id = d.state_id AND upper(s.code) = 'TN'
JOIN tn_district_translation t ON (
  d.display_name = t.tamil_name
  OR EXISTS (
    SELECT 1 FROM unnest(t.aliases) alias
    WHERE lower(regexp_replace(d.code, '[^a-zA-Z0-9]', '', 'g')) =
          lower(regexp_replace(alias, '[^a-zA-Z0-9]', '', 'g'))
       OR lower(regexp_replace(d.url_name, '[^a-zA-Z0-9]', '', 'g')) =
          lower(regexp_replace(alias, '[^a-zA-Z0-9]', '', 'g'))
       OR lower(regexp_replace(d.display_name, '[^a-zA-Z0-9]', '', 'g')) =
          lower(regexp_replace(alias, '[^a-zA-Z0-9]', '', 'g'))
  )
);

DO $$
BEGIN
  IF EXISTS (SELECT 1 FROM tn_resolved GROUP BY id HAVING COUNT(*) <> 1)
     OR EXISTS (SELECT 1 FROM tn_resolved GROUP BY sort_order HAVING COUNT(*) <> 1)
  THEN
    RAISE EXCEPTION 'Ambiguous district translation mapping. Review district codes and aliases.';
  END IF;
  IF (SELECT COUNT(*) FROM tn_resolved WHERE sort_order BETWEEN 1 AND 8) <> 8 THEN
    RAISE EXCEPTION 'The eight reserved district records were not uniquely identified.';
  END IF;
END $$;

-- Other TN districts (if any) are placed after the known 38 in their existing order.
WITH remaining AS (
  SELECT d.id, 38 + ROW_NUMBER() OVER (ORDER BY d.display_order, d.id) AS sort_order
  FROM public.districts d JOIN public.states s ON s.id = d.state_id
  WHERE upper(s.code) = 'TN' AND NOT EXISTS (SELECT 1 FROM tn_resolved r WHERE r.id = d.id)
)
UPDATE public.districts d
SET display_order = r.sort_order, updated_at = NOW()
FROM remaining r WHERE r.id = d.id;

UPDATE public.districts d
SET display_name = r.tamil_name, display_order = r.sort_order, updated_at = NOW()
FROM tn_resolved r WHERE r.id = d.id;

-- Review this result; unmatched districts remain unchanged (no invented translations).
SELECT d.id, d.code, d.display_name, d.display_order,
       CASE WHEN r.id IS NULL THEN 'REVIEW_UNMATCHED' ELSE 'TRANSLATED' END AS migration_result
FROM public.districts d
JOIN public.states s ON s.id = d.state_id AND upper(s.code) = 'TN'
LEFT JOIN tn_resolved r ON r.id = d.id
ORDER BY d.display_order, d.id;

COMMIT;
