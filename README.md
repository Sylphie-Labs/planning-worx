# planning-worx

Spec-driven planning for Claude Code. Start from a product vision, end with an
**atomic, traceable ticket list** — with one YAML file as the single source of
truth that the agent can't drift away from.

It works entirely inside a single interactive `claude` terminal session. No SDK,
no headless mode. You drive it with slash commands; hooks keep the plan honest.

## Why

When you build with an AI agent, drift, over-engineering, and under-engineering are
the same disease: ambiguity the agent fills with its own choices. planning-worx
removes the ambiguity up front and tracks every decision in a contract, then feeds
the agent only the lean slice it needs per task.

## Install

```bash
npx @sylphie-labs/planning-worx init
```

This installs (idempotently — safe to re-run to update):

- `.claude/planning-worx-plugin/` — the Claude plugin: commands, skills, an
  adversarial red-team agent, and contract-validation hooks.
- `planning/contract.yaml` — the master contract (never overwritten if it exists).
- `planning/contract.schema.json` — the contract's schema.
- `planning/vision.md` — your entry point (never overwritten if it exists).
- enables the plugin via two additive keys in `.claude/settings.json`.
- adds one marker-wrapped `@import` line to your `CLAUDE.md` (your content untouched).

## Use

1. Fill in `planning/vision.md` — the problem, the outcome, and a raw feature list.
2. Open `claude` in the repo (trust the folder / enable the plugin if prompted).
3. Walk the pipeline:

   | Command | Does |
   |---|---|
   | `/plan-constitution` | durable rules, incl. what NOT to build |
   | `/plan-vision` | ingest vision.md → vision, non-goals, constraints, feature list |
   | `/plan-clarify` | resolve every open question into a decision / deferral / non-goal |
   | `/plan-design` | tech stack + ADRs + epics (via the `plan-architect` agent) |
   | `/plan-tickets` | epics → atomic tickets, then red-teamed (via `plan-decomposer` + `plan-reviewer`) |
   | `/plan-analyze` | adversarial cross-artifact audit — find the holes before building |
   | `/plan-ticket <id>` | plan one ticket → task steps + the lean build briefing |
   | `/plan-reconcile [id]` | verify ticket statuses against the actual repo, fix drift, finish what's not done |
   | `/plan-status` | progress, next ready ticket, blockers |
   | `/plan-check` | validate the contract |

## How it stays honest (the enforcement layer)

Deterministic hooks do the work that prompts can't be trusted with:

- **PostToolUse** validates `contract.yaml` on every edit and hands schema errors
  back so the agent self-corrects.
- **PreToolUse** keeps `decisions` and `changelog` append-only (supersede, never edit).
- **SessionStart / PreCompact** re-inject the current stage + next ready ticket so the
  agent re-grounds after compaction instead of improvising.

The model owns the fuzzy work (decomposition, acceptance criteria, decisions); the
scripts own the math (validity, references, coverage, rollups).

## The contract in one breath

One self-similar `node` at every level (feature → epic → ticket → task; `kind` sets
the level; flat list with `parent` links). A central `governance` log tracks open
questions, assumptions, risks, deferrals, and append-only decisions — and models how
they convert into each other. Tickets must carry testable Given/When/Then acceptance
criteria. See `planning/contract.schema.json`.

## Publishing (maintainers)

Publishing uploads the package to the npm registry so anyone can
`npx @sylphie-labs/planning-worx init`.

Prerequisites: an npm account that is a member of the **@sylphie-labs** org (the
package is scoped to it).

```bash
# 1. Sanity-check the scripts are intact and tests pass
node --check payload/plugin/planning-worx/scripts/common.js
node --check payload/plugin/planning-worx/scripts/state_digest.js
npm test

# 2. Preview EXACTLY what will ship (the file list + tarball) without publishing
npm pack --dry-run

# 3. Bump the version (pick one); this also creates a git tag
npm version patch   # 0.1.0 -> 0.1.1   (or: minor / major)

# 4. Log in once, then publish (scoped packages need --access public)
npm login
npm publish --access public

# 5. Push the version commit + tag
git push --follow-tags
```

Notes:

- Only the files in package.json's `files` allowlist (`bin/`, `lib/`, `payload/`) plus
  `README`, `LICENSE`, and `package.json` are published. Use `npm pack --dry-run` to confirm.
- `npm publish` runs from your local working tree, so make sure it's the clean, correct
  copy before publishing.
- To release a preview without making it the default install, publish under a tag:
  `npm publish --tag beta --access public`, which users get via
  `npx @sylphie-labs/planning-worx@beta init`.
- To pull a broken release within 72 hours:
  `npm unpublish @sylphie-labs/planning-worx@<version>`.

## License

MIT.
