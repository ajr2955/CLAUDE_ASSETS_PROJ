-- Migration: US-063 Asset Risk Scores
-- Creates the asset_risk_scores table for storing computed risk scores

CREATE TYPE risk_band AS ENUM (
  'Low',
  'Medium',
  'High',
  'Critical'
);

CREATE TABLE asset_risk_scores (
  id               UUID        NOT NULL DEFAULT gen_random_uuid(),
  asset_id         UUID        NOT NULL UNIQUE,
  risk_score       INTEGER     NOT NULL,
  risk_band        risk_band   NOT NULL,
  score_components JSONB       NOT NULL DEFAULT '{}',
  computed_at      TIMESTAMPTZ NOT NULL DEFAULT NOW(),

  CONSTRAINT asset_risk_scores_pkey PRIMARY KEY (id),
  CONSTRAINT asset_risk_scores_asset_id_fkey
    FOREIGN KEY (asset_id) REFERENCES assets(id)
);
