---
name: coord-main-cr-review
description: Use by Main before launching a SaltMarcher CR Review Coordinator. Assigns one CR review artifact path, neutral evidence packet, allowed write surface, and blocked fallback when the coordinator cannot run.
---

# Coordination: Main To CR Review

## Role

Use this caller-side skill before launching a CR Review Coordinator. CR review
is a pre-roadmap gate. It grants or denies downstream permission to create the
roadmap; it does not review a planning bundle or implementation result.
The split CR Review Coordinator route does not change guard-readable artifact
role values; generated CR review headers use the shared
`Planning Review Coordinator` role required by the artifact-chain guard.

Main launches exactly one clean coordinator using:

1. `/home/aaron/.codex/skills/local/lens-adversarial-review-agent/SKILL.md`
2. `/home/aaron/.codex/skills/local/lens-coordinator/SKILL.md`
3. `tools/quality/skills/lens-coordinator-cr-review/SKILL.md`
4. `tools/quality/skills/coord-planning-reviewer/SKILL.md` before reviewers

## Launch Packet

Provide only neutral, inspectable facts:

- reviewed CR path
- required CR review artifact path
- allowed write surface: exactly that review artifact path
- current dirty-path boundary and unrelated work
- owner documents and mandatory skills needed to judge the CR
- local source evidence and proof snippets the CR relies on
- user constraints, non-goals, and unresolved questions
- Initial Concern Hints as hints only, not questions or expected findings

Main assigns the review path but must not write or replace it. If the
coordinator or required reviewer launch is unavailable, the CR remains
WIP/blocked; Main must not self-review or synthesize acceptance.

## Handoff

Before roadmap planning proceeds, the generated review artifact must exist at
the assigned path and show:

- `Artifact Role: CR Review`
- `Owner Role: Planning Review Coordinator`
- `Authored By Role: Planning Review Coordinator`
- completed `lens-cr-artifact`
- a valid verdict
- downstream permission `Roadmap creation may proceed` when accepted

## References

- [CR Review Coordinator](../lens-coordinator-cr-review/SKILL.md)
- [Planning Reviewer Briefing](../coord-planning-reviewer/SKILL.md)
- [Implementation Artifacts Standard](../../../../docs/project/architecture/implementation-artifacts.md)
