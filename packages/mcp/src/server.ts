import { McpServer } from '@modelcontextprotocol/sdk/server/mcp.js';
import { StdioServerTransport } from '@modelcontextprotocol/sdk/server/stdio.js';
import { openDatabase } from '@aicodepulse/core';
import type { DB } from '@aicodepulse/core';
import { join } from 'path';
import { existsSync } from 'fs';
import { getContextSchema, getContextHandler } from './tools/getContext.js';
import { searchSymbolsSchema, searchSymbolsHandler } from './tools/searchSymbols.js';
import { getFileSummarySchema, getFileSummaryHandler } from './tools/getFileSummary.js';

export async function startServer(): Promise<void> {
  const repoRoot = process.cwd();
  const dbPath = join(repoRoot, '.codepulse', 'index.db');

  let db: DB | null = null;
  if (existsSync(dbPath)) {
    db = openDatabase(dbPath);
  }

  const server = new McpServer({
    name: 'codepulse',
    version: '0.1.0',
  });

  server.tool(
    'get_context',
    'Get a token-budgeted codebase context snapshot for the current repository',
    getContextSchema,
    (args) => {
      if (!db) return { content: [{ type: 'text', text: 'No CodePulse index found. Run: codepulse init' }] };
      return getContextHandler(db)(args as { budget_tokens: number; focus_path?: string; format: 'xml' | 'markdown' });
    }
  );

  server.tool(
    'search_symbols',
    'Search for exported symbols by name (partial match)',
    searchSymbolsSchema,
    (args) => {
      if (!db) return { content: [{ type: 'text', text: 'No CodePulse index found. Run: codepulse init' }] };
      return searchSymbolsHandler(db)(args as { query: string; limit: number });
    }
  );

  server.tool(
    'get_file_summary',
    'Get exported symbols, imports, and importers for a specific file',
    getFileSummarySchema,
    (args) => {
      if (!db) return { content: [{ type: 'text', text: 'No CodePulse index found. Run: codepulse init' }] };
      return getFileSummaryHandler(db)(args as { path: string });
    }
  );

  const transport = new StdioServerTransport();
  await server.connect(transport);
}
