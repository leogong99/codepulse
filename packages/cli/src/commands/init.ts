import { mkdirSync, writeFileSync, existsSync } from 'fs';
import { join } from 'path';
import pc from 'picocolors';
import { openDatabase, Indexer, DEFAULT_CONFIG } from '@codepulse/core';

export async function initCommand(repoRoot: string): Promise<void> {
  const dotDir = join(repoRoot, '.codepulse');
  const dbPath = join(dotDir, 'index.db');
  const cfgPath = join(dotDir, 'config.json');

  mkdirSync(dotDir, { recursive: true });

  if (!existsSync(cfgPath)) {
    writeFileSync(cfgPath, JSON.stringify(DEFAULT_CONFIG, null, 2));
  }

  console.log(pc.cyan('Initializing CodePulse index...'));

  const db = openDatabase(dbPath);
  const indexer = new Indexer(db, repoRoot, DEFAULT_CONFIG);

  let lastPct = -1;
  const stats = await indexer.runFullWithParsing((done, total) => {
    const pct = Math.floor((done / total) * 100);
    if (pct !== lastPct && pct % 10 === 0) {
      process.stdout.write(`\r  Parsing files... ${pct}%`);
      lastPct = pct;
    }
  });

  process.stdout.write('\r');
  console.log(pc.green(`✓ Indexed ${stats.filesAdded} files, ${stats.symbolsTotal} symbols in ${stats.durationMs}ms`));
  console.log(pc.dim(`  Index stored at ${dbPath}`));
}
