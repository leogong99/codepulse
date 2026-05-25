import { join } from 'path';
import { existsSync } from 'fs';
import pc from 'picocolors';
import { openDatabase, generateContext, DEFAULT_CONFIG } from '@aicodepulse/core';
import type { ContextRequest } from '@aicodepulse/core';
import { extractKeywords } from '@aicodepulse/core';

export interface ContextOptions {
  budget: number;
  focus?: string;
  format: 'markdown' | 'xml';
  task?: string;
  auto?: boolean;
}

export async function contextCommand(repoRoot: string, options: ContextOptions): Promise<void> {
  const dbPath = join(repoRoot, '.codepulse', 'index.db');
  if (!existsSync(dbPath)) {
    console.error(pc.red('No index found. Run `codepulse init` first.'));
    process.exit(1);
  }

  const db = openDatabase(dbPath);
  const taskKeywords = options.task ? extractKeywords(options.task) : [];

  const request: ContextRequest = {
    budgetTokens: options.budget,
    focusPath: options.focus,
    format: options.format,
    taskKeywords,
    autoBudget: options.auto,
  };

  const result = generateContext(db, request, DEFAULT_CONFIG);

  if (result.skipped) {
    process.stderr.write(pc.dim('[codepulse] repo too small to benefit from context injection — skipped\n'));
    return;
  }

  process.stdout.write(result.rendered);
  process.stdout.write('\n');

  const kwNote = taskKeywords.length > 0 ? ` | task keywords: ${taskKeywords.join(', ')}` : '';
  const autoNote = options.auto ? ' (auto-budget)' : '';
  process.stderr.write(pc.dim(`[codepulse] ${result.totalTokens}/${result.budgetTokens} tokens used${autoNote}${kwNote}\n`));
}
