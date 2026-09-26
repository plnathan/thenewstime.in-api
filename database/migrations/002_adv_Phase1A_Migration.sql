BEGIN;

-- ============================================================
-- THE NEWS TIME
-- Advertisement Management - Phase 1
--
-- Purpose:
--   Establish the independent advertisement management foundation.
--
-- Design principles:
--   1. Advertisements are independent from news content.
--   2. Placements determine WHERE an advertisement can appear.
--   3. Schedules determine WHEN an advertisement can appear.
--   4. Targets determine WHO/WHAT the advertisement targets.
--   5. Placement rules determine HOW advertisements are inserted.
--   6. Empty placements can be collapsed/hidden.
--   7. Fallback behavior is configurable.
-- ============================================================


-- ============================================================
-- 1. ADVERTISEMENT FORMATS
-- ============================================================

CREATE TABLE IF NOT EXISTS advertisement_formats (
    id BIGINT GENERATED ALWAYS AS IDENTITY PRIMARY KEY,

    code VARCHAR(50) NOT NULL,
    display_name VARCHAR(100) NOT NULL,
    description TEXT,

    width_px INTEGER,
    height_px INTEGER,

    is_responsive BOOLEAN NOT NULL DEFAULT TRUE,
    is_system_format BOOLEAN NOT NULL DEFAULT FALSE,

    status VARCHAR(20) NOT NULL DEFAULT 'ACTIVE',

    display_order INTEGER NOT NULL DEFAULT 0,

    created_at TIMESTAMPTZ NOT NULL DEFAULT CURRENT_TIMESTAMP,
    updated_at TIMESTAMPTZ NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT uq_advertisement_formats_code
        UNIQUE (code),

    CONSTRAINT chk_advertisement_formats_status
        CHECK (status IN ('ACTIVE', 'INACTIVE')),

    CONSTRAINT chk_advertisement_formats_width
        CHECK (width_px IS NULL OR width_px > 0),

    CONSTRAINT chk_advertisement_formats_height
        CHECK (height_px IS NULL OR height_px > 0)
);


-- ============================================================
-- 2. ADVERTISERS
-- ============================================================

CREATE TABLE IF NOT EXISTS advertisers (
    id BIGINT GENERATED ALWAYS AS IDENTITY PRIMARY KEY,

    name VARCHAR(200) NOT NULL,
    display_name VARCHAR(200),

    contact_person VARCHAR(200),
    email VARCHAR(255),
    mobile VARCHAR(30),

    website_url TEXT,

    status VARCHAR(20) NOT NULL DEFAULT 'ACTIVE',

    notes TEXT,

    created_by BIGINT,
    updated_by BIGINT,

    created_at TIMESTAMPTZ NOT NULL DEFAULT CURRENT_TIMESTAMP,
    updated_at TIMESTAMPTZ NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT chk_advertisers_status
        CHECK (status IN ('ACTIVE', 'INACTIVE'))
);


-- ============================================================
-- 3. ADVERTISEMENT CAMPAIGNS
-- ============================================================

CREATE TABLE IF NOT EXISTS advertisement_campaigns (
    id BIGINT GENERATED ALWAYS AS IDENTITY PRIMARY KEY,

    advertiser_id BIGINT NOT NULL,

    name VARCHAR(200) NOT NULL,
    description TEXT,

    status VARCHAR(20) NOT NULL DEFAULT 'DRAFT',

    priority INTEGER NOT NULL DEFAULT 0,

    start_at TIMESTAMPTZ,
    end_at TIMESTAMPTZ,

    created_by BIGINT,
    updated_by BIGINT,

    created_at TIMESTAMPTZ NOT NULL DEFAULT CURRENT_TIMESTAMP,
    updated_at TIMESTAMPTZ NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT fk_advertisement_campaigns_advertiser
        FOREIGN KEY (advertiser_id)
        REFERENCES advertisers(id),

    CONSTRAINT chk_advertisement_campaigns_status
        CHECK (
            status IN (
                'DRAFT',
                'ACTIVE',
                'PAUSED',
                'COMPLETED',
                'ARCHIVED'
            )
        ),

    CONSTRAINT chk_advertisement_campaigns_priority
        CHECK (priority >= 0),

    CONSTRAINT chk_advertisement_campaigns_schedule
        CHECK (
            end_at IS NULL
            OR start_at IS NULL
            OR end_at > start_at
        )
);


