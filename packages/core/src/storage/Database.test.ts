import { describe, it, expect, beforeEach, afterEach } from 'vitest';
import { mkdirSync, rmSync } from 'fs';
import { join } from 'path';
import { openDatabase } from './Database.js';
import { FileRepository } from './FileRepository.js';
import type { DB } from './Database.js';

const TMP = '/tmp/codepulse-db-test';
let db: DB;

beforeEach(() => {
  mkdirSync(TMP, { recursive: true });
  db = openDatabase(join(TMP, 'test.db'));
});

afterEach(() => {
  db.close();
  rmSync(TMP, { recursive: true, force: true });
});

describe('schema migration', () => {
  it('creates all required columns including summary, complexity_score, change_count', () => {
    const cols = (db.prepare('PRAGMA table_info(file_records)').all() as { name: string }[]).map(r => r.name);
    expect(cols).toContain('summary');
    expect(cols).toContain('complexity_score');
    expect(cols).toContain('change_count');
  });

  it('sets schema_version to 3', () => {
    const row = db.prepare("SELECT value FROM index_meta WHERE key = 'schema_version'").get() as { value: string };
    expect(Number(row.value)).toBe(3);
  });
});

describe('FileRepository', () => {
  it('upserts and retrieves a file with new fields', () => {
    const repo = new FileRepository(db);
    repo.upsert({
      path: 'src/auth.ts', language: 'typescript', contentHash: 'abc',
      sizeBytes: 100, linesTotal: 50, indexedAt: Date.now(), isDeleted: false,
      summary: 'lang:typescript exports:login(function)', complexityScore: 42, changeCount: 7,
    });

    const file = repo.getByPath('src/auth.ts');
    expect(file?.summary).toBe('lang:typescript exports:login(function)');
    expect(file?.complexityScore).toBe(42);
    expect(file?.changeCount).toBe(7);
  });

  it('getTotalComplexity sums across active files', () => {
    const repo = new FileRepository(db);
    repo.upsert({ path: 'a.ts', language: 'ts', contentHash: 'a', sizeBytes: 1, linesTotal: 1, indexedAt: 0, isDeleted: false, summary: null, complexityScore: 10, changeCount: 0 });
    repo.upsert({ path: 'b.ts', language: 'ts', contentHash: 'b', sizeBytes: 1, linesTotal: 1, indexedAt: 0, isDeleted: false, summary: null, complexityScore: 20, changeCount: 0 });
    repo.upsert({ path: 'c.ts', language: 'ts', contentHash: 'c', sizeBytes: 1, linesTotal: 1, indexedAt: 0, isDeleted: true, summary: null, complexityScore: 999, changeCount: 0 });

    expect(repo.getTotalComplexity()).toBe(30); // deleted file excluded
  });

  it('getSummaries returns changeCount', () => {
    const repo = new FileRepository(db);
    repo.upsert({ path: 'x.ts', language: 'ts', contentHash: 'x', sizeBytes: 1, linesTotal: 1, indexedAt: 0, isDeleted: false, summary: 'test summary', complexityScore: 5, changeCount: 3 });

    const summaries = repo.getSummaries();
    const entry = summaries.find(s => s.path === 'x.ts');
    expect(entry?.summary).toBe('test summary');
    expect(entry?.changeCount).toBe(3);
  });
});
