import { join } from 'path';
import { existsSync } from 'fs';
import pc from 'picocolors';
import { openDatabase, Indexer, DEFAULT_CONFIG } from '@codepulse/core';

export async function updateCommand(repoRoot: string, full: boolean): Promise<void> {
  const dbPath = join(repoRoot, '.codepulse', 'index.db');
  if (!existsSync(dbPath)) {
    console.error(pc.red('No index found. Run `codepulse init` first.'));
    process.exit(1);
  }

  const db = openDatabase(dbPath);
  const indexer = new Indexer(db, repoRoot, DEFAULT_CONFIG);

  console.log(pc.cyan(full ? 'Running full re-index...' : 'Running incremental update...'));

  const stats = full
    ? await indexer.runFullWithParsing()
    : await indexer.runIncrementalWithParsing();

  if (stats.filesAdded === 0 && stats.filesUpdated === 0 && stats.filesDeleted === 0) {
    console.log(pc.dim('No changes detected.'));
  } else {
    const parts = [];
    if (stats.filesAdded > 0)   parts.push(`${stats.filesAdded} added`);
    if (stats.filesUpdated > 0) parts.push(`${stats.filesUpdated} updated`);
    if (stats.filesDeleted > 0) parts.push(`${stats.filesDeleted} deleted`);
    console.log(pc.green(`✓ ${parts.join(', ')} — ${stats.symbolsTotal} symbols total (${stats.durationMs}ms)`));
  }
}
