-- US-048: Allocation schema and migration

-- Create allocation type enum
CREATE TYPE allocation_type AS ENUM (
  'internal_use',
  'operator',
  'tenant',
  'partner',
  'temporary_use'
);

-- Create allocation status enum
CREATE TYPE allocation_status AS ENUM (
  'active',
  'pending',
  'expired',
  'terminated'
);

-- Create allocations table
-- Note: fee_frequency reuses the payment_frequency enum defined in US-030
CREATE TABLE allocations (
  id                    UUID              NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  asset_id              UUID              NOT NULL REFERENCES assets(id),
  allocated_to_body_id  UUID              REFERENCES responsible_bodies(id),
  allocated_to_name     VARCHAR,
  allocation_type       allocation_type   NOT NULL,
  start_date            DATE              NOT NULL,
  end_date              DATE,
  area_sqm              DECIMAL(12, 2),
  usage_description     TEXT,
  is_revenue_generating BOOLEAN           NOT NULL DEFAULT FALSE,
  periodic_fee          DECIMAL(18, 2),
  fee_frequency         payment_frequency,
  status                allocation_status NOT NULL DEFAULT 'pending',
  notes                 TEXT,
  created_at            TIMESTAMPTZ       NOT NULL DEFAULT NOW(),
  updated_at            TIMESTAMPTZ       NOT NULL DEFAULT NOW()
);

-- Indexes
CREATE INDEX idx_allocations_asset_id             ON allocations(asset_id);
CREATE INDEX idx_allocations_status               ON allocations(status);
CREATE INDEX idx_allocations_end_date             ON allocations(end_date);
CREATE INDEX idx_allocations_is_revenue_generating ON allocations(is_revenue_generating);
