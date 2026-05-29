import { Command } from 'commander';
import { resolve } from 'path';
import { initCommand } from './commands/init.js';
import { updateCommand } from './commands/update.js';
import { contextCommand } from './commands/context.js';
import { statsCommand } from './commands/stats.js';
import { watchCommand } from './commands/watch.js';
import { installHooksCommand, uninstallHooksCommand } from './commands/hooks.js';
import { searchCommand } from './commands/search.js';

const program = new Command();

program
  .name('codepulse')
  .description('Token-efficient codebase indexer for AI coding tools')
  .version('0.1.0');

program
  .command('init')
  .description('Initialize a new CodePulse index for the current repo')
  .option('-r, --root <path>', 'Repository root', '.')
  .action(async (opts) => {
    await initCommand(resolve(opts.root));
  });

program
  .command('update')
  .description('Update the index (incremental by default)')
  .option('-r, --root <path>', 'Repository root', '.')
  .option('--full', 'Force a full re-index')
  .action(async (opts) => {
    await updateCommand(resolve(opts.root), opts.full ?? false);
  });

program
  .command('context')
  .description('Emit a token-budgeted codebase context snapshot')
  .option('-r, --root <path>', 'Repository root', '.')
  .option('-b, --budget <tokens>', 'Token budget (default: 4000, or auto-scaled with --auto)')
  .option('-f, --focus <path>', 'Focus path (file or directory)')
  .option('--format <format>', 'Output format: markdown or xml', 'xml')
  .option('--task <description>', 'Task description — ranks relevant files first')
  .option('--auto', 'Auto-scale budget by repo complexity (skips tiny repos)')
  .action(async (opts) => {
    const explicitBudget = opts.budget !== undefined;
    await contextCommand(resolve(opts.root), {
      budget: Number(opts.budget ?? 4000),
      focus: opts.focus,
      format: opts.format as 'markdown' | 'xml',
      task: opts.task,
      auto: opts.auto && !explicitBudget, // explicit --budget always wins over --auto
    });
  });

program
  .command('stats')
  .description('Show index statistics')
  .option('-r, --root <path>', 'Repository root', '.')
  .action((opts) => {
    statsCommand(resolve(opts.root));
  });

program
  .command('watch')
  .description('Watch for file changes and update index automatically')
  .option('-r, --root <path>', 'Repository root', '.')
  .action(async (opts) => {
    await watchCommand(resolve(opts.root));
  });

program
  .command('search <query>')
  .description('Search exported symbols by name')
  .option('-r, --root <path>', 'Repository root', '.')
  .option('-l, --limit <n>', 'Max results', '20')
  .action((query, opts) => {
    searchCommand(resolve(opts.root), query, Number(opts.limit));
  });

program
  .command('install-hooks')
  .description('Install git post-commit hook to auto-update index after every commit')
  .option('-r, --root <path>', 'Repository root', '.')
  .action((opts) => {
    installHooksCommand(resolve(opts.root));
  });

program
  .command('uninstall-hooks')
  .description('Remove codepulse git hooks')
  .option('-r, --root <path>', 'Repository root', '.')
  .action((opts) => {
    uninstallHooksCommand(resolve(opts.root));
  });

program.parse();
