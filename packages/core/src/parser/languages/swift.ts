import type { LanguageQueries } from '../SymbolExtractor.js';

export const swiftQueries: LanguageQueries = {
  symbols: `
    (function_declaration name: (simple_identifier) @name) @node

    (class_declaration name: (type_identifier) @name) @node

    (struct_declaration name: (type_identifier) @name) @node

    (enum_declaration name: (type_identifier) @name) @node

    (protocol_declaration name: (type_identifier) @name) @node

    (typealias_declaration name: (type_identifier) @name) @node
  `,
  imports: `
    (import_declaration (identifier) @source) @node
  `,
};
