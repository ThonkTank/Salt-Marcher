---
name: adversarial-review
description: Use by the implementing agent at the end of every SaltMarcher repo-tracked implementation pass, after the diff exists and before final handoff or any commit/publication decision. Sets up and waits for the required independent review subagent; the review subagent itself uses `adversarial-review-agent`.
---

# Adversarial Review Caller

## Role

Use this skill as the implementing agent. It owns the mandatory caller-side
route for getting an independent adversarial review before final handoff,
commit, or publication. It does not own the review method itself.

The review subagent must use:

- `tools/quality/skills/adversarial-review-agent/SKILL.md`

Run the review after the implementation diff exists at the end of every
SaltMarcher repo-tracked implementation pass, regardless of whether
verification is green, the pass is still WIP, or a stable commit/publication is
planned.

## Required Timing

Start the review only after:

- the current task diff exists
- the required verification command for the touched surface has a literal
  result, or the blocker that prevented that command is known
- known blockers and intentionally deferred slices are explicit enough for an
  independent reviewer to inspect

Do not start final handoff, commit, or publication claims before the review
completes.

## Review Prompt Contract

When starting the review subagent, provide a compact task frame:

- task goal
- changed paths you believe are agent-owned
- known pre-existing dirty paths that are not part of this pass
- verification commands run and their literal results
- known blockers or intentionally deferred slices
- instruction that the subagent must read and follow
  `tools/quality/skills/adversarial-review-agent/SKILL.md`
- instruction that the subagent must inspect `git status`, `git diff`, owner
  documents, and verification evidence directly instead of trusting the
  caller summary

Do not duplicate the review workflow in the prompt. The review-agent skill owns
the method, finding classes, and output shape.

## Waiting Rules

A running required review is not failed, optional, or replaceable merely
because it is slow or silent.

- Do not impose a time limit on a required review.
- Do not treat missing interim output as a failure signal.
- Do not reinterpret an incomplete review as a finding class or as review
  evidence.
- Start a replacement review only after the subagent or tool returns an
  explicit failure signal.

If no explicit failure signal exists, wait for completion.

## Handling Findings

Treat the review result as part of the handoff gate:

- `Must Fix Before Handoff` findings block final handoff, stable commit, and
  publication until resolved.
- If you change the implementation after review, rerun the required
  verification surface and get a fresh adversarial review for the new diff.
- `Should Fix In This Pass` findings should be fixed when they are local and
  low risk; if deferred, name the deferral in handoff.
- `Separate Slice` findings must not widen the current pass unless the user
  explicitly changes the scope.
- `False Positive / Review-Owned` findings do not block, but keep the rationale
  in the handoff summary.

A pass with unresolved blocking review findings remains WIP.

## Handoff

Report the review outcome in normal handoff text:

- review subagent completed or explicit failure signal received
- whether `Must Fix Before Handoff` findings remain
- any fixes made after review and the follow-up verification/review status
- any `Should Fix In This Pass` or `Separate Slice` items deferred

Do not create a separate review ledger, pull-request template, or changelog
entry only to record adversarial review evidence.

## References

- [Adversarial Review Agent Skill](../adversarial-review-agent/SKILL.md)
- [Agent Instruction Standard](../../../../docs/project/architecture/agent-instructions.md)
- [Quality Platforms Standard](../../../../docs/project/verification/quality-platforms.md)
