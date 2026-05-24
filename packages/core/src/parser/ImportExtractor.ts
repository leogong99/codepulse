import Parser from 'tree-sitter';
import { resolve, dirname, extname } from 'path';
import type { ImportEdge } from '../types.js';

function resolveImportPath(source: string, fromFile: string): { toPath: string | null; toPackage: string | null } {
  if (source.startsWith('.')) {
    const dir = dirname(fromFile);
    let resolved = resolve(dir, source);
    // Add extension if missing
    if (!extname(resolved)) resolved += '.ts';
    return { toPath: resolved, toPackage: null };
  }
  // External package — extract package name
  const parts = source.split('/');
  const pkg = source.startsWith('@') ? parts.slice(0, 2).join('/') : parts[0];
  return { toPath: null, toPackage: pkg };
}

function walkForImports(
  node: Parser.SyntaxNode,
  filePath: string,
  fileId: number,
  language: string,
  edges: Omit<ImportEdge, 'id'>[],
  depth = 0,
): void {
  if (depth > 4) return;

  const type = node.type;

  // TypeScript/JavaScript: import_statement
  if (type === 'import_statement') {
    const sourceNode = node.children.find(c => c.type === 'string');
    if (sourceNode) {
      const raw = sourceNode.text.replace(/['"]/g, '');
      const { toPath, toPackage } = resolveImportPath(raw, filePath);
      const isTypeOnly = node.children.some(c => c.text === 'type');
      const names: string[] = [];
      const namedImports = node.children.find(c => c.type === 'import_clause');
      if (namedImports) {
        const named = namedImports.children.find(c => c.type === 'named_imports');
        if (named) {
          for (const spec of named.children) {
            if (spec.type === 'import_specifier') {
              const n = spec.childForFieldName('name');
              if (n) names.push(n.text);
            }
          }
        }
        if (names.length === 0) names.push('*');
      }
      edges.push({ fromFileId: fileId, fromPath: filePath, toPath, toPackage, importedNames: names, isTypeOnly });
    }
  }

  // Python: import_statement / import_from_statement
  if (language === 'python') {
    if (type === 'import_statement') {
      const name = node.children.find(c => c.type === 'dotted_name');
      if (name) {
        const mod = name.text.replace(/\./g, '/');
        edges.push({ fromFileId: fileId, fromPath: filePath, toPath: null, toPackage: mod, importedNames: ['*'], isTypeOnly: false });
      }
    }
    if (type === 'import_from_statement') {
      const mod = node.childForFieldName('module_name')?.text ?? '';
      const names: string[] = [];
      const nameList = node.children.find(c => c.type === 'import_from_as_names');
      if (nameList) {
        for (const c of nameList.children) {
          if (c.type === 'dotted_name') names.push(c.text);
        }
      }
      if (names.length === 0) names.push('*');
      const isRelative = mod.startsWith('.');
      const { toPath, toPackage } = isRelative ? resolveImportPath(mod, filePath) : { toPath: null, toPackage: mod };
      edges.push({ fromFileId: fileId, fromPath: filePath, toPath, toPackage, importedNames: names, isTypeOnly: false });
    }
  }

  // Go: import_spec
  if (language === 'go' && type === 'import_spec') {
    const pathNode = node.childForFieldName('path');
    if (pathNode) {
      const raw = pathNode.text.replace(/"/g, '');
      edges.push({ fromFileId: fileId, fromPath: filePath, toPath: null, toPackage: raw, importedNames: ['*'], isTypeOnly: false });
    }
  }

  // Rust: use_declaration
  if (language === 'rust' && type === 'use_declaration') {
    const arg = node.children.find(c => c.type !== 'use' && c.type !== ';');
    if (arg) {
      edges.push({ fromFileId: fileId, fromPath: filePath, toPath: null, toPackage: arg.text, importedNames: ['*'], isTypeOnly: false });
    }
  }

  for (const child of node.children) {
    walkForImports(child, filePath, fileId, language, edges, depth + 1);
  }
}

export function extractImports(
  tree: Parser.Tree,
  filePath: string,
  fileId: number,
  language: string,
): Omit<ImportEdge, 'id'>[] {
  const edges: Omit<ImportEdge, 'id'>[] = [];
  walkForImports(tree.rootNode, filePath, fileId, language, edges);
  return edges;
}
