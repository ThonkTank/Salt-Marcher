---
name: coord-main-plan-review
description: Use by Main before launching a SaltMarcher Plan Review Coordinator for one roadmap, phase-plan, and step-plan bundle. Assigns the plan-review artifact path and blocks when the coordinator cannot run.
---

# Coordination: Main To Plan Review

## Role

Use this caller-side skill before launching a Plan Review Coordinator for a
planning bundle. The bundle is the planner-authored roadmap, any required phase
plans, and implementation-ready wave/step plans authorized for possible
implementation.
The split Plan Review Coordinator route does not change guard-readable artifact
role values; generated plan-review headers use the shared
`Planning Review Coordinator` role required by the artifact-chain guard.

Main launches exactly one clean coordinator using:

1. `/home/aaron/.codex/skills/local/lens-adversarial-review-agent/SKILL.md`
2. `/home/aaron/.codex/skills/local/lens-coordinator/SKILL.md`
3. `tools/quality/skills/lens-coordinator-plan-review/SKILL.md`
4. `tools/quality/skills/coord-planning-reviewer/SKILL.md` before reviewers

## Launch Packet

Provide only neutral, inspectable facts:

- accepted CR and CR review paths
- roadmap, phase-plan, and step-plan paths under review
- required plan-review artifact path
- allowed write surface: exactly that review artifact path
- dirty baseline boundary and unrelated work
- owner documents, mandatory skills, proof snippets, source evidence, and
  unresolved questions needed to judge the bundle
- Initial Concern Hints as hints only

Main must not write or replace the plan-review artifact. If the coordinator or
required reviewer launch is unavailable, the bundle remains WIP/blocked; Main
must not self-review or synthesize implementation permission.

## Handoff

Before implementation proceeds, the generated review artifact must exist at the
assigned path and show:

- `Artifact Role: Plan Review`
- `Owner Role: Planning Review Coordinator`
- `Authored By Role: Planning Review Coordinator`
- completed `lens-plan-artifact`
- accepted downstream permission
- the authorized step-plan paths

## References

- [Plan Review Coordinator](../lens-coordinator-plan-review/SKILL.md)
- [Planning Reviewer Briefing](../coord-planning-reviewer/SKILL.md)
- [Implementation Artifacts Standard](../../../../docs/project/architecture/implementation-artifacts.md)
