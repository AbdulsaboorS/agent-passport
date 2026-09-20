CREATE TABLE identities (
  id TEXT PRIMARY KEY NOT NULL,
  public_jwk TEXT NOT NULL,
  created_at TEXT NOT NULL
);

CREATE TABLE shares (
  id TEXT PRIMARY KEY NOT NULL,
  identity_id TEXT NOT NULL REFERENCES identities(id),
  project_id TEXT NOT NULL UNIQUE,
  handoff_id TEXT NOT NULL,
  expires_at TEXT NOT NULL,
  revoked_at TEXT,
  bundle_json TEXT NOT NULL,
  created_at TEXT NOT NULL
);

CREATE TABLE connection_grants (
  token_id TEXT PRIMARY KEY NOT NULL,
  connection_id TEXT NOT NULL UNIQUE,
  identity_id TEXT NOT NULL REFERENCES identities(id),
  share_id TEXT NOT NULL REFERENCES shares(id),
  project_id TEXT NOT NULL,
  scopes_json TEXT NOT NULL,
  issued_at TEXT NOT NULL,
  expires_at TEXT NOT NULL,
  revoked_at TEXT
);

CREATE INDEX shares_identity_id_idx ON shares(identity_id);
CREATE INDEX shares_expiry_idx ON shares(expires_at, revoked_at);
CREATE INDEX connection_grants_share_id_idx ON connection_grants(share_id);
CREATE INDEX connection_grants_expiry_idx ON connection_grants(expires_at, revoked_at);
