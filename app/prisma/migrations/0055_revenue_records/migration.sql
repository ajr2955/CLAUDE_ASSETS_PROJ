-- US-055: Revenue Record schema and migration

CREATE TYPE revenue_type AS ENUM (
  'lease_income',
  'booking_fee',
  'service_charge',
  'operator_fee',
  'other'
);

CREATE TYPE revenue_status AS ENUM (
  'expected',
  'received',
  'partial',
  'overdue',
  'waived'
);

CREATE TABLE revenue_records (
  id              UUID           NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  asset_id        UUID           NOT NULL REFERENCES assets(id),
  allocation_id   UUID           REFERENCES allocations(id),
  contract_id     UUID           REFERENCES contracts(id),
  revenue_type    revenue_type   NOT NULL,
  period_start    DATE           NOT NULL,
  period_end      DATE           NOT NULL,
  expected_amount DECIMAL(18, 2) NOT NULL DEFAULT 0,
  actual_amount   DECIMAL(18, 2) NOT NULL DEFAULT 0,
  payment_date    DATE,
  status          revenue_status NOT NULL DEFAULT 'expected',
  notes           TEXT,
  created_at      TIMESTAMPTZ    NOT NULL DEFAULT NOW(),
  updated_at      TIMESTAMPTZ    NOT NULL DEFAULT NOW()
);

CREATE INDEX idx_revenue_records_asset_id     ON revenue_records(asset_id);
CREATE INDEX idx_revenue_records_status       ON revenue_records(status);
CREATE INDEX idx_revenue_records_period_start ON revenue_records(period_start);
CREATE INDEX idx_revenue_records_period_end   ON revenue_records(period_end);
