import { join } from 'path';
import { existsSync } from 'fs';
import pc from 'picocolors';
import { openDatabase, SymbolRepository } from '@aicodepulse/core';

export function searchCommand(repoRoot: string, query: string, limit: number): void {
  const dbPath = join(repoRoot, '.codepulse', 'index.db');
  if (!existsSync(dbPath)) {
    console.error(pc.red('No index found. Run `codepulse init` first.'));
    process.exit(1);
  }

  const db = openDatabase(dbPath);
  const repo = new SymbolRepository(db);
  const results = repo.search(query, limit);

  if (results.length === 0) {
    console.log(pc.dim(`No symbols matching "${query}"`));
    return;
  }

  console.log(pc.dim(`Found ${results.length} symbol${results.length === 1 ? '' : 's'} matching "${query}":\n`));

  for (const sym of results) {
    const kind = pc.cyan(sym.kind.padEnd(10));
    const name = pc.bold(sym.name);
    const sig = sym.signature ? pc.dim(sym.signature) : '';
    const loc = pc.dim(`${sym.filePath}:${sym.line}`);
    console.log(`  ${kind} ${name}${sig}`);
    console.log(`  ${loc}`);
    if (sym.docComment) console.log(`  ${pc.dim(sym.docComment)}`);
    console.log();
  }
}
