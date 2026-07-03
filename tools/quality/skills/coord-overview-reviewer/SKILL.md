---
name: coord-overview-reviewer
description: "Use by an Overview coordinator before launching specialist reviewer subagents. Adds the Overview-to-reviewer communication contract: isolated slice briefings, assigned lenses, no conversation history, no outcome anchoring, and read-only reviewer behavior."
---

# Coordination: Overview To Reviewer

## Role

Use this skill inside an Overview coordinator before launching specialist
reviewer subagents. Mandatory generic skills:

- `/home/aaron/Schreibtisch/projects/SaltMarcher/tools/quality/skills/coord-adversarial-review/SKILL.md`
- `/home/aaron/Schreibtisch/projects/SaltMarcher/tools/quality/skills/lens-coordinator/SKILL.md`

This skill is additive. Do not repeat generic skill workflows in reviewer
prompts; this skill only defines what an Overview coordinator may and must give
each reviewer.

## Reviewer Isolation

Every reviewer receives an isolated, slice-specific briefing. Do not pass:

- conversation history
- other reviewers' findings
- coordinator expectations about likely outcomes
- implementation-defense rationale
- broad unrelated dirty-worktree context

Give only neutral facts needed to inspect the assigned slice.

## Required Reviewer Briefing

Each reviewer prompt must include:

- `Role`: one assigned specialist lens.
- `Scope`: exact files, diff slice, artifact, or decision to review.
- `Accepted Plan Evidence`: accepted wave/step-plan path or coordinator-selected
  plan excerpt when it defines the reviewed slice; omit only when no plan
  applies.
- `Goal`: one short sentence from the user request.
- `Success Criteria / Done When`: only the slice-relevant completion facts the
  reviewer must test against evidence; they are not the answer key.
- `Owner Evidence`: nearest governing docs or skills for the slice.
- `Verification Evidence`: exact top-level command/result relevant to the
  slice, or blocker. Tell the reviewer to report stale proof if the reviewed
  slice changed after that command.
- `Dirty Baseline`: only dirty paths needed to avoid misattribution.
- `Coordinator-Derived Handoff Risk Proposition`: one falsifiable handoff
  proposition this reviewer must stress-test.
- `Evidence To Inspect`: concrete diff, owner docs, code paths, logs, proof
  snippets, dirty-baseline facts, and current-state claims to check.
- `What Would Make This Handoff Wrong`: the condition that would turn the
  proposition into a blocker, WIP result, stale-proof result, or evidence gap.
- `Alternative / Rejected Shortcut / Tradeoff To Compare`: at least one
  plausible alternative path, shortcut, or tradeoff to test against the final
  state.
- `Expected Specialist Judgment`: the lens-specific judgment to return, such as
  objective completion, target fit, baseline admission, owner fit, proof
  sufficiency, debt disposition, maintainability, or residual risk.
- `Structural State Review`: for architecture reviewers, state `Triggered`
  with slice paths and trigger reasons, or `Not Triggered` with the
  code-scope reason. When triggered, require the reviewer to inspect code first
  and return the Structural State Ownership Matrix from `lens-architecture`.
- `Constraints`: read-only, no edits, no staging, no commits, no formatters, no
  subagent launches.
- `Required First Skill`: `/home/aaron/Schreibtisch/projects/SaltMarcher/tools/quality/skills/lens-adversarial-review-agent/SKILL.md`.
- `Assigned Lens`: exact `lens-*` skill path.

Do not ask reviewers to summarize the overall change, deduplicate across the
panel, decide final handoff, verify by rerunning top-level proof tools, or
speak outside their assigned lens. Do ask each reviewer to answer the assigned
handoff risk proposition with lens-specific evidence and residual risk.
Invalid reviewer briefings ask only whether proof is green, Done When appears
satisfied, logs exist, known findings are closed, or the diff is formally
inside scope.

For structural-state slices, docs, pass logs, and implementation rationale may
identify the intended owner or invariant, but they cannot by themselves close a
code-supported finding. The reviewer must ground each non-clean matrix row in
code evidence or classify it as `False Positive` with code evidence.

## Slice Rules

- One reviewer may cover multiple small paths only when the same expertise and
  owner evidence apply.
- One large path may require multiple reviewers when it contains distinct risk
  types.
- Each slice must have a concrete risk signal; do not launch a reviewer only to
  make a panel look large.
- If a reviewer needs broader context to prove a finding, it may inspect
  adjacent code but must keep findings tied to the assigned slice. Broader
  supported concerns still block the same run.

## Reviewer Output Handling

The coordinator owns aggregation:

- wait for every required reviewer to finish
- deduplicate findings by underlying issue
- preserve the strongest evidence and classification
- treat every supported finding as blocking until fixed in the same run or
  closed as false-positive/review-owned with evidence
- keep stale reviewer results separate when fixes changed the diff after the
  reviewer ran
- relaunch reviewers only after the top-level caller provides fresh proof for
  the changed state

## References

- [Adversarial Review Caller Coordination](/home/aaron/Schreibtisch/projects/SaltMarcher/tools/quality/skills/coord-adversarial-review/SKILL.md)
- [Adversarial Review Agent Lens](/home/aaron/Schreibtisch/projects/SaltMarcher/tools/quality/skills/lens-adversarial-review-agent/SKILL.md)
- [Coordinator Lens](/home/aaron/Schreibtisch/projects/SaltMarcher/tools/quality/skills/lens-coordinator/SKILL.md)
