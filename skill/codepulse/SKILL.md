---
name: codepulse
description: >
  Injects a compact, token-efficient codebase index into the current conversation.
  Use at the start of any session to give Claude instant structural awareness of
  the repository — file map, exported symbols, and import relationships — without
  manually scanning files. Powered by a persistent, git-diff-aware SQLite index.
user_invocable: true
args: args
argument-hint: "[--budget <tokens>] [--focus <path>] [--format markdown|xml]"
---

# CodePulse Context Injection

Runs `codepulse context` and injects the output directly into this conversation.

## Execution

```bash
# Auto-init if no index exists, then emit context
if [ ! -f .codepulse/index.db ]; then
  codepulse init
fi
codepulse context {{args}}
```

## Arguments

| Argument | Default | Description |
|---|---|---|
| `--budget N` | 4000 | Token budget for the context snapshot |
| `--focus path` | none | Prioritize a specific file or directory |
| `--format markdown\|xml` | xml | Output format |

## Output

The command emits a structured context block:

```
<codebase_context>
  <repo_overview>repo name, file/symbol counts, language breakdown</repo_overview>
  <directory_map>top-level directories with file counts</directory_map>
  <symbol_table>exported functions, classes, types grouped by file</symbol_table>
  <import_graph>most-imported modules</import_graph>
</codebase_context>
```

Treat this as ground truth for repo structure. Do **not** re-explore files already
covered in the symbol table — navigate directly to the file you need.

## Tips

- `/codepulse --budget 8000` — larger budget for bigger repos
- `/codepulse --focus src/auth` — deep detail on one subsystem  
- `/codepulse --format markdown` — human-readable output
- Run `codepulse update` after large commits to keep the index fresh

## Always-on injection (opt-in for teams)

Add to `.claude/settings.json` to auto-inject on every session start:

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
