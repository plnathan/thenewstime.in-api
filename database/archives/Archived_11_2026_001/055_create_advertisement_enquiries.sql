BEGIN;
CREATE TABLE IF NOT EXISTS advertisement_enquiries (
  id BIGINT GENERATED ALWAYS AS IDENTITY PRIMARY KEY,
  full_name VARCHAR(120) NOT NULL,
  company_name VARCHAR(160),
  mobile_number VARCHAR(20) NOT NULL,
  email VARCHAR(254),
  advertisement_type VARCHAR(30) NOT NULL,
  page_types TEXT[] NOT NULL,
  placement_types TEXT[] NOT NULL,
  preferred_start_date DATE,
  preferred_end_date DATE,
  additional_requirements VARCHAR(2000),
  source VARCHAR(20) NOT NULL,
  source_advertisement_id BIGINT,
  source_placement_id BIGINT,
  status VARCHAR(20) NOT NULL DEFAULT 'NEW',
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  CONSTRAINT chk_ad_enquiry_source CHECK (source IN ('HOUSE_AD', 'FOOTER')),
  CONSTRAINT chk_ad_enquiry_status CHECK (status IN ('NEW', 'CONTACTED', 'CONVERTED', 'CLOSED')),
  CONSTRAINT chk_ad_enquiry_type CHECK (advertisement_type IN ('DISPLAY', 'SIDEBAR', 'MODAL', 'OTHER')),
  CONSTRAINT chk_ad_enquiry_page_types CHECK (cardinality(page_types) BETWEEN 1 AND 3 AND page_types <@ ARRAY['HOME','NEWS_LIST','NEWS_DETAIL']::TEXT[]),
  CONSTRAINT chk_ad_enquiry_placement_types CHECK (cardinality(placement_types) BETWEEN 1 AND 16),
  CONSTRAINT chk_ad_enquiry_date_range CHECK (preferred_start_date IS NULL OR preferred_end_date IS NULL OR preferred_end_date >= preferred_start_date),
  CONSTRAINT chk_ad_enquiry_source_refs CHECK (source = 'HOUSE_AD' OR (source_advertisement_id IS NULL AND source_placement_id IS NULL))
);
CREATE INDEX IF NOT EXISTS idx_ad_enquiries_created_at ON advertisement_enquiries (created_at DESC);
CREATE INDEX IF NOT EXISTS idx_ad_enquiries_status_created_at ON advertisement_enquiries (status, created_at DESC);
COMMIT;


-- Apply AFTER the initial advertisement_enquiries CREATE TABLE migration.
-- All advertisement preferences are optional; contact name and mobile remain required.
ALTER TABLE advertisement_enquiries ALTER COLUMN advertisement_type DROP NOT NULL;
ALTER TABLE advertisement_enquiries ALTER COLUMN page_types DROP NOT NULL;
ALTER TABLE advertisement_enquiries ALTER COLUMN placement_types DROP NOT NULL;
-- Existing CHECK constraints on page_types/placement_types allow NULL in PostgreSQL.