CREATE TABLE IF NOT EXISTS public.advertisement_operational_audit
(
    id bigint GENERATED ALWAYS AS IDENTITY PRIMARY KEY,
    advertisement_id bigint NOT NULL,
    event_type varchar(40) NOT NULL,
    previous_status varchar(20),
    new_status varchar(20),
    remarks text NOT NULL,
    performed_by bigint NOT NULL,
    performed_at timestamptz NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT fk_advertisement_operational_audit_advertisement
        FOREIGN KEY (advertisement_id)
        REFERENCES public.advertisements (id)
        ON UPDATE NO ACTION
        ON DELETE RESTRICT,

    CONSTRAINT chk_advertisement_operational_audit_event_type
        CHECK (event_type IN ('ACTIVATED'))
);

CREATE INDEX IF NOT EXISTS idx_advertisement_operational_audit_ad
    ON public.advertisement_operational_audit
    (advertisement_id, performed_at DESC);