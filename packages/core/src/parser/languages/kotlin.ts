import type { LanguageQueries } from '../SymbolExtractor.js';

export const kotlinQueries: LanguageQueries = {
  symbols: `
    (function_declaration (simple_identifier) @name) @node

    (class_declaration (type_identifier) @name) @node

    (object_declaration (type_identifier) @name) @node

    (interface_declaration (type_identifier) @name) @node
  `,
  imports: `
    (import_header (identifier) @source) @node
  `,
};
