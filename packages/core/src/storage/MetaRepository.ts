import type { DB } from './Database.js';
import type { IndexMeta } from '../types.js';

export class MetaRepository {
  constructor(private db: DB) {}

  get(key: string): string | null {
    const row = this.db.prepare('SELECT value FROM index_meta WHERE key = ?').get(key) as { value: string } | undefined;
    return row?.value ?? null;
  }

  set(key: string, value: string): void {
    this.db.prepare('INSERT OR REPLACE INTO index_meta (key, value) VALUES (?, ?)').run(key, value);
  }

  getIndexMeta(): IndexMeta {
    const fileCount = (this.db.prepare("SELECT COUNT(*) as c FROM file_records WHERE is_deleted = 0").get() as { c: number }).c;
    const symbolCount = (this.db.prepare("SELECT COUNT(*) as c FROM symbols").get() as { c: number }).c;
    return {
      schemaVersion: Number(this.get('schema_version') ?? 1),
      lastIndexedCommit: this.get('last_indexed_commit') ?? '',
      lastIndexedAt: Number(this.get('last_indexed_at') ?? 0),
      repoRoot: this.get('repo_root') ?? '',
      totalFiles: fileCount,
      totalSymbols: symbolCount,
    };
  }

  saveIndexMeta(commit: string, repoRoot: string): void {
    this.set('last_indexed_commit', commit);
    this.set('last_indexed_at', String(Date.now()));
    this.set('repo_root', repoRoot);
  }
}
