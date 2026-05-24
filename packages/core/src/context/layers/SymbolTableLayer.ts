import type { DB } from '../../storage/Database.js';
import { SymbolRepository } from '../../storage/SymbolRepository.js';
import { countTokens } from '../TokenCounter.js';

export function renderSymbolTable(db: DB, budget: number): { content: string; truncated: boolean } {
  const repo = new SymbolRepository(db);
  const symbols = repo.getAllExported();

  // Group by file
  const byFile = new Map<string, typeof symbols>();
  for (const s of symbols) {
    if (!byFile.has(s.filePath)) byFile.set(s.filePath, []);
    byFile.get(s.filePath)!.push(s);
  }

  // Sort files by symbol count descending (most-exported files first)
  const sorted = [...byFile.entries()].sort((a, b) => b[1].length - a[1].length);

  const lines: string[] = [];
  let usedTokens = 0;
  let truncated = false;

  for (const [file, syms] of sorted) {
    const header = `### ${file}`;
    const symLines = syms.map(s => {
      const sig = s.signature ? `${s.name}${s.signature}` : s.name;
      const doc = s.docComment ? ` — ${s.docComment}` : '';
      return `  ${s.kind} ${sig}${doc}`;
    });

    const block = [header, ...symLines].join('\n');
    const blockTokens = countTokens(block);

    if (usedTokens + blockTokens > budget) {
      truncated = true;
      break;
    }

    lines.push(block);
    usedTokens += blockTokens;
  }

  return { content: lines.join('\n\n'), truncated };
}
