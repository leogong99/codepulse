import type { DB } from '../../storage/Database.js';
import { SymbolRepository } from '../../storage/SymbolRepository.js';
import { FileRepository } from '../../storage/FileRepository.js';
import { countTokens } from '../TokenCounter.js';

export function renderFocusLayer(db: DB, focusPath: string, budget: number): { content: string; truncated: boolean } {
  const symRepo = new SymbolRepository(db);
  const fileRepo = new FileRepository(db);

  // Find all files under focusPath
  const allFiles = fileRepo.getAllActive().filter(f => f.path.startsWith(focusPath));
  const lines: string[] = [`### Focus: ${focusPath}`];
  let usedTokens = countTokens(lines[0]);
  let truncated = false;

  for (const file of allFiles) {
    const syms = symRepo.getExportedByFile(file.path);
    if (syms.length === 0) continue;

    const importers = symRepo.getImportersOf(file.path);

    const fileLines = [`  ${file.path}:`];
    for (const s of syms) {
      const sig = s.signature ? `${s.name}${s.signature}` : s.name;
      fileLines.push(`    ${s.kind} ${sig}`);
    }
    if (importers.length > 0) {
      fileLines.push(`    ← imported by: ${importers.slice(0, 3).join(', ')}${importers.length > 3 ? ` +${importers.length - 3} more` : ''}`);
    }

    const block = fileLines.join('\n');
    const t = countTokens(block);
    if (usedTokens + t > budget) { truncated = true; break; }
    lines.push(block);
    usedTokens += t;
  }

  return { content: lines.join('\n'), truncated };
}
