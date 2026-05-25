import { join } from 'path';
import { existsSync } from 'fs';
import pc from 'picocolors';
import { openDatabase, MetaRepository, FileRepository } from '@aicodepulse/core';

export function statsCommand(repoRoot: string): void {
  const dbPath = join(repoRoot, '.codepulse', 'index.db');
  if (!existsSync(dbPath)) {
    console.error(pc.red('No index found. Run `codepulse init` first.'));
    process.exit(1);
  }

  const db = openDatabase(dbPath);
  const meta = new MetaRepository(db).getIndexMeta();
  const langStats = new FileRepository(db).getLanguageStats();

  console.log(pc.bold('\nCodePulse Index Stats'));
  console.log(pc.dim('─'.repeat(40)));
  console.log(`  Files:        ${meta.totalFiles}`);
  console.log(`  Symbols:      ${meta.totalSymbols}`);
  console.log(`  Last indexed: ${meta.lastIndexedAt ? new Date(meta.lastIndexedAt).toLocaleString() : 'never'}`);
  console.log(`  Commit:       ${meta.lastIndexedCommit.slice(0, 8) || 'none'}`);
  console.log(pc.dim('─'.repeat(40)));
  console.log(pc.bold('  Languages:'));
  for (const { language, count } of langStats) {
    console.log(`    ${language.padEnd(12)} ${count} files`);
  }
  console.log('');
}
