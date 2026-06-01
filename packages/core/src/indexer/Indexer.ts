import Parser from 'tree-sitter';
import { readFileSync, statSync } from 'fs';
import { join } from 'path';
import type { DB } from '../storage/Database.js';
import { FileRepository } from '../storage/FileRepository.js';
import { SymbolRepository } from '../storage/SymbolRepository.js';
import { MetaRepository } from '../storage/MetaRepository.js';
import { getLanguageForExtension, extensionFromPath } from '../parser/ParserRegistry.js';
import { extractSymbols } from '../parser/SymbolExtractor.js';
import { extractImports } from '../parser/ImportExtractor.js';
import { hashContent } from './HashUtil.js';
import { walkFiles } from './FileWalker.js';
import { getHeadCommit, getChangedFiles, getFileChangeCounts } from './GitDiff.js';
import type { CodePulseConfig } from '../types.js';

function buildFileSummary(
  language: string,
  symbols: Omit<import('../types.js').CodeSymbol, 'id'>[],
  imports: Omit<import('../types.js').ImportEdge, 'id'>[],
): string {
  const exported = symbols.filter(s => s.isExported);
  const packages = [...new Set(imports.filter(i => i.toPackage).map(i => i.toPackage!))];
  const parts: string[] = [`lang:${language}`];
  if (exported.length > 0) {
    const names = exported.slice(0, 6).map(s => `${s.name}(${s.kind})`).join(' ');
    parts.push(`exports:${names}${exported.length > 6 ? ` +${exported.length - 6}` : ''}`);
  }
  if (packages.length > 0) {
    parts.push(`uses:${packages.slice(0, 6).join(' ')}`);
  }
  return parts.join(' ');
}

function computeComplexity(
  linesTotal: number,
  symbols: Omit<import('../types.js').CodeSymbol, 'id'>[],
  imports: Omit<import('../types.js').ImportEdge, 'id'>[],
): number {
  const exported = symbols.filter(s => s.isExported).length;
  return exported * 2 + imports.length + Math.floor(linesTotal / 50);
}

export interface IndexStats {
  filesAdded: number;
  filesUpdated: number;
  filesDeleted: number;
  filesSkipped: number;
  symbolsTotal: number;
  durationMs: number;
  mode: 'full' | 'incremental';
}

export class Indexer {
  private parser = new Parser();
  private files: FileRepository;
  private symbols: SymbolRepository;
  private meta: MetaRepository;
  private changeCounts: Map<string, number> = new Map();

  constructor(private db: DB, private repoRoot: string, private config: CodePulseConfig) {
    this.files = new FileRepository(db);
    this.symbols = new SymbolRepository(db);
    this.meta = new MetaRepository(db);
  }

  async runFull(): Promise<IndexStats> {
    const start = Date.now();
    const allFiles = await walkFiles(this.repoRoot, this.config);
    let added = 0, updated = 0, skipped = 0;

    const transaction = this.db.transaction(() => {
      for (const { absolutePath, relativePath } of allFiles) {
        const result = this.indexFile(absolutePath, relativePath);
        if (result === 'added') added++;
        else if (result === 'updated') updated++;
        else skipped++;
      }
    });
    transaction();

    const commit = getHeadCommit(this.repoRoot);
    this.meta.saveIndexMeta(commit, this.repoRoot);

    const metaInfo = this.meta.getIndexMeta();
    return {
      filesAdded: added,
      filesUpdated: updated,
      filesDeleted: 0,
      filesSkipped: skipped,
      symbolsTotal: metaInfo.totalSymbols,
      durationMs: Date.now() - start,
      mode: 'full',
    };
  }

