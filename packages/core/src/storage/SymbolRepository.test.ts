import { describe, it, expect, beforeEach, afterEach } from 'vitest';
import { mkdirSync, rmSync } from 'fs';
import { join } from 'path';
import { openDatabase } from './Database.js';
import { FileRepository } from './FileRepository.js';
import { SymbolRepository } from './SymbolRepository.js';
import type { DB } from './Database.js';

const TMP = '/tmp/codepulse-sym-test';
let db: DB;
let fileRepo: FileRepository;
let symRepo: SymbolRepository;

function makeFile(path: string) {
  fileRepo.upsert({
    path, language: 'ts', contentHash: path, sizeBytes: 1, linesTotal: 1,
    indexedAt: 0, isDeleted: false, summary: null, complexityScore: 1, changeCount: 0,
  });
  return fileRepo.getByPath(path)!;
}

beforeEach(() => {
  mkdirSync(TMP, { recursive: true });
  db = openDatabase(join(TMP, 'test.db'));
  fileRepo = new FileRepository(db);
  symRepo = new SymbolRepository(db);
});

afterEach(() => {
  db.close();
  rmSync(TMP, { recursive: true, force: true });
});

describe('getBlastRadius', () => {
  it('returns empty when file has no importers', () => {
    makeFile('src/util.ts');
    expect(symRepo.getBlastRadius('src/util.ts')).toEqual([]);
  });

  it('returns direct importers at depth 1', () => {
    const util = makeFile('src/util.ts');
    const app = makeFile('src/app.ts');
    symRepo.insertImports(app.id, [{
      fromFileId: app.id, fromPath: 'src/app.ts',
      toPath: 'src/util.ts', toPackage: null,
      importedNames: ['helper'], isTypeOnly: false,
    }]);

    const radius = symRepo.getBlastRadius('src/util.ts');
    expect(radius).toHaveLength(1);
    expect(radius[0]).toEqual({ path: 'src/app.ts', depth: 1 });
  });

  it('returns transitive importers at depth 2', () => {
    const util = makeFile('src/util.ts');
    const app = makeFile('src/app.ts');
    const index = makeFile('src/index.ts');

    // index → app → util
    symRepo.insertImports(app.id, [{
      fromFileId: app.id, fromPath: 'src/app.ts',
      toPath: 'src/util.ts', toPackage: null,
      importedNames: [], isTypeOnly: false,
    }]);
    symRepo.insertImports(index.id, [{
      fromFileId: index.id, fromPath: 'src/index.ts',
      toPath: 'src/app.ts', toPackage: null,
      importedNames: [], isTypeOnly: false,
    }]);

    const radius = symRepo.getBlastRadius('src/util.ts', 2);
    expect(radius).toHaveLength(2);
    expect(radius.find(r => r.path === 'src/app.ts')?.depth).toBe(1);
    expect(radius.find(r => r.path === 'src/index.ts')?.depth).toBe(2);
  });

  it('does not double-count files that import at multiple depths', () => {
    const util = makeFile('src/util.ts');
    const app = makeFile('src/app.ts');
    const index = makeFile('src/index.ts');

    // Both app and index import util, and index also imports app
    symRepo.insertImports(app.id, [{
      fromFileId: app.id, fromPath: 'src/app.ts',
      toPath: 'src/util.ts', toPackage: null,
      importedNames: [], isTypeOnly: false,
    }]);
    symRepo.insertImports(index.id, [
      {
        fromFileId: index.id, fromPath: 'src/index.ts',
        toPath: 'src/util.ts', toPackage: null,
        importedNames: [], isTypeOnly: false,
      },
      {
        fromFileId: index.id, fromPath: 'src/index.ts',
        toPath: 'src/app.ts', toPackage: null,
        importedNames: [], isTypeOnly: false,
      },
    ]);

    const radius = symRepo.getBlastRadius('src/util.ts', 2);
    const paths = radius.map(r => r.path);
    // No duplicates
    expect(new Set(paths).size).toBe(paths.length);
    expect(paths).toContain('src/app.ts');
    expect(paths).toContain('src/index.ts');
  });

  it('respects maxDepth=1', () => {
    const util = makeFile('src/util.ts');
    const app = makeFile('src/app.ts');
    const index = makeFile('src/index.ts');

    symRepo.insertImports(app.id, [{
      fromFileId: app.id, fromPath: 'src/app.ts',
      toPath: 'src/util.ts', toPackage: null,
      importedNames: [], isTypeOnly: false,
    }]);
    symRepo.insertImports(index.id, [{
      fromFileId: index.id, fromPath: 'src/index.ts',
      toPath: 'src/app.ts', toPackage: null,
      importedNames: [], isTypeOnly: false,
    }]);

    const radius = symRepo.getBlastRadius('src/util.ts', 1);
    expect(radius).toHaveLength(1);
    expect(radius[0].path).toBe('src/app.ts');
  });
});
