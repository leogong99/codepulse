import type { DB } from './Database.js';
import type { FileRecord } from '../types.js';

function rowToFile(row: Record<string, unknown>): FileRecord {
  return {
    id: row.id as number,
    path: row.path as string,
    language: row.language as string,
    contentHash: row.content_hash as string,
    sizeBytes: row.size_bytes as number,
    linesTotal: row.lines_total as number,
    indexedAt: row.indexed_at as number,
    isDeleted: Boolean(row.is_deleted),
    summary: (row.summary as string | null) ?? null,
    complexityScore: (row.complexity_score as number) ?? 0,
  };
}

export class FileRepository {
  constructor(private db: DB) {}

  upsert(file: Omit<FileRecord, 'id'>): number {
    const result = this.db.prepare(`
      INSERT INTO file_records (path, language, content_hash, size_bytes, lines_total, indexed_at, is_deleted, summary, complexity_score)
      VALUES (@path, @language, @contentHash, @sizeBytes, @linesTotal, @indexedAt, @isDeleted, @summary, @complexityScore)
      ON CONFLICT(path) DO UPDATE SET
        language         = excluded.language,
        content_hash     = excluded.content_hash,
        size_bytes       = excluded.size_bytes,
        lines_total      = excluded.lines_total,
        indexed_at       = excluded.indexed_at,
        is_deleted       = excluded.is_deleted,
        summary          = excluded.summary,
        complexity_score = excluded.complexity_score
    `).run({
      path: file.path,
      language: file.language,
      contentHash: file.contentHash,
      sizeBytes: file.sizeBytes,
      linesTotal: file.linesTotal,
      indexedAt: file.indexedAt,
      isDeleted: file.isDeleted ? 1 : 0,
      summary: file.summary,
      complexityScore: file.complexityScore,
    });
    return result.lastInsertRowid as number;
  }

  getByPath(path: string): FileRecord | null {
    const row = this.db.prepare('SELECT * FROM file_records WHERE path = ?').get(path) as Record<string, unknown> | undefined;
    return row ? rowToFile(row) : null;
  }

  markDeleted(path: string): void {
    this.db.prepare('UPDATE file_records SET is_deleted = 1 WHERE path = ?').run(path);
  }

  getAllActive(): FileRecord[] {
    const rows = this.db.prepare('SELECT * FROM file_records WHERE is_deleted = 0 ORDER BY path').all() as Record<string, unknown>[];
    return rows.map(rowToFile);
  }

  getLanguageStats(): { language: string; count: number }[] {
    return this.db.prepare(`
      SELECT language, COUNT(*) as count
      FROM file_records WHERE is_deleted = 0
      GROUP BY language ORDER BY count DESC
    `).all() as { language: string; count: number }[];
  }

  getTotalComplexity(): number {
    const row = this.db.prepare(
      'SELECT COALESCE(SUM(complexity_score), 0) as total FROM file_records WHERE is_deleted = 0'
    ).get() as { total: number };
    return row.total;
  }

  getSummaries(): { path: string; summary: string | null; complexityScore: number }[] {
    return this.db.prepare(
      'SELECT path, summary, complexity_score as complexityScore FROM file_records WHERE is_deleted = 0'
    ).all() as { path: string; summary: string | null; complexityScore: number }[];
  }
}
