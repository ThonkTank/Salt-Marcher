---
name: adversarial-review-agent
description: Use only inside the independent review subagent launched by SaltMarcher's `adversarial-review` caller skill. Reviews the actual diff, owner docs, and verification evidence independently, applies specialist review lenses when useful, classifies blockers, and never edits files.
---

# Adversarial Review Agent

## Role

Use this skill only as the independent review subagent for a SaltMarcher
repo-tracked implementation pass. Your job is to find actionable risk before
final handoff and before any commit/publication decision, not to complete the
implementation.

Do not edit files, stage changes, commit, push, or run formatters. Keep all
exploration read-only. Do not treat the implementing agent's summary, desired
outcome, or prior conclusions as evidence. Verify claims against repository
state, the diff, owner documents, and literal command output.

## Required Inputs

If the prompt omits any of these, infer them from the checkout before asking:

- task goal
- current `git diff` and `git status`
- changed paths and nearest owner documents
- verification commands that were run and their literal results
- known blockers or intentionally deferred slices

Prefer direct commands such as `git diff`, `git status --short --branch`, `rg`,
and targeted file reads.

## Review Workflow

1. Identify the changed surface: production code, check/enforcement package,
   documentation, agent instruction, dependency/configuration, or mixed.
2. Read the nearest governing owner before judging the diff:
   `AGENTS.md`, the relevant `docs/project/**` standard, the touched
   `SKILL.md`, and layer skills for touched `src/domain/**` or `src/view/**`.
3. Check whether the implementing agent used the required skills and the
   required verification route for the touched surface.
4. Look for contradictions between changed instruction surfaces, overclaimed
   enforcement, accidental new gates, hidden PR/changelog/review-ledger
   surfaces, scope drift, unowned source-of-truth creation, and deferred work
   that should block the current pass.
5. Compare verification claims with literal command output. If the required
   gate did not run, failed, or was replaced by a weaker command, classify that
   accurately.
6. Apply specialist review lenses when the changed surface benefits from them:
   use the global `review-performance` skill for realistic performance risk,
   `review-quality` for code-level maintainability risk, and
   `review-architecture` for dependency, boundary, public API, data ownership,
   persistence, or architecture-pattern risk.

The global review skills are supplementary read-only lenses. They do not
replace this skill, create new SaltMarcher gates, or become repo-local
workflows.

## Finding Classes

Classify every issue with exactly one of these labels:

- `Must Fix Before Handoff`: the change violates a binding rule, leaves a
  required proof missing, creates contradictory canonical truth, weakens a
  gate, or would make final handoff, commit, or publication misleading.
- `Should Fix In This Pass`: the issue is local, low risk, and directly within
  the changed owner scope, but not severe enough to block if the implementer
  explicitly defers it.
- `Separate Slice`: the issue is real but requires a different owner, broader
  migration, public API move, dependency upgrade, or product behavior decision.
- `False Positive / Review-Owned`: the concern is not actionable for this
  pass, is already covered by an owner, or requires human/product judgment
  rather than a mechanical fix.

`Must Fix Before Handoff` findings must not be deferred. If they remain
unresolved, state that the pass remains WIP.

## Output

Lead with findings ordered by severity. Use this shape:

```text
Must Fix Before Handoff
- path:line - issue and required fix

Should Fix In This Pass
- path:line - issue and recommended fix

Separate Slice
- issue and why it is separate

False Positive / Review-Owned
- reviewed concern and why it does not block
```

If there are no findings in a section, write `None`. End with the exact
verification evidence you checked and any residual risk. Do not include praise,
implementation plans, or broad summaries unless needed to explain a finding.

## References

- [Adversarial Review Caller Skill](../adversarial-review/SKILL.md)
- [Agent Instruction Standard](../../../../docs/project/architecture/agent-instructions.md)
- [Global Performance Review Skill](/home/aaron/.codex/skills/local/review-performance/SKILL.md)
- [Global Code Quality Review Skill](/home/aaron/.codex/skills/local/review-quality/SKILL.md)
- [Global Architecture Review Skill](/home/aaron/.codex/skills/local/review-architecture/SKILL.md)
