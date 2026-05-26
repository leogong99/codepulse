# CLAUDE.md

This file provides guidance to Claude Code (claude.ai/code) when working with code in this repository.

## Commands

```bash
# Build all packages
npm run build

# Build and watch (per package)
cd packages/core && npm run dev
cd packages/cli && npm run dev

# Run tests
npm test

# Run a single test file
npx vitest run packages/core/src/context/TaskAnalyzer.test.ts

# Link CLI globally for local testing
cd packages/cli && npm link

# Publish all packages (requires npm token)
cd packages/core && npm publish --access public
cd packages/cli && npm publish --access public
cd packages/mcp && npm publish --access public
```

## Architecture

This is an npm workspace monorepo with three packages:

- **`packages/core`** — indexer engine and context generator (no CLI/MCP concerns)
- **`packages/cli`** — wraps core into `codepulse` CLI commands
- **`packages/mcp`** — wraps core into an MCP server exposing 3 tools

### Core data flow

**Indexing:** `Indexer` → `FileWalker` (glob + .gitignore) → `ParserRegistry` (Tree-Sitter grammars) → `SymbolExtractor` + `ImportExtractor` → SQLite via `FileRepository` / `SymbolRepository`

**Context generation:** `generateContext()` in `ContextGenerator.ts` → `allocateBudget()` distributes token budget across 5 layers → each layer queries SQLite and truncates to its token allocation → XML or Markdown output

**Incremental updates:** `GitDiff.getChangedFiles()` compares last indexed commit to HEAD → only changed files are re-parsed

### Context layers (budget weights)

| Layer | Default weight | Source |
|---|---|---|
| `repo_overview` | 10% | `index_meta` + language stats |
| `directory_map` | 20% | all active file paths |
| `symbol_table` | 45% | exported symbols, ranked by task relevance |
| `import_graph` | 15% | top imported files by importer count |
| `focus` | 10% | deep detail on a specific path (only when `--focus` set) |

Surplus tokens from underfull layers carry forward to later layers.

### Task-aware ranking

`TaskAnalyzer.ts` extracts keywords from `--task` descriptions and scores files via `scoreFile()` (path match = +3, symbol name match = +2, signature/doc match = +1). `SymbolTableLayer` sorts files by score descending before filling the budget — most relevant files always appear first.

### Auto-budget thresholds

Controlled in `ContextGenerator.ts`:
- `< 10 files` → skip entirely (returns `skipped: true`)
- `10–29 files` → 800 tokens
- `30–149 files` → 2,000 tokens
- `≥ 150 files` → 4,000 tokens

### SQLite schema

Four tables: `index_meta` (key-value), `file_records`, `symbols`, `import_edges`. Native modules `better-sqlite3` and `tree-sitter` are **external** in all tsup configs — they must remain as runtime dependencies and cannot be bundled.

### Build notes

All packages build to ESM only (`format: ['esm']`). The `packages/cli` tsup config marks `@aicodepulse/core`, `tree-sitter`, and all `tree-sitter-*` packages as external. Same for `packages/mcp`. The `packages/core` tsup config marks `better-sqlite3`, `tree-sitter`, and `tree-sitter-*` as external.

### Skill

`skill/codepulse/SKILL.md` is the Claude Code skill. It runs `codepulse context --auto {{args}}` — `--auto` is always on by default so tiny repos are skipped automatically.
