-- Add per-advertisement creative rotation configuration.
-- Existing placement-level rotation remains on advertisement_placements.
BEGIN;
CREATE TABLE IF NOT EXISTS public.advertisement_creative_rotation_configs (
    advertisement_id bigint PRIMARY KEY REFERENCES public.advertisements(id) ON DELETE CASCADE,
    rotation_enabled boolean NOT NULL DEFAULT false,
    rotation_interval_seconds integer NOT NULL DEFAULT 10,
    rotation_strategy varchar(30) NOT NULL DEFAULT 'ROUND_ROBIN',
    created_at timestamptz NOT NULL DEFAULT CURRENT_TIMESTAMP,
    updated_at timestamptz NOT NULL DEFAULT CURRENT_TIMESTAMP,
    CONSTRAINT chk_ad_creative_rotation_interval CHECK (rotation_interval_seconds BETWEEN 1 AND 3600),
    CONSTRAINT chk_ad_creative_rotation_strategy CHECK (rotation_strategy = 'ROUND_ROBIN')
);
COMMENT ON TABLE public.advertisement_creative_rotation_configs IS
'Per-advertisement creative cycling settings, independent of placement-level advertisement rotation.';
COMMIT;
