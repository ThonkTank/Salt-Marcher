---
name: lens-plan-artifact
description: Review SaltMarcher planning bundles as a specialist lens inside a planning-review panel. Checks roadmap goal coverage, substantive planning quality, phase decomposition, worker-ready step slices, proof and review routes, and implementation authority. Review only; do not coordinate, plan, implement, or write generated review artifacts.
---

# Lens: Plan Artifact

## Mandatory Generic Skill

Use this specialist lens only after applying:

- `/home/aaron/Schreibtisch/projects/SaltMarcher/tools/quality/skills/lens-adversarial-review-agent/SKILL.md`

Follow that skill's Specialist Lens Contract. This file adds SaltMarcher
planning-bundle criteria only.

## Role

Review whether one planner's roadmap, phase plans, and wave/step plans form a
single decision-complete planning bundle. The roadmap must carry the goal from
start state to endpoint, phases must split broad work by real dependency or
owner boundaries, and step plans must be worker-ready slices. Formal artifact
correctness is not enough: reject bundles that are vague, over-governed, or
force implementation workers to invent the real architecture.

This lens may report when the planning bundle's risk requires specialist
content coverage, but it cannot validate sibling reviewer briefings or outputs.
The planning review coordinator owns content-lens briefing and aggregation
governance. This lens does not replace
architecture, quality, simplicity, smell, critical-analysis, security,
performance, UX, design, structure, convention, onboarding, or research
review.

## Review Artifact Contract To Enforce

When this lens supports a plan review, require the coordinator-authored review
artifact to use:

- `Artifact Role: Plan Review`
- `Owner Role: Planning Review Coordinator`
- `Authored By Role: Planning Review Coordinator`
- `Reviewed Artifact Role: Planning Bundle`
- `Artifact Lens: lens-plan-artifact`
- `Artifact Lens Status: Completed`
- `Content Review Status: Completed` or `Not Required`
- `Content Review Rationale: <free prose>`
- `Verdict: Accepted`, `Rework Required`, or `Blocked`
- accepted downstream permission: `Implementation may proceed`
- `Reviewed Path`, `Authored Review Path`, and `Allowed Write Surface`
- `Reviewed Roadmap Path`
- `Reviewed Phase Plan Paths`
- `Authorized Step Plan Paths`

Reject reviews that treat user-provided plans, chat confirmation, Main
summaries, or separate roadmap/phase/step reviews as implementation authority.
A worker may start only for a step plan listed in an accepted plan review and
after the artifact-chain guard passes.

The accepted plan-review artifact must be the canonical
`YYYY-MM-DD-<slug>-plan-review.md` path for the CR chain. Noncanonical
accepted artifacts such as `*-plan-review-r2.md` are evidence only until the
Plan Review Coordinator repairs the canonical artifact form. The exact
`Allowed Write Surface`, reviewed path fields, and authorized step-plan list
must match the artifact contract or the output of
`verify_artifact_chain.py --print-contract`.

## Review Criteria

### Formal Contract

Flag missing or contradictory:

- accepted CR backlink and coordinator-authored CR review
- roadmap, phase plans when used, step plans, and generated artifact links
- bundle provenance, accepted artifact statuses, review fields, and authorized
  step-plan list
- role values showing `Planner` authored roadmap, phase, and step artifacts
- canonical review paths, exact header names, exact downstream-permission
  values, and status-authority fields that allow the artifact-chain guard to
  pass without a Main-owned status-fix step

### Goal Coverage

Check that the roadmap preserves the accepted CR from start to endpoint:

- no softened, dropped, or reinterpreted acceptance criteria
- completion goals, owner surfaces, proof route, review route, blockers, and
  final audit state are visible
- narrow work records why no phase plan is needed; broad work has real phases

### Planning Quality

Check that the bundle is a substantive engineering plan:

- concrete current structural problem and concrete target model are stated
- chosen strategy follows from owner docs, code evidence, maintainability, and
  long-term project health
- plausible alternatives, shortcuts, and compatibility paths are rejected with
  reasons
- each affected surface has an `Adopt`, `Adapt`, `Reject`, or `Investigate`
  disposition with evidence and implementation consequence
- interface/API, ownership-boundary, migration-path, compatibility-budget, and
  proof-oracle decisions are made before implementation authority is granted
- governance sections are compact and do not hide missing technical decisions

### Phase And Step Readiness

Check whether decomposition reduces implementation risk:

- phase order matches dependencies, owner boundaries, migrations, and proof
  readiness
- step plans are implementable without hidden product, architecture, ownership,
  proof, or sequencing decisions
- exploration slices have bounded questions and required outputs; they are not
  generic inventory work with no architectural conclusion
- read/write/forbidden sets and conditional writes prevent scope drift
- non-clean structural-state rows have a slice, blocker/WIP status,
  project-health route, or explicit user exclusion

### Proof And Review Quality

Check whether the bundle can prove the intended outcome:

- behavior harness, focused handoff, documentation enforcement, or production
  handoff route matches the touched surface
- proof is not self-confirming or weaker than the risk requires
- Verification Runner, Implementation Review Coordinator, qualitative review,
  project-health, and debt sync are assigned when their triggers apply
- reviewed roadmap, phase-plan, and authorized step-plan status/upkeep fields
  are review-owned, point to the plan-review artifact as status authority, and
  are not deferred to a Main status-fix step

## Lens Escalation Signals

Report missing panel coverage when needed:

- `lens-architecture` for stateful, boundary, public API, migration, or seam
  work
- `lens-quality`, `lens-simplicity`, or `lens-smells` for complexity or worker
  clarity risk
- `lens-critical-analysis` for disputed target, phase, or proof tradeoffs
- `lens-security`, `lens-performance`, `lens-ux`, or `lens-design` for their
  surfaces
- `lens-onboarding` for instruction or developer-facing worker packets

## Output

Use the generic finding classes. In diagnostic detail include:

- `Formal Contract`: accepted or findings
- `Goal Coverage`: accepted or findings
- `Planning Quality`: accepted or findings
- `Phase And Step Readiness`: accepted or findings
- `Proof And Review`: accepted or findings
- `Implementation Authority`: authorized step plans or why blocked

Block acceptance when a bundle is formally valid but technically
non-decisive. Examples include abstract principle lists without target
decisions, `where it fits` wording without criteria, phase plans that only
create more planning, or step plans that leave API shape, owner boundaries,
migration strategy, or proof oracle to the worker.

## References

- [Implementation Artifacts Standard](/home/aaron/Schreibtisch/projects/SaltMarcher/docs/project/architecture/implementation-artifacts.md:1)
- [Agent Instruction Standard](/home/aaron/Schreibtisch/projects/SaltMarcher/docs/project/architecture/agent-instructions.md:1)
- [Planning Reviewer Briefing Skill](/home/aaron/Schreibtisch/projects/SaltMarcher/tools/quality/skills/coord-planning-reviewer/SKILL.md:1)
- [Plan Review Coordinator Skill](/home/aaron/Schreibtisch/projects/SaltMarcher/tools/quality/skills/lens-coordinator-plan-review/SKILL.md:1)
