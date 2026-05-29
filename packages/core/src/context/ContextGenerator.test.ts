import { describe, it, expect, beforeEach, afterEach } from 'vitest';
import { mkdirSync, rmSync } from 'fs';
import { join } from 'path';
import { openDatabase } from '../storage/Database.js';
import { FileRepository } from '../storage/FileRepository.js';
import { SymbolRepository } from '../storage/SymbolRepository.js';
import { MetaRepository } from '../storage/MetaRepository.js';
import { generateContext } from './ContextGenerator.js';
import { DEFAULT_CONFIG } from '../types.js';
import type { DB } from '../storage/Database.js';

const TMP = '/tmp/codepulse-test';
let db: DB;

function seedFile(files: FileRepository, symbols: SymbolRepository, path: string, complexity: number, changeCount = 0) {
  const id = files.upsert({
    path,
    language: 'typescript',
    contentHash: 'abc',
    sizeBytes: 100,
    linesTotal: 50,
    indexedAt: Date.now(),
    isDeleted: false,
    summary: `lang:typescript exports:${path.replace(/\W/g, '')}(function)`,
    complexityScore: complexity,
    changeCount,
  });
  symbols.insertSymbols(id, [{
    fileId: id, filePath: path, name: path.replace(/\W/g, ''), kind: 'function',
    line: 1, endLine: 10, isExported: true, signature: '()', docComment: null, parentName: null,
  }]);
  return id;
}

beforeEach(() => {
  mkdirSync(TMP, { recursive: true });
  db = openDatabase(join(TMP, 'test.db'));
  new MetaRepository(db).set('repo_root', TMP);
  new MetaRepository(db).set('last_indexed_commit', 'abc123');
});

afterEach(() => {
  db.close();
  rmSync(TMP, { recursive: true, force: true });
});

describe('generateContext — auto budget', () => {
  it('skips tiny repos (complexity < 50)', () => {
    const files = new FileRepository(db);
    seedFile(files, new SymbolRepository(db), 'src/tiny.ts', 5);

    const result = generateContext(db, { budgetTokens: 4000, format: 'xml', autoBudget: true }, DEFAULT_CONFIG);
    expect(result.skipped).toBe(true);
    expect(result.totalTokens).toBe(0);
  });

  it('uses small budget (800) for low-complexity repos', () => {
    const files = new FileRepository(db);
    const syms = new SymbolRepository(db);
    for (let i = 0; i < 10; i++) seedFile(files, syms, `src/file${i}.ts`, 20);

    const result = generateContext(db, { budgetTokens: 4000, format: 'xml', autoBudget: true }, DEFAULT_CONFIG);
    expect(result.skipped).toBeUndefined();
    expect(result.budgetTokens).toBe(800);
    expect(result.totalTokens).toBeLessThanOrEqual(800);
  });

  it('explicit --budget overrides auto when autoBudget is false', () => {
    const files = new FileRepository(db);
    const syms = new SymbolRepository(db);
    for (let i = 0; i < 10; i++) seedFile(files, syms, `src/file${i}.ts`, 20);

    const result = generateContext(db, { budgetTokens: 500, format: 'xml', autoBudget: false }, DEFAULT_CONFIG);
    expect(result.budgetTokens).toBe(500);
    expect(result.totalTokens).toBeLessThanOrEqual(500);
  });

  it('never exceeds the resolved budget', () => {
    const files = new FileRepository(db);
    const syms = new SymbolRepository(db);
    for (let i = 0; i < 30; i++) seedFile(files, syms, `src/module${i}/index.ts`, 30);

    const result = generateContext(db, { budgetTokens: 4000, format: 'xml', autoBudget: true }, DEFAULT_CONFIG);
    expect(result.totalTokens).toBeLessThanOrEqual(result.budgetTokens);
  });
});

describe('generateContext — task-aware ranking', () => {
  it('ranks files matching task keywords higher', () => {
    const files = new FileRepository(db);
    const syms = new SymbolRepository(db);
    seedFile(files, syms, 'src/auth/login.ts', 100);
    seedFile(files, syms, 'src/utils/format.ts', 100);

    const result = generateContext(db, {
      budgetTokens: 4000, format: 'xml',
      taskKeywords: ['auth', 'login'],
    }, DEFAULT_CONFIG);

    const symTable = result.layers.find(l => l.layer === 'symbol_table')?.content ?? '';
    const authPos = symTable.indexOf('src/auth/login.ts');
    const utilPos = symTable.indexOf('src/utils/format.ts');
    expect(authPos).toBeGreaterThan(-1);
    expect(authPos).toBeLessThan(utilPos);
  });
});

describe('generateContext — truncation warning', () => {
  it('emits truncationWarning when auto-budget truncates symbol table', () => {
    const files = new FileRepository(db);
    const syms = new SymbolRepository(db);
    // seed enough complexity to hit small budget but enough files to truncate
    for (let i = 0; i < 20; i++) seedFile(files, syms, `src/module${i}.ts`, 30);

    const result = generateContext(db, { budgetTokens: 4000, format: 'xml', autoBudget: true }, DEFAULT_CONFIG);
    if (result.layers.find(l => l.layer === 'symbol_table')?.truncated) {
      expect(result.truncationWarning).toBeDefined();
      expect(result.truncationWarning).toContain('--budget');
    }
  });
});

describe('generateContext — rendered output', () => {
  it('produces valid XML wrapper', () => {
    const files = new FileRepository(db);
    seedFile(files, new SymbolRepository(db), 'src/index.ts', 100);

    const result = generateContext(db, { budgetTokens: 4000, format: 'xml' }, DEFAULT_CONFIG);
    expect(result.rendered).toContain('<codebase_context>');
    expect(result.rendered).toContain('</codebase_context>');
  });

  it('produces markdown without XML tags', () => {
    const files = new FileRepository(db);
    seedFile(files, new SymbolRepository(db), 'src/index.ts', 100);

    const result = generateContext(db, { budgetTokens: 4000, format: 'markdown' }, DEFAULT_CONFIG);
    expect(result.rendered).not.toContain('<codebase_context>');
  });
});
