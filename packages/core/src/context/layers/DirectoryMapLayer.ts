import type { DB } from '../../storage/Database.js';
import { FileRepository } from '../../storage/FileRepository.js';
import { countTokens } from '../TokenCounter.js';

function buildTree(paths: string[]): Map<string, Set<string>> {
  const tree = new Map<string, Set<string>>();
  for (const p of paths) {
    const parts = p.split('/');
    // Add each directory level
    for (let i = 1; i < parts.length; i++) {
      const dir = parts.slice(0, i).join('/') || '.';
      if (!tree.has(dir)) tree.set(dir, new Set());
      tree.get(dir)!.add(parts.slice(0, i + 1).join('/'));
    }
  }
  return tree;
}

function renderTree(paths: string[], maxLines: number): string {
  const dirs = new Map<string, string[]>();
  for (const p of paths) {
    const slash = p.lastIndexOf('/');
    const dir = slash === -1 ? '.' : p.slice(0, slash);
    if (!dirs.has(dir)) dirs.set(dir, []);
    dirs.get(dir)!.push(slash === -1 ? p : p.slice(slash + 1));
  }

  const lines: string[] = [];
  // Show top-level dirs and their file counts
  const topLevel = new Map<string, number>();
  for (const p of paths) {
    const top = p.split('/')[0];
    topLevel.set(top, (topLevel.get(top) ?? 0) + 1);
  }

  for (const [dir, count] of [...topLevel.entries()].sort()) {
    if (lines.length >= maxLines) { lines.push('...'); break; }
    lines.push(`${dir}/ (${count} files)`);
  }

  return lines.join('\n');
}

export function renderDirectoryMap(db: DB, budget: number): { content: string; truncated: boolean } {
  const allFiles = new FileRepository(db).getAllActive();
  const paths = allFiles.map(f => f.path);
  const charsPerToken = 4;
  const maxLines = Math.floor((budget * charsPerToken) / 30);

  const content = renderTree(paths, maxLines);
  return { content, truncated: countTokens(content) > budget };
}