-- ============================================================
-- 4. ADVERTISEMENT PLACEMENTS
--
-- A placement represents a location/slot in the website.
--
-- fallback_behavior:
--   HIDE
--
-- When no eligible advertisement exists:
--   HIDE = do not render the placement.
--
-- collapse_when_empty:
--   TRUE = no empty container / unnecessary vertical space.
-- ============================================================

CREATE TABLE IF NOT EXISTS advertisement_placements (
    id BIGINT GENERATED ALWAYS AS IDENTITY PRIMARY KEY,

    code VARCHAR(100) NOT NULL,
    display_name VARCHAR(150) NOT NULL,
    description TEXT,

    page_type VARCHAR(30) NOT NULL,

    placement_type VARCHAR(60) NOT NULL,

    insertion_type VARCHAR(40) NOT NULL DEFAULT 'FIXED',

    display_order INTEGER NOT NULL DEFAULT 0,

    is_enabled BOOLEAN NOT NULL DEFAULT TRUE,

    collapse_when_empty BOOLEAN NOT NULL DEFAULT TRUE,

    fallback_behavior VARCHAR(30) NOT NULL DEFAULT 'HIDE',

    -- Modal / overlay configuration
    display_frequency VARCHAR(30),
    frequency_value INTEGER,

    auto_close_enabled BOOLEAN NOT NULL DEFAULT FALSE,
    auto_close_seconds INTEGER,

    close_button_enabled BOOLEAN NOT NULL DEFAULT TRUE,
    close_on_overlay_click BOOLEAN NOT NULL DEFAULT TRUE,

    status VARCHAR(20) NOT NULL DEFAULT 'ACTIVE',

    created_by BIGINT,
    updated_by BIGINT,

    created_at TIMESTAMPTZ NOT NULL DEFAULT CURRENT_TIMESTAMP,
    updated_at TIMESTAMPTZ NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT uq_advertisement_placements_code
        UNIQUE (code),

    CONSTRAINT chk_advertisement_placements_page_type
        CHECK (
            page_type IN (
                'HOME',
                'NEWS_LIST',
                'NEWS_DETAIL'
            )
        ),

    CONSTRAINT chk_advertisement_placements_type
        CHECK (
            placement_type IN (
                'HOME_BANNER',
                'HOME_TOP',
                'HOME_BETWEEN_SECTIONS',
                'HOME_SIDEBAR',
                
                'NEWS_LIST_TOP',
                'NEWS_LIST_BETWEEN'
                ,
                'NEWS_LIST_BOTTOM',

                'NEWS_DETAIL_TOP',
                'NEWS_DETAIL_BETWEEN',
                'NEWS_DETAIL_SIDEBAR',
                'NEWS_DETAIL_BOTTOM',
                'NEWS_DETAIL_MODAL'
            )
        ),

    CONSTRAINT chk_advertisement_placements_insertion_type
        CHECK (
            insertion_type IN (
                'FIXED',
                'AFTER_N_ITEMS',
                'BETWEEN_SECTIONS'
            )
        ),

    CONSTRAINT chk_advertisement_placements_fallback
        CHECK (
            fallback_behavior IN ('HIDE')
        ),

    CONSTRAINT chk_advertisement_placements_frequency
        CHECK (
            display_frequency IS NULL
            OR display_frequency IN (
                'EVERY_VISIT',
                'ONCE_PER_SESSION',
                'ONCE_PER_DAY',
                'ONCE_PER_PERIOD'
            )
        ),

    CONSTRAINT chk_advertisement_placements_frequency_value
        CHECK (
            frequency_value IS NULL
            OR frequency_value > 0
        ),

    CONSTRAINT chk_advertisement_placements_auto_close_seconds
        CHECK (
            auto_close_seconds IS NULL
            OR auto_close_seconds > 0
        ),

    CONSTRAINT chk_advertisement_placements_status
        CHECK (
            status IN ('ACTIVE', 'INACTIVE')
        )
);


