# Instruction Anti-Patterns

Use this list when reviewing agent-facing instruction artifacts.

## Ownership Anti-Patterns

- One file tries to own both project-wide governance and feature-local rules.
- A summary silently becomes the canonical source.
- `openai.yaml` contains workflow rules that no longer exist in `SKILL.md`.

## Prompt-Quality Anti-Patterns

- Checklist masquerading as expertise.
- Repeated reminders that waste attention budget.
- Conflicting rules like "be concise" and "be exhaustive" without a priority.
- Generic style language that never says when the instruction applies.
- Negative-only guidance with no positive operational default.

## Skill Anti-Patterns

- Trigger conditions buried in the body instead of the frontmatter description.
- Reference files that contain the real workflow while `SKILL.md` stays vague.
- Skills that try to govern too many unrelated artifact types without a routing
  step.
- Example-heavy skills that never explain the governing heuristics.

## Governance Anti-Patterns

- Making a rule "mandatory" without naming the covered surfaces.
- Introducing a repo workflow that has no install or discovery path.
- Adding enforcement language that depends on a gate the repo does not run.
- Updating one instruction file without checking neighboring sources of truth.
