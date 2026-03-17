-- US-049: Body Transfer schema and migration

-- Create body transfer type enum
CREATE TYPE body_transfer_type AS ENUM (
  'strategic_owner',
  'responsible_body',
  'operational_body',
  'maintenance_body',
  'data_steward'
);

-- Create body_transfers table (immutable — no update or delete via API)
CREATE TABLE body_transfers (
  id                    UUID               NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  asset_id              UUID               NOT NULL REFERENCES assets(id),
  transfer_type         body_transfer_type NOT NULL,
  from_body_id          UUID               NOT NULL REFERENCES responsible_bodies(id),
  to_body_id            UUID               NOT NULL REFERENCES responsible_bodies(id),
  transfer_date         DATE               NOT NULL,
  reason                TEXT               NOT NULL,
  authorized_by_user_id UUID,
  notes                 TEXT,
  created_at            TIMESTAMPTZ        NOT NULL DEFAULT NOW()
);

-- Note: no updated_at column — body_transfers are append-only (immutable)
-- authorized_by_user_id is a plain UUID stub — FK constraint can be added later via ALTER TABLE