-- ============================================================
-- 5. ADVERTISEMENTS
--
-- This is the business-level advertisement.
-- It is deliberately NOT part of the news table.
-- ============================================================

CREATE TABLE IF NOT EXISTS advertisements (
    id BIGINT GENERATED ALWAYS AS IDENTITY PRIMARY KEY,

    advertiser_id BIGINT NOT NULL,
    campaign_id BIGINT,

    name VARCHAR(250) NOT NULL,
    internal_name VARCHAR(250),

    advertisement_type VARCHAR(40) NOT NULL DEFAULT 'DISPLAY',

    destination_url TEXT,

    priority INTEGER NOT NULL DEFAULT 0,

    status VARCHAR(20) NOT NULL DEFAULT 'DRAFT',

    start_at TIMESTAMPTZ,
    end_at TIMESTAMPTZ,

    is_clickable BOOLEAN NOT NULL DEFAULT TRUE,

    open_in_new_tab BOOLEAN NOT NULL DEFAULT TRUE,

    notes TEXT,

    created_by BIGINT,
    updated_by BIGINT,

    created_at TIMESTAMPTZ NOT NULL DEFAULT CURRENT_TIMESTAMP,
    updated_at TIMESTAMPTZ NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT fk_advertisements_advertiser
        FOREIGN KEY (advertiser_id)
        REFERENCES advertisers(id),

    CONSTRAINT fk_advertisements_campaign
        FOREIGN KEY (campaign_id)
        REFERENCES advertisement_campaigns(id)
        ON DELETE SET NULL,

    CONSTRAINT chk_advertisements_type
        CHECK (
            advertisement_type IN (
                'DISPLAY',
                'BANNER',
                'NATIVE',
                'MODAL',
                'OVERLAY'
            )
        ),

    CONSTRAINT chk_advertisements_status
        CHECK (
            status IN (
                'DRAFT',
                'ACTIVE',
                'PAUSED',
                'COMPLETED',
                'ARCHIVED'
            )
        ),

    CONSTRAINT chk_advertisements_priority
        CHECK (priority >= 0),

    CONSTRAINT chk_advertisements_schedule
        CHECK (
            end_at IS NULL
            OR start_at IS NULL
            OR end_at > start_at
        ),

    CONSTRAINT chk_advertisements_destination_url
        CHECK (
            destination_url IS NULL
            OR length(trim(destination_url)) > 0
        )
);


-- ============================================================
-- 6. ADVERTISEMENT CREATIVES
--
-- Multiple creatives can belong to one advertisement.
-- This allows image/banner/mobile/desktop creatives without
-- changing the advertisement itself.
-- ============================================================

CREATE TABLE IF NOT EXISTS advertisement_creatives (
    id BIGINT GENERATED ALWAYS AS IDENTITY PRIMARY KEY,

    advertisement_id BIGINT NOT NULL,
    format_id BIGINT,

    creative_type VARCHAR(30) NOT NULL DEFAULT 'IMAGE',

    title VARCHAR(250),
    alt_text VARCHAR(500),

    media_url TEXT NOT NULL,

    thumbnail_url TEXT,

    width_px INTEGER,
    height_px INTEGER,

    display_order INTEGER NOT NULL DEFAULT 0,

    is_primary BOOLEAN NOT NULL DEFAULT FALSE,

    status VARCHAR(20) NOT NULL DEFAULT 'ACTIVE',

    created_by BIGINT,
    updated_by BIGINT,

    created_at TIMESTAMPTZ NOT NULL DEFAULT CURRENT_TIMESTAMP,
    updated_at TIMESTAMPTZ NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT fk_advertisement_creatives_advertisement
        FOREIGN KEY (advertisement_id)
        REFERENCES advertisements(id)
        ON DELETE CASCADE,

    CONSTRAINT fk_advertisement_creatives_format
        FOREIGN KEY (format_id)
        REFERENCES advertisement_formats(id)
        ON DELETE SET NULL,

    CONSTRAINT chk_advertisement_creatives_type
        CHECK (
            creative_type IN (
                'IMAGE',
                'HTML',
                'TEXT'
            )
        ),

    CONSTRAINT chk_advertisement_creatives_status
        CHECK (
            status IN ('ACTIVE', 'INACTIVE')
        ),

    CONSTRAINT chk_advertisement_creatives_width
        CHECK (width_px IS NULL OR width_px > 0),

    CONSTRAINT chk_advertisement_creatives_height
        CHECK (height_px IS NULL OR height_px > 0)
);


