---
description: package.json scripts naming — colons only for parallel/sequential groups
globs: **/package.json
alwaysApply: false
---

# package.json script names

Use `:` only for **step scripts** that belong to a group run via `bun run --parallel` or `bun run --sequential` with a glob (`<group>:*`).

## Verify scripts

| Script | Role |
| --- | --- |
| `check` | finish-work — `--parallel type-check lint format test-run knip-warn` |
| `check-ci` | Read-only CI — `--parallel type-check lint-check format-check test-run` |
| `check-pre-push` | husky — parallel leaves |

Full scaffold: tech-stack skill → `references/package-json-scripts.md`.
