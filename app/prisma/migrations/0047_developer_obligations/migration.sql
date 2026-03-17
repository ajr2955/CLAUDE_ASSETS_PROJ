-- US-047: Developer Obligation schema and migration

-- Create developer obligation funding model enum
CREATE TYPE developer_obligation_funding_model AS ENUM (
  'developer_builds',
  'developer_funds_municipality_builds',
  'combined',
  'land_only'
);

-- Create developer obligation status enum
CREATE TYPE developer_obligation_status AS ENUM (
  'open',
  'in_progress',
  'delivered',
  'partially_delivered',
  'in_dispute',
  'closed_gap_identified'
);

-- Create developer_obligations table
CREATE TABLE developer_obligations (
  id                            UUID        NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  obligation_reference          VARCHAR     NOT NULL UNIQUE,
  related_project_name          VARCHAR     NOT NULL,
  developer_name                VARCHAR     NOT NULL,
  promised_asset_type_id        UUID        NOT NULL REFERENCES asset_types(id),
  promised_asset_family_id      UUID        NOT NULL REFERENCES asset_families(id),
  committed_area_sqm            DECIMAL(12, 2),
  committed_delivery_date       DATE,
  actual_delivery_date          DATE,
  funding_model                 developer_obligation_funding_model,
  committed_funding_amount      DECIMAL(18, 2),
  status                        developer_obligation_status NOT NULL DEFAULT 'open',
  gaps_identified               TEXT,
  receiving_body_id             UUID        REFERENCES responsible_bodies(id),
  receiving_body_is_placeholder BOOLEAN     NOT NULL DEFAULT FALSE,
  planning_entity_id            UUID        REFERENCES planning_entities(id),
  delivery_milestones           JSONB,
  notes                         TEXT,
  created_at                    TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at                    TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

-- Resolve planning_entities.developer_obligation_id FK stub (declared in US-046, now target table exists)
ALTER TABLE planning_entities
  ADD CONSTRAINT fk_planning_entities_developer_obligation
  FOREIGN KEY (developer_obligation_id)
  REFERENCES developer_obligations(id);

-- Resolve assets.developer_obligation_id FK stub (declared in US-005, now target table exists)
ALTER TABLE assets
  ADD CONSTRAINT fk_assets_developer_obligation
  FOREIGN KEY (developer_obligation_id)
  REFERENCES developer_obligations(id);

-- Indexes
CREATE INDEX idx_dev_obligations_status           ON developer_obligations(status);
CREATE INDEX idx_dev_obligations_developer_name   ON developer_obligations(developer_name);
CREATE INDEX idx_dev_obligations_committed_date   ON developer_obligations(committed_delivery_date);
CREATE INDEX idx_dev_obligations_family           ON developer_obligations(promised_asset_family_id);
