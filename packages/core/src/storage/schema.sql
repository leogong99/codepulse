CREATE TABLE IF NOT EXISTS index_meta (
  key   TEXT PRIMARY KEY,
  value TEXT NOT NULL
);

CREATE TABLE IF NOT EXISTS file_records (
  id           INTEGER PRIMARY KEY AUTOINCREMENT,
  path         TEXT NOT NULL UNIQUE,
  language     TEXT NOT NULL,
  content_hash TEXT NOT NULL,
  size_bytes   INTEGER NOT NULL,
  lines_total  INTEGER NOT NULL,
  indexed_at   INTEGER NOT NULL,
  is_deleted   INTEGER NOT NULL DEFAULT 0
);
CREATE INDEX IF NOT EXISTS idx_file_language ON file_records(language);
CREATE INDEX IF NOT EXISTS idx_file_deleted  ON file_records(is_deleted);

CREATE TABLE IF NOT EXISTS symbols (
  id           INTEGER PRIMARY KEY AUTOINCREMENT,
  file_id      INTEGER NOT NULL REFERENCES file_records(id) ON DELETE CASCADE,
  file_path    TEXT NOT NULL,
  name         TEXT NOT NULL,
  kind         TEXT NOT NULL,
  line         INTEGER NOT NULL,
  end_line     INTEGER NOT NULL,
  is_exported  INTEGER NOT NULL DEFAULT 0,
  signature    TEXT,
  doc_comment  TEXT,
  parent_name  TEXT
);
CREATE INDEX IF NOT EXISTS idx_symbol_file     ON symbols(file_id);
CREATE INDEX IF NOT EXISTS idx_symbol_name     ON symbols(name);
CREATE INDEX IF NOT EXISTS idx_symbol_exported ON symbols(is_exported);

CREATE TABLE IF NOT EXISTS import_edges (
  id              INTEGER PRIMARY KEY AUTOINCREMENT,
  from_file_id    INTEGER NOT NULL REFERENCES file_records(id) ON DELETE CASCADE,
  from_path       TEXT NOT NULL,
  to_path         TEXT,
  to_package      TEXT,
  imported_names  TEXT NOT NULL,
  is_type_only    INTEGER NOT NULL DEFAULT 0
);
CREATE INDEX IF NOT EXISTS idx_import_from ON import_edges(from_file_id);
CREATE INDEX IF NOT EXISTS idx_import_to   ON import_edges(to_path);
