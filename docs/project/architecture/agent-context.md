Status: Active
Owner: SaltMarcher Team
Last Reviewed: 2026-07-04
Source of Truth: Context hygiene expectations for SaltMarcher agents.

# Agent Context

## Purpose

Agents should use the smallest current context that can support the decision.
Nearby files are candidates, not authority, until owner docs or source evidence
prove them.

## Rules

- Start from the current user request and touched surface.
- Read the nearest owner doc and mandatory skill before editing.
- Classify evidence as owner-proven, evidence-proven, candidate, or suspect.
- Keep repeated workflow in `AGENTS.md`, owner docs, and `SKILL.md` files
  instead of copying it into new prose.
- Search `docs/project/journal/` for bug, regression, refactor, governance, or
  repeated-fix history before planning a related change.
- After resume, interruption, or user correction, refresh the user request,
  dirty paths, and owner boundary before tracked edits.

## References

- [Agent Guide](../../../AGENTS.md)
- [Agent Instruction Standard](agent-instructions.md)
- [Work Logs](work-logs.md)
