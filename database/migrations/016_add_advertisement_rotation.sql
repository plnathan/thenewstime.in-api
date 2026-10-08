-- ============================================================
-- ADVERTISEMENT ROTATION
-- ============================================================
--
-- Purpose:
--   Allow multiple advertisements to share the same placement
--   during overlapping schedule periods and rotate between them.
--
-- Important:
--   advertisement_schedules.priority is NOT modified.
--
-- Existing schedule priority is already used by the delivery
-- repository as a general candidate ordering priority:
--
--     schedule priority DESC
--     advertisement priority DESC
--     placement rule display order ASC
--     placement display order ASC
--
-- Rotation priority therefore has its own field/table.
--
-- Initial supported rotation:
--
--   rotation_enabled = TRUE
--   rotation_mode    = TIME_BASED
--   rotation_strategy = ROUND_ROBIN
--
-- ============================================================


-- ============================================================
-- 1. PLACEMENT ROTATION CONFIGURATION
-- ============================================================

ALTER TABLE advertisement_placements
    ADD COLUMN IF NOT EXISTS rotation_enabled BOOLEAN
        NOT NULL DEFAULT FALSE,

    ADD COLUMN IF NOT EXISTS rotation_mode VARCHAR(30)
        NOT NULL DEFAULT 'TIME_BASED',

    ADD COLUMN IF NOT EXISTS rotation_interval_seconds INTEGER
        NOT NULL DEFAULT 10,

    ADD COLUMN IF NOT EXISTS rotation_strategy VARCHAR(30)
        NOT NULL DEFAULT 'ROUND_ROBIN';


-- ============================================================
-- 2. ROTATION CONFIGURATION CONSTRAINTS
-- ============================================================

ALTER TABLE advertisement_placements
    DROP CONSTRAINT IF EXISTS chk_advertisement_placements_rotation_mode;

ALTER TABLE advertisement_placements
    ADD CONSTRAINT chk_advertisement_placements_rotation_mode
    CHECK (
        rotation_mode IN (
            'TIME_BASED'
        )
    );


ALTER TABLE advertisement_placements
    DROP CONSTRAINT IF EXISTS chk_advertisement_placements_rotation_interval;

ALTER TABLE advertisement_placements
    ADD CONSTRAINT chk_advertisement_placements_rotation_interval
    CHECK (
        rotation_interval_seconds > 0
    );


ALTER TABLE advertisement_placements
    DROP CONSTRAINT IF EXISTS chk_advertisement_placements_rotation_strategy;

ALTER TABLE advertisement_placements
    ADD CONSTRAINT chk_advertisement_placements_rotation_strategy
    CHECK (
        rotation_strategy IN (
            'ROUND_ROBIN'
        )
    );


-- ============================================================
-- 3. ROTATION MEMBERS
-- ============================================================
--
-- Defines which advertisements participate in rotation for
-- a particular placement.
--
-- priority is intentionally separate from
-- advertisement_schedules.priority.
--
-- Lower id is used only as a deterministic tie-breaker.
--
-- status:
--   ACTIVE   -> participates in rotation
--   INACTIVE -> temporarily excluded
--
-- ============================================================

CREATE TABLE IF NOT EXISTS advertisement_rotation_members (
    id BIGINT GENERATED ALWAYS AS IDENTITY PRIMARY KEY,

    placement_id BIGINT NOT NULL,

    advertisement_id BIGINT NOT NULL,

    priority INTEGER NOT NULL DEFAULT 0,

    status VARCHAR(20) NOT NULL DEFAULT 'ACTIVE',

    created_at TIMESTAMPTZ NOT NULL DEFAULT CURRENT_TIMESTAMP,

    updated_at TIMESTAMPTZ NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT fk_advertisement_rotation_members_placement
        FOREIGN KEY (placement_id)
        REFERENCES advertisement_placements(id)
        ON DELETE CASCADE,

    CONSTRAINT fk_advertisement_rotation_members_advertisement
        FOREIGN KEY (advertisement_id)
        REFERENCES advertisements(id)
        ON DELETE CASCADE,

    CONSTRAINT chk_advertisement_rotation_members_priority
        CHECK (
            priority >= 0
        ),

    CONSTRAINT chk_advertisement_rotation_members_status
        CHECK (
            status IN (
                'ACTIVE',
                'INACTIVE'
            )
        ),

    CONSTRAINT uq_advertisement_rotation_members_placement_advertisement
        UNIQUE (
            placement_id,
            advertisement_id
        )
);


-- ============================================================
-- 4. ROTATION MEMBER INDEXES
-- ============================================================

CREATE INDEX IF NOT EXISTS idx_advertisement_rotation_members_placement
    ON advertisement_rotation_members (
        placement_id
    );


CREATE INDEX IF NOT EXISTS idx_advertisement_rotation_members_placement_status
    ON advertisement_rotation_members (
        placement_id,
        status
    );


CREATE INDEX IF NOT EXISTS idx_advertisement_rotation_members_placement_priority
    ON advertisement_rotation_members (
        placement_id,
        status,
        priority DESC,
        id ASC
    );


CREATE INDEX IF NOT EXISTS idx_advertisement_rotation_members_advertisement
    ON advertisement_rotation_members (
        advertisement_id
    );


-- ============================================================
-- 5. COMMENTS
-- ============================================================

COMMENT ON COLUMN advertisement_placements.rotation_enabled IS
    'Enables multiple advertisements to rotate within this placement.';


COMMENT ON COLUMN advertisement_placements.rotation_mode IS
    'Rotation timing mode. TIME_BASED is the initial supported mode.';


COMMENT ON COLUMN advertisement_placements.rotation_interval_seconds IS
    'Number of seconds before the rotation advances to the next advertisement.';


COMMENT ON COLUMN advertisement_placements.rotation_strategy IS
    'Advertisement selection strategy. ROUND_ROBIN is the initial supported strategy.';


COMMENT ON TABLE advertisement_rotation_members IS
    'Advertisements participating in placement-level rotation.';


COMMENT ON COLUMN advertisement_rotation_members.placement_id IS
    'Placement in which the advertisement participates in rotation.';


COMMENT ON COLUMN advertisement_rotation_members.advertisement_id IS
    'Advertisement participating in the placement rotation.';


COMMENT ON COLUMN advertisement_rotation_members.priority IS
    'Rotation-specific priority controlled independently from advertisement schedule priority.';


COMMENT ON COLUMN advertisement_rotation_members.status IS
    'ACTIVE members participate in rotation; INACTIVE members are excluded.';


-- ============================================================
-- 6. SAFETY CHECK / DOCUMENTATION
-- ============================================================
--
-- DO NOT ALTER:
--
--     advertisement_schedules.priority
--
-- That column remains the existing schedule/delivery priority.
--
-- Rotation priority is:
--
--     advertisement_rotation_members.priority
--
-- Existing delivery ordering remains independent:
--
--     schedule.priority DESC
--     advertisement.priority DESC
--     placement_rule.display_order ASC
--     placement.display_order ASC
--
-- ============================================================