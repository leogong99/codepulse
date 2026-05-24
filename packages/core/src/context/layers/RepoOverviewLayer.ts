import type { DB } from '../../storage/Database.js';
import { MetaRepository } from '../../storage/MetaRepository.js';
import { FileRepository } from '../../storage/FileRepository.js';
import { countTokens } from '../TokenCounter.js';
import { basename } from 'path';

export function renderRepoOverview(db: DB, budget: number): { content: string; truncated: boolean } {
  const meta = new MetaRepository(db).getIndexMeta();
  const files = new FileRepository(db);
  const langStats = files.getLanguageStats();

  const repoName = basename(meta.repoRoot) || 'unknown';
  const lastIndexed = meta.lastIndexedAt
    ? new Date(meta.lastIndexedAt).toISOString().slice(0, 10)
    : 'never';

  const langSummary = langStats
    .slice(0, 8)
    .map(l => `${l.language}: ${l.count}`)
    .join(', ');

  const content = [
    `# Repository: ${repoName}`,
    `Files: ${meta.totalFiles} | Symbols: ${meta.totalSymbols} | Last indexed: ${lastIndexed}`,
    `Languages: ${langSummary}`,
  ].join('\n');

  return { content, truncated: countTokens(content) > budget };
}
