# planning-worx — Master Build List

The complete set of skills, commands, subagents, hooks, scripts, and data files
to build the vision: a framework that takes a product vision down to an atomic,
high-fidelity ticket list, with one YAML contract as the single source of truth.

**This is a feature/asset list, not code.** Each item below is a Claude Code
primitive composed against the right planning condition. Nothing here has been
built yet — this is the plan for the plan.

---

## Operating constraint (read first)

Everything runs inside **one interactive `claude` session in a terminal**. No
Agent SDK, no `claude -p`, no headless or multi-process orchestration. Concretely
that means:

- The **pipeline is user-driven**: you advance it by typing slash commands in the
  session. Stages do not auto-chain behind your back.
- **Subagents are fine** — they're spawned by the single main agent via its Task
  tool and run inside the same session. They are not separate `claude` processes.
- **Hooks are local shell scripts** the one instance fires on events (validate,
  gate, re-ground). They are deterministic and need no AI.
- **State lives in files** (the contract + schema), because that's the only
  channel all primitives share. No external queue or daemon.

---

## The fidelity principle: push enforcement down to deterministic checks

The single biggest lever for high fidelity is to make as much as possible
**deterministic** (shell scripts run by hooks) rather than leaving it to the
model. AI proposes; scripts dispose. Validation, referential integrity, coverage,
append-only protection, and rollups are all math — they belong in hooks/scripts,
not in a prompt. The model's job is the irreducibly fuzzy part: decomposition,
writing acceptance criteria, naming decisions.

---

## A. Data contract (the source of truth — files)

| Asset | Format | Purpose |
|---|---|---|
| `planning/contract.yaml` | YAML | The master contract. Recursive `nodes` (project→feature→epic→ticket→task) + a central `governance` log + meta envelope. Mutable state lives here. |
| `planning/contract.schema.json` | JSON Schema | Validatable definition of the contract: recursive node via `$ref`, `kind` discriminator with `if/then` per-level required fields, `governance_item` types. The contract's law. |
| `planning/vision.md` | Markdown | The human entry point. Product vision + raw feature list. Input to the ingest stage. |
| `planning/.state.json` | JSON (generated) | Tiny derived digest (current stage, next ready ticket, open blockers, rollups). Written by scripts, read by re-grounding hooks. Never hand-edited. |

---

## B. Slash commands — the pipeline (user-invoked, explicit, re-runnable)

Each is a `SKILL.md`/command the user types. Each **reads the whole contract,
writes only its own section, idempotently** (keyed by stable IDs — re-running
updates in place, never duplicates). The gate after each is enforced by a hook
(Section E), not by trust.

| Command | Reads | Writes | Gate before it can "complete" |
|---|---|---|---|
| `/plan:init` | — | scaffolds contract.yaml, schema, vision.md, CLAUDE.md | none |
| `/plan:constitution` | vision | `constitution[]` (durable principles, what NOT to build) | none (foundational) |
| `/plan:vision` (ingest) | vision, constitution | `vision{}`, `features[]`, `requirements[]` (EARS/testable) | ambiguity gate: no requirement lacks acceptance criteria |
| `/plan:clarify` | requirements | resolves `governance` open_questions; patches requirements | resolution gate: zero unresolved *blocking* open_questions |
| `/plan:design` (→ subagent) | requirements, constitution | `tech_stack[]`, `design{}`, `decisions[]` (ADRs) | consistency gate: every requirement maps to ≥1 design element |
| `/plan:tickets` (→ subagent) | requirements, design | `epics[]` → `tickets[]` (atomic) | coverage gate: every ticket carries `requirement_ids`; every requirement has ≥1 ticket |
| `/plan:analyze` (→ subagent) | everything | `analysis_report` only (read-only) | quality gate: no CRITICAL findings; constitution not violated |
| `/plan:ticket <id>` | one ticket | expands that ticket → atomic `task` children (same schema) | readiness gate: ticket passes the atomicity predicate |
| `/plan:status` | everything | — (prints rollups + next ready ticket) | none |
| `/plan:check` | everything | — (runs full validator, prints report) | none |

