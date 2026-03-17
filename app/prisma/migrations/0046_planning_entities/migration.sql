-- US-046: Planning Entity schema and migration

-- Create planning entity status enum
CREATE TYPE planning_entity_status AS ENUM (
  'identified',
  'in_planning',
  'approved',
  'in_implementation',
  'delivered',
  'converted_to_asset'
);

-- Create planning_entities table
CREATE TABLE planning_entities (
  id                                   UUID        NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  name                                 VARCHAR     NOT NULL,
  planning_code                        VARCHAR     NOT NULL UNIQUE,
  asset_family_id                      UUID        NOT NULL REFERENCES asset_families(id),
  asset_type_id                        UUID        NOT NULL REFERENCES asset_types(id),
  planning_body_id                     UUID        REFERENCES responsible_bodies(id),
  intended_receiving_body_id           UUID        REFERENCES responsible_bodies(id),
  intended_receiving_body_is_placeholder BOOLEAN   NOT NULL DEFAULT FALSE,
  population_forecast_notes            TEXT,
  service_area_description             TEXT,
  planned_area_sqm                     DECIMAL(12, 2),
  target_delivery_date                 DATE,
  current_planning_milestone           VARCHAR,
  status                               planning_entity_status NOT NULL DEFAULT 'identified',
  -- linked_asset_id: FK to assets — added below after REFERENCES check
  linked_asset_id                      UUID        REFERENCES assets(id),
  -- developer_obligation_id: plain UUID stub; FK constraint added in US-047
  developer_obligation_id              UUID,
  funding_source_notes                 TEXT,
  notes                                TEXT,
  created_at                           TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at                           TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

-- Resolve assets.planning_entity_id FK stub (declared in US-005, now target table exists)
ALTER TABLE assets
  ADD CONSTRAINT fk_assets_planning_entity
  FOREIGN KEY (planning_entity_id)
  REFERENCES planning_entities(id);

-- Indexes
CREATE INDEX idx_planning_entities_asset_family    ON planning_entities(asset_family_id);
CREATE INDEX idx_planning_entities_status          ON planning_entities(status);
CREATE INDEX idx_planning_entities_planning_body   ON planning_entities(planning_body_id);
CREATE INDEX idx_planning_entities_target_delivery ON planning_entities(target_delivery_date);
