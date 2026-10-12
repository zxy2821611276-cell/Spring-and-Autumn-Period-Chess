-- Ported from the original Cloudflare D1 rooms schema to PostgreSQL.
-- The serialized Room / Game JSON structure stays unchanged.
CREATE TABLE IF NOT EXISTS rooms (
    id TEXT PRIMARY KEY NOT NULL,
    data TEXT NOT NULL,
    revision INTEGER NOT NULL DEFAULT 0,
    created_at BIGINT NOT NULL
);
