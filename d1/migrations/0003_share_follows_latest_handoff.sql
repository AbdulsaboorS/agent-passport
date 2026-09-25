CREATE TABLE share_bundles (
  share_id TEXT PRIMARY KEY NOT NULL REFERENCES shares(id),
  bundle_json TEXT NOT NULL
);

INSERT INTO share_bundles (share_id, bundle_json)
SELECT id, bundle_json FROM shares WHERE revoked_at IS NULL;

ALTER TABLE shares DROP COLUMN bundle_json;

ALTER TABLE shares ADD COLUMN updated_at TEXT NOT NULL DEFAULT '';

UPDATE shares SET updated_at = created_at;

CREATE TABLE runtime_readiness (
  share_id TEXT PRIMARY KEY NOT NULL REFERENCES shares(id),
  runtime_json TEXT NOT NULL,
  reported_at TEXT NOT NULL
);