  async runIncremental(): Promise<IndexStats> {
    const start = Date.now();
    const lastCommit = this.meta.get('last_indexed_commit') ?? '';
    const currentCommit = getHeadCommit(this.repoRoot);

    // Fall back to full scan if no prior index or git unavailable
    if (!lastCommit || lastCommit === currentCommit) {
      if (!lastCommit) return this.runFull();
      return { filesAdded: 0, filesUpdated: 0, filesDeleted: 0, filesSkipped: 0, symbolsTotal: this.meta.getIndexMeta().totalSymbols, durationMs: 0, mode: 'incremental' };
    }

    const changes = getChangedFiles(this.repoRoot, lastCommit);
    if (!changes) return this.runFull();

    let added = 0, updated = 0, deleted = 0, skipped = 0;

    const transaction = this.db.transaction(() => {
      for (const change of changes) {
        const absPath = join(this.repoRoot, change.path);
        if (change.status === 'D') {
          const existing = this.files.getByPath(change.path);
          if (existing) {
            this.symbols.deleteByFileId(existing.id);
            this.files.markDeleted(change.path);
            deleted++;
          }
        } else {
          const result = this.indexFile(absPath, change.path);
          if (result === 'added') added++;
          else if (result === 'updated') updated++;
          else skipped++;
        }
      }
    });
    transaction();

    this.meta.saveIndexMeta(currentCommit, this.repoRoot);

    const metaInfo = this.meta.getIndexMeta();
    return {
      filesAdded: added,
      filesUpdated: updated,
      filesDeleted: deleted,
      filesSkipped: skipped,
      symbolsTotal: metaInfo.totalSymbols,
      durationMs: Date.now() - start,
      mode: 'incremental',
    };
  }

  private indexFile(absolutePath: string, relativePath: string): 'added' | 'updated' | 'skipped' {
    let stat;
    try {
      stat = statSync(absolutePath);
    } catch {
      return 'skipped';
    }

    if (stat.size > this.config.maxFileSizeBytes) return 'skipped';

    const ext = extensionFromPath(relativePath);
    // We'll still record file even if no parser — skip symbol extraction only
    let content: string;
    try {
      content = readFileSync(absolutePath, 'utf8');
    } catch {
      return 'skipped';
    }

    const contentHash = hashContent(content);
    const existing = this.files.getByPath(relativePath);

    if (existing && existing.contentHash === contentHash && !existing.isDeleted) {
      return 'skipped';
    }

    const isNew = !existing;
    const lines = content.split('\n').length;

    const langConfig = null; // resolved below async — we need sync parsing
    // Note: language config loading done synchronously via cached registry
    const fileId = this.files.upsert({
      path: relativePath,
      language: 'unknown',
      contentHash,
      sizeBytes: stat.size,
      linesTotal: lines,
      indexedAt: Date.now(),
      isDeleted: false,
      summary: existing?.summary ?? null,
      complexityScore: existing?.complexityScore ?? 0,
      changeCount: this.changeCounts.get(relativePath) ?? existing?.changeCount ?? 0,
    });

    // We use the actual file id (insert returns rowid, but on conflict we need the real id)
    const record = this.files.getByPath(relativePath);
    if (!record) return 'skipped';

    this.symbols.deleteByFileId(record.id);

    // Return early — async language loading handled in parseAndStore
    return isNew ? 'added' : 'updated';
  }

  async parseAndIndex(absolutePath: string, relativePath: string): Promise<void> {
    const langConfig = getLanguageForExtension(extensionFromPath(relativePath));
    if (!langConfig) return;

    let content: string;
    try {
      content = readFileSync(absolutePath, 'utf8');
    } catch {
      return;
    }

    this.parser.setLanguage(langConfig.language);
    const tree = this.parser.parse(content);

    const record = this.files.getByPath(relativePath);
    if (!record) return;

    const symbols = extractSymbols(tree, relativePath, record.id, langConfig.name, content);
    const rawImports = extractImports(tree, relativePath, record.id, langConfig.name);

    // Normalize toPath: strip absolute repoRoot prefix so all paths are repo-relative
    const prefix = this.repoRoot + '/';
    const imports = rawImports.map(imp => ({
      ...imp,
      toPath: imp.toPath?.startsWith(prefix) ? imp.toPath.slice(prefix.length) : imp.toPath,
    }));

    const summary = buildFileSummary(langConfig.name, symbols, imports);
    const complexityScore = computeComplexity(record.linesTotal, symbols, imports);
    const changeCount = this.changeCounts.get(relativePath) ?? record.changeCount;

    this.files.upsert({ ...record, language: langConfig.name, summary, complexityScore, changeCount });

    this.symbols.deleteByFileId(record.id);
    if (symbols.length > 0) this.symbols.insertSymbols(record.id, symbols);
    if (imports.length > 0) this.symbols.insertImports(record.id, imports);
  }

