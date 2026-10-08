BEGIN;

-- ============================================================
-- TheNewsTime.in
-- Advertisement Placement / Format Test Data
--
-- Purpose:
--   Populate meaningful predefined advertisement formats and
--   placements for Advertisement Create UI testing.
--
-- Safety:
--   Only rows with codes beginning with TNT_TEST_ are removed.
--   Existing non-test master data is preserved.
--
-- Relationship:
--   advertisement_placements.format_id
--       -> advertisement_formats.id
-- ============================================================


-- ============================================================
-- 1. CLEAN UP PREVIOUS TEST DATA
-- ============================================================

-- Placements must be removed before formats because
-- advertisement_placements.format_id references
-- advertisement_formats.id with ON DELETE RESTRICT.

delete from advertisement_pricing_snapshots

delete from advertisement_rate_cards

delete from advertisement_schedules

delete from advertisement_impressions

delete from advertisement_clicks

delete from advertisement_workflow_history

delete from advertisement_financial_approvals

delete from advertisement_payments

delete from advertisements

DELETE FROM public.advertisement_placements

DELETE FROM public.advertisement_formats



-- ============================================================
-- 2. INSERT TEST ADVERTISEMENT FORMATS
-- ============================================================

-- ------------------------------------------------------------
-- 1200 x 250 desktop banner
-- Mobile equivalent: 320 x 100
-- ------------------------------------------------------------
INSERT INTO public.advertisement_formats (
    code,
    display_name,
    description,
    width_px,
    height_px,
    is_responsive,
    is_system_format,
    status,
    display_order,
    mobile_width_px,
    mobile_height_px
)
VALUES (
    'TNT_TEST_BANNER_1200X250',
    'Test Banner 1200 × 250',
    'Standard wide banner format for desktop and tablet layouts.',
    1200,
    250,
    true,
    true,
    'ACTIVE',
    10,
    320,
    100
);


-- ------------------------------------------------------------
-- 300 x 600 desktop sidebar
-- Mobile equivalent: 300 x 250
--
-- This is intentionally used for:
--   Home Sidebar
--   News List Sidebar
--   News Detail Sidebar
-- ------------------------------------------------------------
INSERT INTO public.advertisement_formats (
    code,
    display_name,
    description,
    width_px,
    height_px,
    is_responsive,
    is_system_format,
    status,
    display_order,
    mobile_width_px,
    mobile_height_px
)
VALUES (
    'TNT_TEST_SIDEBAR_300X600',
    'Test Sidebar 300 × 600',
    'Standard tall sidebar format for desktop layouts. Mobile fallback uses 300 × 250.',
    300,
    600,
    true,
    true,
    'ACTIVE',
    20,
    300,
    250
);


-- ------------------------------------------------------------
-- 1200 x 200 section banner
-- Mobile equivalent: 320 x 100
-- ------------------------------------------------------------
INSERT INTO public.advertisement_formats (
    code,
    display_name,
    description,
    width_px,
    height_px,
    is_responsive,
    is_system_format,
    status,
    display_order,
    mobile_width_px,
    mobile_height_px
)
VALUES (
    'TNT_TEST_SECTION_1200X200',
    'Test Section Banner 1200 × 200',
    'Compact horizontal banner for between-section advertisement placements.',
    1200,
    200,
    true,
    true,
    'ACTIVE',
    30,
    320,
    100
);


-- ------------------------------------------------------------
-- 600 x 400 modal
-- Mobile equivalent: 320 x 480
-- ------------------------------------------------------------
INSERT INTO public.advertisement_formats (
    code,
    display_name,
    description,
    width_px,
    height_px,
    is_responsive,
    is_system_format,
    status,
    display_order,
    mobile_width_px,
    mobile_height_px
)
VALUES (
    'TNT_TEST_MODAL_600X400',
    'Test Modal 600 × 400',
    'Modal advertisement format for desktop and mobile overlay presentation.',
    600,
    400,
    true,
    true,
    'ACTIVE',
    40,
    320,
    480
);


-- ------------------------------------------------------------
-- 970 x 250 large desktop banner
-- Mobile equivalent: 320 x 100
-- ------------------------------------------------------------
INSERT INTO public.advertisement_formats (
    code,
    display_name,
    description,
    width_px,
    height_px,
    is_responsive,
    is_system_format,
    status,
    display_order,
    mobile_width_px,
    mobile_height_px
)
VALUES (
    'TNT_TEST_LEADERBOARD_970X250',
    'Test Large Banner 970 × 250',
    'Large desktop banner suitable for prominent news-page advertising.',
    970,
    250,
    true,
    true,
    'ACTIVE',
    50,
    320,
    100
);


