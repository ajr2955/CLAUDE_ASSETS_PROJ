-- Migration: 0008_events
-- US-008: Event schema and migration

-- Enum for event category
CREATE TYPE event_category AS ENUM (
  'business',
  'operational',
  'governance'
);

-- Event types lookup table
CREATE TABLE event_types (
  id          UUID         NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  name        VARCHAR(120) NOT NULL UNIQUE,
  category    event_category NOT NULL,
  description TEXT,
  is_active   BOOLEAN      NOT NULL DEFAULT true
);

-- Seed data: all known event types
-- Business events
INSERT INTO event_types (name, category) VALUES
  ('need_opened',          'business'),
  ('plan_reviewed',        'business'),
  ('land_allocated',       'business'),
  ('budget_approved',      'business'),
  ('contract_signed',      'business'),
  ('funding_changed',      'business'),
  ('asset_transferred',    'business'),
  ('operator_changed',     'business'),
  ('approval_granted',     'business'),
  ('allocation_confirmed', 'business');

-- Operational events
INSERT INTO event_types (name, category) VALUES
  ('construction_started',    'operational'),
  ('asset_delivered',         'operational'),
  ('asset_received',          'operational'),
  ('asset_activated',         'operational'),
  ('maintenance_opened',      'operational'),
  ('inspection_completed',    'operational'),
  ('inspection_failed',       'operational'),
  ('pruning_executed',        'operational'),
  ('fault_opened',            'operational'),
  ('service_suspended',       'operational'),
  ('safety_issue_reported',   'operational'),
  ('work_order_created',      'operational'),
  ('work_order_closed',       'operational'),
  ('turf_replaced',           'operational'),
  ('irrigation_repaired',     'operational'),
  ('asset_reassigned',        'operational');

-- Governance events
INSERT INTO event_types (name, category) VALUES
  ('status_changed',              'governance'),
  ('missing_document_detected',   'governance'),
  ('budget_variance_detected',    'governance'),
  ('asset_at_risk_flagged',       'governance'),
  ('overdue_milestone_flagged',   'governance'),
  ('lifecycle_stage_changed',     'governance'),
  ('contract_renewed',            'governance'),
  ('asset_decommissioned',        'governance');

-- Events table (append-only audit log)
CREATE TABLE events (
  id                  UUID        NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  event_type_id       UUID        NOT NULL REFERENCES event_types(id),
  asset_id            UUID        NOT NULL REFERENCES assets(id),
  lifecycle_stage_id  UUID                 REFERENCES lifecycle_stages(id),
  occurred_at         TIMESTAMPTZ NOT NULL DEFAULT now(),
  -- FK stub: recorded_by_user_id resolved in US-018
  recorded_by_user_id UUID,
  responsible_body_id UUID                 REFERENCES responsible_bodies(id),
  description         TEXT,
  metadata            JSONB,
  is_system_generated BOOLEAN     NOT NULL DEFAULT false,
  created_at          TIMESTAMPTZ NOT NULL DEFAULT now()
);

-- Indexes
CREATE INDEX idx_events_asset_id          ON events (asset_id);
CREATE INDEX idx_events_event_type_id     ON events (event_type_id);
CREATE INDEX idx_events_occurred_at       ON events (occurred_at);
CREATE INDEX idx_events_lifecycle_stage   ON events (lifecycle_stage_id);
