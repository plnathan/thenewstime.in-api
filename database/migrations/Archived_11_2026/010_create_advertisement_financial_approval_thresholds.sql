-- Table: public.advertisement_financial_approval_thresholds

-- DROP TABLE IF EXISTS public.advertisement_financial_approval_thresholds;

CREATE TABLE IF NOT EXISTS public.advertisement_financial_approval_thresholds
(
    id bigint NOT NULL GENERATED ALWAYS AS IDENTITY ( INCREMENT 1 START 1 MINVALUE 1 MAXVALUE 9223372036854775807 CACHE 1 ),
    approval_type character varying(30) COLLATE pg_catalog."default" NOT NULL,
    amount_threshold numeric(14,2),
    percentage_threshold numeric(7,2),
    status character varying(20) COLLATE pg_catalog."default" NOT NULL DEFAULT 'ACTIVE'::character varying,
    created_by bigint,
    updated_by bigint,
    created_at timestamp with time zone NOT NULL DEFAULT CURRENT_TIMESTAMP,
    updated_at timestamp with time zone NOT NULL DEFAULT CURRENT_TIMESTAMP,
    CONSTRAINT advertisement_financial_approval_thresholds_pkey PRIMARY KEY (id),
    CONSTRAINT chk_advertisement_financial_approval_thresholds_amount CHECK (amount_threshold IS NULL OR amount_threshold > 0::numeric),
    CONSTRAINT chk_advertisement_financial_approval_thresholds_percentage CHECK (percentage_threshold IS NULL OR percentage_threshold >= 0::numeric AND percentage_threshold <= 100::numeric),
    CONSTRAINT chk_advertisement_financial_approval_thresholds_status CHECK (status::text = ANY (ARRAY['ACTIVE'::character varying, 'INACTIVE'::character varying]::text[])),
    CONSTRAINT chk_advertisement_financial_approval_thresholds_type CHECK (approval_type::text = ANY (ARRAY['DISCOUNT'::character varying, 'REFUND'::character varying, 'PARTIAL_REFUND'::character varying, 'ADJUSTMENT'::character varying]::text[])),
    CONSTRAINT chk_advertisement_financial_approval_thresholds_value CHECK (amount_threshold IS NOT NULL OR percentage_threshold IS NOT NULL)
)

TABLESPACE pg_default;

ALTER TABLE IF EXISTS public.advertisement_financial_approval_thresholds
    OWNER to neondb_owner;
-- Index: idx_advertisement_financial_approval_thresholds_type_status

-- DROP INDEX IF EXISTS public.idx_advertisement_financial_approval_thresholds_type_status;

CREATE INDEX IF NOT EXISTS idx_advertisement_financial_approval_thresholds_type_status
    ON public.advertisement_financial_approval_thresholds USING btree
    (approval_type COLLATE pg_catalog."default" ASC NULLS LAST, status COLLATE pg_catalog."default" ASC NULLS LAST)
    TABLESPACE pg_default;

CREATE UNIQUE INDEX IF NOT EXISTS
    uq_advertisement_financial_approval_thresholds_active_type
ON advertisement_financial_approval_thresholds
(
    approval_type
)
WHERE status = 'ACTIVE';    