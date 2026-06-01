import { join } from 'path';
import { existsSync } from 'fs';
import pc from 'picocolors';
import { openDatabase, MetaRepository, getCommitsBehind } from '@aicodepulse/core';

function formatAge(ms: number): string {
  if (ms < 60_000) return 'just now';
  if (ms < 3_600_000) return `${Math.round(ms / 60_000)}m ago`;
  if (ms < 86_400_000) return `${Math.round(ms / 3_600_000)}h ago`;
  return `${Math.round(ms / 86_400_000)}d ago`;
}

export function statusCommand(repoRoot: string, json: boolean): void {
  const dbPath = join(repoRoot, '.codepulse', 'index.db');
  if (!existsSync(dbPath)) {
    if (json) {
      console.log(JSON.stringify({ indexed: false }));
    } else {
      console.log(pc.dim('Not indexed. Run `codepulse init` first.'));
    }
    return;
  }

  const db = openDatabase(dbPath);
  const meta = new MetaRepository(db).getIndexMeta();
  const commitsBehind = getCommitsBehind(repoRoot, meta.lastIndexedCommit);
  db.close();

  if (json) {
    console.log(JSON.stringify({
      indexed: true,
      commitsBehind,
      lastIndexedAt: meta.lastIndexedAt,
      lastIndexedCommit: meta.lastIndexedCommit,
      totalFiles: meta.totalFiles,
      totalSymbols: meta.totalSymbols,
    }));
    return;
  }

  const age = formatAge(Date.now() - meta.lastIndexedAt);
  console.log(pc.bold('CodePulse Index Status'));
  console.log(`  Indexed:        ${pc.cyan(age)}`);
  console.log(`  Files:          ${meta.totalFiles}  |  Symbols: ${meta.totalSymbols}`);
  if (commitsBehind > 0) {
    const n = pc.yellow(String(commitsBehind));
    console.log(`  Commits behind: ${n} — run ${pc.cyan('`codepulse update`')} to refresh`);
  } else if (commitsBehind === 0) {
    console.log(`  Status:         ${pc.green('Up to date')}`);
  }
}
