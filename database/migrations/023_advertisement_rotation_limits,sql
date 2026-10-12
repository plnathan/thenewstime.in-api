BEGIN;

CREATE TABLE IF NOT EXISTS advertisement_rotation_limits (
    id SMALLINT PRIMARY KEY DEFAULT 1,

    max_active_creatives_per_advertisement INTEGER
        NOT NULL DEFAULT 5,

    max_active_rotation_members_per_placement INTEGER
        NOT NULL DEFAULT 10,

    created_at TIMESTAMPTZ
        NOT NULL DEFAULT CURRENT_TIMESTAMP,

    created_by INTEGER NULL,

    updated_at TIMESTAMPTZ
        NOT NULL DEFAULT CURRENT_TIMESTAMP,

    updated_by INTEGER NULL,

    CONSTRAINT chk_advertisement_rotation_limits_singleton
        CHECK (id = 1),

    CONSTRAINT chk_max_active_creatives_per_advertisement
        CHECK (max_active_creatives_per_advertisement >= 1),

    CONSTRAINT chk_max_active_rotation_members_per_placement
        CHECK (max_active_rotation_members_per_placement >= 1)
);

INSERT INTO advertisement_rotation_limits (
    id,
    max_active_creatives_per_advertisement,
    max_active_rotation_members_per_placement
)
VALUES (
    1,
    5,
    10
)
ON CONFLICT (id) DO NOTHING;

COMMIT;