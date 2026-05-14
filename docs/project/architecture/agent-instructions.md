Status: Active
Owner: SaltMarcher Team
Last Reviewed: 2026-05-11
Source of Truth: Governance for agent instruction surfaces, the mandatory
global instruction skill, and ownership boundaries between instruction
artifacts.

# Agent Instruction Standard

## Goal

SaltMarcher treats agent-facing instructions as governed engineering artifacts.
Changes to those artifacts must use the global `agent-instruction-engineering`
skill and must preserve a single canonical owner for each instruction topic.

## Covered Surfaces

This standard applies to Markdown artifacts whose primary purpose is to steer
Codex or other agents:

- `AGENTS.md`
- any `SKILL.md`
- architecture standards or other rule docs that directly define agent behavior
- narrow prompt or workflow markdown that is primarily for agent execution

The surface also includes `agents/openai.yaml`, but only as derived interface
metadata that must stay consistent with the governing skill.

This standard does not apply to ordinary feature specs, UI docs, persistence
docs, or ADRs unless those files are themselves defining agent behavior.

## Mandatory Skill

The global skill is:

- source path:
  `/home/aaron/.codex/skills/local/agent-instruction-engineering/`

Any work on covered surfaces must use that skill first.

- The global copy is the canonical skill source.
- If the harness does not auto-discover global skills, read and apply the
  global `SKILL.md` directly before editing covered artifacts.
- The governing workflow lives in the global `SKILL.md`.
- `agents/openai.yaml` must not become a second source of truth for workflow.

## Specialist Review Repertoire

SaltMarcher uses the global review specialists as reusable review repertoire
instead of copying them into the repository. These skills are optional
specialist lenses that can accompany the mandatory repo-owned
`adversarial-review`; they do not replace it, create new gates, or change the
verification route required by `AGENTS.md`.

- Use `/home/aaron/.codex/skills/local/claude-agents/review-performance/`
  when a change touches hot paths, rendering, startup, storage or network I/O,
  data volume, caching, threading, memory behavior, or other performance-risk
  surfaces.
- Use `/home/aaron/.codex/skills/local/claude-agents/review-quality/` when a
  change needs a code-level maintainability review for smells, accidental
  complexity, duplication, naming, readability, or unnecessary indirection.
- Use `/home/aaron/.codex/skills/local/claude-agents/review-architecture/`
  when a change touches dependency direction, layer boundaries, public APIs,
  data ownership, persistence shape, cross-cutting mechanisms, or architectural
  pattern drift.

Do not create repo-local copies of these global review skills unless the user
explicitly asks for a SaltMarcher-owned fork with separate maintenance
responsibility.

## Verification Path

- Covered Markdown-only instruction changes that stay inside the documentation
  gate scope use `./gradlew checkDocumentationEnforcement --console=plain`.
- Covered changes that also touch non-Markdown code, Gradle, build logic, or
  non-covered surfaces still follow the broader verification path owned by
  `AGENTS.md` and the quality-platform standards.
- `agents/openai.yaml` is governed by this standard but is not itself part of
  the Markdown-focused documentation gate scope.

## Ownership Rules

- `AGENTS.md` owns project-wide norms only.
- `AGENTS.md` must stay an early router: it names mandatory triggers,
  canonical owners, and repo-specific verification surfaces, but it must not
  become a glossary, feature spec, migration plan, or second copy of a layer
  standard.
- `SKILL.md` owns reusable agent workflow and trigger logic for one skill.
- `docs/project/<type>/*.md` own reusable project-wide rules for one
  topic.
- Other instruction markdown may exist only when the topic is narrower than a
  reusable standard or skill.

If multiple covered surfaces start repeating the same rule, move the rule to
the lowest stable canonical owner and replace the others with short summaries or
links.

## Review Rules

When a covered artifact changes, reviewers must check:

- Was the global instruction skill used?
- Does the edited file still own the right topic?
- Did a neighboring instruction source also require an update?
- Does `agents/openai.yaml` still match the governing skill?
- Did the change introduce duplicate or conflicting truth across covered
  surfaces?
- Does the chosen verification path match the actual changed surfaces?
- Did any specialist review skill used for the pass remain a read-only review
  lens instead of becoming a competing repo-owned workflow?

Covered instruction changes also follow the repo-wide adversarial review route
in `AGENTS.md`. The repo-owned
`tools/quality/skills/adversarial-review/SKILL.md` owns the mandatory review
protocol. This standard adds only the instruction-specific review questions
above.

## References

- [Architecture Overview](/home/aaron/Schreibtisch/projects/SaltMarcher/docs/project/architecture/overview.md:1)
- [Documentation Standard](/home/aaron/Schreibtisch/projects/SaltMarcher/docs/project/architecture/documentation.md:1)
- [Agent Context Standard](/home/aaron/Schreibtisch/projects/SaltMarcher/docs/project/architecture/agent-context.md:1)
- [Layering Architecture Standard](/home/aaron/Schreibtisch/projects/SaltMarcher/docs/project/architecture/patterns/layering-architecture.md:1)
- [Global Agent Instruction Engineering Skill](/home/aaron/.codex/skills/local/agent-instruction-engineering/SKILL.md:1)
- [Adversarial Review Skill](/home/aaron/Schreibtisch/projects/SaltMarcher/tools/quality/skills/adversarial-review/SKILL.md:1)
- [Global Performance Review Skill](/home/aaron/.codex/skills/local/claude-agents/review-performance/SKILL.md:1)
- [Global Code Quality Review Skill](/home/aaron/.codex/skills/local/claude-agents/review-quality/SKILL.md:1)
- [Global Architecture Review Skill](/home/aaron/.codex/skills/local/claude-agents/review-architecture/SKILL.md:1)
