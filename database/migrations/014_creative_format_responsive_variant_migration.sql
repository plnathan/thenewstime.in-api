BEGIN;

-- ============================================================================
-- THE NEWS TIME
-- Advertisement Management
-- UI-4.1 Creative Upload & Preview
--
-- Creative / Format Responsive Variant Migration
--
-- Purpose:
--   1. Add mobile expected dimensions to advertisement_formats.
--   2. Add desktop/mobile creative variant to advertisement_creatives.
--   3. Extend creative types to support VIDEO.
--   4. Add supporting constraints and indexes.
--
-- Design:
--   - Format defines the expected desktop/mobile dimensions.
--   - Creative stores the actual uploaded dimensions.
--   - Dimension differences are NOT rejected here.
--   - Preview status is derived by the API from expected vs actual
--     dimensions/aspect ratio.
--   - Existing creatives are treated as DESKTOP creatives.
--   - Mobile creative is optional; the API can fall back to DESKTOP.
--   - No preview table is required.
-- ============================================================================


-- ============================================================================
-- 1. ADVERTISEMENT FORMATS
-- ============================================================================
--
-- Existing fields:
--   width_px
--   height_px
--
-- New fields:
--   mobile_width_px
--   mobile_height_px
--
-- These represent the EXPECTED dimensions for the format.
--
-- Example:
--
--   Desktop : 1200 x 300
--   Mobile  :  600 x 400
--
-- The actual uploaded creative may differ from these values.
-- ============================================================================

ALTER TABLE public.advertisement_formats
    ADD COLUMN IF NOT EXISTS mobile_width_px INTEGER,
    ADD COLUMN IF NOT EXISTS mobile_height_px INTEGER;


-- ============================================================================
-- 2. MOBILE DIMENSION VALIDATION
-- ============================================================================
--
-- Mobile dimensions must either be NULL or positive integers.
--
-- NULL is intentionally allowed because some formats may be responsive
-- without requiring a fixed mobile dimension.
-- ============================================================================

ALTER TABLE public.advertisement_formats
    DROP CONSTRAINT IF EXISTS chk_advertisement_formats_mobile_width_px;

ALTER TABLE public.advertisement_formats
    ADD CONSTRAINT chk_advertisement_formats_mobile_width_px
    CHECK (
        mobile_width_px IS NULL
        OR mobile_width_px > 0
    );


ALTER TABLE public.advertisement_formats
    DROP CONSTRAINT IF EXISTS chk_advertisement_formats_mobile_height_px;

ALTER TABLE public.advertisement_formats
    ADD CONSTRAINT chk_advertisement_formats_mobile_height_px
    CHECK (
        mobile_height_px IS NULL
        OR mobile_height_px > 0
    );


-- ============================================================================
-- 3. ADVERTISEMENT FORMAT COMMENTS
-- ============================================================================

COMMENT ON COLUMN public.advertisement_formats.mobile_width_px IS
    'Expected mobile creative width in pixels. NULL means no fixed mobile width is defined.';

COMMENT ON COLUMN public.advertisement_formats.mobile_height_px IS
    'Expected mobile creative height in pixels. NULL means no fixed mobile height is defined.';


-- ============================================================================
-- 4. CREATIVE VARIANT
-- ============================================================================
--
-- Existing creatives are automatically assigned:
--
--     DESKTOP
--
-- A second creative may optionally be stored as:
--
--     MOBILE
--
-- The API will use MOBILE when available for mobile rendering and otherwise
-- fall back to DESKTOP.
-- ============================================================================

ALTER TABLE public.advertisement_creatives
    ADD COLUMN IF NOT EXISTS variant VARCHAR(10) NOT NULL DEFAULT 'DESKTOP';


-- ============================================================================
-- 5. CREATIVE VARIANT VALIDATION
-- ============================================================================

ALTER TABLE public.advertisement_creatives
    DROP CONSTRAINT IF EXISTS chk_advertisement_creatives_variant;

ALTER TABLE public.advertisement_creatives
    ADD CONSTRAINT chk_advertisement_creatives_variant
    CHECK (
        variant IN (
            'DESKTOP',
            'MOBILE'
        )
    );


-- ============================================================================
-- 6. EXTEND CREATIVE TYPE
-- ============================================================================
--
-- Existing system:
--
--     IMAGE
--     HTML
--     TEXT
--
-- UI-4.1 additionally supports:
--
--     VIDEO
--
-- Existing rows remain unchanged.
-- ============================================================================

ALTER TABLE public.advertisement_creatives
    DROP CONSTRAINT IF EXISTS chk_advertisement_creatives_type;

ALTER TABLE public.advertisement_creatives
    ADD CONSTRAINT chk_advertisement_creatives_type
    CHECK (
        creative_type IN (
            'IMAGE',
            'VIDEO',
            'HTML',
            'TEXT'
        )
    );


-- ============================================================================
-- 7. CREATIVE VARIANT INDEX
-- ============================================================================
--
-- Optimizes:
--
--   GET /advertisements/:advertisementId/creatives
--   GET active desktop creative
--   GET active mobile creative
--   mobile -> desktop fallback lookup
--
-- Existing advertisement/status indexes remain untouched.
-- ============================================================================

CREATE INDEX IF NOT EXISTS idx_advertisement_creatives_ad_variant_status
    ON public.advertisement_creatives (
        advertisement_id,
        variant,
        status,
        display_order,
        id
    );


-- ============================================================================
-- 8. CREATIVE VARIANT COMMENT
-- ============================================================================

COMMENT ON COLUMN public.advertisement_creatives.variant IS
    'Creative rendering variant. DESKTOP is the default; MOBILE is optional and can be used instead of the desktop creative on mobile devices.';


-- ============================================================================
-- 9. MIGRATION VERIFICATION COMMENTS
-- ============================================================================
--
-- Expected resulting model:
--
-- advertisement_formats
-- ----------------------
-- id
-- code
-- display_name
-- width_px
-- height_px
-- mobile_width_px
-- mobile_height_px
-- is_responsive
-- ...
--
--
-- advertisement_creatives
-- -----------------------
-- id
-- advertisement_id
-- format_id
-- creative_type
-- variant
-- title
-- alt_text
-- media_url
-- thumbnail_url
-- width_px
-- height_px
-- ...
--
--
-- Example:
--
-- Format:
--   Desktop expected = 1200 x 300
--   Mobile expected  = 600 x 400
--
-- Creative 1:
--   variant = DESKTOP
--   actual  = 1180 x 295
--
-- Creative 2:
--   variant = MOBILE
--   actual  = 580 x 390
--
-- The API will assess these dimensions during preview.
-- The database does NOT reject them merely because they differ.
--
-- ============================================================================


COMMIT;