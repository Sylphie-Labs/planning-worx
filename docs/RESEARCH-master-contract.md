# Research: The Master Planning Contract for AI-Assisted Builds

*Synthesis of deep research, June 2026. Sources at the end.*

## The one-sentence finding

Every proven system converges on the same idea: **make a single, versioned, structured spec — not the code and not the chat — the source of truth, and write down everything the agent would otherwise have to decide.** Drift, over-engineering, and under-engineering are all symptoms of one root cause: the agent filling ambiguity with its own choices. The cure is to leave less ambiguity, tracked in one file.

## Why this matters with AI (the root cause)

Anthropic states it plainly: agent quality degrades as the context window fills, and the model starts "forgetting" earlier instructions. Three failure modes follow, and all three are well-documented in 2025–2026 practitioner writing:

- **Drift** — output variance that compounds silently across runs; worst right after context compaction, which compresses away your careful instructions.
- **Over-engineering** — agents optimize for "looking comprehensive": 1,000 lines where 100 would do, a logging *framework* when you asked for one log line. The top four agent failure modes are silent assumptions, overbuilt code, unintended edits, and scope creep.
- **Under-engineering** — vague criteria ("it should work well") let the agent cut corners that become technical debt.

The fix that every source repeats: a persistent spec file that is re-loaded every session and re-fed when you change direction, so truth lives in the file, not in a conversation that gets truncated.

## The proven anti-drift stack (what works)

1. **One versioned spec as source of truth.** Spec-driven development (GitHub Spec Kit, AWS Kiro, the SDD community) treats the spec as a living, executable contract that the code is derived from. When direction changes, you update the spec and explicitly re-sync the agent — you never let chat history become the real record.
2. **Plan, then execute.** Anthropic's loop is Explore → Plan → Implement → Commit, planning in read-only mode before any code. Separating planning from coding stops the agent from "solving the wrong problem."
3. **Small, independently verifiable units.** Each task is sized for one agent invocation and carries a *runnable* check — "looks done" is not done.
4. **Spec the negative space.** "Out of scope" is treated as a first-class field, as important as in-scope. This is the single biggest guard against over-engineering.
5. **Testable acceptance criteria** (EARS or Given/When/Then). The guard against under-engineering — if it isn't testable, it doesn't count.
6. **A lean rules file with hard-worded constraints.** "MUST" / "NEVER," critical rules first. But there is a hard **compliance cliff**: past ~12–15 rules / ~200 lines, agents start ignoring the rules file.
7. **Adversarial review against the plan.** A fresh-context subagent diffs the work against the spec and reports gaps — correctness/scope only, not style.
8. **Traceability.** Every requirement links forward to design → code → test and up to its epic/vision. This is the single most valuable cross-cutting feature — it turns separate sections into one auditable graph.

## The key tension — and how to resolve it

Jim's instinct ("the more we track, the better — less room for decisions") is correct, **but** it collides with the compliance cliff: a giant rules blob makes the agent obey *fewer* rules, not more. The "curse of instructions" — piling on directives degrades adherence to each one — is documented across GPT-4 and Claude.

**Resolution — separate the database from the briefing:**

- The **master contract YAML is the database.** Track everything in it — richly, exhaustively. It is read/written by tooling, not dumped wholesale at the agent.
- For any given task, tooling derives a **lean briefing**: just the one ticket, its acceptance criteria, its non-goals, its constraints, and the relevant decisions. That stays under the cliff.

So: track maximally in the file, feed minimally to the agent per task. This gives Jim what he wants ("the more we track the better") without breaking the model that has to act on it.

A second resolution that recurs in the sources: **separate the mutable current-state from the immutable history inside the same file.** Statuses and progress change; decisions and the changelog are append-only (you supersede an ADR, you never edit it). That split is what makes the file a trustworthy living record rather than a lossy snapshot.

## Recommended master contract schema

The eight frameworks studied (Spec Kit, Kiro, RFCs, ADRs, traceability matrices, Gherkin, story mapping, OpenAPI) decompose into a consistent layered schema. Concretely:

