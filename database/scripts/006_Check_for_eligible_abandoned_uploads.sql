-- Check for eligible abandoned uploads - Testing
-- Step 1:

SELECT
    ma.id,
    ma.public_id,
    ma.created_at,
    ma.status
FROM media_assets ma
WHERE ma.provider = 'CLOUDINARY'
  AND ma.status = 'ACTIVE'
  AND ma.created_at < NOW() - INTERVAL '7 days'
  AND NOT EXISTS (
      SELECT 1
      FROM news_media nm
      WHERE nm.media_asset_id = ma.id
  )
ORDER BY ma.created_at;

-- Step 2:

UPDATE media_assets
SET created_at = NOW() - INTERVAL '8 days'
WHERE id = 12345
  AND provider = 'CLOUDINARY'
  AND status = 'ACTIVE'
  AND NOT EXISTS (
      SELECT 1
      FROM news_media
      WHERE media_asset_id = 12345
  );

-- Step 3:

$baseUrl = "https://thenewstime-in-api-swart.vercel.app"

--$secret = "F74EF554B4A91401BFF519F547C9D702F7CAE89170C1830BE783F95E5E445E8D"
$secret = $env:CRON_SECRET

Invoke-RestMethod `
    -Uri "$baseUrl/api/v1/system/cloudinary-cleanup" `
    -Method GET `
    -Headers @{
        Authorization = "Bearer $secret"
    }

OR For local testing:

$baseUrl = "http://localhost:5000"

$secret = $env:CRON_SECRET

$response = Invoke-RestMethod `
    -Uri "$baseUrl/api/v1/system/cloudinary-cleanup" `
    -Method GET `
    -Headers @{
        Authorization = "Bearer $secret"
    }

$response | ConvertTo-Json -Depth 5

------------------------------
# Enter the exact CRON_SECRET value from your backend .env
$cronSecret = Read-Host "Enter CRON_SECRET"

# Remove accidental leading/trailing spaces
$cronSecret = $cronSecret.Trim()

# Use the secret already entered
$authHeader = "Bearer " + $cronSecret

# IMPORTANT: Recreate the headers variable
$headers = @{
    Authorization = $authHeader
    Accept = "application/json"
}

# Verify before sending
Write-Host "Secret length:" $cronSecret.Length
Write-Host "Bearer prefix valid:" $headers.Authorization.StartsWith("Bearer ")
Write-Host "Authorization header length:" $headers.Authorization.Length