-- ============================================================
-- 7. ADVERTISEMENT TARGETS
--
-- Targeting is intentionally represented independently from
-- advertisements and placements.
--
-- target_type examples:
--   SITE
--   NEWS
--   CATEGORY
--   STATE
--   DISTRICT
--   COUNTRY
--
-- target_value is kept as text because the exact existing
-- master-table names/structures are not assumed here.
-- ============================================================

CREATE TABLE IF NOT EXISTS advertisement_targets (
    id BIGINT GENERATED ALWAYS AS IDENTITY PRIMARY KEY,

    advertisement_id BIGINT NOT NULL,

    target_type VARCHAR(30) NOT NULL,
    target_value VARCHAR(255) NOT NULL,

    is_include BOOLEAN NOT NULL DEFAULT TRUE,

    created_at TIMESTAMPTZ NOT NULL DEFAULT CURRENT_TIMESTAMP,
    updated_at TIMESTAMPTZ NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT fk_advertisement_targets_advertisement
        FOREIGN KEY (advertisement_id)
        REFERENCES advertisements(id)
        ON DELETE CASCADE,

    CONSTRAINT chk_advertisement_targets_type
        CHECK (
            target_type IN (
                'SITE',
                'NEWS',
                'CATEGORY',
                'STATE',
                'DISTRICT',
                'COUNTRY'
            )
        ),

    CONSTRAINT chk_advertisement_targets_value
        CHECK (
            length(trim(target_value)) > 0
        )
);


-- ============================================================
-- 8. ADVERTISEMENT PLACEMENT RULES
--
-- Connects an advertisement to a placement and controls
-- placement-specific behavior.
-- ============================================================

CREATE TABLE IF NOT EXISTS advertisement_placement_rules (
    id BIGINT GENERATED ALWAYS AS IDENTITY PRIMARY KEY,

    advertisement_id BIGINT NOT NULL,
    placement_id BIGINT NOT NULL,

    display_order INTEGER NOT NULL DEFAULT 0,

    insertion_type VARCHAR(40),

    insertion_position INTEGER,

    max_impressions INTEGER,

    status VARCHAR(20) NOT NULL DEFAULT 'ACTIVE',

    created_by BIGINT,
    updated_by BIGINT,

    created_at TIMESTAMPTZ NOT NULL DEFAULT CURRENT_TIMESTAMP,
    updated_at TIMESTAMPTZ NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT fk_advertisement_placement_rules_advertisement
        FOREIGN KEY (advertisement_id)
        REFERENCES advertisements(id)
        ON DELETE CASCADE,

    CONSTRAINT fk_advertisement_placement_rules_placement
        FOREIGN KEY (placement_id)
        REFERENCES advertisement_placements(id)
        ON DELETE CASCADE,

    CONSTRAINT uq_advertisement_placement_rules
        UNIQUE (advertisement_id, placement_id),

    CONSTRAINT chk_advertisement_placement_rules_insertion_type
        CHECK (
            insertion_type IS NULL
            OR insertion_type IN (
                'FIXED',
                'AFTER_N_ITEMS',
                'BETWEEN_SECTIONS'
            )
        ),

    CONSTRAINT chk_advertisement_placement_rules_position
        CHECK (
            insertion_position IS NULL
            OR insertion_position > 0
        ),

    CONSTRAINT chk_advertisement_placement_rules_max_impressions
        CHECK (
            max_impressions IS NULL
            OR max_impressions > 0
        ),

    CONSTRAINT chk_advertisement_placement_rules_status
        CHECK (
            status IN ('ACTIVE', 'INACTIVE')
        )
);


-- ============================================================
-- 9. DEFAULT ADVERTISEMENT FORMATS
-- ============================================================

