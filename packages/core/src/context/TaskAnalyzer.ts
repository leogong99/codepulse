import type { CodeSymbol } from '../types.js';

const STOPWORDS = new Set([
  'a', 'an', 'the', 'is', 'in', 'it', 'of', 'to', 'and', 'or', 'for',
  'on', 'at', 'by', 'with', 'from', 'this', 'that', 'be', 'are', 'was',
  'can', 'do', 'get', 'use', 'how', 'what', 'my', 'me', 'i', 'we', 'you',
  'show', 'make', 'add', 'fix', 'update', 'change', 'want', 'need', 'all',
]);

export function extractKeywords(task: string): string[] {
  return task
    .toLowerCase()
    .replace(/[^a-z0-9\s_/-]/g, ' ')
    .split(/\s+/)
    .filter(w => w.length > 2 && !STOPWORDS.has(w));
}

export function scoreFile(filePath: string, symbols: CodeSymbol[], keywords: string[]): number {
  if (keywords.length === 0) return 0;
  const pathLower = filePath.toLowerCase();
  let score = 0;

  for (const kw of keywords) {
    if (pathLower.includes(kw)) score += 3;
    for (const sym of symbols) {
      if (sym.name.toLowerCase().includes(kw)) score += 2;
      if (sym.signature?.toLowerCase().includes(kw)) score += 1;
      if (sym.docComment?.toLowerCase().includes(kw)) score += 1;
    }
  }

  return score;
}
