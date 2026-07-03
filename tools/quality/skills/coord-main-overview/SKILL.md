---
name: coord-main-overview
description: Use by a main/caller agent when launching an Overview coordinator subagent for implementation handoff, optimization review, or another coordinated review panel. Adds the main-to-Overview communication contract on top of `coord-adversarial-review`.
---

# Coordination: Main To Overview

## Role

Use this skill in the main or caller agent before launching an Overview
coordinator subagent.

Mandatory generic skill:

- `/home/aaron/Schreibtisch/projects/SaltMarcher/tools/quality/skills/coord-adversarial-review/SKILL.md`

This skill is additive. It defines only what main may and must give the
coordinator. Do not repeat the adversarial caller rules in the launch prompt;
link to the mandatory generic skill instead.

## Main Responsibilities

The main agent owns:

- the user goal and current task boundary
- the original success criteria, Done When facts, and any architecture,
  quality, project-health, or baseline-admission objectives that must be true
  before the pass can be considered complete
- whether the reviewed scope triggers structural-state review because it
  touches state ownership, system-of-record, projections, mappers, commands,
  enums, value objects, persistence rows, content models, drafts, session
  state, view state, or other stateful domain/runtime/view/data surfaces
- the changed or reviewed artifacts
- current dirty-worktree separation, including known parallel work outside scope
- top-level proof results and freshness under `coord-adversarial-review`
- known unresolved reviewer findings and their evidence
- `Initial Concern Hints`: known risks, suspected weak spots, or user concerns
  the coordinator may inspect but must not treat as reviewer questions,
  expected findings, or acceptance criteria
- the coordinator lens assignment, such as `lens-coordinator-handoff` or
  `lens-coordinator-optimization`
- waiting for the coordinator's final result
- writing any local aggregated review log required by the caller repository
  from the Overview result; the Overview coordinator returns review evidence
  and status but does not replace the repository's Main-owned aggregation
  artifact unless the local contract explicitly assigns that write surface to
  Overview

The main agent does not own specialist reviewer selection once the coordinator
has been launched, except when the coordinator reports an explicit nested-launch
failure and asks for caller fallback. Main must not provide ready-made reviewer
questions, expected findings, or acceptance logic. The Overview coordinator owns
neutral evidence gathering, handoff risk-proposition derivation, lens selection,
and specialist briefing.

The main agent owns the top-level proof surface named by the surrounding
workflow. Run that proof for the reviewed state, keep reviewed files and
behavior stable while review is running, and rerun proof before a fresh
coordinator pass if the tested surface changes. Parallel work outside the
reviewed paths is not part of that proof unless it affects the same tested
behavior or proof surface.

## Allowed Coordinator Briefing

Give the Overview coordinator only neutral, inspectable facts:

- `Goal`: one short sentence from the user request.
- `Success Criteria / Done When`: the original completion facts the
  coordinator must test against the final state. When an accepted plan exists,
  give the plan path as the source of slice-specific Done When rather than
  rewriting those facts in the launch prompt. These facts are evidence to
  challenge, not reviewer questions or an answer key.
- `Coordinator Lens`: exact lens path and purpose.
- `Scope`: changed paths, artifact paths, or reviewed decision.
- `Accepted Plan / Implementation Authority`: accepted wave/step-plan path,
  plan-review path, and artifact-chain guard result when available. Prefer
  these paths over restating the plan's Done When or worker instructions in
  Main's own words.
- `Dirty Baseline`: known pre-existing or concurrent dirty paths outside this pass, with any known owner/status when available.
- `Owner Evidence`: nearest standards, skills, or docs that constrain the scope.
- `Verification Evidence`: exact top-level command and literal result, or
  blocker. State whether reviewed paths changed after that proof.
- `Known Blockers / Reviewer Findings`: factual `path/scope/status/evidence`.
- `Initial Concern Hints`: known risks or user concerns; not reviewer
  questions, expected findings, or acceptance criteria.
