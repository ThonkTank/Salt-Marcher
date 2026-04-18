Status: Active
Owner: SaltMarcher Team
Last Reviewed: 2026-04-18
Source of Truth: Governance for repo-owned agent instruction surfaces, the
mandatory SaltMarcher instruction skill, and ownership boundaries between
instruction artifacts.

# Agent Instruction Standard

## Goal

SaltMarcher treats agent-facing instructions as governed engineering artifacts.
Changes to those artifacts must use the repo-owned `agent-instruction-engineering`
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

The repo-owned skill is:

- source path:
  `tools/quality/skills/agent-instruction-engineering/`

Any work on covered surfaces must use that skill first.

- The repository copy is the canonical skill source.
- If the harness does not auto-discover repo-local skills, read and apply the
  repo-owned `SKILL.md` directly before editing covered artifacts.
- The governing workflow lives in the repo-owned `SKILL.md`.
- `agents/openai.yaml` must not become a second source of truth for workflow.

## Ownership Rules

- `AGENTS.md` owns project-wide norms only.
- `SKILL.md` owns reusable agent workflow and trigger logic for one skill.
- `docs/architecture/standards/*.md` own reusable project-wide rules for one
  topic.
- Other instruction markdown may exist only when the topic is narrower than a
  reusable standard or skill.

If multiple covered surfaces start repeating the same rule, move the rule to
the lowest stable canonical owner and replace the others with short summaries or
links.

## Review Rules

When a covered artifact changes, reviewers must check:

- Was the repo-owned instruction skill used?
- Does the edited file still own the right topic?
- Did a neighboring instruction source also require an update?
- Does `agents/openai.yaml` still match the governing skill?
- Did the change introduce duplicate or conflicting truth across covered
  surfaces?

## References

- [Architecture Overview](/home/aaron/Schreibtisch/projects/SaltMarcher/docs/architecture/overview.md:1)
- [Documentation Standard](/home/aaron/Schreibtisch/projects/SaltMarcher/docs/architecture/standards/documentation.md:1)
- [Repository Structure Standard](/home/aaron/Schreibtisch/projects/SaltMarcher/docs/architecture/standards/repository-structure.md:1)
- [Agent Instruction Engineering Skill](/home/aaron/Schreibtisch/projects/SaltMarcher/tools/quality/skills/agent-instruction-engineering/SKILL.md:1)
