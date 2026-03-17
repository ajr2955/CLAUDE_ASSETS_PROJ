-- Migration: 0002_asset_types
-- US-002: Asset Type schema and migration

CREATE TABLE asset_types (
  id              UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  asset_family_id UUID NOT NULL REFERENCES asset_families(id),
  name            VARCHAR(120) NOT NULL,
  description     TEXT,
  is_active       BOOLEAN NOT NULL DEFAULT TRUE,
  created_at      TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at      TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  CONSTRAINT uq_asset_types_family_name UNIQUE (asset_family_id, name)
);

-- Seed: asset types per family
-- Public Buildings
INSERT INTO asset_types (asset_family_id, name, description)
SELECT id, 'Community Center', 'Neighborhood and community centers' FROM asset_families WHERE name = 'Public Buildings';

INSERT INTO asset_types (asset_family_id, name, description)
SELECT id, 'Municipal Office', 'Municipal administrative offices' FROM asset_families WHERE name = 'Public Buildings';

INSERT INTO asset_types (asset_family_id, name, description)
SELECT id, 'Warehouse', 'Municipal storage and operational warehouses' FROM asset_families WHERE name = 'Public Buildings';

INSERT INTO asset_types (asset_family_id, name, description)
SELECT id, 'Commercial Unit', 'Municipal commercial or retail units' FROM asset_families WHERE name = 'Public Buildings';

INSERT INTO asset_types (asset_family_id, name, description)
SELECT id, 'Cultural Hall', 'Theaters, galleries, and cultural venues' FROM asset_families WHERE name = 'Public Buildings';

-- Educational Buildings
INSERT INTO asset_types (asset_family_id, name, description)
SELECT id, 'School', 'Primary and secondary schools' FROM asset_families WHERE name = 'Educational Buildings';

INSERT INTO asset_types (asset_family_id, name, description)
SELECT id, 'Kindergarten', 'Kindergarten and pre-school facilities' FROM asset_families WHERE name = 'Educational Buildings';

INSERT INTO asset_types (asset_family_id, name, description)
SELECT id, 'Maternal and Child Health Center', 'Mother and child healthcare centers (Tipat Halav)' FROM asset_families WHERE name = 'Educational Buildings';

-- Facilities
INSERT INTO asset_types (asset_family_id, name, description)
SELECT id, 'Health Fund Clinic', 'Health fund (HMO) clinic premises' FROM asset_families WHERE name = 'Facilities';

INSERT INTO asset_types (asset_family_id, name, description)
SELECT id, 'Utility Building', 'Technical and utility buildings' FROM asset_families WHERE name = 'Facilities';

-- Public Gardens
INSERT INTO asset_types (asset_family_id, name, description)
SELECT id, 'Public Garden', 'Standard public parks and gardens' FROM asset_families WHERE name = 'Public Gardens';

INSERT INTO asset_types (asset_family_id, name, description)
SELECT id, 'Traffic Island', 'Landscaped traffic islands and road medians' FROM asset_families WHERE name = 'Public Gardens';

INSERT INTO asset_types (asset_family_id, name, description)
SELECT id, 'Playground', 'Public playgrounds within garden areas' FROM asset_families WHERE name = 'Public Gardens';

-- Trees
INSERT INTO asset_types (asset_family_id, name, description)
SELECT id, 'Single Tree', 'Individual street or park tree' FROM asset_families WHERE name = 'Trees';

INSERT INTO asset_types (asset_family_id, name, description)
SELECT id, 'Tree Group', 'Cluster or grove of trees managed as a unit' FROM asset_families WHERE name = 'Trees';

-- Sports Fields and Sports Facilities
INSERT INTO asset_types (asset_family_id, name, description)
SELECT id, 'Football Field', 'Football / soccer pitch' FROM asset_families WHERE name = 'Sports Fields and Sports Facilities';

INSERT INTO asset_types (asset_family_id, name, description)
SELECT id, 'Sports Hall', 'Indoor multipurpose sports hall' FROM asset_families WHERE name = 'Sports Fields and Sports Facilities';

INSERT INTO asset_types (asset_family_id, name, description)
SELECT id, 'Tennis Court', 'Tennis or paddle court' FROM asset_families WHERE name = 'Sports Fields and Sports Facilities';

INSERT INTO asset_types (asset_family_id, name, description)
SELECT id, 'Basketball Court', 'Outdoor or indoor basketball court' FROM asset_families WHERE name = 'Sports Fields and Sports Facilities';

INSERT INTO asset_types (asset_family_id, name, description)
SELECT id, 'Swimming Pool', 'Municipal swimming facility' FROM asset_families WHERE name = 'Sports Fields and Sports Facilities';

-- Real Estate / Lease / Allocation Assets
INSERT INTO asset_types (asset_family_id, name, description)
SELECT id, 'Leased Land', 'Land leased to or from another party' FROM asset_families WHERE name = 'Real Estate / Lease / Allocation Assets';

INSERT INTO asset_types (asset_family_id, name, description)
SELECT id, 'Leased Building', 'Building leased in or out' FROM asset_families WHERE name = 'Real Estate / Lease / Allocation Assets';

INSERT INTO asset_types (asset_family_id, name, description)
SELECT id, 'Allocated Space', 'Space formally allocated to an organization or use' FROM asset_families WHERE name = 'Real Estate / Lease / Allocation Assets';

-- Assets in Formation
INSERT INTO asset_types (asset_family_id, name, description)
SELECT id, 'Planned Asset', 'Asset approved and in planning stage' FROM asset_families WHERE name = 'Assets in Formation';

INSERT INTO asset_types (asset_family_id, name, description)
SELECT id, 'Asset Under Construction', 'Asset currently being built or established' FROM asset_families WHERE name = 'Assets in Formation';

-- Community / Health Assets from Developer Obligations
INSERT INTO asset_types (asset_family_id, name, description)
SELECT id, 'Community Facility', 'Community hall or center from developer obligation' FROM asset_families WHERE name = 'Community / Health Assets from Developer Obligations';

INSERT INTO asset_types (asset_family_id, name, description)
SELECT id, 'Health Clinic', 'Health clinic from developer obligation' FROM asset_families WHERE name = 'Community / Health Assets from Developer Obligations';
