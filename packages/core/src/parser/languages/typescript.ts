import type { LanguageQueries } from '../SymbolExtractor.js';

export const typescriptQueries: LanguageQueries = {
  symbols: `
    (export_statement
      (function_declaration name: (identifier) @name) @node
      (#set! kind "function"))

    (export_statement
      (class_declaration name: (type_identifier) @name) @node
      (#set! kind "class"))

    (export_statement
      (interface_declaration name: (type_identifier) @name) @node
      (#set! kind "interface"))

    (export_statement
      (type_alias_declaration name: (type_identifier) @name) @node
      (#set! kind "type"))

    (export_statement
      (enum_declaration name: (identifier) @name) @node
      (#set! kind "enum"))

    (export_statement
      (lexical_declaration
        (variable_declarator name: (identifier) @name)) @node
      (#set! kind "variable"))

    (export_statement
      declaration: (function_declaration name: (identifier) @name) @node
      (#set! kind "function"))

    (export_default_declaration
      (function_declaration name: (identifier) @name) @node
      (#set! kind "function"))

    (export_default_declaration
      (class_declaration name: (type_identifier) @name) @node
      (#set! kind "class"))
  `,
  imports: `
    (import_statement
      source: (string (string_fragment) @source)
      (import_clause
        (named_imports
          (import_specifier name: (identifier) @specifier)))) @node

    (import_statement
      source: (string (string_fragment) @source)) @node
  `,
};

export const javascriptQueries = typescriptQueries;
