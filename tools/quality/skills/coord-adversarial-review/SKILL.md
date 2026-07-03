---
name: coord-adversarial-review
description: "Use before launching any review, critique, Overview coordination, reviewer, or handoff-validation subagent. Owns the universal caller-side adversarial review frame: neutral briefing, no conversation-history transfer to reviewers, mandatory `lens-adversarial-review-agent`, waiting rules, and finding handling."
---

# Coordination: Adversarial Review Caller

## Role

Use this skill before launching any subagent whose primary purpose is review,
critique, review coordination, finding classification, or handoff validation.
It is the mandatory caller-side foundation for independent, evidence-first
review. It does not own the coordinator method or any specialist review lens.

Every review subagent must use:

- `/home/aaron/Schreibtisch/projects/SaltMarcher/tools/quality/skills/lens-adversarial-review-agent/SKILL.md`

Layer-specific coordination skills may add launch contracts:

- `coord-main-overview` governs main-agent to Overview-coordinator handoff.
- `coord-overview-reviewer` governs Overview-coordinator to reviewer handoff.

Those skills are additive only. They must not repeat, weaken, or replace this
skill's neutral briefing, bias-control, waiting, or finding-handling rules.

## Generic And Specific Skill Boundaries

Generic skills own reusable rules. Specific coordination or lens skills must:

- list mandatory generic skills by name and path before their own additive rules
- say which extra role-specific behavior they add
- link to generic owners instead of copying their workflow, finding classes,
  launch contract, or proof policy
- contradict a generic rule only when the specific skill names the reason,
  scope, and higher-priority owner that authorizes the exception

Unexplained contradiction with a mandatory generic skill is a review blocker.

## Required Timing

For implementation handoff reviews, start review only after:

- the current task diff exists
- the required verification command for the touched surface has a literal
  result, or the blocker that prevented that command is known
- known blockers and prior reviewer findings are explicit enough for an
  independent coordinator to inspect

For pre-implementation, optimization, or planning reviews, provide the concrete
artifact, proposal, current state, or decision under review and name any proof
that exists. Do not ask a review subagent to validate vague intent without
inspectable evidence.

Do not start final handoff, commit, publication, or equivalent completion claims
for a covered implementation pass before the required coordinator returns a
final clean-or-blocked result.

The top-level caller owns expensive proof commands such as production handoff,
focused handoff, behavior harnesses, build gates, and install routes. Review
coordinators and specialist reviewers inspect the provided proof output and mark
it stale when the reviewed files or behavior changed; they do not rerun those
proof tools.

## Scope And Parallel Work

Review subagents stay inside the assigned scope. Dirty paths outside that scope
are a baseline or concurrent-work signal, not a finding by themselves. A review
may block on dirty work only when the reviewer cannot separate it from the
reviewed scope, when it overlaps reviewed paths or owner evidence, when it
changes the same tested behavior or proof surface, or when the caller requested
a whole-checkout review.

If unrelated dirty paths appear during review, the coordinator reports them as
baseline or residual risk and continues the scoped review. The top-level caller
may refresh the dirty baseline for a fresh coordinator pass without widening the
review scope or rerunning proof for unrelated work.

## Universal Launch Contract

When starting any review subagent, provide only neutral entry facts and rules of
engagement. Do not pass conversation history. Reviewers must inspect repository
state, changed artifacts, owner documents, and verification evidence directly.

### Neutral Facts

Include only facts the subagent needs to begin independently:

- task goal or reviewed decision
- exact changed paths, artifacts, or scope you believe are under review
- known pre-existing or concurrent dirty paths that are not part of this pass
- nearest owner documents or skills that constrain the reviewed surface
- verification commands run and their literal results, or the blocker that
  prevented the required command
- known blockers or prior reviewer findings, stated as
  `path/scope/status/evidence` facts
- assigned coordinator lens or specialist review lens, if any
- instruction that the subagent must read and follow
  `/home/aaron/Schreibtisch/projects/SaltMarcher/tools/quality/skills/lens-adversarial-review-agent/SKILL.md`
  before applying any coordinator or specialist lens

### Rules Of Engagement

Tell the subagent that review is read-only unless it is explicitly launched as a
scoped fix worker by a coordinator. Reviewer subagents must not edit files,
stage changes, commit, push, run formatters, or launch subagents.

Do not duplicate the review workflow in the prompt. The review-agent lens owns
the evidence-first method, finding classes, and output shape. Coordinator and
specialist lenses own only their additive role-specific behavior.

If non-neutral context is unavoidable, do not put it in the start prompt. Refer
only to a concrete repo path, command, artifact, or pass log that the subagent
may inspect after completing an evidence-first pass.

## Bias Control

Keep the launch prompt free of wording that anchors the reviewer.

- Do not self-grade the change as clean, safe, simple, complete, or already
  reviewed.
- Do not tell the reviewer which finding outcome you expect.
- Do not describe a concern as probably unrelated, probably false positive, or
  already acceptable before the reviewer inspects evidence.
- Do not appeal to prior approval, user preference, conversation history, or
  another agent's opinion as evidence.
- Do not include implementation-defense prose anywhere in the start prompt.

## Waiting Rules

A running required review is not failed, optional, or replaceable merely because
it is slow or silent.

- Do not impose a time limit on a required review.
- Do not treat missing interim output as a failure signal.
- Do not reinterpret an incomplete review as a finding class or review evidence.
- Start a replacement review only after the subagent or tool returns an
  explicit failure signal.

If no explicit failure signal exists, wait for completion.

## Handling Findings

Treat review results as part of the surrounding workflow's gate:

- Supported findings block final handoff, stable commit, publication, or
  equivalent completion claim until resolved in the same run.
- If implementation changes after handoff review, the top-level caller reruns
  the required verification surface and obtains a fresh coordinator-led review
  for the new diff.
- `False Positive / Review-Owned` concerns are closed only with evidence that
  proves they are not actionable in the reviewed state.

A pass with unresolved supported review findings remains WIP.

## Handoff

Report the review outcome in normal handoff text:

- coordinator completed or explicit failure signal received
- whether `Must Fix Before Handoff` findings remain
- any fixes made after review and the follow-up verification/review status
- any nested specialist or worker launch failure that required caller fallback
- any false-positive or review-owned concerns closed with evidence

Do not create a separate review ledger, pull-request template, or changelog
entry only to record adversarial review evidence.

## References

- [Adversarial Review Agent Lens](/home/aaron/Schreibtisch/projects/SaltMarcher/tools/quality/skills/lens-adversarial-review-agent/SKILL.md)
- [Main To Overview Coordination](/home/aaron/Schreibtisch/projects/SaltMarcher/tools/quality/skills/coord-main-overview/SKILL.md)
- [Overview To Reviewer Coordination](/home/aaron/Schreibtisch/projects/SaltMarcher/tools/quality/skills/coord-overview-reviewer/SKILL.md)
