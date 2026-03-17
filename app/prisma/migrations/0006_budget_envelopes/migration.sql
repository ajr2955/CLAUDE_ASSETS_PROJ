-- Migration: 0006_budget_envelopes
-- US-006: Budget Envelope schema and migration

CREATE TYPE budget_type AS ENUM (
  'capex',
  'opex',
  'renewal_reserve',
  'external_funding',
  'developer_funded',
  'lease_income',
  'service_charges',
  'maintenance_reserve',
  'adjustment',
  'equipment'
);

CREATE TABLE budget_envelopes (
  id                          UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  asset_id                    UUID NOT NULL REFERENCES assets(id),
  lifecycle_stage_id          UUID REFERENCES lifecycle_stages(id),
  budget_type                 budget_type NOT NULL,
  fiscal_year                 INTEGER,
  is_multi_year               BOOLEAN NOT NULL DEFAULT FALSE,
  multi_year_start            INTEGER,
  multi_year_end              INTEGER,
  approved_amount             NUMERIC(18, 2) NOT NULL DEFAULT 0,
  committed_amount            NUMERIC(18, 2) NOT NULL DEFAULT 0,
  actual_amount               NUMERIC(18, 2) NOT NULL DEFAULT 0,
  variance_amount             NUMERIC(18, 2) NOT NULL DEFAULT 0,
  external_source_description TEXT,
  developer_funded_amount     NUMERIC(18, 2) NOT NULL DEFAULT 0,
  responsible_body_id         UUID REFERENCES responsible_bodies(id),
  notes                       TEXT,
  is_closed                   BOOLEAN NOT NULL DEFAULT FALSE,
  variance_event_created      BOOLEAN NOT NULL DEFAULT FALSE,
  created_at                  TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at                  TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE INDEX idx_budget_envelopes_asset_id          ON budget_envelopes(asset_id);
CREATE INDEX idx_budget_envelopes_fiscal_year        ON budget_envelopes(fiscal_year);
CREATE INDEX idx_budget_envelopes_budget_type        ON budget_envelopes(budget_type);
CREATE INDEX idx_budget_envelopes_lifecycle_stage_id ON budget_envelopes(lifecycle_stage_id);
