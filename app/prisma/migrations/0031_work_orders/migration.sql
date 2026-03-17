-- US-031: Work Order schema and migration

-- Work order categories lookup table
CREATE TABLE work_order_categories (
  id          UUID        NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  name        VARCHAR(120) NOT NULL UNIQUE,
  description TEXT,
  is_active   BOOLEAN     NOT NULL DEFAULT TRUE
);

INSERT INTO work_order_categories (name) VALUES
  ('pruning'),
  ('repair'),
  ('inspection'),
  ('cleaning'),
  ('irrigation_repair'),
  ('safety_remediation'),
  ('surface_renewal'),
  ('structural_repair'),
  ('general_maintenance'),
  ('equipment_replacement');

-- Enums
CREATE TYPE work_order_priority AS ENUM ('critical', 'high', 'medium', 'low');
CREATE TYPE work_order_status   AS ENUM ('open', 'assigned', 'in_progress', 'pending_approval', 'closed', 'cancelled');

-- Work orders table
CREATE TABLE work_orders (
  id                      UUID                  NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  asset_id                UUID                  NOT NULL REFERENCES assets(id),
  work_order_number       VARCHAR(60)           NOT NULL UNIQUE,
  category_id             UUID                  NOT NULL REFERENCES work_order_categories(id),
  title                   TEXT                  NOT NULL,
  description             TEXT,
  priority                work_order_priority   NOT NULL DEFAULT 'medium',
  status                  work_order_status     NOT NULL DEFAULT 'open',
  assigned_to_body_id     UUID                  REFERENCES responsible_bodies(id),
  -- FK stubs for users (resolved in US-018 migration)
  assigned_to_user_id     UUID,
  reported_by_user_id     UUID,
  lifecycle_stage_id      UUID                  REFERENCES lifecycle_stages(id),
  target_completion_date  DATE,
  actual_completion_date  DATE,
  estimated_cost          NUMERIC(18, 2),
  actual_cost             NUMERIC(18, 2),
  sla_breach_at           TIMESTAMPTZ,
  notes                   TEXT,
  created_at              TIMESTAMPTZ           NOT NULL DEFAULT NOW(),
  updated_at              TIMESTAMPTZ           NOT NULL DEFAULT NOW()
);

CREATE INDEX idx_work_orders_asset_id            ON work_orders(asset_id);
CREATE INDEX idx_work_orders_status              ON work_orders(status);
CREATE INDEX idx_work_orders_priority            ON work_orders(priority);
CREATE INDEX idx_work_orders_assigned_to_body_id ON work_orders(assigned_to_body_id);
CREATE INDEX idx_work_orders_target_completion   ON work_orders(target_completion_date);