- `Baseline Debt Policy`: how supported pre-existing structural or quality debt
  in the reviewed scope should be handled. Default to materialization through
  the project's debt mechanism or explicitly named handoff artifact rather than
  silently closing it as review-owned.
- `Objective-Relevant Debt`: known or suspected debt families that overlap the
  current goal and therefore must be fixed, explicitly user-excluded, or
  returned as WIP rather than materialized as incidental baseline.
- `Structural State Review`: `Triggered` with the concrete changed paths and
  trigger reasons, or `Not Triggered` with the code-scope reason. Mark it
  `Triggered` when the goal or diff touches state ownership, system-of-record,
  projections, mappers, commands, enums/value objects, persistence rows,
  content models, drafts, sessions, view state, or other stateful
  domain/runtime/view/data code. When triggered, tell Overview that
  `lens-architecture` must return the Structural State Ownership Matrix and
  that a missing, incomplete, `Handoff Blocker`, or unresolved
  `Materialization Required` matrix prevents clean handoff.
- `Required First Skill`: `/home/aaron/Schreibtisch/projects/SaltMarcher/tools/quality/skills/lens-adversarial-review-agent/SKILL.md`.
- `No Conversation History`: instruction that the coordinator must not rely on
  or pass conversation history to reviewers.

Do not include implementation-defense prose, ready-made reviewer questions,
expected findings, expected verdicts, prior approval, or the full conversation
transcript. Do not frame green proof, closed known findings, or apparent Done
When satisfaction as acceptance.

## Required Launch Shape

Launch exactly one Overview coordinator and tell it to use the mandatory
Overview stack:

1. `/home/aaron/Schreibtisch/projects/SaltMarcher/tools/quality/skills/lens-adversarial-review-agent/SKILL.md`
2. `/home/aaron/Schreibtisch/projects/SaltMarcher/tools/quality/skills/coord-adversarial-review/SKILL.md`
3. `/home/aaron/Schreibtisch/projects/SaltMarcher/tools/quality/skills/lens-coordinator/SKILL.md`

Then assign exactly one coordinator lens for the intended review mode:

- implementation handoff: `/home/aaron/Schreibtisch/projects/SaltMarcher/tools/quality/skills/lens-coordinator-handoff/SKILL.md`
- optimization review: `/home/aaron/Schreibtisch/projects/SaltMarcher/tools/quality/skills/lens-coordinator-optimization/SKILL.md`

Other coordinated review panels must name the coordinator lens explicitly.

## Handling Coordinator Results

- If the coordinator returns `Not Reviewable Yet`, fix the named reviewability
  blocker and launch a fresh coordinator for the updated scope.
- If the coordinator reports nested reviewer launch failure, perform only the
  fallback launch the coordinator requested and keep the same neutral prompt
  discipline.
- If implementation changes after coordinator review, rerun the required
  top-level proof surface and launch a fresh coordinator.
- Do not shrink, replace, or self-certify the coordinator's panel without an
  explicit user scope change or mechanical nested-orchestration blocker.
- Do not accept a `Clean` handoff for a triggered structural-state scope unless
  the Overview result includes the Structural State Ownership Matrix, every row
  has an allowed disposition, and no row remains an unresolved
  `Handoff Blocker` or `Materialization Required`.

## References

- [Adversarial Review Caller Coordination](/home/aaron/Schreibtisch/projects/SaltMarcher/tools/quality/skills/coord-adversarial-review/SKILL.md)
- [Coordinator Lens](/home/aaron/Schreibtisch/projects/SaltMarcher/tools/quality/skills/lens-coordinator/SKILL.md)
- [Handoff Coordinator Lens](/home/aaron/Schreibtisch/projects/SaltMarcher/tools/quality/skills/lens-coordinator-handoff/SKILL.md)
- [Optimization Coordinator Lens](/home/aaron/Schreibtisch/projects/SaltMarcher/tools/quality/skills/lens-coordinator-optimization/SKILL.md)