`/plan:ticket <id>` is the **dogfood of "same schema for ingestion and ticket
plans"**: it runs the same decomposition engine, one zoom level down, writing
`task` nodes into the same file. That expansion *is* the lean briefing you hand
the agent to actually build.

---

## C. Skills — model-invoked guidance (auto-loaded by description)

These are not pipeline stages; they're the reusable know-how the commands and the
agent pull in automatically when relevant. Each stays small (token cost every turn).

| Skill | Triggers when… | Provides |
|---|---|---|
| `schema-reference` | any contract read/write | the node + governance schema, field meanings, enums — so edits stay valid |
| `atomicity-gate` | writing/validating tickets | the computable "is this ticket atomic & ready?" predicate (INVEST + vertical slice + testable AC + no live deps + bounded scope) |
| `story-splitter` | a ticket fails the atomicity gate | SPIDR + Lawrence patterns; the meta-rule "find the core complexity, reduce variations to one" |
| `governance-lifecycle` | adding/resolving an open question, risk, assumption | the conversion edges (open_question→decision/deferral/non_goal; assumption→risk→issue) and required fields |
| `briefing-builder` | about to implement a ticket | derives the lean slice (one ticket + AC + non_goals + constraints + relevant decisions) — keeps the agent under the compliance cliff |

---

## D. Subagents — isolated heavy lifting (spawned by the main agent via Task tool)

Used only where fresh context genuinely helps, so their large intermediate
reasoning doesn't pollute the planner's window.

| Subagent | Invoked by | Why isolated | Returns |
|---|---|---|---|
| `plan-architect` | `/plan:design` | design reasoning shouldn't leak implementation bias into the planner | tech_stack + design + draft ADRs |
| `plan-decomposer` | `/plan:tickets`, `/plan:ticket` | decomposition is verbose; isolate it; can fan out per epic | atomic tickets/tasks with deps + requirement_ids |
| `plan-reviewer` | `/plan:analyze` | adversarial fresh-context review catches drift the author can't see | CRITICAL→LOW findings: coverage gaps, constitution violations, inconsistencies |

---

## E. Hooks — the enforcement layer (deterministic, fire automatically)

This is what makes the contract *trustworthy* rather than aspirational. All use
the correct protocol: **exit 2 blocks** (exit 1 is a silent no-op — never use it
for a gate); stdout on `SessionStart`/`UserPromptSubmit`/`PreCompact` injects
context.

