-- READ-ONLY verification for advertisement archive + Cloudinary cleanup.
-- Replace 12345 with the TEST advertisement ID in every query.
-- Run sections 1-3 BEFORE archiving, then 1-6 AFTER archiving.
-- Do not use an advertisement containing images needed elsewhere.

-- 1. Advertisement workflow and delivery status
SELECT id, workflow_status, status
FROM advertisements
WHERE id = 2340;

-- 2. Creative records and Cloudinary URLs (save public_id before archiving)
SELECT id AS creative_id, advertisement_id, status AS creative_status,
       media_url,
       CASE WHEN media_url LIKE 'https://res.cloudinary.com/%'
            THEN regexp_replace(split_part(media_url, '/upload/', 2), '^v[0-9]+/', '')
            ELSE NULL END AS cloudinary_path_with_extension
FROM advertisement_creatives
WHERE advertisement_id = 2340
ORDER BY id;

-- 3. Pre/post archive counts
SELECT COUNT(*) AS total_creatives,
       COUNT(*) FILTER (WHERE status = 'ACTIVE') AS active_creatives,
       COUNT(*) FILTER (WHERE status = 'INACTIVE') AS inactive_creatives
FROM advertisement_creatives
WHERE advertisement_id = 2340;

-- 4. Cleanup queue details (after archive)
SELECT q.id AS cleanup_id, q.advertisement_id, q.creative_id,
       q.public_id, q.resource_type, q.status AS cleanup_status,
       q.attempts, q.last_error, q.next_attempt_at,
       q.deleted_at, q.created_at, q.updated_at
FROM advertisement_creative_cleanup q
WHERE q.advertisement_id = 2340
ORDER BY q.creative_id;

-- 5. Summary of queued cleanup jobs
SELECT COUNT(*) AS total_jobs,
       COUNT(*) FILTER (WHERE status = 'DELETED') AS deleted_jobs,
       COUNT(*) FILTER (WHERE status = 'PENDING') AS pending_jobs,
       COUNT(*) FILTER (WHERE status = 'PROCESSING') AS processing_jobs,
       COUNT(*) FILTER (WHERE status = 'FAILED') AS failed_jobs,
       COUNT(*) FILTER (WHERE status = 'SKIPPED') AS skipped_jobs
FROM advertisement_creative_cleanup
WHERE advertisement_id = 2340;

-- 6. Overall result. A creative with no queue entry may have an external or unsupported URL.
SELECT a.id AS advertisement_id, a.workflow_status,
       COUNT(c.id) AS total_creatives,
       COUNT(c.id) FILTER (WHERE c.status <> 'INACTIVE') AS non_inactive_creatives,
       COUNT(q.id) AS queued_cloudinary_creatives,
       COUNT(q.id) FILTER (WHERE q.status = 'DELETED') AS deleted_cloudinary_creatives,
       COUNT(q.id) FILTER (WHERE q.status IN ('PENDING','PROCESSING','FAILED','SKIPPED')) AS incomplete_cleanup_jobs,
       CASE
         WHEN a.workflow_status <> 'ARCHIVED' THEN 'NOT ARCHIVED'
         WHEN COUNT(c.id) FILTER (WHERE c.status <> 'INACTIVE') > 0 THEN 'CREATIVES STILL ACTIVE'
         WHEN COUNT(q.id) FILTER (WHERE q.status IN ('PENDING','PROCESSING','FAILED','SKIPPED')) > 0 THEN 'CLEANUP INCOMPLETE'
         WHEN COUNT(q.id) = 0 THEN 'ARCHIVED - NO ELIGIBLE CLOUDINARY JOBS'
         ELSE 'ARCHIVED - ALL QUEUED ASSETS DELETED'
       END AS verification_result
FROM advertisements a
LEFT JOIN advertisement_creatives c ON c.advertisement_id = a.id
LEFT JOIN advertisement_creative_cleanup q ON q.creative_id = c.id
WHERE a.id = 2340
GROUP BY a.id, a.workflow_status;

-------------- FOR RETRY SCRIPT -----------------
SELECT
    id,
    advertisement_id,
    creative_id,
    status,
    attempts,
    last_error,
    next_attempt_at,
    NOW() AS current_db_time
FROM advertisement_creative_cleanup
WHERE advertisement_id = 2340;
----------------------------------------