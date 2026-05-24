import Parser from 'tree-sitter';
import { createRequire } from 'module';

const req = createRequire(import.meta.url);

export interface LanguageConfig {
  language: Parser.Language;
  extensions: string[];
  name: string;
}

let registry: Map<string, LanguageConfig> | null = null;

function buildRegistry(): Map<string, LanguageConfig> {
  const map = new Map<string, LanguageConfig>();

  const entries: [string[], string, string, ((mod: unknown) => Parser.Language)?][] = [
    [['.js', '.mjs', '.cjs'], 'javascript', 'tree-sitter-javascript'],
    [['.ts', '.tsx', '.mts', '.cts'], 'typescript', 'tree-sitter-typescript', (m) => (m as { typescript: Parser.Language }).typescript],
    [['.py', '.pyw'], 'python', 'tree-sitter-python'],
    [['.go'], 'go', 'tree-sitter-go'],
    [['.rs'], 'rust', 'tree-sitter-rust'],
    [['.java'], 'java', 'tree-sitter-java'],
    [['.c', '.h'], 'c', 'tree-sitter-c'],
    [['.cpp', '.cc', '.cxx', '.hpp', '.hxx'], 'cpp', 'tree-sitter-cpp'],
    [['.cs'], 'csharp', 'tree-sitter-c-sharp'],
    [['.rb'], 'ruby', 'tree-sitter-ruby'],
    [['.php'], 'php', 'tree-sitter-php', (m) => (m as { php: Parser.Language }).php],
    [['.sh', '.bash'], 'bash', 'tree-sitter-bash'],
    [['.kt', '.kts'], 'kotlin', 'tree-sitter-kotlin'],
    [['.swift'], 'swift', 'tree-sitter-swift'],
  ];

  for (const [exts, name, pkg, extract] of entries) {
    try {
      const mod = req(pkg);
      const lang = extract ? extract(mod) : (mod as Parser.Language);
      const config: LanguageConfig = { language: lang, extensions: exts, name };
      for (const ext of exts) map.set(ext, config);
    } catch {
      // grammar not installed or platform unsupported — skip silently
    }
  }

  return map;
}

export function getRegistry(): Map<string, LanguageConfig> {
  if (!registry) registry = buildRegistry();
  return registry;
}

export function getLanguageForExtension(ext: string): LanguageConfig | null {
  return getRegistry().get(ext) ?? null;
}

export function extensionFromPath(filePath: string): string {
  const dot = filePath.lastIndexOf('.');
  return dot === -1 ? '' : filePath.slice(dot).toLowerCase();
}