-- ============================================================
-- 3. INSERT TEST ADVERTISEMENT PLACEMENTS
-- ============================================================

-- ------------------------------------------------------------
-- HOME
-- ------------------------------------------------------------

-- Home top banner
INSERT INTO public.advertisement_placements (
    code,
    display_name,
    description,
    page_type,
    placement_type,
    insertion_type,
    display_order,
    is_enabled,
    collapse_when_empty,
    fallback_behavior,
    status,
    rotation_enabled,
    rotation_mode,
    rotation_interval_seconds,
    rotation_strategy,
    format_id
)
SELECT
    'TNT_TEST_HOME_TOP',
    'Home Top Banner',
    'Primary advertisement placement at the top of the homepage.',
    'HOME',
    'HOME_TOP',
    'FIXED',
    10,
    true,
    true,
    'HIDE',
    'ACTIVE',
    false,
    'TIME_BASED',
    10,
    'ROUND_ROBIN',
    id
FROM public.advertisement_formats
WHERE code = 'TNT_TEST_BANNER_1200X250';


-- Home sidebar
INSERT INTO public.advertisement_placements (
    code,
    display_name,
    description,
    page_type,
    placement_type,
    insertion_type,
    display_order,
    is_enabled,
    collapse_when_empty,
    fallback_behavior,
    status,
    rotation_enabled,
    rotation_mode,
    rotation_interval_seconds,
    rotation_strategy,
    format_id
)
SELECT
    'TNT_TEST_HOME_SIDEBAR',
    'Home Sidebar',
    'Tall sidebar advertisement on the homepage. Desktop format is 300 × 600.',
    'HOME',
    'HOME_SIDEBAR',
    'FIXED',
    20,
    true,
    true,
    'HIDE',
    'ACTIVE',
    false,
    'TIME_BASED',
    10,
    'ROUND_ROBIN',
    id
FROM public.advertisement_formats
WHERE code = 'TNT_TEST_SIDEBAR_300X600';


-- Home between sections
INSERT INTO public.advertisement_placements (
    code,
    display_name,
    description,
    page_type,
    placement_type,
    insertion_type,
    display_order,
    is_enabled,
    collapse_when_empty,
    fallback_behavior,
    status,
    rotation_enabled,
    rotation_mode,
    rotation_interval_seconds,
    rotation_strategy,
    format_id
)
SELECT
    'TNT_TEST_HOME_BETWEEN_SECTIONS',
    'Home Between Sections',
    'Advertisement inserted between homepage content sections.',
    'HOME',
    'HOME_BETWEEN_SECTIONS',
    'BETWEEN_SECTIONS',
    30,
    true,
    true,
    'HIDE',
    'ACTIVE',
    false,
    'TIME_BASED',
    10,
    'ROUND_ROBIN',
    id
FROM public.advertisement_formats
WHERE code = 'TNT_TEST_SECTION_1200X200';


-- ------------------------------------------------------------
-- NEWS LIST
-- ------------------------------------------------------------

-- News list top
INSERT INTO public.advertisement_placements (
    code,
    display_name,
    description,
    page_type,
    placement_type,
    insertion_type,
    display_order,
    is_enabled,
    collapse_when_empty,
    fallback_behavior,
    status,
    rotation_enabled,
    rotation_mode,
    rotation_interval_seconds,
    rotation_strategy,
    format_id
)
SELECT
    'TNT_TEST_NEWS_LIST_TOP',
    'News List Top Banner',
    'Primary banner displayed above the news listing.',
    'NEWS_LIST',
    'NEWS_LIST_TOP',
    'FIXED',
    10,
    true,
    true,
    'HIDE',
    'ACTIVE',
    false,
    'TIME_BASED',
    10,
    'ROUND_ROBIN',
    id
FROM public.advertisement_formats
WHERE code = 'TNT_TEST_BANNER_1200X250';


-- News list sidebar
INSERT INTO public.advertisement_placements (
    code,
    display_name,
    description,
    page_type,
    placement_type,
    insertion_type,
    display_order,
    is_enabled,
    collapse_when_empty,
    fallback_behavior,
    status,
    rotation_enabled,
    rotation_mode,
    rotation_interval_seconds,
    rotation_strategy,
    format_id
)
SELECT
    'TNT_TEST_NEWS_LIST_SIDEBAR',
    'News List Sidebar',
    'Tall sidebar advertisement displayed beside the news listing. Desktop format is 300 × 600.',
    'NEWS_LIST',
    'NEWS_LIST_SIDEBAR',
    'FIXED',
    20,
    true,
    true,
    'HIDE',
    'ACTIVE',
    false,
    'TIME_BASED',
    10,
    'ROUND_ROBIN',
    id
