import type { DB } from '../storage/Database.js';
import type { ContextRequest, ContextResult, LayerResult, LayerName, CodePulseConfig } from '../types.js';
import { FileRepository } from '../storage/FileRepository.js';
import { allocateBudget } from './BudgetAllocator.js';
import { renderRepoOverview } from './layers/RepoOverviewLayer.js';
import { renderDirectoryMap } from './layers/DirectoryMapLayer.js';
import { renderSymbolTable } from './layers/SymbolTableLayer.js';
import { renderImportGraph } from './layers/ImportGraphLayer.js';
import { renderFocusLayer } from './layers/FocusLayer.js';
import { countTokens } from './TokenCounter.js';

const DEFAULT_LAYERS: LayerName[] = ['repo_overview', 'directory_map', 'symbol_table', 'import_graph', 'focus'];

// Complexity thresholds (sum of per-file scores: exported*2 + imports + lines/50)
// A 10-file TS project with ~5 exports each ≈ complexity 100
// A 50-file project ≈ complexity 500+
// A 150-file project ≈ complexity 1500+
const SKIP_THRESHOLD = 50;
const SMALL_REPO_BUDGET = 800;
const MEDIUM_REPO_BUDGET = 2000;
const LARGE_REPO_BUDGET = 4000;

function autoBudget(totalComplexity: number): number | null {
  if (totalComplexity < SKIP_THRESHOLD) return null; // null = skip
  if (totalComplexity < 500) return SMALL_REPO_BUDGET;
  if (totalComplexity < 1500) return MEDIUM_REPO_BUDGET;
  return LARGE_REPO_BUDGET;
}

function renderLayer(db: DB, layer: LayerName, budget: number, focusPath?: string, taskKeywords: string[] = []): { content: string; truncated: boolean } {
  switch (layer) {
    case 'repo_overview':  return renderRepoOverview(db, budget);
    case 'directory_map':  return renderDirectoryMap(db, budget);
    case 'symbol_table':   return renderSymbolTable(db, budget, taskKeywords);
    case 'import_graph':   return renderImportGraph(db, budget);
    case 'focus':          return focusPath ? renderFocusLayer(db, focusPath, budget) : { content: '', truncated: false };
    default:               return { content: '', truncated: false };
  }
}

function wrapMarkdown(layers: LayerResult[]): string {
  return layers.map(l => l.content).filter(Boolean).join('\n\n');
}

function wrapXML(layers: LayerResult[]): string {
  const inner = layers
    .filter(l => l.content)
    .map(l => `  <${l.layer}>\n${l.content}\n  </${l.layer}>`)
    .join('\n');
  return `<codebase_context>\n${inner}\n</codebase_context>`;
}

export function generateContext(db: DB, request: ContextRequest, config: CodePulseConfig): ContextResult {
  const layers = request.layers ?? DEFAULT_LAYERS;
  const hasFocus = Boolean(request.focusPath);
  const taskKeywords = request.taskKeywords ?? [];

  // Resolve budget — auto-scale by repo complexity if requested
  let budgetTokens = request.budgetTokens;
  let skipped = false;
  if (request.autoBudget) {
    const totalComplexity = new FileRepository(db).getTotalComplexity();
    const resolved = autoBudget(totalComplexity);
    if (resolved === null) {
      skipped = true;
    } else {
      budgetTokens = resolved;
    }
  }

  if (skipped) {
    return {
      totalTokens: 0,
      budgetTokens: 0,
      layers: [],
      rendered: '',
      skipped: true,
    };
  }

  // Reserve tokens for XML/Markdown wrapper overhead (~15 tokens per layer + outer tags)
  const wrapperOverhead = request.format === 'xml' ? 10 + layers.length * 15 : 0;
  const contentBudget = Math.max(budgetTokens - wrapperOverhead, 100);
  const budgets = allocateBudget(contentBudget, config, hasFocus, layers);

  let remainingSurplus = 0;
  let totalUsed = 0;
  const results: LayerResult[] = [];

  for (const { layer, tokens } of budgets) {
    const remaining = contentBudget - totalUsed;
    const layerBudget = Math.min(tokens + remainingSurplus, remaining);
    if (layerBudget <= 0) break;
    const { content, truncated } = renderLayer(db, layer, layerBudget, request.focusPath, taskKeywords);
    const used = countTokens(content);
    remainingSurplus = truncated ? 0 : layerBudget - used;
    totalUsed += used;

    results.push({ layer, tokensUsed: used, content, truncated });
  }

  const rendered = request.format === 'xml' ? wrapXML(results) : wrapMarkdown(results);
  const totalTokens = countTokens(rendered);

  // Warn if symbol_table was truncated while auto-budget was active
  let truncationWarning: string | undefined;
  const symLayer = results.find(r => r.layer === 'symbol_table');
  if (symLayer?.truncated && request.autoBudget) {
    const nextBudget = budgetTokens === SMALL_REPO_BUDGET ? MEDIUM_REPO_BUDGET
      : budgetTokens === MEDIUM_REPO_BUDGET ? LARGE_REPO_BUDGET
      : budgetTokens * 2;
    truncationWarning = `symbol table truncated — some files omitted. Re-run with --budget ${nextBudget} for full coverage.`;
  }

  return {
    totalTokens,
    budgetTokens,
    layers: results,
    rendered,
    truncationWarning,
  };
}