# Invoke the API
Invoke-RestMethod `
    -Uri "http://localhost:5000/api/v1/system/cloudinary-cleanup" `
    -Method Get `
    -Headers $headers
------------------------------
-- Step 4: Verify the cleanup

    SELECT
    id,
    public_id,
    reason,
    status,
    attempts,
    last_error
FROM cloudinary_cleanup_jobs
WHERE reason = 'ABANDONED_UPLOAD'
ORDER BY id DESC
LIMIT 20;

OR 

SELECT
    public_id,
    reason,
    status,
    attempts,
    last_error
FROM cloudinary_cleanup_jobs
WHERE public_id = 'cleanup-testing/abandoned-test-001';

-----------------------------------------
-- Create a Mock record for testing:

-- STEP 1: Insert one disposable, unreferenced media asset.
-- Replace the public ID, URL, and uploaded_by user ID.

INSERT INTO media_assets (
    provider,
    asset_type,
    public_id,
    original_file_name,
    mime_type,
    file_extension,
    file_size_bytes,
    width,
    height,
    alt_text,
    caption,
    file_url,
    thumbnail_url,
    status,
    uploaded_by,
    created_at
)
VALUES (
    'CLOUDINARY',
    'IMAGE',
    'cleanup-testing/abandoned-test-001',
    'abandoned-test-001.jpg',
    'image/jpeg',
    'jpg',
    10240,
    100,
    100,
    'Abandoned cleanup test',
    'Disposable test asset',
    'https://res.cloudinary.com/YOUR_CLOUD_NAME/image/upload/v1/cleanup-testing/abandoned-test-001.jpg',
    NULL,
    'ACTIVE',
    1,
    NOW() - INTERVAL '8 days'
)
RETURNING id, public_id, status, created_at;

-- STEP 2: Verify the inserted record / after the cleanup job has been executed, check if the record is still present in the media_assets table.

SELECT
    ma.id,
    ma.public_id,
    ma.status,
    ma.created_at,
    COUNT(nm.id) AS news_references
FROM media_assets ma
LEFT JOIN news_media nm
    ON nm.media_asset_id = ma.id
WHERE ma.public_id = 'cleanup-testing/abandoned-test-001'
GROUP BY ma.id, ma.public_id, ma.status, ma.created_at;

SELECT
    nm.news_id,
    ma.id AS media_asset_id,
    ma.public_id,
    ma.status,
    ma.created_at
FROM public.news_media nm
JOIN public.media_assets ma
    ON ma.id = nm.media_asset_id
WHERE nm.news_id = 698;

-- To verify Eligible records:

SELECT
    ma.id,
    ma.public_id,
    ma.provider,
    ma.status,
    ma.created_at,
    NOW() - ma.created_at AS asset_age,
    CASE
        WHEN ma.created_at <= NOW() - INTERVAL '7 days'
        THEN 'ELIGIBLE'
        ELSE 'TOO_RECENT'
    END AS retention_check,
    CASE
        WHEN ma.provider = 'CLOUDINARY'
         AND ma.status = 'ACTIVE'
        THEN 'ELIGIBLE'
        ELSE 'NOT_ELIGIBLE'
    END AS provider_status_check,
    (
        SELECT COUNT(*)
        FROM news_media nm
        WHERE nm.media_asset_id = ma.id
    ) AS news_references
FROM media_assets ma
WHERE ma.public_id = 'cleanup-testing/abandoned-test-001';


--- USAGE QUERIES -----------

SELECT
    public_id,
    reason,
    status,
    last_error
FROM public.cloudinary_cleanup_jobs
WHERE public_id = 'YOUR_DRAFT_IMAGE_PUBLIC_ID'
  AND reason = 'ABANDONED_UPLOAD';

  SELECT
    current_database() AS database_name,
    current_schema() AS schema_name,
    current_user AS database_user,
    inet_server_addr() AS server_address,
    inet_server_port() AS server_port;

	SELECT
    id,
    public_id,
    status,
    created_at
FROM public.media_assets
ORDER BY id DESC
LIMIT 20;

SELECT
    id,
    public_id,
    provider,
    status,
    created_at
FROM public.media_assets
WHERE public_id = 'cleanup-testing/abandoned-test-001';

SELECT
    COUNT(*) AS total_jobs
FROM public.cloudinary_cleanup_jobs;

SELECT
    column_name,
    data_type
FROM information_schema.columns
WHERE table_schema = 'public'
  AND table_name = 'cloudinary_cleanup_jobs'
ORDER BY ordinal_position;

SELECT
    ma.id,
    ma.public_id,
    ma.status,
    ma.created_at,
    COUNT(nm.id) AS news_references
FROM media_assets ma
LEFT JOIN news_media nm
    ON nm.media_asset_id = ma.id
WHERE ma.public_id = 'cleanup-testing/abandoned-test-001'
GROUP BY ma.id, ma.public_id, ma.status, ma.created_at;

SELECT
    id,
    public_id,
    provider,
    status,
    created_at
FROM media_assets
WHERE public_id ILIKE '%abandoned%'
ORDER BY id DESC;

SELECT
    id,
    public_id,
    reason,
    status,
    attempts,
    last_error
FROM cloudinary_cleanup_jobs
ORDER BY id DESC
LIMIT 30;

SELECT
    current_database() AS database_name,
    current_user AS database_user,
    current_schema() AS schema_name,
    inet_server_addr()::text AS server_address,
    inet_server_port() AS server_port,
    (
        SELECT COUNT(*)::text
        FROM public.media_assets
        WHERE public_id = 'cleanup-testing/abandoned-test-001'
    ) AS mock_count,
    (
        SELECT COUNT(*)::text
        FROM public.cloudinary_cleanup_jobs
    ) AS cleanup_job_count;

SELECT
    nm.news_id,
    ma.id AS media_asset_id,
    ma.public_id,
    ma.status,
    ma.created_at
FROM public.news_media nm
JOIN public.media_assets ma
    ON ma.id = nm.media_asset_id
WHERE nm.news_id = 698;

UPDATE public.media_assets
SET
    created_at = NOW() - INTERVAL '8 days',
    updated_at = NOW()
WHERE id = 33
  AND provider = 'CLOUDINARY'
  AND status = 'ACTIVE'
  AND EXISTS (
      SELECT 1
      FROM public.news_media nm
      WHERE nm.media_asset_id = media_assets.id
  )
RETURNING
    id,
    public_id,
    status,
    created_at;

SELECT
    nm.news_id,
    ma.id AS media_asset_id,
    ma.public_id,
    ma.status,
    ma.created_at,
    cj.id AS cleanup_job_id,
    cj.reason AS cleanup_reason,
    cj.status AS cleanup_status
FROM public.news_media nm
JOIN public.media_assets ma
    ON ma.id = nm.media_asset_id
LEFT JOIN public.cloudinary_cleanup_jobs cj
    ON cj.public_id = ma.public_id
WHERE nm.news_id = 698;
---------------------------------
SELECT
    id,
    public_id,
    reason,
    status,
    attempts,
    next_attempt_at,
    last_error
FROM cloudinary_cleanup_jobs
ORDER BY created_at DESC
LIMIT 20;