FROM public.advertisement_formats
WHERE code = 'TNT_TEST_SIDEBAR_300X600';


-- News list between items
INSERT INTO public.advertisement_placements (
    code,
    display_name,
    description,
    page_type,
    placement_type,
    insertion_type,
    display_order,
    is_enabled,
    collapse_when_empty,
    fallback_behavior,
    display_frequency,
    frequency_value,
    status,
    rotation_enabled,
    rotation_mode,
    rotation_interval_seconds,
    rotation_strategy,
    format_id
)
SELECT
    'TNT_TEST_NEWS_LIST_BETWEEN',
    'News List Between Articles',
    'Advertisement inserted after a configured number of news items.',
    'NEWS_LIST',
    'NEWS_LIST_BETWEEN',
    'AFTER_N_ITEMS',
    30,
    true,
    true,
    'HIDE',
    'EVERY_VISIT',
    5,
    'ACTIVE',
    false,
    'TIME_BASED',
    10,
    'ROUND_ROBIN',
    id
FROM public.advertisement_formats
WHERE code = 'TNT_TEST_SECTION_1200X200';


-- News list bottom
INSERT INTO public.advertisement_placements (
    code,
    display_name,
    description,
    page_type,
    placement_type,
    insertion_type,
    display_order,
    is_enabled,
    collapse_when_empty,
    fallback_behavior,
    status,
    rotation_enabled,
    rotation_mode,
    rotation_interval_seconds,
    rotation_strategy,
    format_id
)
SELECT
    'TNT_TEST_NEWS_LIST_BOTTOM',
    'News List Bottom Banner',
    'Advertisement displayed after the news listing.',
    'NEWS_LIST',
    'NEWS_LIST_BOTTOM',
    'FIXED',
    40,
    true,
    true,
    'HIDE',
    'ACTIVE',
    false,
    'TIME_BASED',
    10,
    'ROUND_ROBIN',
    id
FROM public.advertisement_formats
WHERE code = 'TNT_TEST_BANNER_1200X250';


-- ------------------------------------------------------------
-- NEWS DETAIL
-- ------------------------------------------------------------

-- News detail top
INSERT INTO public.advertisement_placements (
    code,
    display_name,
    description,
    page_type,
    placement_type,
    insertion_type,
    display_order,
    is_enabled,
    collapse_when_empty,
    fallback_behavior,
    status,
    rotation_enabled,
    rotation_mode,
    rotation_interval_seconds,
    rotation_strategy,
    format_id
)
SELECT
    'TNT_TEST_NEWS_DETAIL_TOP',
    'News Detail Top Banner',
    'Primary advertisement displayed above the news article.',
    'NEWS_DETAIL',
    'NEWS_DETAIL_TOP',
    'FIXED',
    10,
    true,
    true,
    'HIDE',
    'ACTIVE',
    false,
    'TIME_BASED',
    10,
    'ROUND_ROBIN',
    id
FROM public.advertisement_formats
WHERE code = 'TNT_TEST_BANNER_1200X250';


-- News detail sidebar
INSERT INTO public.advertisement_placements (
    code,
    display_name,
    description,
    page_type,
    placement_type,
    insertion_type,
    display_order,
    is_enabled,
    collapse_when_empty,
    fallback_behavior,
    status,
    rotation_enabled,
    rotation_mode,
    rotation_interval_seconds,
    rotation_strategy,
    format_id
)
SELECT
    'TNT_TEST_NEWS_DETAIL_SIDEBAR',
    'News Detail Sidebar',
    'Tall sidebar advertisement displayed beside the article. Desktop format is 300 × 600.',
    'NEWS_DETAIL',
    'NEWS_DETAIL_SIDEBAR',
    'FIXED',
    20,
    true,
    true,
    'HIDE',
    'ACTIVE',
    false,
    'TIME_BASED',
    10,
    'ROUND_ROBIN',
    id
FROM public.advertisement_formats
WHERE code = 'TNT_TEST_SIDEBAR_300X600';


-- News detail between sections
INSERT INTO public.advertisement_placements (
    code,
    display_name,
    description,
    page_type,
    placement_type,
    insertion_type,
    display_order,
    is_enabled,
    collapse_when_empty,
    fallback_behavior,
    status,
    rotation_enabled,
    rotation_mode,
    rotation_interval_seconds,
    rotation_strategy,
    format_id
)
SELECT
    'TNT_TEST_NEWS_DETAIL_BETWEEN',
    'News Detail Between Sections',
    'Advertisement inserted between article content sections.',
    'NEWS_DETAIL',
    'NEWS_DETAIL_BETWEEN',
    'BETWEEN_SECTIONS',
    30,
    true,
    true,
    'HIDE',
    'ACTIVE',
    false,
    'TIME_BASED',
    10,
    'ROUND_ROBIN',
    id
