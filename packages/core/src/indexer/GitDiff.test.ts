import { describe, it, expect, beforeEach, afterEach } from 'vitest';
import { mkdirSync, rmSync, writeFileSync } from 'fs';
import { join } from 'path';
import { execSync } from 'child_process';
import { getHeadCommit, getCommitsBehind, getFileChangeCounts } from './GitDiff.js';

const TMP = '/tmp/codepulse-gitdiff-test';

function git(cmd: string) {
  execSync(cmd, { cwd: TMP, encoding: 'utf8', stdio: 'pipe' });
}

beforeEach(() => {
  mkdirSync(TMP, { recursive: true });
  git('git init');
  git('git config user.email "test@test.com"');
  git('git config user.name "Test"');
  // Initial commit
  writeFileSync(join(TMP, 'a.ts'), 'export const a = 1;');
  git('git add .');
  git('git commit -m "init"');
});

afterEach(() => {
  rmSync(TMP, { recursive: true, force: true });
});

describe('getHeadCommit', () => {
  it('returns a 40-char sha', () => {
    const sha = getHeadCommit(TMP);
    expect(sha).toMatch(/^[0-9a-f]{40}$/);
  });

  it('returns empty string for non-git directory', () => {
    expect(getHeadCommit('/tmp')).toBe('');
  });
});

describe('getCommitsBehind', () => {
  it('returns 0 when index is at HEAD', () => {
    const sha = getHeadCommit(TMP);
    expect(getCommitsBehind(TMP, sha)).toBe(0);
  });

  it('returns correct count after new commits', () => {
    const sha = getHeadCommit(TMP); // snapshot before extra commits

    writeFileSync(join(TMP, 'b.ts'), 'export const b = 2;');
    git('git add . && git commit -m "second"');
    writeFileSync(join(TMP, 'c.ts'), 'export const c = 3;');
    git('git add . && git commit -m "third"');

    expect(getCommitsBehind(TMP, sha)).toBe(2);
  });

  it('returns -1 for empty sinceCommit', () => {
    expect(getCommitsBehind(TMP, '')).toBe(-1);
  });
});

describe('getFileChangeCounts', () => {
  it('counts commits per file', () => {
    // a.ts was in the initial commit
    const counts = getFileChangeCounts(TMP);
    expect(counts.get('a.ts')).toBe(1);
  });

  it('increments count across multiple commits', () => {
    writeFileSync(join(TMP, 'a.ts'), 'export const a = 2;');
    git('git add . && git commit -m "modify a"');

    const counts = getFileChangeCounts(TMP);
    expect(counts.get('a.ts')).toBe(2);
  });
});
