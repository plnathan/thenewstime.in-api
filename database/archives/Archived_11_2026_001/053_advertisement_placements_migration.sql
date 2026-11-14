BEGIN;

ALTER TABLE public.advertisement_placements
DROP CONSTRAINT IF EXISTS chk_advertisement_placements_type;

ALTER TABLE public.advertisement_placements
ADD CONSTRAINT chk_advertisement_placements_type
CHECK (
    placement_type IN (
        -- HOME
        'HOME_TOP',
        'HOME_BANNER',
        'HOME_BETWEEN_SECTIONS',
        'HOME_SIDEBAR',
        'HOME_BOTTOM',
        'HOME_MODAL',

        -- NEWS LIST
        'NEWS_LIST_TOP',
        'NEWS_LIST_BANNER',
        'NEWS_LIST_BETWEEN',
        'NEWS_LIST_SIDEBAR',
        'NEWS_LIST_BOTTOM',
        'NEWS_LIST_MODAL',

        -- NEWS DETAIL
        'NEWS_DETAIL_TOP',
        'NEWS_DETAIL_BANNER',
        'NEWS_DETAIL_BETWEEN',
        'NEWS_DETAIL_SIDEBAR',
        'NEWS_DETAIL_BOTTOM',
        'NEWS_DETAIL_MODAL'
    )
);

COMMIT;