INSERT INTO advertisement_formats (
    code,
    display_name,
    description,
    is_responsive,
    is_system_format,
    display_order
)
VALUES
    (
        'RESPONSIVE_BANNER',
        'Responsive Banner',
        'Responsive banner advertisement suitable for different screen sizes.',
        TRUE,
        TRUE,
        1
    ),
    (
        'DESKTOP_BANNER',
        'Desktop Banner',
        'Desktop-oriented banner advertisement.',
        FALSE,
        TRUE,
        2
    ),
    (
        'MOBILE_BANNER',
        'Mobile Banner',
        'Mobile-oriented banner advertisement.',
        FALSE,
        TRUE,
        3
    ),
    (
        'SQUARE',
        'Square',
        'Square advertisement creative.',
        TRUE,
        TRUE,
        4
    ),
    (
        'NATIVE',
        'Native',
        'Native-style advertisement creative.',
        TRUE,
        TRUE,
        5
    ),
    (
        'MODAL',
        'Modal / Overlay',
        'Advertisement displayed as a non-intrusive modal or overlay.',
        TRUE,
        TRUE,
        6
    )
ON CONFLICT (code) DO NOTHING;


-- ============================================================
-- 10. DEFAULT ADVERTISEMENT PLACEMENTS
-- ============================================================

INSERT INTO advertisement_placements (
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
    status
)
VALUES
    (
        'HOME_BANNER',
        'Homepage Banner',
        'Primary banner advertisement placement on the homepage.',
        'HOME',
        'HOME_BANNER',
        'FIXED',
        1,
        TRUE,
        TRUE,
        'HIDE',
        'ACTIVE'
    ),
    (
        'HOME_TOP',
        'Homepage Top',
        'Top advertisement placement on the homepage.',
        'HOME',
        'HOME_TOP',
        'FIXED',
        2,
        TRUE,
        TRUE,
        'HIDE',
        'ACTIVE'
    ),
    (
        'HOME_BETWEEN_SECTIONS',
        'Homepage Between Sections',
        'Advertisement displayed between homepage news sections.',
        'HOME',
        'HOME_BETWEEN_SECTIONS',
        'BETWEEN_SECTIONS',
        3,
        TRUE,
        TRUE,
        'HIDE',
        'ACTIVE'
    ),
    (
        'NEWS_LIST_TOP',
        'News List Top',
        'Advertisement at the top of the news list.',
        'NEWS_LIST',
        'NEWS_LIST_TOP',
        'FIXED',
        1,
        TRUE,
        TRUE,
        'HIDE',
        'ACTIVE'
    ),
    (
        'NEWS_LIST_BETWEEN',
        'News List Between',
        'Advertisement inserted between news list items.',
        'NEWS_LIST',
        'NEWS_LIST_BETWEEN',
        'AFTER_N_ITEMS',
        2,
        TRUE,
        TRUE,
        'HIDE',
        'ACTIVE'
    ),
    (
        'NEWS_LIST_BOTTOM',
        'News List Bottom',
        'Advertisement at the bottom of the news list.',
        'NEWS_LIST',
        'NEWS_LIST_BOTTOM',
        'FIXED',
        3,
        TRUE,
        TRUE,
        'HIDE',
        'ACTIVE'
    ),
    (
        'NEWS_DETAIL_TOP',
        'News Detail Top',
        'Advertisement at the top of the news detail page.',
        'NEWS_DETAIL',
        'NEWS_DETAIL_TOP',
        'FIXED',
        1,
        TRUE,
        TRUE,
        'HIDE',
        'ACTIVE'
    ),
    (
        'NEWS_DETAIL_BETWEEN',
        'News Detail Between',
        'Advertisement inserted between news article content.',
        'NEWS_DETAIL',
        'NEWS_DETAIL_BETWEEN',
        'AFTER_N_ITEMS',
        2,
        TRUE,
        TRUE,
        'HIDE',
        'ACTIVE'
    ),
    (
        'NEWS_DETAIL_SIDEBAR',
        'News Detail Sidebar',
        'Sidebar advertisement on the news detail page.',
        'NEWS_DETAIL',
        'NEWS_DETAIL_SIDEBAR',
        'FIXED',
        3,
        TRUE,
        TRUE,
        'HIDE',
        'ACTIVE'
    ),
    (
        'NEWS_DETAIL_BOTTOM',
        'News Detail Bottom',
        'Advertisement at the bottom of the news detail page.',
        'NEWS_DETAIL',
        'NEWS_DETAIL_BOTTOM',
        'FIXED',
        4,
        TRUE,
        TRUE,
        'HIDE',
        'ACTIVE'
    ),
    (
        'NEWS_DETAIL_MODAL',
        'News Detail Modal',
        'Non-intrusive modal/overlay advertisement on the news detail page.',
        'NEWS_DETAIL',
        'NEWS_DETAIL_MODAL',
        'FIXED',
        5,
        TRUE,
        TRUE,
        'HIDE',
        'ACTIVE'
    )
