import { glob } from 'glob';
import Ignore from 'ignore';
import { readFileSync, existsSync } from 'fs';
import { join, relative } from 'path';
import type { CodePulseConfig } from '../types.js';

export interface WalkedFile {
  absolutePath: string;
  relativePath: string;
}

export async function walkFiles(repoRoot: string, config: CodePulseConfig): Promise<WalkedFile[]> {
  const ig = Ignore.default();

  // Load .gitignore if present
  const gitignorePath = join(repoRoot, '.gitignore');
  if (existsSync(gitignorePath)) {
    ig.add(readFileSync(gitignorePath, 'utf8'));
  }

  // Add config excludes
  ig.add(config.exclude);

  const pattern = '**/*';
  const files = await glob(pattern, {
    cwd: repoRoot,
    nodir: true,
    dot: false,
    absolute: false,
  });

  const result: WalkedFile[] = [];
  for (const rel of files) {
    if (ig.ignores(rel)) continue;
    result.push({
      absolutePath: join(repoRoot, rel),
      relativePath: rel.replace(/\\/g, '/'),
    });
  }

  return result;
}
