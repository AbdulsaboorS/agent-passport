ALTER TABLE connection_grants ADD COLUMN replaces_token_id TEXT REFERENCES connection_grants(token_id);
CREATE UNIQUE INDEX connection_grants_replaces_token_id_idx ON connection_grants(replaces_token_id);
