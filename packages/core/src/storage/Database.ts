import BetterSqlite3 from 'better-sqlite3';
import { readFileSync } from 'fs';
import { fileURLToPath } from 'url';
import { dirname, join } from 'path';

const __dirname = dirname(fileURLToPath(import.meta.url));
const SCHEMA_VERSION = 1;

export type DB = BetterSqlite3.Database;

export function openDatabase(dbPath: string): DB {
  const db = new BetterSqlite3(dbPath);
  db.pragma('journal_mode = WAL');
  db.pragma('foreign_keys = ON');
  runMigrations(db);
  return db;
}

function runMigrations(db: DB): void {
  const schemaSQL = readFileSync(join(__dirname, 'schema.sql'), 'utf8');
  db.exec(schemaSQL);

  const existing = db.prepare("SELECT value FROM index_meta WHERE key = 'schema_version'").get() as { value: string } | undefined;
  if (!existing) {
    db.prepare("INSERT INTO index_meta (key, value) VALUES ('schema_version', ?)").run(String(SCHEMA_VERSION));
  }
}