```yaml
# ========== META (slow-changing) ==========
meta:
  schema_version: "1.0"
  project_id: planning-worx
  title: "..."
  status: planning            # planning | building | shipped | paused
  created_at: 2026-06-15
  updated_at: 2026-06-15
  source_of_truth: true       # this file wins over trackers/chat

# ========== INTENT (the "why", kept separate from the "how") ==========
vision:
  problem: "..."
  outcome: "..."
  measurable_goals: ["...", "..."]
  target_users: ["...", "..."]

# ========== GUARDRAILS (what removes agent decisions) ==========
principles:        # the "constitution" — durable rules, incl. what NOT to build
  - "MUST do the simplest thing that satisfies the acceptance criteria."
  - "NEVER add a dependency without an ADR."
non_goals:         # negative space — the #1 over-engineering guard
  - "No multi-tenant support in v1."
constraints:       # technical/business limits
  - "Runs offline; no external API calls in core path."

# ========== TECH STACK ==========
tech_stack:
  - name: "..."
    version: "..."
    rationale: "..."
    decision_ref: ADR-002      # traceability into decisions

# ========== DECISIONS (append-only ADR log — never edit, supersede) ==========
decisions:
  - id: ADR-001
    date: 2026-06-15
    status: accepted           # proposed | accepted | superseded
    context: "..."
    decision: "We will ..."
    consequences: "..."
    alternatives: ["..."]
    supersedes: null

# ========== HIERARCHY (vision → features → epics → tickets → POCs) ==========
features:
  - id: FEAT-1
    title: "..."
    priority: P1               # P1=MVP, P2, P3
    status: todo
    epic_refs: [EP-1]

epics:
  - id: EP-1
    title: "..."
    feature_ref: FEAT-1
    intent: "..."
    priority: P1
    status: in_progress
    acceptance_criteria: ["..."]

tickets:
  - id: TK-12
    title: "..."
    epic_ref: EP-1
    status: in_progress        # backlog | todo | in_progress | blocked | done | canceled
    priority: P1
    estimate: M                # S | M | L  (or points)
    engineering_level: mvp     # prototype | mvp | production | regulated  (right-sizes the build)
    complexity_budget: "<=150 LOC; stop and ask after 3 failed attempts"
    acceptance_criteria:       # testable — Given/When/Then or EARS
      - given: "..."
        when: "..."
        then: "..."
    non_goals: ["..."]         # per-ticket negative space
    depends_on: [TK-9]
    blocks: [TK-15]
    design_refs: ["docs/design/x.md"]   # traceability →
    code_refs: ["src/x.ts"]
    test_refs: ["tests/x.test.ts"]
    poc_ref: POC-3
    created_at: 2026-06-15
    updated_at: 2026-06-15

pocs:
  - id: POC-3
    ticket_ref: TK-12
    question: "Can we do X within the latency budget?"   # what we're de-risking
    hypothesis: "..."
    status: open               # open | proven | disproven
    result: null
    decision_ref: null         # feeds back into decisions[] when resolved

# ========== GOVERNANCE ==========
open_questions:
  - id: Q-1
    question: "..."
    blocks: [TK-12]
    status: open               # open | resolved
    resolution: null
risks:
  - id: R-1
    risk: "..."
    impact: high
    likelihood: medium
    mitigation: "..."

# ========== AUDIT TRAIL (append-only) ==========
changelog:
  - date: 2026-06-15
    version: "1.0"
    change: "Contract generated from vision doc."
```

### Why each unusual field earns its place

- `non_goals` (global + per-ticket) — the most-cited over-engineering guard; "out of scope is as important as in scope."
- `engineering_level` — lets you right-size: a throwaway prototype and a regulated module shouldn't get the same rigor. Sets the bar explicitly instead of leaving it to the agent.
- `complexity_budget` — caps the over-work spiral (the "debug for 20 iterations / 100K tokens" failure); forces the agent to stop and surface an impasse.
- `acceptance_criteria` as Given/When/Then — the under-engineering guard and the `test_refs` end of the traceability chain.
- `*_refs` (design/code/test/epic/poc) — bi-directional traceability; the connective tissue that makes the whole file one graph.
- `decisions` append-only with `supersedes` — the "why," preserved; distinct from mutable current-state.
- `status` enum with categories — proven Linear/Spec-Kit model; categories enable automatic % rollups (ticket → epic → feature → project).

