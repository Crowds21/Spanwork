-- Spanwork schema migration 011: FLM sync field change log

CREATE TABLE IF NOT EXISTS sync_field_changes (
    change_seq     INTEGER PRIMARY KEY AUTOINCREMENT,
    table_name     TEXT NOT NULL,
    pk             TEXT NOT NULL,
    column_name    TEXT NOT NULL,
    value          TEXT,
    updated_at     INTEGER NOT NULL,
    device_id      TEXT NOT NULL,
    op             TEXT NOT NULL CHECK (op IN ('insert', 'update'))
);

CREATE INDEX IF NOT EXISTS idx_sfc_device_seq
    ON sync_field_changes(device_id, change_seq);

CREATE TABLE IF NOT EXISTS sync_internal (
    id                   INTEGER PRIMARY KEY CHECK (id = 1),
    suppress_field_log   INTEGER NOT NULL DEFAULT 0
);

INSERT OR IGNORE INTO sync_internal (id, suppress_field_log) VALUES (1, 0);
