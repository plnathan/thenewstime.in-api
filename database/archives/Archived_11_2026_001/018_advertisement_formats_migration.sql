-- ============================================================
-- TheNewsTime.in
-- Advertisement Placement -> Advertisement Format
-- UI-3.4
--
-- Purpose:
--   Associate each advertisement placement with the
--   system-defined advertisement format.
--
-- Dimensions are NOT duplicated in advertisement_placements.
-- They remain defined by advertisement_formats.
--
-- ============================================================


-- ============================================================
-- 1. ADD FORMAT REFERENCE
-- ============================================================

ALTER TABLE advertisement_placements
    ADD COLUMN IF NOT EXISTS format_id BIGINT;


-- ============================================================
-- 2. FOREIGN KEY
--
-- A placement may temporarily have no format configured.
--
-- Existing placements are therefore allowed to remain NULL.
--
-- ON DELETE RESTRICT prevents an advertisement format from
-- being deleted while it is still assigned to a placement.
-- ============================================================

DO $$
BEGIN
    IF NOT EXISTS (
        SELECT 1
        FROM pg_constraint
        WHERE conname = 'fk_advertisement_placements_format'
    ) THEN
        ALTER TABLE advertisement_placements
            ADD CONSTRAINT fk_advertisement_placements_format
            FOREIGN KEY (format_id)
            REFERENCES advertisement_formats(id)
            ON DELETE RESTRICT;
    END IF;
END
$$;


-- ============================================================
-- 3. INDEX
--
-- Placement -> format lookup is part of the advertisement
-- creation/configuration flow and can also be used by
-- delivery/configuration queries.
-- ============================================================

CREATE INDEX IF NOT EXISTS idx_advertisement_placements_format_id
    ON advertisement_placements(format_id);


-- ============================================================
-- 4. DOCUMENTATION
-- ============================================================

COMMENT ON COLUMN advertisement_placements.format_id IS
    'System-defined advertisement format assigned to this placement. NULL means the placement has not yet been configured with a creative format.';