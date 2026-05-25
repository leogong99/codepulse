# CodePulse

**Token-efficient codebase indexing for AI coding tools.**

AI assistants waste 60–80% of their token budget exploring your repo on every new conversation. CodePulse maintains a persistent, git-diff-aware index and injects a compact snapshot — repo structure, exported symbols, import graph — at session start.

Works with Claude Code (skill), OpenAI Codex CLI (pipe or `AGENTS.md`), Cursor/Continue.dev (MCP server), and any tool that can consume CLI output.

---

## Token Savings

Without CodePulse, an AI assistant typically reads 10–30 files per session just to understand your repo before it can help. With CodePulse, it gets a pre-built snapshot instead — no exploration needed.

| Repo Size | Without CodePulse | With CodePulse | Saved |
|---|---|---|---|
| Small (< 5k lines) | ~8,000 tokens | ~2,000 tokens | ~75% |
| Medium (5k–50k lines) | ~25,000 tokens | ~4,000 tokens | ~84% |
| Large (50k+ lines) | ~60,000 tokens | ~8,000 tokens | ~87% |

> Estimates based on typical file-read patterns. Actual savings vary by repo structure and session type. Use `codepulse context --budget` to tune the snapshot size.

At current API pricing (Claude Sonnet ~$3/MTok input), saving 20,000 tokens per session adds up fast across a team:

| Sessions/day | Tokens saved/day | Monthly savings (per developer) |
|---|---|---|
| 5 | 100,000 | ~$9 |
| 20 | 400,000 | ~$36 |
| 50 | 1,000,000 | ~$90 |

Beyond cost, fewer tokens spent on exploration means faster responses and more of the context window available for actual work.

---

## Quick Start

```bash
npm install -g @aicodepulse/cli

# In your repo: build the index (one-time)
codepulse init

# Emit context into any AI session
codepulse context

# Keep it fresh after commits
codepulse update
```

In Claude Code: install the skill, then type `/codepulse` at the start of a session.

---

## How to Use

There are three ways to use CodePulse depending on your AI tool. Pick the one that fits your workflow.

### Option 1 — CLI (any AI tool)

Install and index your repo:

```bash
npm install -g @aicodepulse/cli
cd your-project
codepulse init
```

Pipe context into any AI session:

```bash
codepulse context --format markdown
```

Keep the index up to date:

```bash
codepulse update        # incremental (fast)
codepulse watch         # auto-update on file changes
```

### Option 2 — Claude Code Skill

1. Copy `skill/codepulse/` into your project's `.claude/skills/` directory
2. Run `codepulse init` in your repo once
3. Type `/codepulse` at the start of any Claude Code session — it injects a fresh context snapshot automatically

For always-on injection without typing the command, add this to `.claude/settings.json`:

```json
{
  "hooks": {
    "PreToolUse": [{
      "matcher": ".*",
      "hooks": [{ "type": "command", "command": "codepulse context --format xml" }]
    }]
  }
}
```

### Option 3 — MCP Server (Cursor, Continue.dev, etc.)

Install the MCP package:

```bash
npm install -g @aicodepulse/cli @aicodepulse/mcp
cd your-project && codepulse init
```

Add to your MCP config (e.g. `.cursor/mcp.json`):

```json
{
  "codepulse": {
    "command": "codepulse-mcp",
    "args": []
  }
}
```

The MCP server exposes three tools your AI editor can call on demand:
- `get_context(budget_tokens, focus_path?)` — full context snapshot
- `search_symbols(query)` — find exported symbols by name
- `get_file_summary(path)` — symbols, imports, and importers for one file

---

## Commands

| Command | Description |
|---|---|
| `codepulse init` | Build the initial full index |
| `codepulse update` | Incremental update (git-diff-aware) |
| `codepulse update --full` | Force full re-index |
| `codepulse context` | Emit context snapshot (default: 4000 tokens, XML) |
| `codepulse context --budget 8000` | Larger budget for bigger repos |
| `codepulse context --focus src/auth` | Deep detail on one subsystem |
| `codepulse context --format markdown` | Human-readable output |
| `codepulse stats` | Show index stats |
| `codepulse watch` | Auto-update on file changes |

---

## Supported Languages

JavaScript, TypeScript, Python, Go, Rust, Java, C, C++, C#, Ruby, PHP, Bash, Kotlin, Swift

---

## Claude Code Skill

Copy `skill/codepulse/` into your project's `.claude/skills/` directory, then use `/codepulse` in any Claude Code session.

**Always-on injection (opt-in):** Add to `.claude/settings.json`:

```json
{
  "hooks": {
    "PreToolUse": [{
      "matcher": ".*",
      "hooks": [{ "type": "command", "command": "codepulse context --format xml" }]
    }]
  }
}
```

---

## OpenAI Codex CLI

Codex CLI supports an `AGENTS.md` file for project-level instructions and can read context piped into it via stdin.

**Option 1 — Pipe context directly into a prompt:**

```bash
codepulse context --format markdown | codex "refactor the auth module"
```

**Option 2 — Inject into `AGENTS.md` at session start:**

Add a setup script to your repo (e.g. `scripts/codex-init.sh`):

```bash
#!/usr/bin/env bash
# Regenerate AGENTS.md with a fresh CodePulse snapshot before each Codex session
cat > AGENTS.md << 'HEADER'
# Project Context (auto-generated by CodePulse)
HEADER
codepulse context --format markdown >> AGENTS.md
```

Run it before starting Codex:

```bash
bash scripts/codex-init.sh && codex
```

Codex will pick up `AGENTS.md` automatically on startup, giving it instant structural awareness without exploring the repo itself.

**Option 3 — Always-on via shell alias:**

```bash
# Add to ~/.zshrc or ~/.bashrc
alias codex='(codepulse update --full 2>/dev/null; codepulse context --format markdown > /tmp/cp-context.md); codex --context /tmp/cp-context.md'
```

> Note: `--context` flag availability depends on your Codex CLI version. Check `codex --help` for the exact flag name.

---

## MCP Server (Cursor, Continue.dev, etc.)

Add to your MCP config:

```json
{
  "codepulse": {
    "command": "codepulse-mcp",
    "args": []
  }
}
```

Tools available:
- `get_context(budget_tokens, focus_path?)` — full context snapshot
- `search_symbols(query)` — find exported symbols by name
- `get_file_summary(path)` — symbols, imports, and importers for one file

---

## How It Works

1. **Index:** Tree-Sitter parses all source files, extracting exported symbols and import edges into a SQLite database (`.codepulse/index.db`)
2. **Update:** On each `update`, only files changed since the last indexed git commit are re-parsed — a 50k-line repo updates in milliseconds
3. **Context:** Given a token budget, a layered generator fills it from most to least important: repo overview → directory map → symbol table → import graph

The index is stored per-repo (not globally) so each project has its own isolated snapshot.

---

## Packages

| Package | Description |
|---|---|
| `@aicodepulse/core` | Indexer engine (Tree-Sitter, SQLite, context generator) |
| `@aicodepulse/cli` | `codepulse` CLI |
| `@aicodepulse/mcp` | `codepulse-mcp` MCP server |

---

## License

MIT
