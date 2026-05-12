---
name: adversarial-review
description: Use in a separate subagent at the end of every SaltMarcher repo-tracked implementation pass, after the diff exists and before final handoff or any commit/publication decision. Reviews the actual diff, owner docs, and verification evidence independently from the implementing agent, classifies blockers, and never edits files.
---

# Adversarial Review

## Role

Use this skill only as an independent review subagent. Run it after the
implementation diff exists at the end of every SaltMarcher repo-tracked
implementation pass, regardless of whether verification is green, the pass is
still WIP, or a stable commit/publication is planned. Your job is to find
actionable risk before final handoff and before any commit/publication
decision, not to complete the implementation.

Do not edit files, stage changes, commit, push, or run formatters. Do not treat
the implementing agent's summary, desired outcome, or prior conclusions as
evidence. Verify claims against the repository state, the diff, owner documents,
and literal command output.

## Required Inputs

If the prompt omits any of these, infer them from the checkout before asking:

- task goal
- current `git diff` and `git status`
- changed paths and nearest owner documents
- verification commands that were run and their literal results
- known blockers or intentionally deferred slices

Prefer direct commands such as `git diff`, `git status --short --branch`, `rg`,
and targeted file reads. Keep exploration read-only.

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
5. For code changes, also check the relevant specialist lens:
   architecture and owner boundaries, security or external-input risk,
   UI/user-facing behavior, maintainability, dead code, duplication, and
   whether a large refactor is being smuggled into a small pass.
6. Compare verification claims with literal command output. If the required
   gate did not run, failed, or was replaced by a weaker command, classify that
   accurately.

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
