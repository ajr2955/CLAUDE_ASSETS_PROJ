-- US-018: User authentication schema
-- Creates the users table with JWT-based auth support

CREATE TYPE user_role AS ENUM (
  'admin',
  'planner',
  'asset_manager',
  'operations_manager',
  'department_user',
  'contractor',
  'public'
);

CREATE TABLE users (
  id                  UUID        PRIMARY KEY DEFAULT gen_random_uuid(),
  email               VARCHAR(255) NOT NULL UNIQUE,
  name                VARCHAR(200),
  password_hash       TEXT        NOT NULL,
  role                user_role   NOT NULL DEFAULT 'public',
  responsible_body_id UUID        REFERENCES responsible_bodies(id),
  is_active           BOOLEAN     NOT NULL DEFAULT true,
  last_login_at       TIMESTAMPTZ,
  created_at          TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at          TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

-- Resolve FK stubs from earlier migrations
ALTER TABLE events
  ADD CONSTRAINT events_recorded_by_user_id_fkey
  FOREIGN KEY (recorded_by_user_id) REFERENCES users(id);

ALTER TABLE documents
  ADD CONSTRAINT documents_uploaded_by_user_id_fkey
  FOREIGN KEY (uploaded_by_user_id) REFERENCES users(id);

ALTER TABLE documents
  ADD CONSTRAINT documents_verified_by_user_id_fkey
  FOREIGN KEY (verified_by_user_id) REFERENCES users(id);
