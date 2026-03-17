-- Migration: 0007_documents
-- US-007: Document schema and migration

-- Document types lookup table
CREATE TABLE document_types (
  id          UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  name        VARCHAR(120) NOT NULL UNIQUE,
  description TEXT,
  is_active   BOOLEAN NOT NULL DEFAULT TRUE
);

-- Seed all known document types
INSERT INTO document_types (name) VALUES
  ('plan'),
  ('permit'),
  ('approval'),
  ('allocation document'),
  ('specification'),
  ('execution report'),
  ('delivery document'),
  ('as-made document'),
  ('occupancy protocol'),
  ('activation approval'),
  ('operator agreement'),
  ('inspection form'),
  ('work order'),
  ('maintenance report'),
  ('safety report'),
  ('closure approval'),
  ('decommissioning protocol'),
  ('disposal decision'),
  ('developer commitment'),
  ('budget approval'),
  ('contract'),
  ('title deed'),
  ('condition survey'),
  ('field photo'),
  ('GIS reference document'),
  ('survey report');

-- Enum for entity types that documents can be attached to
CREATE TYPE attached_entity_type AS ENUM (
  'asset',
  'event',
  'budget_envelope',
  'contract',
  'planning_entity',
  'developer_obligation',
  'handover_record',
  'work_order'
);

-- Documents table
CREATE TABLE documents (
  id                      UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  document_type_id        UUID NOT NULL REFERENCES document_types(id),
  title                   TEXT NOT NULL,
  description             TEXT,
  file_url                TEXT NOT NULL,
  file_name               VARCHAR(500),
  file_size_bytes         INTEGER,
  mime_type               VARCHAR(200),
  attached_to_entity_type attached_entity_type NOT NULL,
  attached_to_entity_id   UUID NOT NULL,
  -- FK stub: uploaded_by_user_id resolved in US-018
  uploaded_by_user_id     UUID,
  lifecycle_stage_id      UUID REFERENCES lifecycle_stages(id),
  is_required             BOOLEAN NOT NULL DEFAULT FALSE,
  is_verified             BOOLEAN NOT NULL DEFAULT FALSE,
  -- FK stub: verified_by_user_id resolved in US-018
  verified_by_user_id     UUID,
  verified_at             TIMESTAMPTZ,
  expiry_date             DATE,
  is_deleted              BOOLEAN NOT NULL DEFAULT FALSE,
  created_at              TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at              TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

-- Indexes
CREATE INDEX idx_documents_entity ON documents(attached_to_entity_type, attached_to_entity_id);
CREATE INDEX idx_documents_document_type_id  ON documents(document_type_id);
CREATE INDEX idx_documents_lifecycle_stage_id ON documents(lifecycle_stage_id);
