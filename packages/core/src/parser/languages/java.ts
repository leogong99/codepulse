import type { LanguageQueries } from '../SymbolExtractor.js';

export const javaQueries: LanguageQueries = {
  symbols: `
    (class_declaration name: (identifier) @name) @node

    (interface_declaration name: (identifier) @name) @node

    (enum_declaration name: (identifier) @name) @node

    (method_declaration name: (identifier) @name) @node

    (field_declaration
      declarator: (variable_declarator name: (identifier) @name)) @node
  `,
  imports: `
    (import_declaration (scoped_identifier) @source) @node
  `,
};
