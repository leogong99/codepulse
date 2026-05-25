import type { DB } from '../storage/Database.js';
import type { ContextRequest, ContextResult, LayerResult, LayerName, CodePulseConfig } from '../types.js';
import { MetaRepository } from '../storage/MetaRepository.js';
import { allocateBudget } from './BudgetAllocator.js';
import { renderRepoOverview } from './layers/RepoOverviewLayer.js';
import { renderDirectoryMap } from './layers/DirectoryMapLayer.js';
import { renderSymbolTable } from './layers/SymbolTableLayer.js';
import { renderImportGraph } from './layers/ImportGraphLayer.js';
import { renderFocusLayer } from './layers/FocusLayer.js';
import { countTokens } from './TokenCounter.js';

const DEFAULT_LAYERS: LayerName[] = ['repo_overview', 'directory_map', 'symbol_table', 'import_graph', 'focus'];

const SKIP_THRESHOLD = 10;       // repos smaller than this get skipped entirely
const SMALL_REPO_BUDGET = 800;
const MEDIUM_REPO_BUDGET = 2000;
const LARGE_REPO_BUDGET = 4000;

function autoBudget(totalFiles: number): number | null {
  if (totalFiles < SKIP_THRESHOLD) return null; // null = skip
  if (totalFiles < 30) return SMALL_REPO_BUDGET;
  if (totalFiles < 150) return MEDIUM_REPO_BUDGET;
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

  // Resolve budget — auto-scale by repo size if requested
  let budgetTokens = request.budgetTokens;
  let skipped = false;
  if (request.autoBudget) {
    const meta = new MetaRepository(db).getIndexMeta();
    const resolved = autoBudget(meta.totalFiles);
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

  const budgets = allocateBudget(budgetTokens, config, hasFocus, layers);

  let remainingSurplus = 0;
  const results: LayerResult[] = [];

  for (const { layer, tokens } of budgets) {
    const layerBudget = tokens + remainingSurplus;
    const { content, truncated } = renderLayer(db, layer, layerBudget, request.focusPath, taskKeywords);
    const used = countTokens(content);
    remainingSurplus = truncated ? 0 : layerBudget - used;

    results.push({ layer, tokensUsed: used, content, truncated });
  }

  const rendered = request.format === 'xml' ? wrapXML(results) : wrapMarkdown(results);
  const totalTokens = countTokens(rendered);

  return {
    totalTokens,
    budgetTokens,
    layers: results,
    rendered,
  };
}
