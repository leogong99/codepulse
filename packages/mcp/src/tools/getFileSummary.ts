import { z } from 'zod';
import { SymbolRepository, FileRepository } from '@aicodepulse/core';
import type { DB } from '@aicodepulse/core';

export const getFileSummarySchema = {
  path: z.string().min(1).describe('Relative file path within the repository'),
};

export function getFileSummaryHandler(db: DB) {
  return (args: { path: string }) => {
    const symRepo = new SymbolRepository(db);
    const fileRepo = new FileRepository(db);

    const file = fileRepo.getByPath(args.path);
    if (!file) {
      return { content: [{ type: 'text' as const, text: `File not found in index: ${args.path}` }] };
    }

    const symbols = symRepo.getExportedByFile(args.path);
    const imports = symRepo.getImportsFrom(args.path);
    const importers = symRepo.getImportersOf(args.path);

    const lines = [
      `## ${args.path}`,
      `Language: ${file.language} | Lines: ${file.linesTotal} | Size: ${Math.round(file.sizeBytes / 1024)}KB`,
      '',
    ];

    if (symbols.length > 0) {
      lines.push('### Exported symbols');
      for (const s of symbols) {
        const sig = s.signature ? `${s.name}${s.signature}` : s.name;
        lines.push(`  - \`${s.kind}\` **${sig}**${s.docComment ? ` — ${s.docComment}` : ''}`);
      }
      lines.push('');
    }

    if (imports.length > 0) {
      lines.push('### Imports');
      for (const e of imports.slice(0, 20)) {
        const from = e.toPackage ?? e.toPath ?? '?';
        lines.push(`  - \`${e.importedNames.join(', ')}\` from \`${from}\``);
      }
      lines.push('');
    }

    if (importers.length > 0) {
      lines.push('### Imported by');
      for (const imp of importers.slice(0, 10)) {
        lines.push(`  - ${imp}`);
      }
      if (importers.length > 10) lines.push(`  - ...and ${importers.length - 10} more`);
    }

    return { content: [{ type: 'text' as const, text: lines.join('\n') }] };
  };
}
