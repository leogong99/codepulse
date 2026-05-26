import { join } from 'path';
import { existsSync } from 'fs';
import { execSync } from 'child_process';
import pc from 'picocolors';
import { openDatabase, generateContext, DEFAULT_CONFIG } from '@aicodepulse/core';
import type { ContextRequest } from '@aicodepulse/core';
import { extractKeywords } from '@aicodepulse/core';

function getGitChangedKeywords(repoRoot: string): string[] {
  try {
    const unstaged = execSync('git diff --name-only HEAD', { cwd: repoRoot, encoding: 'utf8', stdio: ['pipe', 'pipe', 'pipe'] });
    const staged = execSync('git diff --name-only --cached', { cwd: repoRoot, encoding: 'utf8', stdio: ['pipe', 'pipe', 'pipe'] });
    const files = [...unstaged.split('\n'), ...staged.split('\n')].filter(Boolean);
    // Extract unique dir and file stem names as keywords
    const keywords = new Set<string>();
    for (const f of files) {
      const parts = f.split('/');
      parts.forEach(p => {
        const stem = p.replace(/\.[^.]+$/, '').toLowerCase();
        if (stem.length > 2) keywords.add(stem);
      });
    }
    return [...keywords];
  } catch {
    return [];
  }
}

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
  const gitKeywords = getGitChangedKeywords(repoRoot);
  // Merge: task keywords take priority (listed first), git keywords fill in the rest
  const allKeywords = [...new Set([...taskKeywords, ...gitKeywords])];

  const request: ContextRequest = {
    budgetTokens: options.budget,
    focusPath: options.focus,
    format: options.format,
    taskKeywords: allKeywords,
    autoBudget: options.auto,
  };

  const result = generateContext(db, request, DEFAULT_CONFIG);

  if (result.skipped) {
    process.stderr.write(pc.dim('[codepulse] repo too small to benefit from context injection — skipped\n'));
    return;
  }

  process.stdout.write(result.rendered);
  process.stdout.write('\n');

  const kwNote = allKeywords.length > 0 ? ` | keywords: ${allKeywords.join(', ')}` : '';
  const autoNote = options.auto ? ' (auto-budget)' : '';
  process.stderr.write(pc.dim(`[codepulse] ${result.totalTokens}/${result.budgetTokens} tokens used${autoNote}${kwNote}\n`));
  if (result.truncationWarning) {
    process.stderr.write(pc.yellow(`[codepulse] warning: ${result.truncationWarning}\n`));
  }
}
