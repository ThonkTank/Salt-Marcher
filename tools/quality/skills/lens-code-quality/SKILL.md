---
name: lens-code-quality
description: Reviews SaltMarcher diffs for correctness, simplicity, maintainability, smells, structure, conventions, and review evidence quality. Use as the independent Reviewer lens for every M/L implementation review.
---

# Lens: Code Quality

## Contract

Review evidence, not intent. Read the diff, relevant owner docs, and proof
logs before deciding. Report only findings that are actionable, supported by a
path and line, and material to the requested change.

Use verdicts from `docs/project/architecture/agent-instructions.md`:
`Approve`, `Rework`, `Blocked`, or `Proof Refresh Required`.

## Checklist

- Correctness: Does the code satisfy the requested behavior and preserve
  existing invariants?
- Simplicity: Is there avoidable abstraction, indirection, configuration, or
  branching?
- Smells: Look for duplication, temporal coupling, mixed responsibilities,
  hidden global state, unclear ownership, and repeated local fixes.
- Structure: Are files, names, and boundaries discoverable? Is related logic
  colocated without becoming a dumping ground?
- Conventions: Does the change follow established repo patterns and owner
  documents?
- Tests and proof: Is the proof command relevant and fresh for the diff? If a
  tracked file changed after proof, return `Proof Refresh Required`.
- Residuals: Are supported findings fixed, explicitly excluded by the user, or
  named as a blocker or scoped GitHub issue when they are not proportional to
  the current objective?

## Finding Format

Use this shape:

```text
[severity] file:line - Finding title
Evidence and impact. Required correction or blocked question.
```

Severity is `blocker`, `major`, or `minor`. Do not pad the review with
positive observations. If there are no findings, say so and name any residual
test or proof risk.

## References

- [Agent Instruction Standard](../../../../docs/project/architecture/agent-instructions.md)
