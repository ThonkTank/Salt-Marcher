Status: Active
Owner: SaltMarcher Team
Last Reviewed: 2026-07-04
Source of Truth: Transient implementation logs, review logs, and committed
journal entries for SaltMarcher work.

# Work Logs

## Transient Logs

Transient logs live in `build/agent-pass-logs/`. They are local operational
evidence, are not committed, and must not redefine requirements, contracts,
architecture, domain truth, or verification policy.

Use these names:

- `YYYY-MM-DD-<slug>-implementation.md`
- `YYYY-MM-DD-<slug>-review.md`

## Implementation Log Template

```markdown
# Implementation: <slug>

## Goal
## Tier
## Write Set
## Plan
## Changes
## Worker Proof
## Final Proof
## Blockers
```

For M and L work, `Plan` records 5-15 lines: goal, write set, proof command,
and risks. `Worker Proof` and `Final Proof` include literal command and result.
The Verification Runner writes or supplies the final proof result when that role
is used.

## Review Log Template

```markdown
# Review: <slug>

## Verdict
## Findings
## Lenses Applied
## Proof Checked
```

Findings use id, severity, `file:line`, and description. `Proof Checked` names
the proof path or command and whether it is fresh for the reviewed diff.

## Journal

Committed journal entries live in `docs/project/journal/YYYY-MM.md`. The
journal is append-only with newest entries last.

Entry format:

```markdown
## YYYY-MM-DD <slug> - <one-line summary>
```

Follow the heading with 3-15 lines. Mandatory journal triggers are:

- L-tier design notes
- incidents such as broken main, reverted merge, or governance/check bypass
- repeated fixes to the same surface two or more times in 30 days
- debt closures
- harness gaps

Nothing else is mandatory.

Before bug, regression, or refactor work on a surface, search the journal with
`rg <surface|symptom> docs/project/journal/` and read any hits. This replaces
older generated-log history intake.

## References

- [Agent Instruction Standard](agent-instructions.md)
- [Documentation Standard](documentation.md)
