import type { DB } from '../../storage/Database.js';
import { SymbolRepository } from '../../storage/SymbolRepository.js';
import { countTokens } from '../TokenCounter.js';

export function renderImportGraph(db: DB, budget: number): { content: string; truncated: boolean } {
  const repo = new SymbolRepository(db);
  const hubs = repo.getTopImportedFiles(30);

  const lines: string[] = ['### Most-imported modules'];
  let usedTokens = countTokens(lines[0]);
  let truncated = false;

  for (const { path, importerCount } of hubs) {
    const line = `  ${path} ← imported by ${importerCount} files`;
    const t = countTokens(line);
    if (usedTokens + t > budget) { truncated = true; break; }
    lines.push(line);
    usedTokens += t;
  }

  return { content: lines.join('\n'), truncated };
}
