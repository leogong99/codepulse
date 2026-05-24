import type { LanguageQueries } from '../SymbolExtractor.js';

export const csharpQueries: LanguageQueries = {
  symbols: `
    (class_declaration name: (identifier) @name) @node

    (interface_declaration name: (identifier) @name) @node

    (enum_declaration name: (identifier) @name) @node

    (struct_declaration name: (identifier) @name) @node

    (method_declaration name: (identifier) @name) @node

    (property_declaration name: (identifier) @name) @node

    (record_declaration name: (identifier) @name) @node
  `,
  imports: `
    (using_directive (qualified_name) @source) @node
    (using_directive (identifier) @source) @node
  `,
};
