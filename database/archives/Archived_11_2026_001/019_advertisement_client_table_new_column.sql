BEGIN;

-- ============================================================
-- Advertisement Clients
-- Add future/preferred client fields.
--
-- IMPORTANT:
-- Existing application fields such as business_name,
-- contact_no and website_url are intentionally retained.
--
-- No existing columns are renamed, removed or modified.
-- No current UI/API behavior is changed.
-- ============================================================


-- ------------------------------------------------------------
-- Business information
-- ------------------------------------------------------------

ALTER TABLE public.advertisement_clients
    ADD COLUMN IF NOT EXISTS company_name character varying(250);


-- ------------------------------------------------------------
-- Contact information
-- ------------------------------------------------------------

ALTER TABLE public.advertisement_clients
    ADD COLUMN IF NOT EXISTS designation character varying(150);

ALTER TABLE public.advertisement_clients
    ADD COLUMN IF NOT EXISTS phone character varying(50);


-- ------------------------------------------------------------
-- Address information
-- ------------------------------------------------------------

ALTER TABLE public.advertisement_clients
    ADD COLUMN IF NOT EXISTS registered_address text;

ALTER TABLE public.advertisement_clients
    ADD COLUMN IF NOT EXISTS billing_address text;


-- ------------------------------------------------------------
-- Tax information
-- ------------------------------------------------------------

ALTER TABLE public.advertisement_clients
    ADD COLUMN IF NOT EXISTS gst_number character varying(50);

ALTER TABLE public.advertisement_clients
    ADD COLUMN IF NOT EXISTS tax_number character varying(50);


COMMIT;