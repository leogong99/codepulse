---
name: codepulse
description: >
  Injects a compact, token-efficient codebase index into the current conversation.
  Use at the start of any session to give Claude instant structural awareness of
  the repository — file map, exported symbols, and import relationships — without
  manually scanning files. Powered by a persistent, git-diff-aware SQLite index.
user_invocable: true
args: args
argument-hint: "[--task <description>] [--focus <path>] [--budget <tokens>] [--format markdown|xml]"
---

# CodePulse Context Injection

Runs `codepulse context` and injects the output directly into this conversation.

## Execution

```bash
# Auto-init if no index exists
if [ ! -f .codepulse/index.db ]; then
  codepulse init
fi

# Emit context with auto-scaled budget and task-aware ranking
codepulse context --auto {{args}}
```

The `--auto` flag scales the token budget to repo size and skips injection entirely
for tiny repos (< 10 files) where the AI can navigate without help.

## Arguments

| Argument | Default | Description |
|---|---|---|
| `--task "description"` | none | Rank files relevant to this task first |
| `--focus path` | none | Prioritize a specific file or directory |
| `--budget N` | auto | Override auto-scaled token budget |
| `--format markdown\|xml` | xml | Output format |

## How token savings work

| Repo size | Without CodePulse | With `--auto` | Saved |
|---|---|---|---|
| < 10 files | — | skipped (0 tokens) | 100% |
| 10–30 files | ~8,000 | ~800 tokens | ~90% |
| 30–150 files | ~25,000 | ~2,000 tokens | ~92% |
| 150+ files | ~60,000 | ~4,000 tokens | ~93% |

With `--task`, the most relevant files are ranked first within the budget — so even
at 800 tokens the AI sees the files it actually needs instead of the largest ones.

## Examples

```
/codepulse --task "fix the auth login bug"
/codepulse --task "add dark mode to the settings page"
/codepulse --focus src/auth --task "refactor session handling"
/codepulse --budget 8000   # manual override for a very large repo
/codepulse --format markdown
```

## Output

The command emits a structured context block:

```
<codebase_context>
  <repo_overview>repo name, file/symbol counts, language breakdown</repo_overview>
  <directory_map>top-level directories with file counts</directory_map>
  <symbol_table>exported functions, classes, types — ranked by task relevance</symbol_table>
  <import_graph>most-imported modules</import_graph>
</codebase_context>
```

Treat this as ground truth for repo structure. Do **not** re-explore files already
covered in the symbol table — navigate directly to the file you need.

## Always-on injection (opt-in)

Add to `.claude/settings.json` to auto-inject on every session:

```json
{
  "hooks": {
    "PreToolUse": [{
      "matcher": ".*",
      "hooks": [{ "type": "command", "command": "codepulse context --auto --format xml" }]
    }]
  }
}
```
