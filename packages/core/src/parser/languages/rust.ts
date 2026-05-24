import type { LanguageQueries } from '../SymbolExtractor.js';

export const rustQueries: LanguageQueries = {
  symbols: `
    (function_item name: (identifier) @name) @node

    (struct_item name: (type_identifier) @name) @node

    (enum_item name: (type_identifier) @name) @node

    (trait_item name: (type_identifier) @name) @node

    (impl_item type: (type_identifier) @name) @node

    (type_item name: (type_identifier) @name) @node

    (const_item name: (identifier) @name) @node
  `,
  imports: `
    (use_declaration
      argument: (scoped_identifier path: (identifier) @source)) @node

    (extern_crate_declaration name: (identifier) @source) @node
  `,
};
