import { z } from 'zod';
import { generateContext, DEFAULT_CONFIG } from '@codepulse/core';
import type { DB } from '@codepulse/core';
import type { ContextRequest } from '@codepulse/core';

export const getContextSchema = {
  budget_tokens: z.number().int().min(500).max(32000).default(4000).describe('Token budget for the context snapshot'),
  focus_path: z.string().optional().describe('File or directory path to prioritize in the context'),
  format: z.enum(['xml', 'markdown']).default('xml').describe('Output format'),
};

export function getContextHandler(db: DB) {
  return (args: { budget_tokens: number; focus_path?: string; format: 'xml' | 'markdown' }) => {
    const request: ContextRequest = {
      budgetTokens: args.budget_tokens,
      focusPath: args.focus_path,
      format: args.format,
    };
    const result = generateContext(db, request, DEFAULT_CONFIG);
    return {
      content: [{ type: 'text' as const, text: result.rendered }],
    };
  };
}
