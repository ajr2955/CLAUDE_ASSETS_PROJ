-- Migration: 0005_assets
-- US-005: Asset core schema and migration

-- Enums
CREATE TYPE asset_status AS ENUM (
  'active',
  'inactive',
  'in_formation',
  'in_construction',
  'decommissioned',
  'disposed'
);

CREATE TYPE ownership_model AS ENUM (
  'owned',
  'leased_in',
  'leased_out',
  'allocated',
  'developer_obligation',
  'partnership'
);

CREATE TABLE assets (
  id                          UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  asset_name                  TEXT NOT NULL,
  asset_code                  VARCHAR(60) NOT NULL UNIQUE,
  asset_family_id             UUID NOT NULL REFERENCES asset_families(id),
  asset_type_id               UUID NOT NULL REFERENCES asset_types(id),
  current_lifecycle_stage_id  UUID NOT NULL REFERENCES lifecycle_stages(id),
  current_status              asset_status NOT NULL DEFAULT 'in_formation',
  ownership_model             ownership_model,
  strategic_owner_body_id     UUID REFERENCES responsible_bodies(id),
  responsible_body_id         UUID REFERENCES responsible_bodies(id),
  operational_body_id         UUID REFERENCES responsible_bodies(id),
  maintenance_body_id         UUID REFERENCES responsible_bodies(id),
  data_steward_body_id        UUID REFERENCES responsible_bodies(id),
  -- Self-referential hierarchy
  parent_asset_id             UUID REFERENCES assets(id),
  -- Phase 3 FK stubs (tables not yet created; constraints added in Phase 3 migrations)
  planning_entity_id          UUID,
  developer_obligation_id     UUID,
  -- Phase 1 budget FK stub (populated after US-006)
  active_budget_envelope_id   UUID,
  -- Phase 2 GIS FK stub (populated after US-034)
  location_id                 UUID,
  gis_reference               VARCHAR(200),
  address                     TEXT,
  area_sqm                    NUMERIC(12, 2),
  service_start_date          DATE,
  handover_date               DATE,
  decommission_date           DATE,
  notes                       TEXT,
  is_placeholder_body         BOOLEAN NOT NULL DEFAULT FALSE,
  created_at                  TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at                  TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

-- Indexes
CREATE INDEX idx_assets_asset_family_id         ON assets(asset_family_id);
CREATE INDEX idx_assets_asset_type_id           ON assets(asset_type_id);
CREATE INDEX idx_assets_current_lifecycle_stage ON assets(current_lifecycle_stage_id);
CREATE INDEX idx_assets_responsible_body_id     ON assets(responsible_body_id);
CREATE INDEX idx_assets_current_status          ON assets(current_status);
