import type { DB } from './Database.js';
import type { CodeSymbol, ImportEdge } from '../types.js';

function rowToSymbol(row: Record<string, unknown>): CodeSymbol {
  return {
    id: row.id as number,
    fileId: row.file_id as number,
    filePath: row.file_path as string,
    name: row.name as string,
    kind: row.kind as CodeSymbol['kind'],
    line: row.line as number,
    endLine: row.end_line as number,
    isExported: Boolean(row.is_exported),
    signature: row.signature as string | null,
    docComment: row.doc_comment as string | null,
    parentName: row.parent_name as string | null,
  };
}

function rowToImport(row: Record<string, unknown>): ImportEdge {
  return {
    id: row.id as number,
    fromFileId: row.from_file_id as number,
    fromPath: row.from_path as string,
    toPath: row.to_path as string | null,
    toPackage: row.to_package as string | null,
    importedNames: JSON.parse(row.imported_names as string),
    isTypeOnly: Boolean(row.is_type_only),
  };
}

export class SymbolRepository {
  constructor(private db: DB) {}

  insertSymbols(fileId: number, symbols: Omit<CodeSymbol, 'id'>[]): void {
    const stmt = this.db.prepare(`
      INSERT INTO symbols (file_id, file_path, name, kind, line, end_line, is_exported, signature, doc_comment, parent_name)
      VALUES (@fileId, @filePath, @name, @kind, @line, @endLine, @isExported, @signature, @docComment, @parentName)
    `);
    for (const s of symbols) {
      stmt.run({
        fileId: s.fileId,
        filePath: s.filePath,
        name: s.name,
        kind: s.kind,
        line: s.line,
        endLine: s.endLine,
        isExported: s.isExported ? 1 : 0,
        signature: s.signature,
        docComment: s.docComment,
        parentName: s.parentName,
      });
    }
  }

  insertImports(fileId: number, edges: Omit<ImportEdge, 'id'>[]): void {
    const stmt = this.db.prepare(`
      INSERT INTO import_edges (from_file_id, from_path, to_path, to_package, imported_names, is_type_only)
      VALUES (@fromFileId, @fromPath, @toPath, @toPackage, @importedNames, @isTypeOnly)
    `);
    for (const e of edges) {
      stmt.run({
        fromFileId: e.fromFileId,
        fromPath: e.fromPath,
        toPath: e.toPath,
        toPackage: e.toPackage,
        importedNames: JSON.stringify(e.importedNames),
        isTypeOnly: e.isTypeOnly ? 1 : 0,
      });
    }
  }

  deleteByFileId(fileId: number): void {
    this.db.prepare('DELETE FROM symbols WHERE file_id = ?').run(fileId);
    this.db.prepare('DELETE FROM import_edges WHERE from_file_id = ?').run(fileId);
  }

  getExportedByFile(filePath: string): CodeSymbol[] {
    const rows = this.db.prepare(
      'SELECT * FROM symbols WHERE file_path = ? AND is_exported = 1 ORDER BY line'
    ).all(filePath) as Record<string, unknown>[];
    return rows.map(rowToSymbol);
  }

  getAllExported(): CodeSymbol[] {
    const rows = this.db.prepare(
      'SELECT * FROM symbols WHERE is_exported = 1 ORDER BY file_path, line'
    ).all() as Record<string, unknown>[];
    return rows.map(rowToSymbol);
  }

  search(query: string, limit = 20): CodeSymbol[] {
    const rows = this.db.prepare(
      'SELECT * FROM symbols WHERE name LIKE ? AND is_exported = 1 LIMIT ?'
    ).all(`%${query}%`, limit) as Record<string, unknown>[];
    return rows.map(rowToSymbol);
  }

  getImportsFrom(filePath: string): ImportEdge[] {
    const rows = this.db.prepare(
      'SELECT * FROM import_edges WHERE from_path = ?'
    ).all(filePath) as Record<string, unknown>[];
    return rows.map(rowToImport);
  }

  getImportersOf(filePath: string): string[] {
    const rows = this.db.prepare(
      'SELECT DISTINCT from_path FROM import_edges WHERE to_path = ?'
    ).all(filePath) as { from_path: string }[];
    return rows.map(r => r.from_path);
  }

  getTopImportedFiles(limit = 20): { path: string; importerCount: number }[] {
    return this.db.prepare(`
      SELECT to_path as path, COUNT(*) as importerCount
      FROM import_edges WHERE to_path IS NOT NULL
      GROUP BY to_path ORDER BY importerCount DESC LIMIT ?
    `).all(limit) as { path: string; importerCount: number }[];
  }
}
