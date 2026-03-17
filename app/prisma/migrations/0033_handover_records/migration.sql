-- US-033: Handover Record schema and migration

-- Enum for handover status
CREATE TYPE handover_status AS ENUM (
  'pending',
  'accepted',
  'accepted_with_conditions',
  'rejected'
);

-- Table: handover_records
CREATE TABLE handover_records (
  id                           UUID        NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  asset_id                     UUID        NOT NULL REFERENCES assets(id),
  delivered_by_body_id         UUID        NOT NULL REFERENCES responsible_bodies(id),
  received_by_body_id          UUID        NOT NULL REFERENCES responsible_bodies(id),
  -- User FK stubs — REFERENCES added in a later migration
  delivered_by_user_id         UUID,
  received_by_user_id          UUID,
  handover_date                DATE        NOT NULL,
  handover_status              handover_status NOT NULL DEFAULT 'pending',
  defects_list                 JSONB,
  missing_documents            JSONB,
  accepted_with_conditions_flag BOOLEAN    NOT NULL DEFAULT FALSE,
  conditions_description       TEXT,
  warranty_expiry_date         DATE,
  notes                        TEXT,
  created_at                   TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at                   TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

-- Indexes
CREATE INDEX idx_handover_records_asset_id       ON handover_records(asset_id);
CREATE INDEX idx_handover_records_handover_date  ON handover_records(handover_date);
CREATE INDEX idx_handover_records_handover_status ON handover_records(handover_status);
