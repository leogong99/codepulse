import { join } from 'path';
import { existsSync } from 'fs';
import pc from 'picocolors';
import { openDatabase, Indexer, DEFAULT_CONFIG } from '@aicodepulse/core';

export async function watchCommand(repoRoot: string): Promise<void> {
  const dbPath = join(repoRoot, '.codepulse', 'index.db');
  if (!existsSync(dbPath)) {
    console.error(pc.red('No index found. Run `codepulse init` first.'));
    process.exit(1);
  }

  const { default: chokidar } = await import('chokidar');
  const db = openDatabase(dbPath);
  const indexer = new Indexer(db, repoRoot, DEFAULT_CONFIG);

  console.log(pc.cyan('Watching for changes... (Ctrl+C to stop)'));

  let debounce: ReturnType<typeof setTimeout> | null = null;

  const trigger = () => {
    if (debounce) clearTimeout(debounce);
    debounce = setTimeout(async () => {
      const stats = await indexer.runIncrementalWithParsing();
      if (stats.filesAdded + stats.filesUpdated + stats.filesDeleted > 0) {
        console.log(pc.green(`✓ Updated: +${stats.filesAdded} ~${stats.filesUpdated} -${stats.filesDeleted} (${stats.durationMs}ms)`));
      }
    }, 500);
  };

  chokidar
    .watch(repoRoot, {
      ignored: /(node_modules|\.git|dist|\.codepulse)/,
      ignoreInitial: true,
    })
    .on('add', trigger)
    .on('change', trigger)
    .on('unlink', trigger);

  // Keep process alive
  await new Promise(() => {});
}
