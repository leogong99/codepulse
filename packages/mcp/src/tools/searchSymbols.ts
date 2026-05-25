import { z } from 'zod';
import { SymbolRepository } from '@aicodepulse/core';
import type { DB } from '@aicodepulse/core';

export const searchSymbolsSchema = {
  query: z.string().min(1).describe('Symbol name to search for (partial match)'),
  limit: z.number().int().min(1).max(100).default(20).describe('Maximum number of results'),
};

export function searchSymbolsHandler(db: DB) {
  return (args: { query: string; limit: number }) => {
    const repo = new SymbolRepository(db);
    const results = repo.search(args.query, args.limit);
    const text = JSON.stringify(results, null, 2);
    return {
      content: [{ type: 'text' as const, text }],
    };
  };
}
