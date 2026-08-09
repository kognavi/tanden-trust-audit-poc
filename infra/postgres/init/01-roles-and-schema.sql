-- ⚠️ LOCAL DEVELOPMENT ONLY — DO NOT reuse this password in staging/production.
-- Production credentials MUST be managed via AWS Secrets Manager / SSM Parameter Store.
CREATE ROLE evidence_app LOGIN PASSWORD 'app_localdev_password';
CREATE ROLE evidence_owner NOLOGIN;

CREATE SCHEMA IF NOT EXISTS audit;
ALTER SCHEMA audit OWNER TO evidence_owner;

SET ROLE evidence_owner;

CREATE TABLE audit.evidence_log (
  id           BIGSERIAL PRIMARY KEY,
  created_at   TIMESTAMPTZ NOT NULL DEFAULT now(),
  canonical_json JSONB NOT NULL,
  row_hash     TEXT NOT NULL,
  prev_hash    TEXT,
  signature    TEXT,
  kms_key_id   TEXT
);

RESET ROLE;

GRANT USAGE ON SCHEMA audit TO evidence_app;
GRANT INSERT, SELECT ON audit.evidence_log TO evidence_app;
GRANT USAGE, SELECT ON SEQUENCE audit.evidence_log_id_seq TO evidence_app;
