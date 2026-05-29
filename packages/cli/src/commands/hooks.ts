import { join, resolve } from 'path';
import { existsSync, mkdirSync, readFileSync, writeFileSync, chmodSync, unlinkSync } from 'fs';
import pc from 'picocolors';

const HOOK_MARKER = '# codepulse-managed';
const HOOK_BODY = `#!/bin/sh
${HOOK_MARKER}
codepulse update --root "$(git rev-parse --show-toplevel)" 2>/dev/null || true
`;

export function installHooksCommand(repoRoot: string): void {
  const hooksDir = join(repoRoot, '.git', 'hooks');
  if (!existsSync(join(repoRoot, '.git'))) {
    console.error(pc.red('Not a git repository.'));
    process.exit(1);
  }

  mkdirSync(hooksDir, { recursive: true });
  const hookPath = join(hooksDir, 'post-commit');

  if (existsSync(hookPath)) {
    const existing = readFileSync(hookPath, 'utf8');
    if (existing.includes(HOOK_MARKER)) {
      console.log(pc.yellow('Hook already installed.'));
      return;
    }
    // Append to existing hook
    writeFileSync(hookPath, existing.trimEnd() + '\n\n' + HOOK_BODY);
    console.log(pc.green('✓ Appended codepulse to existing post-commit hook.'));
  } else {
    writeFileSync(hookPath, HOOK_BODY);
    console.log(pc.green('✓ Installed post-commit hook.'));
  }

  chmodSync(hookPath, 0o755);
  console.log(pc.dim(`  ${hookPath}`));
  console.log(pc.dim('  Index will auto-update after every commit.'));
}

export function uninstallHooksCommand(repoRoot: string): void {
  const hookPath = join(repoRoot, '.git', 'hooks', 'post-commit');
  if (!existsSync(hookPath)) {
    console.log(pc.yellow('No post-commit hook found.'));
    return;
  }

  const existing = readFileSync(hookPath, 'utf8');
  if (!existing.includes(HOOK_MARKER)) {
    console.log(pc.yellow('No codepulse hook found in post-commit.'));
    return;
  }

  // Remove only the codepulse block
  const cleaned = existing
    .split('\n')
    .reduce<{ lines: string[]; skip: boolean }>((acc, line) => {
      if (line.includes(HOOK_MARKER)) return { lines: acc.lines, skip: true };
      if (acc.skip && line.startsWith('codepulse')) return acc;
      return { lines: [...acc.lines, line], skip: false };
    }, { lines: [], skip: false })
    .lines.join('\n')
    .trimEnd();

  if (cleaned === '#!/bin/sh' || cleaned.trim() === '') {
    unlinkSync(hookPath);
    console.log(pc.green('✓ Removed post-commit hook.'));
  } else {
    writeFileSync(hookPath, cleaned + '\n');
    console.log(pc.green('✓ Removed codepulse from post-commit hook.'));
  }
}
