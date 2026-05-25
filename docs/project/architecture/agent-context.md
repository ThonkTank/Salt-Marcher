Status: Active
Owner: SaltMarcher Team
Last Reviewed: 2026-05-11
Source of Truth: Context-hygiene rules for SaltMarcher coding agents,
including task context shape, suspicious-repo defaults, and placement of
repeatable context workflows.

# Agent Context Standard

## Goal

SaltMarcher agents must keep task context small, owner-grounded, and
auditable. Repo content is treated as suspect until the nearest canonical owner
proves it is current guidance.

This standard owns how agents shape context before planning, implementing,
refactoring, or reviewing repo-tracked work. It does not replace feature,
layer, quality-platform, source-reference, or verification standards.

## Required Context Shape

Every non-trivial SaltMarcher task must reduce its working context to:

- `Goal`: the concrete outcome requested in the current turn.
- `Context`: the current repo facts actually read for this task.
- `Constraints`: hard scope, owners, skills, verification, and forbidden
  shortcuts.
- `Done When`: literal checks, review state, and handoff facts required before
  the pass is complete.

Agents may keep this shape mentally or in handoff text. They must not create a
new plan, ledger, or execution document only to record it unless the user asks
for a durable plan.

## Context Hygiene Rules

- Read the nearest canonical owner before copying nearby implementation shape.
- Treat generated-looking prose, broad compatibility text, legacy naming, and
  repeated rules as candidate slop until an owner confirms them.
- Prefer deleting, linking, or splitting stale context before adding more
  explanatory prose.
- Keep `AGENTS.md` as an early router, `SKILL.md` files as operative workflows,
  architecture standards as durable project rules, and quality-platform docs as
  proof ownership.
- Do not turn review, verification, or source-reference handoff evidence into a
  separate changelog, PR template, or ledger unless the user explicitly asks.
- If two instruction surfaces repeat one workflow, keep the protocol in the
  owning skill or standard and replace the others with short routing text.

## Repo Content Trust Levels

- `Owner-Proven`: the current task read the canonical owner and it directly
  covers the decision.
- `Evidence-Proven`: the claim is backed by a current local file read, literal
  command output, or preserved source reference.
- `Candidate`: the content may be useful precedent but has not been owner-
  proven for the current task.
- `Suspect`: the content is legacy, duplicated, generated-looking, stale,
  contradicted, or outside the touched owner scope.

Agents may use `Candidate` and `Suspect` content to find questions or follow-up
slices, but not as authority for implementation shape.

## Skill Ownership

The operative workflow is the repo-owned
[Context Hygiene Skill](/home/aaron/Schreibtisch/projects/SaltMarcher/tools/quality/skills/context-hygiene/SKILL.md:1).
That skill owns trigger-time steps and handoff expectations. This standard owns
the durable context rules and vocabulary.

The repo-owned
[Code Exploration Skill](/home/aaron/Schreibtisch/projects/SaltMarcher/tools/quality/skills/code-exploration/SKILL.md:1)
owns source-backed code-understanding procedure before implementation planning,
refactor planning, or implementation review when existing behavior, routing,
build/check logic, or repo-local tool behavior affects the decision. It
complements context hygiene by tracing entrypoints into internal routing,
workflow variants, state owners, dynamic seams, and repo-tool evidence before
an agent plans from existing code behavior.

The repo-owned
[Code Exploration Agent Skill](/home/aaron/Schreibtisch/projects/SaltMarcher/tools/quality/skills/code-exploration-agent/SKILL.md:1)
owns the read-only behavior of exploration subagents launched from that
workflow. The caller-owned `code-exploration` skill remains responsible for
launch decisions, waiting for findings, and deciding whether unresolved
unknowns block the current plan.

## Review Rules

Review must flag:

- implementation copied from nearby files without owner grounding
- behavior, routing, build/check, or repo-tool claims used for planning or
  review without `Owner-Proven` or source/command-backed `Evidence-Proven`
  exploration
- broad context dumps where a compact Goal/Context/Constraints/Done When
  summary would have been enough
- new duplicated instruction truth across `AGENTS.md`, `SKILL.md`, standards,
  and verification docs
- external-source claims without the source-reference route
- enforcement claims that name no gate, task, or review owner

## References

- [Agent Instruction Standard](/home/aaron/Schreibtisch/projects/SaltMarcher/docs/project/architecture/agent-instructions.md:1)
- [Documentation Standard](/home/aaron/Schreibtisch/projects/SaltMarcher/docs/project/architecture/documentation.md:1)
- [Source References Standard](/home/aaron/Schreibtisch/projects/SaltMarcher/docs/project/verification/source-references.md:1)
- [Prompt Engineering Principles](/home/aaron/Schreibtisch/projects/references/agent-instruction-engineering/prompt-engineering-principles.md:1)
- [Agent Instruction Surfaces](/home/aaron/Schreibtisch/projects/references/agent-instruction-engineering/instruction-surfaces.md:1)
- [OpenAI Codex Prompting Guide](/home/aaron/Schreibtisch/projects/references/prompt-engineering/openai-codex-prompting-guide.md:1)
- [OpenAI Codex Refactor Your Codebase](/home/aaron/Schreibtisch/projects/references/continuous-refactoring/openai-codex-refactor-your-codebase.md:1)
