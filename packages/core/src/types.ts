export interface IndexMeta {
  schemaVersion: number;
  lastIndexedCommit: string;
  lastIndexedAt: number;
  repoRoot: string;
  totalFiles: number;
  totalSymbols: number;
}

export type SymbolKind =
  | 'function' | 'class' | 'interface' | 'type' | 'enum'
  | 'variable' | 'constant' | 'method' | 'property' | 'module';

export interface FileRecord {
  id: number;
  path: string;
  language: string;
  contentHash: string;
  sizeBytes: number;
  linesTotal: number;
  indexedAt: number;
  isDeleted: boolean;
}

export interface CodeSymbol {
  id: number;
  fileId: number;
  filePath: string;
  name: string;
  kind: SymbolKind;
  line: number;
  endLine: number;
  isExported: boolean;
  signature: string | null;
  docComment: string | null;
  parentName: string | null;
}

export interface ImportEdge {
  id: number;
  fromFileId: number;
  fromPath: string;
  toPath: string | null;
  toPackage: string | null;
  importedNames: string[];
  isTypeOnly: boolean;
}

export type LayerName =
  | 'repo_overview'
  | 'directory_map'
  | 'symbol_table'
  | 'import_graph'
  | 'focus';

export interface ContextRequest {
  budgetTokens: number;
  focusPath?: string;
  format: 'markdown' | 'xml';
  layers?: LayerName[];
  taskKeywords?: string[];  // rank content by relevance to these keywords
  autoBudget?: boolean;     // scale budget automatically by repo size
}

export interface LayerResult {
  layer: LayerName;
  tokensUsed: number;
  content: string;
  truncated: boolean;
}

export interface ContextResult {
  totalTokens: number;
  budgetTokens: number;
  layers: LayerResult[];
  rendered: string;
  skipped?: boolean;
}

export interface CodePulseConfig {
  exclude: string[];
  maxFileSizeBytes: number;
  defaultBudgetTokens: number;
  layerWeights: Record<LayerName, number>;
  languages?: string[];
}

export const DEFAULT_CONFIG: CodePulseConfig = {
  exclude: ['node_modules', '.git', 'dist', 'build', '.next', '__pycache__', '*.min.js'],
  maxFileSizeBytes: 512 * 1024,
  defaultBudgetTokens: 4000,
  layerWeights: {
    repo_overview: 0.10,
    directory_map: 0.20,
    symbol_table: 0.45,
    import_graph: 0.15,
    focus: 0.10,
  },
};
