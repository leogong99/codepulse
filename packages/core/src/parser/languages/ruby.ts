import type { LanguageQueries } from '../SymbolExtractor.js';

export const rubyQueries: LanguageQueries = {
  symbols: `
    (method name: (identifier) @name) @node

    (singleton_method name: (identifier) @name) @node

    (class name: (constant) @name) @node

    (module name: (constant) @name) @node
  `,
  imports: `
    (call
      method: (identifier) @method
      arguments: (argument_list (string (string_content) @source))
      (#match? @method "^(require|require_relative|load)$")) @node
  `,
};
