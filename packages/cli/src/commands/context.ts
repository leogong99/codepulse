import { join } from 'path';
import { existsSync } from 'fs';
import pc from 'picocolors';
import { openDatabase, generateContext, DEFAULT_CONFIG } from '@codepulse/core';
import type { ContextRequest } from '@codepulse/core';

export interface ContextOptions {
  budget: number;
  focus?: string;
  format: 'markdown' | 'xml';
}

export async function contextCommand(repoRoot: string, options: ContextOptions): Promise<void> {
  const dbPath = join(repoRoot, '.codepulse', 'index.db');
  if (!existsSync(dbPath)) {
    console.error(pc.red('No index found. Run `codepulse init` first.'));
    process.exit(1);
  }

  const db = openDatabase(dbPath);

  const request: ContextRequest = {
    budgetTokens: options.budget,
    focusPath: options.focus,
    format: options.format,
  };

  const result = generateContext(db, request, DEFAULT_CONFIG);
  process.stdout.write(result.rendered);
  process.stdout.write('\n');

  // Print token stats to stderr so they don't pollute piped output
  process.stderr.write(pc.dim(`\n[codepulse] ${result.totalTokens}/${result.budgetTokens} tokens used\n`));
}
