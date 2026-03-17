-- US-060: Document Completeness Rules Engine

CREATE TABLE document_completeness_rules (
  id                  UUID        NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  asset_family_id     UUID        REFERENCES asset_families(id),
  asset_type_id       UUID        REFERENCES asset_types(id),
  lifecycle_stage_id  UUID        NOT NULL REFERENCES lifecycle_stages(id),
  document_type_id    UUID        NOT NULL REFERENCES document_types(id),
  is_mandatory        BOOLEAN     NOT NULL DEFAULT true,
  is_active           BOOLEAN     NOT NULL DEFAULT true,
  created_at          TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at          TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE INDEX idx_dcr_lifecycle_stage ON document_completeness_rules(lifecycle_stage_id);
CREATE INDEX idx_dcr_asset_family    ON document_completeness_rules(asset_family_id);
CREATE INDEX idx_dcr_document_type   ON document_completeness_rules(document_type_id);

-- Seed data: critical document completeness rules
-- Uses subqueries to look up IDs by name

-- Planning and Approval stage rules (all families)
INSERT INTO document_completeness_rules (lifecycle_stage_id, document_type_id, asset_family_id, asset_type_id, is_mandatory)
SELECT
  ls.id,
  dt.id,
  NULL,
  NULL,
  true
FROM lifecycle_stages ls, document_types dt
WHERE ls.name = 'Planning and Approval'
  AND dt.name = 'plan';

INSERT INTO document_completeness_rules (lifecycle_stage_id, document_type_id, asset_family_id, asset_type_id, is_mandatory)
SELECT ls.id, dt.id, NULL, NULL, true
FROM lifecycle_stages ls, document_types dt
WHERE ls.name = 'Planning and Approval'
  AND dt.name = 'permit';

INSERT INTO document_completeness_rules (lifecycle_stage_id, document_type_id, asset_family_id, asset_type_id, is_mandatory)
SELECT ls.id, dt.id, NULL, NULL, true
FROM lifecycle_stages ls, document_types dt
WHERE ls.name = 'Planning and Approval'
  AND dt.name = 'allocation document';

-- Establishment / Implementation / Intake stage rules (all families)
INSERT INTO document_completeness_rules (lifecycle_stage_id, document_type_id, asset_family_id, asset_type_id, is_mandatory)
SELECT ls.id, dt.id, NULL, NULL, true
FROM lifecycle_stages ls, document_types dt
WHERE ls.name = 'Establishment / Implementation / Intake'
  AND dt.name = 'specification';

INSERT INTO document_completeness_rules (lifecycle_stage_id, document_type_id, asset_family_id, asset_type_id, is_mandatory)
SELECT ls.id, dt.id, NULL, NULL, true
FROM lifecycle_stages ls, document_types dt
WHERE ls.name = 'Establishment / Implementation / Intake'
  AND dt.name = 'execution report';

INSERT INTO document_completeness_rules (lifecycle_stage_id, document_type_id, asset_family_id, asset_type_id, is_mandatory)
SELECT ls.id, dt.id, NULL, NULL, true
FROM lifecycle_stages ls, document_types dt
WHERE ls.name = 'Establishment / Implementation / Intake'
  AND dt.name = 'delivery document';

INSERT INTO document_completeness_rules (lifecycle_stage_id, document_type_id, asset_family_id, asset_type_id, is_mandatory)
SELECT ls.id, dt.id, NULL, NULL, true
FROM lifecycle_stages ls, document_types dt
WHERE ls.name = 'Establishment / Implementation / Intake'
  AND dt.name = 'as-made document';

-- Activation and Operation stage rules (all families)
INSERT INTO document_completeness_rules (lifecycle_stage_id, document_type_id, asset_family_id, asset_type_id, is_mandatory)
SELECT ls.id, dt.id, NULL, NULL, true
FROM lifecycle_stages ls, document_types dt
WHERE ls.name = 'Activation and Operation'
  AND dt.name = 'occupancy protocol';

INSERT INTO document_completeness_rules (lifecycle_stage_id, document_type_id, asset_family_id, asset_type_id, is_mandatory)
SELECT ls.id, dt.id, NULL, NULL, true
FROM lifecycle_stages ls, document_types dt
WHERE ls.name = 'Activation and Operation'
  AND dt.name = 'activation approval';

-- Maintenance and Control stage rules (all families)
INSERT INTO document_completeness_rules (lifecycle_stage_id, document_type_id, asset_family_id, asset_type_id, is_mandatory)
SELECT ls.id, dt.id, NULL, NULL, true
FROM lifecycle_stages ls, document_types dt
WHERE ls.name = 'Maintenance and Control'
  AND dt.name = 'inspection form';

-- Disposal / End of Life stage rules (all families)
INSERT INTO document_completeness_rules (lifecycle_stage_id, document_type_id, asset_family_id, asset_type_id, is_mandatory)
SELECT ls.id, dt.id, NULL, NULL, true
FROM lifecycle_stages ls, document_types dt
WHERE ls.name = 'Disposal / End of Life'
  AND dt.name = 'closure approval';

INSERT INTO document_completeness_rules (lifecycle_stage_id, document_type_id, asset_family_id, asset_type_id, is_mandatory)
SELECT ls.id, dt.id, NULL, NULL, true
FROM lifecycle_stages ls, document_types dt
WHERE ls.name = 'Disposal / End of Life'
  AND dt.name = 'decommissioning protocol';

-- Handover-specific rule for Planning Administration assets (Establishment stage, delivery document)
-- This is already covered by the all-families rule above; no duplicate needed.
-- For completeness, add budget approval as mandatory for Budgeting and Allocation stage
INSERT INTO document_completeness_rules (lifecycle_stage_id, document_type_id, asset_family_id, asset_type_id, is_mandatory)
SELECT ls.id, dt.id, NULL, NULL, true
FROM lifecycle_stages ls, document_types dt
WHERE ls.name = 'Budgeting and Allocation'
  AND dt.name = 'budget approval';
