PRAGMA defer_foreign_keys = true;

CREATE TABLE shares_next (
  id TEXT PRIMARY KEY NOT NULL,
  identity_id TEXT NOT NULL REFERENCES identities(id),
  project_id TEXT NOT NULL UNIQUE,
  handoff_id TEXT NOT NULL,
  expires_at TEXT NOT NULL,
  revoked_at TEXT,
  bundle_json TEXT,
  created_at TEXT NOT NULL,
  updated_at TEXT NOT NULL
);

INSERT INTO shares_next
  (id, identity_id, project_id, handoff_id, expires_at, revoked_at, bundle_json, created_at, updated_at)
SELECT
  id, identity_id, project_id, handoff_id, expires_at, revoked_at,
  CASE WHEN revoked_at IS NULL THEN bundle_json ELSE NULL END,
  created_at, created_at
FROM shares;

DROP TABLE shares;

ALTER TABLE shares_next RENAME TO shares;

CREATE INDEX shares_identity_id_idx ON shares(identity_id);

CREATE INDEX shares_expiry_idx ON shares(expires_at, revoked_at);

CREATE TABLE runtime_readiness (
  share_id TEXT PRIMARY KEY NOT NULL REFERENCES shares(id),
  runtime_json TEXT NOT NULL,
  reported_at TEXT NOT NULL
);