| Hook event | Matcher | Action | Condition enforced |
|---|---|---|---|
| **PostToolUse** | `Edit\|Write` on contract.yaml | run `validate` script; on failure return `decision: block` with the schema errors | contract is **always schema-valid**; agent self-corrects from the fed-back errors |
| **PreToolUse** | `Edit\|Write` on contract.yaml | run `append-guard`; block edits that rewrite/delete `decisions[]` or `changelog[]` entries | **append-only history**: accepted ADRs & changelog are immutable (supersede, don't edit) |
| **Stop** | — | run stage-gate check for the active stage; block stop until its exit criteria pass (guarded by `stop_hook_active` to avoid loops) | you **cannot end a stage** with its gate unmet (e.g. a ticket with no requirement_ids) |
| **SessionStart** | `compact` | echo current stage + open gates + constitution invariants from `.state.json` | agent **re-grounds after compaction** instead of improvising |
| **PreCompact** | `*` | inject a directive to preserve contract invariants + open decisions verbatim | the plan **survives the lossy summary** |
| **UserPromptSubmit** | — | inject a *tiny* digest: current stage, next ready ticket, blocking open_questions | every turn starts **re-anchored to the contract**, not the chat |

Guardrails baked in (from the hook research): keep command hooks fast; send
diagnostics to stderr (stray stdout corrupts the JSON); add a `Stop`-hook
`git status` scan so files written via Bash don't dodge the `Edit|Write` matcher;
always honor `stop_hook_active`.

---

## F. Scripts — deterministic engine (called by hooks and `/plan:check`)

Plain shell/Python, no AI. The math the model shouldn't be trusted to do.

| Script | Does | Used by |
|---|---|---|
| `validate` | JSON-Schema-validate the contract; check ID uniqueness, parent refs resolve, status enums, coverage (every ticket has requirement_ids) | PostToolUse hook, `/plan:check` |
| `rollup` | compute parent %/status from leaf nodes; write `.state.json` | after any write, `/plan:status` |
| `append-guard` | diff proposed edit against existing `decisions[]`/`changelog[]`; block if prior lines removed/altered | PreToolUse hook |
| `state-digest` | emit the tiny current-stage / next-ready-ticket / blockers summary | SessionStart, UserPromptSubmit, PreCompact hooks |
| `gate-check` | given a stage, assert its exit criteria; exit 2 + reason if unmet | Stop hook |

---

## G. CLAUDE.md — the lean always-on rules (kept under the compliance cliff)

Short, hard-worded, critical-first. Not a dumping ground — the rich detail lives
in the contract; this file just points at it and sets the non-negotiables:

- The contract is the **single source of truth**. Re-read it before acting. It
  wins over chat history.
- On any change of direction: **update the contract, then re-sync** — never let
  the conversation become the record.
- `decisions[]` and `changelog[]` are **append-only**. Supersede, never edit.
- Do the **simplest thing** that satisfies the acceptance criteria. Respect
  `non_goals`, `constraints`, and `complexity_budget`. NEVER add unrequested scope.
- A ticket isn't done until its acceptance criteria **pass a runnable check**.

---

## H. Packaging — how it installs (npm now, plugin-ready)

| Asset | Purpose |
|---|---|
| `package.json` + `bin/cli.js` | `npx planning-worx init` scaffolds the framework into a repo (contract, schema, vision, CLAUDE.md, `.claude/` skills + agents + hooks). Zero runtime deps. |
| `.claude-plugin/plugin.json` | bundles the skills + subagents + commands + hooks so the same assets install as a Claude Code plugin (`/plugin install`) with no manual settings edits. |
| `marketplace.json` | optional distribution entry so others can `/plugin marketplace add`. |
| `README.md` | quickstart: write `vision.md` → `/plan:vision` → `/plan:clarify` → … → atomic backlog. |

The repo dogfoods itself: planning-worx's own `planning/contract.yaml` is built
with these commands, and is the canonical worked example.

---

## Condition → primitive (the cheat sheet)

| Planning condition to guarantee | Built with |
|---|---|
| One source of truth, always valid | contract.yaml + schema + **PostToolUse validate hook** |
| History can't be quietly rewritten | append-only `decisions`/`changelog` + **PreToolUse append-guard** |
| Agent never drifts after compaction | **SessionStart(compact) + PreCompact** re-ground hooks + `.state.json` |
| Every turn anchored to the plan | **UserPromptSubmit** digest hook |
| Can't finish a stage with its gate unmet | **Stop hook** + `gate-check` |
| No invented scope in decomposition | coverage gate (`requirement_ids`) enforced by hook + `plan-reviewer` |
| Tickets are genuinely atomic & ready | `atomicity-gate` skill + readiness predicate at the `/plan:ticket` gate |
| Over-engineering held back | `non_goals`/`constraints`/`engineering_level`/`complexity_budget` fields + lean CLAUDE.md |
| Heavy reasoning doesn't pollute the planner | `plan-architect` / `plan-decomposer` / `plan-reviewer` **subagents** |
| Same schema for master plan and ticket plans | recursive `node` + `kind`; `/plan:ticket` reuses the decomposer |
| Agent only sees what it needs | `briefing-builder` skill (lean slice) |

---

## Still open before building (from research-log.yaml)

These forks shape several assets above and aren't settled yet: OD1 ID scheme,
OD2 single-file vs file-per-ticket, OD3 gate hardness, OD4 node typing, OD5
governance placement (inline vs central), OD6 decompose up-front vs as-needed,
OD7 package shape. The list above reflects my current leanings; resolving these
finalizes the schema and a couple of the hooks.
