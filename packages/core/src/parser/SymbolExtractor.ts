import Parser from 'tree-sitter';
import type { CodeSymbol, SymbolKind } from '../types.js';
import { typescriptQueries, javascriptQueries } from './languages/typescript.js';
import { pythonQueries } from './languages/python.js';
import { goQueries } from './languages/go.js';
import { rustQueries } from './languages/rust.js';
import { javaQueries } from './languages/java.js';
import { cQueries, cppQueries } from './languages/c.js';
import { csharpQueries } from './languages/csharp.js';
import { rubyQueries } from './languages/ruby.js';
import { phpQueries } from './languages/php.js';
import { bashQueries } from './languages/bash.js';
import { kotlinQueries } from './languages/kotlin.js';
import { swiftQueries } from './languages/swift.js';

export interface LanguageQueries {
  symbols: string;
  imports: string;
}

const LANGUAGE_QUERIES: Record<string, LanguageQueries> = {
  typescript: typescriptQueries,
  javascript: javascriptQueries,
  python: pythonQueries,
  go: goQueries,
  rust: rustQueries,
  java: javaQueries,
  c: cQueries,
  cpp: cppQueries,
  csharp: csharpQueries,
  ruby: rubyQueries,
  php: phpQueries,
  bash: bashQueries,
  kotlin: kotlinQueries,
  swift: swiftQueries,
};

const KIND_DEFAULTS: Record<string, SymbolKind> = {
  function_definition: 'function',
  function_declaration: 'function',
  function_item: 'function',
  method_declaration: 'method',
  method_definition: 'method',
  class_declaration: 'class',
  class_definition: 'class',
  class_specifier: 'class',
  class_item: 'class',
  interface_declaration: 'interface',
  interface_item: 'interface',
  type_alias_declaration: 'type',
  type_item: 'type',
  type_definition: 'type',
  enum_declaration: 'enum',
  enum_item: 'enum',
  struct_item: 'class',
  struct_specifier: 'class',
  trait_item: 'interface',
  trait_declaration: 'interface',
  export_statement: 'variable',
  lexical_declaration: 'variable',
  var_declaration: 'variable',
  const_item: 'constant',
  const_declaration: 'constant',
};

function inferKind(node: Parser.SyntaxNode): SymbolKind {
  const type = node.type;
  if (KIND_DEFAULTS[type]) return KIND_DEFAULTS[type];
  for (const child of node.children) {
    if (KIND_DEFAULTS[child.type]) return KIND_DEFAULTS[child.type];
  }
  return 'variable';
}

function extractDocComment(node: Parser.SyntaxNode): string | null {
  const prev = node.previousNamedSibling;
  if (!prev) return null;
  const text = prev.text;
  if (text.startsWith('/**') || text.startsWith('///') || text.startsWith('#')) {
    const line = text.split('\n')[0].replace(/^[/*#\s]+/, '').trim();
    return line || null;
  }
  return null;
}

function extractSignature(node: Parser.SyntaxNode, name: string): string | null {
  const params = node.childForFieldName('parameters')
    ?? node.children.find(c => c.type === 'formal_parameters' || c.type === 'parameters');
  if (!params) return null;
  const retType = node.childForFieldName('return_type') ?? node.childForFieldName('type');
  const sig = retType ? `${params.text}: ${retType.text}` : params.text;
  return sig.length > 80 ? sig.slice(0, 77) + '...' : sig;
}

export function extractSymbols(
  tree: Parser.Tree,
  filePath: string,
  fileId: number,
  language: string,
  source: string,
): Omit<CodeSymbol, 'id'>[] {
  const queries = LANGUAGE_QUERIES[language];
  if (!queries) return [];

  const symbols: Omit<CodeSymbol, 'id'>[] = [];
  const lines = source.split('\n');
  const isExportedLang = ['typescript', 'javascript'].includes(language);

  // Simple AST walk for languages without explicit export syntax
  function walk(node: Parser.SyntaxNode, depth = 0): void {
    const nodeType = node.type;
    const nameNode = node.childForFieldName('name');

    if (nameNode && KIND_DEFAULTS[nodeType]) {
      const name = nameNode.text;
      // For TS/JS, only count if inside an export_statement
      const isExported = isExportedLang
        ? (node.parent?.type === 'export_statement' || node.parent?.type === 'export_default_declaration')
        : name.length > 0 && name[0] === name[0].toUpperCase();

      if (name && name.length > 0) {
        symbols.push({
          fileId,
          filePath,
          name,
          kind: inferKind(node),
          line: node.startPosition.row + 1,
          endLine: node.endPosition.row + 1,
          isExported,
          signature: extractSignature(node, name),
          docComment: extractDocComment(node),
          parentName: null,
        });
      }
    }

    for (const child of node.children) {
      if (depth < 6) walk(child, depth + 1);
    }
  }

  walk(tree.rootNode);
  return symbols;
}