## How the single command should work

Two viable shapes for "one command builds the contract from the vision doc":

- **A. CLI scaffold** — `npx planning-worx init` reads `vision.md` and writes a skeleton `project.plan.yaml` with the structure above (sections present, hierarchy empty), ready to fill. Deterministic, no AI needed.
- **B. AI decomposition** — the command (or a Claude slash command like `/plan:build`) reads `vision.md` and *expands* it: vision → feature list → tech stack → epics → tickets → POC candidates, written into the YAML. This is where the real value is, and it's the spec-driven workflow Kit/Kiro use (specify → plan → tasks).

Recommended: **both, layered.** The npm package installs the framework (schema + JSON Schema validator + Claude commands + a lean `CLAUDE.md` rules file). `init` scaffolds; a `/plan:build` Claude command does the AI decomposition into the contract; later commands (`/plan:epics`, `/plan:tickets`, `/plan:poc`) drive the chain. A validator keeps the file schema-valid so it stays trustworthy as the source of truth.

## Sources

- Anthropic — Best practices for Claude Code: https://www.anthropic.com/engineering/claude-code-best-practices
- Anthropic — Effective context engineering for AI agents: https://www.anthropic.com/engineering/effective-context-engineering-for-ai-agents
- amattn — Using AGENTS.md/CLAUDE.md to counteract agent drift: https://amattn.com/p/using_agentsmd_or_claudemd_to_counteract_agent_drift.html
- Addy Osmani — How to write a good spec for AI agents: https://addyosmani.com/blog/good-spec/
- Addy Osmani — The 80% problem in agentic coding: https://addyo.substack.com/p/the-80-problem-in-agentic-coding
- O'Reilly / Osmani — How to write a good spec for AI agents: https://www.oreilly.com/radar/how-to-write-a-good-spec-for-ai-agents/
- GitHub — How to write a great AGENTS.md (2,500+ repos): https://github.blog/ai-and-ml/github-copilot/how-to-write-a-great-agents-md-lessons-from-over-2500-repositories/
- GitHub — Spec-driven development with AI (Spec Kit): https://github.blog/ai-and-ml/generative-ai/spec-driven-development-with-ai-get-started-with-a-new-open-source-toolkit/
- GitHub Spec Kit tasks template: https://github.com/github/spec-kit/blob/main/templates/tasks-template.md
- thebcms — Spec-Driven Development: The Definitive 2026 Guide: https://thebcms.com/blog/spec-driven-development
- dev.to/rams901 — CLAUDE.md Rules: cut AI coding mistakes from 40% to 3%: https://dev.to/rams901/claudemd-rules-how-to-cut-ai-coding-mistakes-from-40-to-3-in-2026-2j7o
- AWS Kiro — Specs docs: https://kiro.dev/docs/specs/
- ADR — Architecture Decision Records: https://adr.github.io/
- intent-driven.dev — SDD with ADR: https://intent-driven.dev/blog/2026/04/29/spec-driven-development-with-adr/
- Linear — conceptual model & workflows: https://linear.app/docs/conceptual-model , https://linear.app/docs/configuring-workflows
- MindStudio — Context rot in AI coding agents: https://www.mindstudio.ai/blog/context-rot-ai-coding-agents-how-to-prevent
- TestRail — Requirements traceability matrix: https://www.testrail.com/blog/requirements-traceability-matrix/
- TestQuality — Gherkin acceptance criteria: https://testquality.com/how-to-write-effective-gherkin-acceptance-criteria/
- StoriesOnBoard — User story mapping: https://storiesonboard.com/user-story-mapping-basics.html
- OpenAPI Specification v3.1.0: https://spec.openapis.org/oas/v3.1.0.html
