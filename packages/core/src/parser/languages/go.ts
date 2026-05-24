import type { LanguageQueries } from '../SymbolExtractor.js';

export const goQueries: LanguageQueries = {
  symbols: `
    (function_declaration name: (identifier) @name) @node

    (method_declaration name: (field_identifier) @name) @node

    (type_declaration
      (type_spec name: (type_identifier) @name)) @node

    (var_declaration
      (var_spec name: (identifier) @name)) @node

    (const_declaration
      (const_spec name: (identifier) @name)) @node
  `,
  imports: `
    (import_spec path: (interpreted_string_literal) @source) @node
  `,
};
