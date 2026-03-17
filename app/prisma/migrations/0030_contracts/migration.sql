-- US-030: Contract schema and migration

-- Contract types lookup table
CREATE TABLE contract_types (
  id         UUID        NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  name       VARCHAR(120) NOT NULL UNIQUE,
  description TEXT,
  is_active  BOOLEAN     NOT NULL DEFAULT TRUE
);

-- Seed contract types
INSERT INTO contract_types (name, description) VALUES
  ('lease_contract',        'Lease contract for asset use by a tenant'),
  ('supplier_agreement',    'Agreement with a supplier or service provider'),
  ('allocation_agreement',  'Formal allocation of asset to a body or party'),
  ('service_contract',      'Ongoing service or maintenance contract'),
  ('operator_agreement',    'Agreement with an operator managing the asset'),
  ('developer_commitment',  'Developer obligation or commitment document');

-- Enums
CREATE TYPE counterparty_type AS ENUM (
  'tenant', 'supplier', 'operator', 'developer', 'authority', 'other'
);

CREATE TYPE payment_frequency AS ENUM (
  'monthly', 'quarterly', 'annual', 'one_off'
);

CREATE TYPE contract_status AS ENUM (
  'draft', 'active', 'expired', 'terminated', 'renewed'
);

-- Contracts table
CREATE TABLE contracts (
  id                  UUID             NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  asset_id            UUID             NOT NULL REFERENCES assets(id),
  contract_type_id    UUID             NOT NULL REFERENCES contract_types(id),
  contract_reference  VARCHAR(200)     UNIQUE,
  counterparty_name   VARCHAR(300)     NOT NULL,
  counterparty_type   counterparty_type NOT NULL,
  responsible_body_id UUID             REFERENCES responsible_bodies(id),
  start_date          DATE             NOT NULL,
  end_date            DATE,
  notice_period_days  INTEGER,
  renewal_option      BOOLEAN          NOT NULL DEFAULT FALSE,
  auto_renewal        BOOLEAN          NOT NULL DEFAULT FALSE,
  contract_value      DECIMAL(18, 2),
  periodic_amount     DECIMAL(18, 2),
  payment_frequency   payment_frequency,
  sla_description     TEXT,
  status              contract_status  NOT NULL DEFAULT 'draft',
  notes               TEXT,
  created_at          TIMESTAMPTZ      NOT NULL DEFAULT NOW(),
  updated_at          TIMESTAMPTZ      NOT NULL DEFAULT NOW()
);

-- Indexes
CREATE INDEX contracts_asset_id_idx         ON contracts(asset_id);
CREATE INDEX contracts_status_idx           ON contracts(status);
CREATE INDEX contracts_end_date_idx         ON contracts(end_date);
CREATE INDEX contracts_counterparty_type_idx ON contracts(counterparty_type);
