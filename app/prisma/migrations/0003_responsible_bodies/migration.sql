-- Migration: 0003_responsible_bodies
-- US-003: Responsible Body schema and migration

CREATE TYPE body_type AS ENUM (
  'headquarters',
  'planning',
  'assets',
  'operations',
  'administration',
  'department',
  'contractor',
  'data_governance',
  'placeholder'
);

CREATE TABLE responsible_bodies (
  id              UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  name            VARCHAR(200) NOT NULL UNIQUE,
  body_type       body_type NOT NULL,
  description     TEXT,
  is_active       BOOLEAN NOT NULL DEFAULT TRUE,
  is_placeholder  BOOLEAN NOT NULL DEFAULT FALSE,
  resolution_note TEXT,
  created_at      TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at      TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

-- Seed: core responsible bodies
INSERT INTO responsible_bodies (name, body_type, description) VALUES
  ('CEO Office / Executive Headquarters',         'headquarters',    'Municipal CEO office and executive leadership'),
  ('Planning Administration / Public Construction Headquarters', 'planning', 'Public construction and urban planning administration'),
  ('Assets Department',                           'assets',          'Department responsible for municipal asset management'),
  ('Operations / Gardening Department',           'operations',      'Field operations including gardens and public spaces'),
  ('Culture Society and Sports Administration',   'administration',  'Administration for culture, community, and sports programs'),
  ('Sports Department',                           'department',      'Department managing sports facilities and programs'),
  ('Data and Innovation Headquarters',            'data_governance', 'Digital transformation and data governance unit'),
  ('Contractors / Suppliers / Field Parties',     'contractor',      'External contractors and field service providers');

-- Seed: placeholder bodies for unresolved organizational decisions
INSERT INTO responsible_bodies (name, body_type, description, is_placeholder, resolution_note) VALUES
  (
    'Educational Buildings Holding Body (TBD)',
    'placeholder',
    'Placeholder holding body for educational buildings pending organizational decision',
    TRUE,
    'Open decision: Which body will formally hold educational buildings (schools, kindergartens, etc.)? Pending legal/organizational review.'
  ),
  (
    'Health/Community Developer Obligation Holding Body (TBD)',
    'placeholder',
    'Placeholder holding body for health and community assets arising from developer obligations',
    TRUE,
    'Open decision: Which body will formally hold health and community assets transferred from developers? Pending stakeholder alignment.'
  );
