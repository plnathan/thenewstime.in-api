BEGIN;

ALTER TABLE public.advertisement_targets
    ADD COLUMN IF NOT EXISTS created_by BIGINT,
    ADD COLUMN IF NOT EXISTS updated_by BIGINT;

DO $$
BEGIN
    IF NOT EXISTS (
        SELECT 1
        FROM pg_constraint
        WHERE conname = 'fk_advertisement_targets_created_by'
          AND conrelid = 'public.advertisement_targets'::regclass
    ) THEN
        ALTER TABLE public.advertisement_targets
            ADD CONSTRAINT fk_advertisement_targets_created_by
            FOREIGN KEY (created_by)
            REFERENCES public.users (id)
            ON DELETE SET NULL;
    END IF;

    IF NOT EXISTS (
        SELECT 1
        FROM pg_constraint
        WHERE conname = 'fk_advertisement_targets_updated_by'
          AND conrelid = 'public.advertisement_targets'::regclass
    ) THEN
        ALTER TABLE public.advertisement_targets
            ADD CONSTRAINT fk_advertisement_targets_updated_by
            FOREIGN KEY (updated_by)
            REFERENCES public.users (id)
            ON DELETE SET NULL;
    END IF;
END
$$;

CREATE INDEX IF NOT EXISTS idx_advertisement_targets_created_by
    ON public.advertisement_targets (created_by);

CREATE INDEX IF NOT EXISTS idx_advertisement_targets_updated_by
    ON public.advertisement_targets (updated_by);

COMMIT;