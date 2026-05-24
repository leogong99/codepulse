import type { LanguageQueries } from '../SymbolExtractor.js';

export const pythonQueries: LanguageQueries = {
  symbols: `
    (function_definition name: (identifier) @name) @node

    (class_definition name: (identifier) @name) @node

    (expression_statement
      (assignment
        left: (identifier) @name)) @node
  `,
  imports: `
    (import_statement
      name: (dotted_name) @source) @node

    (import_from_statement
      module_name: (dotted_name) @source
      name: (import_from_as_names
        (dotted_name) @specifier)) @node

    (import_from_statement
      module_name: (dotted_name) @source) @node
  `,
};