ON CONFLICT (code) DO NOTHING;


-- ============================================================
-- 11. INDEXES
-- ============================================================

CREATE INDEX IF NOT EXISTS idx_advertisement_campaigns_advertiser
    ON advertisement_campaigns (advertiser_id);

CREATE INDEX IF NOT EXISTS idx_advertisement_campaigns_status
    ON advertisement_campaigns (status);

CREATE INDEX IF NOT EXISTS idx_advertisement_campaigns_schedule
    ON advertisement_campaigns (status, start_at, end_at);

CREATE INDEX IF NOT EXISTS idx_advertisement_campaigns_priority
    ON advertisement_campaigns (priority DESC);


CREATE INDEX IF NOT EXISTS idx_advertisement_placements_page_type
    ON advertisement_placements (page_type);

CREATE INDEX IF NOT EXISTS idx_advertisement_placements_type
    ON advertisement_placements (placement_type);

CREATE INDEX IF NOT EXISTS idx_advertisement_placements_enabled
    ON advertisement_placements (is_enabled, status);

CREATE INDEX IF NOT EXISTS idx_advertisement_placements_order
    ON advertisement_placements (page_type, display_order);


CREATE INDEX IF NOT EXISTS idx_advertisements_advertiser
    ON advertisements (advertiser_id);

CREATE INDEX IF NOT EXISTS idx_advertisements_campaign
    ON advertisements (campaign_id);

CREATE INDEX IF NOT EXISTS idx_advertisements_status
    ON advertisements (status);

CREATE INDEX IF NOT EXISTS idx_advertisements_schedule
    ON advertisements (status, start_at, end_at);

CREATE INDEX IF NOT EXISTS idx_advertisements_priority
    ON advertisements (priority DESC);


CREATE INDEX IF NOT EXISTS idx_advertisement_creatives_advertisement
    ON advertisement_creatives (advertisement_id);

CREATE INDEX IF NOT EXISTS idx_advertisement_creatives_format
    ON advertisement_creatives (format_id);

CREATE INDEX IF NOT EXISTS idx_advertisement_creatives_active
    ON advertisement_creatives (advertisement_id, status, display_order);


CREATE INDEX IF NOT EXISTS idx_advertisement_targets_advertisement
    ON advertisement_targets (advertisement_id);

CREATE INDEX IF NOT EXISTS idx_advertisement_targets_type_value
    ON advertisement_targets (target_type, target_value);


CREATE INDEX IF NOT EXISTS idx_advertisement_placement_rules_advertisement
    ON advertisement_placement_rules (advertisement_id);

CREATE INDEX IF NOT EXISTS idx_advertisement_placement_rules_placement
    ON advertisement_placement_rules (placement_id);

CREATE INDEX IF NOT EXISTS idx_advertisement_placement_rules_active
    ON advertisement_placement_rules (placement_id, status, display_order);


-- ============================================================
-- 12. UPDATED_AT TRIGGER FUNCTION
--
-- Reuses an existing function if your database already has one.
-- If not, this creates the common utility function.
-- ============================================================

CREATE OR REPLACE FUNCTION set_updated_at()
RETURNS TRIGGER
LANGUAGE plpgsql
AS $$
BEGIN
    NEW.updated_at = CURRENT_TIMESTAMP;
    RETURN NEW;
END;
$$;


