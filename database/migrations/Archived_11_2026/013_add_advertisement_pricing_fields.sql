ALTER TABLE public.advertisements
  ADD COLUMN IF NOT EXISTS pricing_placement_id bigint,
  ADD COLUMN IF NOT EXISTS pricing_unit character varying(20),
  ADD COLUMN IF NOT EXISTS pricing_quantity numeric(14,4),
  ADD COLUMN IF NOT EXISTS standard_amount numeric(14,2);

ALTER TABLE public.advertisements
  ADD CONSTRAINT fk_advertisements_pricing_placement
  FOREIGN KEY (pricing_placement_id)
  REFERENCES public.advertisement_placements (id)
  ON UPDATE NO ACTION
  ON DELETE RESTRICT;

ALTER TABLE public.advertisements
  ADD CONSTRAINT chk_advertisements_pricing_unit
  CHECK (
    pricing_unit IS NULL
    OR pricing_unit IN (
      'DAY',
      'WEEK',
      'MONTH',
      'IMPRESSION',
      'CAMPAIGN',
      'FIXED'
    )
  );

ALTER TABLE public.advertisements
  ADD CONSTRAINT chk_advertisements_pricing_quantity
  CHECK (
    pricing_quantity IS NULL
    OR pricing_quantity > 0
  );

ALTER TABLE public.advertisements
  ADD CONSTRAINT chk_advertisements_standard_amount
  CHECK (
    standard_amount IS NULL
    OR standard_amount >= 0
  );

ALTER TABLE public.advertisements
  ADD CONSTRAINT chk_advertisements_pricing_fields
  CHECK (
    (
      pricing_placement_id IS NULL
      AND pricing_unit IS NULL
      AND pricing_quantity IS NULL
      AND standard_amount IS NULL
    )
    OR
    (
      pricing_placement_id IS NOT NULL
      AND pricing_unit IS NOT NULL
      AND pricing_quantity IS NOT NULL
      AND standard_amount IS NOT NULL
    )
  );