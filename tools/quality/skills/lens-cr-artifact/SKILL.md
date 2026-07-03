---
name: lens-cr-artifact
description: Review SaltMarcher Change Request artifacts as a specialist lens inside a planning-review panel. Checks both CR formal compliance and substantive baseline, rationale, target-direction, option, and acceptance quality. Review only; do not coordinate, plan, implement, or write generated review artifacts.
---

# Lens: CR Artifact

## Mandatory Generic Skill

Use this specialist lens only after applying:

- `/home/aaron/.codex/skills/local/lens-adversarial-review-agent/SKILL.md`

Follow that skill's Specialist Lens Contract. This file adds CR-specific
criteria only.

## Role

Review whether a CR is a sound decision-input artifact before roadmap planning.
A CR is not an implementation plan. It must define the current wrong state,
desired target state, rationale, scope boundaries, owner surfaces, acceptance
criteria, and Done When facts without prescribing the implementation route.

This lens may report when the CR's risk requires specialist content coverage,
but it cannot validate sibling reviewer briefings or outputs. The planning
review coordinator owns content-lens briefing and aggregation governance.

## Review Artifact Contract To Enforce

When this lens supports a CR review, require the coordinator-authored review
artifact to use:

- `Artifact Role: CR Review`
- `Owner Role: Planning Review Coordinator`
- `Authored By Role: Planning Review Coordinator`
- `Reviewed Artifact Role: CR`
- `Artifact Lens: lens-cr-artifact`
- `Artifact Lens Status: Completed`
- `Content Review Status: Completed` or `Not Required`
- `Content Review Rationale: <free prose>`
- `Verdict: Accepted`, `Rework Required`, or `Blocked`
- accepted downstream permission: `Roadmap creation may proceed`
- `Reviewed Path`, `Authored Review Path`, and `Allowed Write Surface`

After the guard-readable fields, require free-prose review sections for
coordinator evidence pass, CR goals and target claims,
coordinator-derived risk propositions, content-lens briefings, rejected
formal-only review frames, and residual risk.

Reject CRs or review artifacts that treat user-provided plans,
user-confirmed plans, chat confirmation, Main summaries, or requested-plan
wording as CR review acceptance. That material may inform the CR, but only the
coordinator-authored CR review grants roadmap permission.

## Review Criteria

### Formal Contract

Flag missing or contradictory:

- status, provenance, reviewed path, and artifact-chain fields required by the
  Implementation Artifacts Standard
- current wrong state, target state, rationale, scope boundaries, non-goals,
  owner surfaces, acceptance criteria, and Done When
- explicit governance, proof, review, ownership, documentation, project-health,
  or source-reference failures the CR is meant to solve
- reviewable acceptance criteria or Done When facts
- clear distinction between CR intent and roadmap/implementation route

### Reality Check

Inspect the repo baseline and owner evidence enough to decide whether:

- the claimed wrong state exists or is explicitly evidence-limited
- the target state follows from the rationale and current baseline
- the CR is not solving a stale, already-fixed, or misclassified problem
- owner surfaces are real and sufficient
- source-backed claims cite preserved sources or concrete local repo evidence
- dirty or parallel work makes the baseline ambiguous

### Decision Quality

Stress-test whether the CR is the right target before planning:

- important alternatives or rejected shortcuts are named when the choice is
  high-impact or non-obvious
- tradeoffs, reversibility, migration cost, and quality risks are visible
- the CR does not overfit to the shortest local unblocker when the problem is
  systemic
- the target is specific enough for roadmap planning but not an implementation
  script

## Lens Escalation Signals

Report missing panel coverage when needed:

- `lens-critical-analysis` for contested target direction or tradeoffs
- `lens-research-alternatives` for high-impact external alternatives
- `lens-architecture` for architecture, ownership, state, boundary, or seam
  targets
- `requirements`, `verification`, `contract`, `domain`, or `delivery` owner
  skills when the CR depends on those document types

## Output

Use the generic finding classes. In diagnostic detail include:

- `Formal Contract`: accepted or findings
- `Baseline Reality`: accepted, evidence-limited, or findings
- `Target Direction`: accepted, contested, or findings
- `Acceptance Readiness`: whether roadmap planning can proceed

## References

- [Implementation Artifacts Standard](/home/aaron/Schreibtisch/projects/SaltMarcher/docs/project/architecture/implementation-artifacts.md:1)
- [Planning Reviewer Briefing Skill](/home/aaron/Schreibtisch/projects/SaltMarcher/tools/quality/skills/coord-planning-reviewer/SKILL.md:1)
- [CR Review Coordinator Skill](/home/aaron/Schreibtisch/projects/SaltMarcher/tools/quality/skills/lens-coordinator-cr-review/SKILL.md:1)
- [MADR Decision Template](/home/aaron/Schreibtisch/projects/references/decision-records/madr-template.md)