-- ============================================================
-- 13. UPDATED_AT TRIGGERS
-- ============================================================

DROP TRIGGER IF EXISTS trg_advertisement_formats_updated_at
    ON advertisement_formats;

CREATE TRIGGER trg_advertisement_formats_updated_at
BEFORE UPDATE ON advertisement_formats
FOR EACH ROW
EXECUTE FUNCTION set_updated_at();


DROP TRIGGER IF EXISTS trg_advertisers_updated_at
    ON advertisers;

CREATE TRIGGER trg_advertisers_updated_at
BEFORE UPDATE ON advertisers
FOR EACH ROW
EXECUTE FUNCTION set_updated_at();


DROP TRIGGER IF EXISTS trg_advertisement_campaigns_updated_at
    ON advertisement_campaigns;

CREATE TRIGGER trg_advertisement_campaigns_updated_at
BEFORE UPDATE ON advertisement_campaigns
FOR EACH ROW
EXECUTE FUNCTION set_updated_at();


DROP TRIGGER IF EXISTS trg_advertisement_placements_updated_at
    ON advertisement_placements;

CREATE TRIGGER trg_advertisement_placements_updated_at
BEFORE UPDATE ON advertisement_placements
FOR EACH ROW
EXECUTE FUNCTION set_updated_at();


DROP TRIGGER IF EXISTS trg_advertisements_updated_at
    ON advertisements;

CREATE TRIGGER trg_advertisements_updated_at
BEFORE UPDATE ON advertisements
FOR EACH ROW
EXECUTE FUNCTION set_updated_at();


DROP TRIGGER IF EXISTS trg_advertisement_creatives_updated_at
    ON advertisement_creatives;

CREATE TRIGGER trg_advertisement_creatives_updated_at
BEFORE UPDATE ON advertisement_creatives
FOR EACH ROW
EXECUTE FUNCTION set_updated_at();


DROP TRIGGER IF EXISTS trg_advertisement_targets_updated_at
    ON advertisement_targets;

CREATE TRIGGER trg_advertisement_targets_updated_at
BEFORE UPDATE ON advertisement_targets
FOR EACH ROW
EXECUTE FUNCTION set_updated_at();


DROP TRIGGER IF EXISTS trg_advertisement_placement_rules_updated_at
    ON advertisement_placement_rules;

CREATE TRIGGER trg_advertisement_placement_rules_updated_at
BEFORE UPDATE ON advertisement_placement_rules
FOR EACH ROW
EXECUTE FUNCTION set_updated_at();


-- ============================================================
-- 14. COMMENTS
-- ============================================================

COMMENT ON TABLE advertisement_formats IS
    'Master definitions for advertisement creative formats.';

COMMENT ON TABLE advertisers IS
    'Advertiser/business information. Independent from news content.';

COMMENT ON TABLE advertisement_campaigns IS
    'Campaign-level grouping and scheduling for advertisements.';

COMMENT ON TABLE advertisement_placements IS
    'Configurable locations where advertisements may be displayed.';

COMMENT ON TABLE advertisements IS
    'Independent advertisement business records.';

COMMENT ON TABLE advertisement_creatives IS
    'Visual/text/HTML creatives belonging to advertisements.';

COMMENT ON TABLE advertisement_targets IS
    'Targeting rules for advertisements.';

COMMENT ON TABLE advertisement_placement_rules IS
    'Rules connecting advertisements to configurable placements.';

COMMENT ON COLUMN advertisement_placements.collapse_when_empty IS
    'When TRUE, an empty placement must not reserve visual/vertical space.';

COMMENT ON COLUMN advertisement_placements.fallback_behavior IS
    'Behavior when no eligible advertisement exists. Phase 1 supports HIDE.';

COMMENT ON COLUMN advertisement_placements.auto_close_seconds IS
    'Number of seconds before an enabled modal/overlay advertisement closes automatically.';

COMMENT ON COLUMN advertisement_placements.close_on_overlay_click IS
    'Whether clicking outside the modal advertisement closes it.';

COMMENT ON COLUMN advertisement_placements.display_frequency IS
    'Frequency policy for modal/overlay advertisement display.';


COMMIT;