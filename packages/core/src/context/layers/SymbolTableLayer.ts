import type { DB } from '../../storage/Database.js';
import { SymbolRepository } from '../../storage/SymbolRepository.js';
import { FileRepository } from '../../storage/FileRepository.js';
import { countTokens } from '../TokenCounter.js';
import { scoreFile } from '../TaskAnalyzer.js';

export function renderSymbolTable(db: DB, budget: number, taskKeywords: string[] = []): { content: string; truncated: boolean } {
  const repo = new SymbolRepository(db);
  const fileRepo = new FileRepository(db);
  const symbols = repo.getAllExported();

  // Build summary lookup
  const summaryMap = new Map<string, string | null>();
  if (taskKeywords.length > 0) {
    for (const { path, summary } of fileRepo.getSummaries()) {
      summaryMap.set(path, summary);
    }
  }

  // Group by file
  const byFile = new Map<string, typeof symbols>();
  for (const s of symbols) {
    if (!byFile.has(s.filePath)) byFile.set(s.filePath, []);
    byFile.get(s.filePath)!.push(s);
  }

  // Sort by task relevance first (using summary), then by symbol count
  const sorted = [...byFile.entries()].sort((a, b) => {
    const scoreDiff =
      scoreFile(b[0], b[1], taskKeywords, summaryMap.get(b[0]) ?? null) -
      scoreFile(a[0], a[1], taskKeywords, summaryMap.get(a[0]) ?? null);
    return scoreDiff !== 0 ? scoreDiff : b[1].length - a[1].length;
  });

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
