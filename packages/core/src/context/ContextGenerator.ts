import type { DB } from '../storage/Database.js';
import type { ContextRequest, ContextResult, LayerResult, LayerName, CodePulseConfig } from '../types.js';
import { allocateBudget } from './BudgetAllocator.js';
import { renderRepoOverview } from './layers/RepoOverviewLayer.js';
import { renderDirectoryMap } from './layers/DirectoryMapLayer.js';
import { renderSymbolTable } from './layers/SymbolTableLayer.js';
import { renderImportGraph } from './layers/ImportGraphLayer.js';
import { renderFocusLayer } from './layers/FocusLayer.js';
import { countTokens } from './TokenCounter.js';

const DEFAULT_LAYERS: LayerName[] = ['repo_overview', 'directory_map', 'symbol_table', 'import_graph', 'focus'];

function renderLayer(db: DB, layer: LayerName, budget: number, focusPath?: string): { content: string; truncated: boolean } {
  switch (layer) {
    case 'repo_overview':  return renderRepoOverview(db, budget);
    case 'directory_map':  return renderDirectoryMap(db, budget);
    case 'symbol_table':   return renderSymbolTable(db, budget);
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

  const budgets = allocateBudget(request.budgetTokens, config, hasFocus, layers);

  let remainingSurplus = 0;
  const results: LayerResult[] = [];

  for (const { layer, tokens } of budgets) {
    const layerBudget = tokens + remainingSurplus;
    const { content, truncated } = renderLayer(db, layer, layerBudget, request.focusPath);
    const used = countTokens(content);
    remainingSurplus = truncated ? 0 : layerBudget - used;

    results.push({ layer, tokensUsed: used, content, truncated });
  }

  const rendered = request.format === 'xml' ? wrapXML(results) : wrapMarkdown(results);
  const totalTokens = countTokens(rendered);

  return {
    totalTokens,
    budgetTokens: request.budgetTokens,
    layers: results,
    rendered,
  };
}