  async runFullWithParsing(onProgress?: (done: number, total: number) => void): Promise<IndexStats> {
    const start = Date.now();
    this.changeCounts = getFileChangeCounts(this.repoRoot);
    const allFiles = await walkFiles(this.repoRoot, this.config);

    // First pass: record all files synchronously
    const transaction = this.db.transaction(() => {
      for (const { absolutePath, relativePath } of allFiles) {
        this.indexFile(absolutePath, relativePath);
      }
    });
    transaction();

    // Second pass: parse all files async (Tree-Sitter is sync but language loading is async)
    const parseable = allFiles.filter(f => {
      const ext = extensionFromPath(f.relativePath);
      return ext !== '';
    });

    let done = 0;
    for (const { absolutePath, relativePath } of parseable) {
      await this.parseAndIndex(absolutePath, relativePath);
      done++;
      onProgress?.(done, parseable.length);
    }

    const commit = getHeadCommit(this.repoRoot);
    this.meta.saveIndexMeta(commit, this.repoRoot);

    const metaInfo = this.meta.getIndexMeta();
    return {
      filesAdded: parseable.length,
      filesUpdated: 0,
      filesDeleted: 0,
      filesSkipped: allFiles.length - parseable.length,
      symbolsTotal: metaInfo.totalSymbols,
      durationMs: Date.now() - start,
      mode: 'full',
    };
  }

  async runIncrementalWithParsing(onProgress?: (done: number, total: number) => void): Promise<IndexStats> {
    const start = Date.now();
    const lastCommit = this.meta.get('last_indexed_commit') ?? '';
    const currentCommit = getHeadCommit(this.repoRoot);

    if (!lastCommit) return this.runFullWithParsing(onProgress);
    if (lastCommit === currentCommit) {
      const metaInfo = this.meta.getIndexMeta();
      return { filesAdded: 0, filesUpdated: 0, filesDeleted: 0, filesSkipped: 0, symbolsTotal: metaInfo.totalSymbols, durationMs: 0, mode: 'incremental' };
    }

    const changes = getChangedFiles(this.repoRoot, lastCommit);
    if (!changes) return this.runFullWithParsing(onProgress);

    let added = 0, updated = 0, deleted = 0;
    const toReparse: { abs: string; rel: string }[] = [];

    for (const change of changes) {
      const absPath = join(this.repoRoot, change.path);
      if (change.status === 'D') {
        const existing = this.files.getByPath(change.path);
        if (existing) {
          this.symbols.deleteByFileId(existing.id);
          this.files.markDeleted(change.path);
          deleted++;
        }
      } else {
        // Increment change_count for modified/added files
        const existing = this.files.getByPath(change.path);
        if (existing) {
          this.changeCounts.set(change.path, existing.changeCount + 1);
        }
        const result = this.indexFile(absPath, change.path);
        if (result !== 'skipped') {
          toReparse.push({ abs: absPath, rel: change.path });
          if (result === 'added') added++; else updated++;
        }
      }
    }

    let done = 0;
    for (const { abs, rel } of toReparse) {
      await this.parseAndIndex(abs, rel);
      done++;
      onProgress?.(done, toReparse.length);
    }

    this.meta.saveIndexMeta(currentCommit, this.repoRoot);

    const metaInfo = this.meta.getIndexMeta();
    return {
      filesAdded: added,
      filesUpdated: updated,
      filesDeleted: deleted,
      filesSkipped: 0,
      symbolsTotal: metaInfo.totalSymbols,
      durationMs: Date.now() - start,
      mode: 'incremental',
    };
  }
}
