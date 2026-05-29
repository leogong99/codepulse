import { describe, it, expect, beforeEach, afterEach } from 'vitest';
import { mkdirSync, rmSync, readFileSync, existsSync, writeFileSync } from 'fs';
import { join } from 'path';
import { installHooksCommand, uninstallHooksCommand } from './hooks.js';

const TMP = '/tmp/codepulse-hooks-test';
const GIT_HOOKS = join(TMP, '.git', 'hooks');

beforeEach(() => {
  mkdirSync(join(TMP, '.git', 'hooks'), { recursive: true });
});

afterEach(() => {
  rmSync(TMP, { recursive: true, force: true });
});

describe('installHooksCommand', () => {
  it('creates post-commit hook when none exists', () => {
    installHooksCommand(TMP);
    const content = readFileSync(join(GIT_HOOKS, 'post-commit'), 'utf8');
    expect(content).toContain('codepulse-managed');
    expect(content).toContain('codepulse update');
    expect(content).toContain('#!/bin/sh');
  });

  it('appends to existing hook without overwriting it', () => {
    const hookPath = join(GIT_HOOKS, 'post-commit');
    writeFileSync(hookPath, '#!/bin/sh\necho "existing hook"\n');
    installHooksCommand(TMP);
    const content = readFileSync(hookPath, 'utf8');
    expect(content).toContain('existing hook');
    expect(content).toContain('codepulse-managed');
  });

  it('detects already-installed hook and skips', () => {
    installHooksCommand(TMP);
    const before = readFileSync(join(GIT_HOOKS, 'post-commit'), 'utf8');
    installHooksCommand(TMP); // second call
    const after = readFileSync(join(GIT_HOOKS, 'post-commit'), 'utf8');
    expect(before).toBe(after); // unchanged
  });
});

describe('uninstallHooksCommand', () => {
  it('removes hook file when only codepulse content', () => {
    installHooksCommand(TMP);
    uninstallHooksCommand(TMP);
    expect(existsSync(join(GIT_HOOKS, 'post-commit'))).toBe(false);
  });

  it('removes only codepulse block from mixed hook', () => {
    const hookPath = join(GIT_HOOKS, 'post-commit');
    writeFileSync(hookPath, '#!/bin/sh\necho "existing hook"\n');
    installHooksCommand(TMP);
    uninstallHooksCommand(TMP);
    const content = readFileSync(hookPath, 'utf8');
    expect(content).toContain('existing hook');
    expect(content).not.toContain('codepulse-managed');
  });

  it('does nothing when no hook exists', () => {
    expect(() => uninstallHooksCommand(TMP)).not.toThrow();
  });
});
