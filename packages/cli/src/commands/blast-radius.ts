import { join, relative } from 'path';
import { existsSync } from 'fs';
import pc from 'picocolors';
import { openDatabase, SymbolRepository } from '@aicodepulse/core';

export function blastRadiusCommand(repoRoot: string, filePath: string, maxDepth: number): void {
  const dbPath = join(repoRoot, '.codepulse', 'index.db');
  if (!existsSync(dbPath)) {
    console.error(pc.red('No index found. Run `codepulse init` first.'));
    process.exit(1);
  }

  const db = openDatabase(dbPath);
  const repo = new SymbolRepository(db);

  // Normalize to repo-relative path
  const relPath = filePath.startsWith(repoRoot)
    ? relative(repoRoot, filePath)
    : filePath;

  const results = repo.getBlastRadius(relPath, maxDepth);
  db.close();

  if (results.length === 0) {
    console.log(pc.dim(`No files import ${relPath}`));
    return;
  }

  console.log(pc.bold(`Blast radius for ${pc.cyan(relPath)}`));
  console.log(pc.dim(`${results.length} file${results.length !== 1 ? 's' : ''} affected if this file changes\n`));

  for (let d = 1; d <= maxDepth; d++) {
    const atDepth = results.filter(r => r.depth === d);
    if (atDepth.length === 0) continue;
    const label = d === 1 ? 'Direct importers' : `Transitive (depth ${d})`;
    console.log(pc.cyan(`${label}:`));
    for (const r of atDepth) {
      console.log(`  ${r.path}`);
    }
    console.log();
  }
}
