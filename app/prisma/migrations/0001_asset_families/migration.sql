-- Migration: 0001_asset_families
-- US-001: Asset Family schema and migration

CREATE EXTENSION IF NOT EXISTS "pgcrypto";

CREATE TABLE asset_families (
  id          UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  name        VARCHAR(120) NOT NULL UNIQUE,
  description TEXT,
  is_active   BOOLEAN NOT NULL DEFAULT TRUE,
  created_at  TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at  TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

-- Seed: all known asset families
INSERT INTO asset_families (name, description) VALUES
  ('Public Buildings',                          'Municipal and community public buildings'),
  ('Educational Buildings',                     'Schools, kindergartens, and educational facilities'),
  ('Facilities',                                'Municipal offices, warehouses, and operational facilities'),
  ('Public Gardens',                            'Public parks, gardens, and green spaces'),
  ('Trees',                                     'Individual trees and tree groups in public spaces'),
  ('Sports Fields and Sports Facilities',       'Outdoor and indoor sports infrastructure'),
  ('Real Estate / Lease / Allocation Assets',   'Leased-in, leased-out, or allocated real estate'),
  ('Assets in Formation',                       'Assets currently in planning or construction'),
  ('Community / Health Assets from Developer Obligations', 'Community and health assets arising from developer commitments');