FROM public.advertisement_formats
WHERE code = 'TNT_TEST_SECTION_1200X200';


-- News detail bottom
INSERT INTO public.advertisement_placements (
    code,
    display_name,
    description,
    page_type,
    placement_type,
    insertion_type,
    display_order,
    is_enabled,
    collapse_when_empty,
    fallback_behavior,
    status,
    rotation_enabled,
    rotation_mode,
    rotation_interval_seconds,
    rotation_strategy,
    format_id
)
SELECT
    'TNT_TEST_NEWS_DETAIL_BOTTOM',
    'News Detail Bottom Banner',
    'Advertisement displayed after the article content.',
    'NEWS_DETAIL',
    'NEWS_DETAIL_BOTTOM',
    'FIXED',
    40,
    true,
    true,
    'HIDE',
    'ACTIVE',
    false,
    'TIME_BASED',
    10,
    'ROUND_ROBIN',
    id
FROM public.advertisement_formats
WHERE code = 'TNT_TEST_BANNER_1200X250';


-- ------------------------------------------------------------
-- NEWS LIST MODAL
-- ------------------------------------------------------------

INSERT INTO public.advertisement_placements (
    code,
    display_name,
    description,
    page_type,
    placement_type,
    insertion_type,
    display_order,
    is_enabled,
    collapse_when_empty,
    fallback_behavior,
    display_frequency,
    frequency_value,
    auto_close_enabled,
    auto_close_seconds,
    close_button_enabled,
    close_on_overlay_click,
    status,
    rotation_enabled,
    rotation_mode,
    rotation_interval_seconds,
    rotation_strategy,
    format_id
)
SELECT
    'TNT_TEST_NEWS_LIST_MODAL',
    'News List Modal',
    'Modal advertisement displayed while browsing the news list.',
    'NEWS_LIST',
    'NEWS_LIST_MODAL',
    'FIXED',
    50,
    true,
    true,
    'HIDE',
    'ONCE_PER_SESSION',
    1,
    true,
    10,
    true,
    true,
    'ACTIVE',
    false,
    'TIME_BASED',
    10,
    'ROUND_ROBIN',
    id
FROM public.advertisement_formats
WHERE code = 'TNT_TEST_MODAL_600X400';


-- ------------------------------------------------------------
-- NEWS DETAIL MODAL
-- ------------------------------------------------------------

INSERT INTO public.advertisement_placements (
    code,
    display_name,
    description,
    page_type,
    placement_type,
    insertion_type,
    display_order,
    is_enabled,
    collapse_when_empty,
    fallback_behavior,
    display_frequency,
    frequency_value,
    auto_close_enabled,
    auto_close_seconds,
    close_button_enabled,
    close_on_overlay_click,
    status,
    rotation_enabled,
    rotation_mode,
    rotation_interval_seconds,
    rotation_strategy,
    format_id
)
SELECT
    'TNT_TEST_NEWS_DETAIL_MODAL',
    'News Detail Modal',
    'Modal advertisement displayed while reading an article.',
    'NEWS_DETAIL',
    'NEWS_DETAIL_MODAL',
    'FIXED',
    50,
    true,
    true,
    'HIDE',
    'ONCE_PER_SESSION',
    1,
    true,
    10,
    true,
    true,
    'ACTIVE',
    false,
    'TIME_BASED',
    10,
    'ROUND_ROBIN',
    id
FROM public.advertisement_formats
WHERE code = 'TNT_TEST_MODAL_600X400';


-- ============================================================
-- 4. VERIFY THE RESULT
-- ============================================================

SELECT
    p.id AS placement_id,
    p.code AS placement_code,
    p.display_name AS placement_name,
    p.page_type,
    p.placement_type,
    p.insertion_type,
    p.is_enabled,
    p.status AS placement_status,
    f.id AS format_id,
    f.code AS format_code,
    f.display_name AS format_name,
    f.width_px AS desktop_width_px,
    f.height_px AS desktop_height_px,
    f.mobile_width_px,
    f.mobile_height_px,
    f.is_responsive,
    f.status AS format_status
FROM public.advertisement_placements p
LEFT JOIN public.advertisement_formats f
    ON f.id = p.format_id
WHERE p.code LIKE 'TNT_TEST_%'
ORDER BY
    p.page_type,
    p.display_order,
    p.id;


COMMIT;