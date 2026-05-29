import type { DB } from '../../storage/Database.js';
import { SymbolRepository } from '../../storage/SymbolRepository.js';
import { FileRepository } from '../../storage/FileRepository.js';
import { countTokens } from '../TokenCounter.js';
import { scoreFile } from '../TaskAnalyzer.js';

export function renderSymbolTable(db: DB, budget: number, taskKeywords: string[] = []): { content: string; truncated: boolean } {
  const repo = new SymbolRepository(db);
  const fileRepo = new FileRepository(db);
  const symbols = repo.getAllExported();

  // Build summary + changeCount lookup
  const fileMetaMap = new Map<string, { summary: string | null; changeCount: number }>();
  for (const { path, summary, complexityScore: _c, ...rest } of fileRepo.getSummaries()) {
    fileMetaMap.set(path, { summary, changeCount: (rest as { changeCount?: number }).changeCount ?? 0 });
  }

  // Group by file
  const byFile = new Map<string, typeof symbols>();
  for (const s of symbols) {
    if (!byFile.has(s.filePath)) byFile.set(s.filePath, []);
    byFile.get(s.filePath)!.push(s);
  }

  // Sort: task relevance first, then change frequency (hot files), then symbol count
  const sorted = [...byFile.entries()].sort((a, b) => {
    const metaA = fileMetaMap.get(a[0]);
    const metaB = fileMetaMap.get(b[0]);
    const relevanceDiff =
      scoreFile(b[0], b[1], taskKeywords, metaB?.summary ?? null) -
      scoreFile(a[0], a[1], taskKeywords, metaA?.summary ?? null);
    if (relevanceDiff !== 0) return relevanceDiff;
    const changeDiff = (metaB?.changeCount ?? 0) - (metaA?.changeCount ?? 0);
    if (changeDiff !== 0) return changeDiff;
    return b[1].length - a[1].length;
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
