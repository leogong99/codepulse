import type { LanguageQueries } from '../SymbolExtractor.js';

export const phpQueries: LanguageQueries = {
  symbols: `
    (function_definition name: (name) @name) @node

    (class_declaration name: (name) @name) @node

    (interface_declaration name: (name) @name) @node

    (trait_declaration name: (name) @name) @node

    (enum_declaration name: (name) @name) @node

    (method_declaration name: (name) @name) @node
  `,
  imports: `
    (namespace_use_declaration
      (namespace_use_clause (qualified_name) @source)) @node

    (require_expression (string (string_value) @source)) @node
    (include_expression (string (string_value) @source)) @node
  `,
};
