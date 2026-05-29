import { describe, it, expect } from 'vitest';
import { extractKeywords, scoreFile } from './TaskAnalyzer.js';
import type { CodeSymbol } from '../types.js';

const sym = (name: string, signature = '', docComment = ''): CodeSymbol => ({
  id: 1, fileId: 1, filePath: 'test.ts', name, kind: 'function',
  line: 1, endLine: 5, isExported: true,
  signature: signature || null,
  docComment: docComment || null,
  parentName: null,
});

describe('extractKeywords', () => {
  it('lowercases and splits on whitespace', () => {
    // 'fix' is a stopword and is filtered out
    expect(extractKeywords('Fix Login Bug')).toEqual(['login', 'bug']);
  });

  it('removes stopwords', () => {
    const kws = extractKeywords('how can i fix the login issue');
    expect(kws).not.toContain('how');
    expect(kws).not.toContain('the');
    expect(kws).toContain('login');
    expect(kws).toContain('issue');
  });

  it('splits on path separators and strips punctuation', () => {
    const kws = extractKeywords('auth/session.ts!');
    expect(kws).toContain('auth');
    expect(kws).toContain('session');
    expect(kws).not.toContain('ts'); // filtered — length 2
  });

  it('filters words shorter than 3 chars', () => {
    const kws = extractKeywords('fix it in db');
    expect(kws).not.toContain('it');
    expect(kws).not.toContain('in');
    expect(kws).not.toContain('db');
  });

  it('returns empty array for all-stopwords input', () => {
    expect(extractKeywords('how to fix the')).toEqual([]);
  });
});

describe('scoreFile', () => {
  it('returns 0 when no keywords', () => {
    expect(scoreFile('src/auth.ts', [], [])).toBe(0);
  });

  it('scores +3 for keyword in file path', () => {
    expect(scoreFile('src/auth/login.ts', [], ['auth'])).toBe(3);
  });

  it('scores +2 for keyword in summary', () => {
    expect(scoreFile('src/util.ts', [], ['auth'], 'exports:AuthService(class)')).toBe(2);
  });

  it('scores +2 for keyword matching symbol name', () => {
    expect(scoreFile('src/util.ts', [sym('validateAuth')], ['auth'])).toBe(2);
  });

  it('scores +1 for keyword in signature', () => {
    expect(scoreFile('src/util.ts', [sym('doThing', '(authToken: string)')], ['auth'])).toBe(1);
  });

  it('accumulates score across multiple matches', () => {
    // path: +3, symbol name: +2 = 5
    const score = scoreFile('src/auth.ts', [sym('validateAuth')], ['auth']);
    expect(score).toBe(5);
  });

  it('ranks auth file higher than unrelated file for auth task', () => {
    const authScore = scoreFile('src/auth/login.ts', [sym('validateToken')], ['auth', 'login']);
    const utilScore = scoreFile('src/utils/format.ts', [sym('formatDate')], ['auth', 'login']);
    expect(authScore).toBeGreaterThan(utilScore);
  });
});
