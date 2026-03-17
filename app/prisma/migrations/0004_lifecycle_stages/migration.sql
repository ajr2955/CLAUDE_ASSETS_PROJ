-- Migration: 0004_lifecycle_stages
-- US-004: Lifecycle Stage schema and migration

CREATE TABLE lifecycle_stages (
  id                    UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  name                  VARCHAR(120) NOT NULL UNIQUE,
  display_order         INTEGER NOT NULL,
  description           TEXT,
  applies_to_families   JSONB,
  created_at            TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at            TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

-- Seed: all 10 lifecycle stages in order
INSERT INTO lifecycle_stages (name, display_order, description) VALUES
  ('Need Identification',                  1,  'Initial identification of an asset need or gap'),
  ('Asset Definition',                     2,  'Defining the scope, type, and requirements of the asset'),
  ('Planning and Approval',                3,  'Urban planning, permits, and formal approvals'),
  ('Budgeting and Allocation',             4,  'Budget approval and funding allocation'),
  ('Establishment / Implementation / Intake', 5, 'Construction, procurement, or intake of the asset'),
  ('Activation and Operation',             6,  'Asset is activated and in regular operation'),
  ('Maintenance and Control',              7,  'Ongoing maintenance, inspections, and control'),
  ('Change / Upgrade / Reconfiguration',   8,  'Physical or functional change to an operating asset'),
  ('Renewal / Replacement',                9,  'Major renewal or replacement of the asset'),
  ('Disposal / End of Life',               10, 'Decommissioning, disposal, or formal end of asset life');

CREATE TABLE lifecycle_transitions (
  id                      UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  from_stage_id           UUID NOT NULL REFERENCES lifecycle_stages(id),
  to_stage_id             UUID NOT NULL REFERENCES lifecycle_stages(id),
  applies_to_family_id    UUID REFERENCES asset_families(id),
  required_document_types JSONB,
  required_events         JSONB,
  warning_message         TEXT,
  is_active               BOOLEAN NOT NULL DEFAULT TRUE
);
