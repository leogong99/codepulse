import { execSync } from 'child_process';

export type ChangeStatus = 'M' | 'A' | 'D' | 'R';

export interface ChangedFile {
  status: ChangeStatus;
  path: string;
  oldPath?: string;
}

export function getHeadCommit(repoRoot: string): string {
  try {
    return execSync('git rev-parse HEAD', { cwd: repoRoot, encoding: 'utf8' }).trim();
  } catch {
    return '';
  }
}

export function getFileChangeCounts(repoRoot: string): Map<string, number> {
  const counts = new Map<string, number>();
  try {
    const output = execSync(
      'git log --format="" --name-only',
      { cwd: repoRoot, encoding: 'utf8', maxBuffer: 10 * 1024 * 1024 }
    );
    for (const line of output.split('\n')) {
      const f = line.trim();
      if (f) counts.set(f, (counts.get(f) ?? 0) + 1);
    }
  } catch { /* not a git repo or no commits */ }
  return counts;
}

export function getChangedFiles(repoRoot: string, sinceCommit: string): ChangedFile[] | null {
  if (!sinceCommit) return null;

  try {
    const output = execSync(
      `git diff --name-status ${sinceCommit} HEAD`,
      { cwd: repoRoot, encoding: 'utf8' }
    );

    const changes: ChangedFile[] = [];
    for (const line of output.trim().split('\n')) {
      if (!line) continue;
      const parts = line.split('\t');
      const rawStatus = parts[0].charAt(0) as ChangeStatus;
      const status = ['M', 'A', 'D', 'R'].includes(rawStatus) ? rawStatus : 'M';

      if (status === 'R') {
        changes.push({ status: 'D', path: parts[1] });
        changes.push({ status: 'A', path: parts[2] });
      } else {
        changes.push({ status, path: parts[1] });
      }
    }
    return changes;
  } catch {
    return null;
  }
}
