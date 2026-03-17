-- US-032: Condition Record schema and migration

CREATE TYPE structural_condition AS ENUM ('good', 'fair', 'poor', 'critical');
CREATE TYPE safety_condition AS ENUM ('safe', 'minor_hazard', 'major_hazard', 'unsafe');
CREATE TYPE maintenance_priority AS ENUM ('none', 'low', 'medium', 'high', 'urgent');
CREATE TYPE replacement_urgency AS ENUM ('none', 'within_5_years', 'within_2_years', 'within_1_year', 'immediate');

CREATE TABLE condition_records (
  id                   UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  asset_id             UUID NOT NULL REFERENCES assets(id),
  inspected_by_user_id UUID,
  inspected_by_body_id UUID REFERENCES responsible_bodies(id),
  inspection_date      DATE NOT NULL,
  condition_score      INTEGER NOT NULL CHECK (condition_score BETWEEN 1 AND 5),
  structural_condition structural_condition,
  safety_condition     safety_condition,
  maintenance_priority maintenance_priority NOT NULL DEFAULT 'none',
  replacement_urgency  replacement_urgency NOT NULL DEFAULT 'none',
  notes                TEXT,
  next_inspection_due  DATE,
  created_at           TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT NOW(),
  updated_at           TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT NOW()
);

CREATE INDEX idx_condition_records_asset_id ON condition_records(asset_id);
CREATE INDEX idx_condition_records_inspection_date ON condition_records(inspection_date);
CREATE INDEX idx_condition_records_condition_score ON condition_records(condition_score);
CREATE INDEX idx_condition_records_safety_condition ON condition_records(safety_condition);
