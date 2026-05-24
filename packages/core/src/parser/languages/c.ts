import type { LanguageQueries } from '../SymbolExtractor.js';

export const cQueries: LanguageQueries = {
  symbols: `
    (function_definition
      declarator: (function_declarator
        declarator: (identifier) @name)) @node

    (declaration
      declarator: (function_declarator
        declarator: (identifier) @name)) @node

    (struct_specifier name: (type_identifier) @name) @node

    (enum_specifier name: (type_identifier) @name) @node

    (type_definition
      declarator: (type_identifier) @name) @node
  `,
  imports: `
    (preproc_include path: (string_literal) @source) @node
    (preproc_include path: (system_lib_string) @source) @node
  `,
};

export const cppQueries: LanguageQueries = {
  symbols: `
    (function_definition
      declarator: (function_declarator
        declarator: (identifier) @name)) @node

    (function_definition
      declarator: (function_declarator
        declarator: (qualified_identifier name: (identifier) @name))) @node

    (class_specifier name: (type_identifier) @name) @node

    (struct_specifier name: (type_identifier) @name) @node

    (enum_specifier name: (type_identifier) @name) @node

    (namespace_definition name: (identifier) @name) @node
  `,
  imports: `
    (preproc_include path: (string_literal) @source) @node
    (preproc_include path: (system_lib_string) @source) @node
  `,
};
