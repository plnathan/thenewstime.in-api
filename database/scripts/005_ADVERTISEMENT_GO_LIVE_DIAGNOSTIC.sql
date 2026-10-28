-- PostgreSQL / Neon. Replace 12345 with your advertisement ID.
-- Diagnostic of the exact delivery repository's core eligibility conditions.
-- Results describe database eligibility, not a guarantee of frontend display.

-- http://localhost:3000/api/v1/advertisements/delivery?pageType=NEWS_DETAIL&placementType=NEWS_DETAIL_SIDEBAR&placementId=514&newsId=238
-- http://localhost:5000/api/v1/advertisements/delivery/slots?pageType=NEWS_DETAIL&placementType=NEWS_DETAIL_MODAL&utm_source=chatgpt.com
-- http://localhost:5000/api/v1/advertisements/delivery/slots?pageType=NEWS_DETAIL&placementType=NEWS_DETAIL_SIDEBAR&utm_source=chatgpt.com

WITH params AS (SELECT 12345::bigint AS advertisement_id, NOW() AS checked_at),
checks AS (
 SELECT a.id AS advertisement_id, a.name, a.status, a.workflow_status, a.is_house_ad,
        a.start_at AS advertisement_start_at, a.end_at AS advertisement_end_at,
        p.id AS placement_id, p.code AS placement_code, p.page_type, p.placement_type,
        p.status AS placement_status, p.is_enabled, p.rotation_enabled,
        pr.id AS placement_rule_id, pr.status AS placement_rule_status,
        s.id AS schedule_id, s.status AS schedule_status, s.start_at AS schedule_start_at,
        s.end_at AS schedule_end_at,
        EXISTS (
          SELECT 1 FROM advertisement_rotation_members rm
          WHERE rm.placement_id=p.id AND rm.advertisement_id=a.id AND rm.status='ACTIVE'
        ) AS active_rotation_member,
        EXISTS (
          SELECT 1 FROM advertisement_creatives c
          WHERE c.advertisement_id=a.id AND c.status='ACTIVE'
            AND NULLIF(BTRIM(c.media_url),'') IS NOT NULL
        ) AS active_creative_present,
        (a.status='ACTIVE' AND a.workflow_status='APPROVED'
          AND a.start_at <= x.checked_at AND a.end_at > x.checked_at) AS advertisement_ready,
        (p.status='ACTIVE' AND p.is_enabled) AS placement_ready,
        (pr.status='ACTIVE') AS placement_rule_ready,
        (s.status='ACTIVE' AND s.start_at <= x.checked_at AND s.end_at > x.checked_at) AS schedule_ready
 FROM params x
 JOIN advertisements a ON a.id=x.advertisement_id
 LEFT JOIN advertisement_placement_rules pr ON pr.advertisement_id=a.id
 LEFT JOIN advertisement_placements p ON p.id=pr.placement_id
 LEFT JOIN advertisement_schedules s ON s.advertisement_id=a.id AND s.placement_id=p.id
   AND (s.placement_rule_id IS NULL OR s.placement_rule_id=pr.id)
)
SELECT *,
 (advertisement_ready AND placement_ready AND placement_rule_ready AND schedule_ready
  AND active_creative_present AND (NOT rotation_enabled OR active_rotation_member)) AS core_delivery_checks_pass,
 CASE
   WHEN NOT advertisement_ready THEN 'Advertisement not ACTIVE/APPROVED or outside its dates'
   WHEN NOT placement_ready THEN 'Placement inactive/disabled/missing'
   WHEN NOT placement_rule_ready THEN 'Placement rule inactive/missing'
   WHEN NOT schedule_ready THEN 'Schedule not ACTIVE/current/matching rule'
   WHEN NOT active_creative_present THEN 'No ACTIVE creative with nonempty media URL'
   WHEN rotation_enabled AND NOT active_rotation_member THEN 'Missing ACTIVE rotation member'
   ELSE 'Core checks pass; inspect targeting, formats, financial/activation policy, and API response'
 END AS next_action
FROM checks
ORDER BY placement_id, placement_rule_id, schedule_id;

-- Also test the actual public API, because delivery applies targeting and creative validation.
-- GET /api/v1/advertisements/delivery/slots?pageType=NEWS_DETAIL&placementType=NEWS_DETAIL_SIDEBAR
-- GET /api/v1/advertisements/delivery?pageType=NEWS_DETAIL&placementType=NEWS_DETAIL_SIDEBAR&placementId=<id>&newsId=<news-id>
