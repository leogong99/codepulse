import Parser from 'tree-sitter';

export interface LanguageConfig {
  language: Parser.Language;
  extensions: string[];
  name: string;
}

let registry: Map<string, LanguageConfig> | null = null;

async function buildRegistry(): Promise<Map<string, LanguageConfig>> {
  const map = new Map<string, LanguageConfig>();

  const entries: [string[], string, () => Promise<{ default: Parser.Language }>][] = [
    [['.js', '.mjs', '.cjs'], 'javascript', () => import('tree-sitter-javascript') as Promise<{ default: Parser.Language }>],
    [['.ts', '.tsx', '.mts', '.cts'], 'typescript', () => import('tree-sitter-typescript').then(m => ({ default: (m as unknown as { typescript: Parser.Language }).typescript }))],
    [['.py', '.pyw'], 'python', () => import('tree-sitter-python') as Promise<{ default: Parser.Language }>],
    [['.go'], 'go', () => import('tree-sitter-go') as Promise<{ default: Parser.Language }>],
    [['.rs'], 'rust', () => import('tree-sitter-rust') as Promise<{ default: Parser.Language }>],
    [['.java'], 'java', () => import('tree-sitter-java') as Promise<{ default: Parser.Language }>],
    [['.c', '.h'], 'c', () => import('tree-sitter-c') as Promise<{ default: Parser.Language }>],
    [['.cpp', '.cc', '.cxx', '.hpp', '.hxx'], 'cpp', () => import('tree-sitter-cpp') as Promise<{ default: Parser.Language }>],
    [['.cs'], 'csharp', () => import('tree-sitter-c-sharp') as Promise<{ default: Parser.Language }>],
    [['.rb'], 'ruby', () => import('tree-sitter-ruby') as Promise<{ default: Parser.Language }>],
    [['.php'], 'php', () => import('tree-sitter-php').then(m => ({ default: (m as unknown as { php: Parser.Language }).php }))],
    [['.sh', '.bash'], 'bash', () => import('tree-sitter-bash') as Promise<{ default: Parser.Language }>],
    [['.kt', '.kts'], 'kotlin', () => import('tree-sitter-kotlin') as Promise<{ default: Parser.Language }>],
    [['.swift'], 'swift', () => import('tree-sitter-swift') as Promise<{ default: Parser.Language }>],
  ];

  await Promise.allSettled(entries.map(async ([exts, name, loader]) => {
    try {
      const mod = await loader();
      const lang = mod.default as Parser.Language;
      const config: LanguageConfig = { language: lang, extensions: exts, name };
      for (const ext of exts) map.set(ext, config);
    } catch {
      // grammar not installed — skip silently
    }
  }));

  return map;
}

export async function getRegistry(): Promise<Map<string, LanguageConfig>> {
  if (!registry) registry = await buildRegistry();
  return registry;
}

export async function getLanguageForExtension(ext: string): Promise<LanguageConfig | null> {
  const reg = await getRegistry();
  return reg.get(ext) ?? null;
}

export function extensionFromPath(filePath: string): string {
  const dot = filePath.lastIndexOf('.');
  return dot === -1 ? '' : filePath.slice(dot).toLowerCase();
}
