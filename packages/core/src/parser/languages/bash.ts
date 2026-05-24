import type { LanguageQueries } from '../SymbolExtractor.js';

export const bashQueries: LanguageQueries = {
  symbols: `
    (function_definition name: (word) @name) @node
  `,
  imports: `
    (command
      name: (command_name (word) @cmd)
      argument: (word) @source
      (#match? @cmd "^(source|\\.)$")) @node
  `,
};
