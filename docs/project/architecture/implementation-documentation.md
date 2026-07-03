Status: Active
Owner: SaltMarcher Team
Last Reviewed: 2026-06-30
Source of Truth: Entry standard for SaltMarcher generated implementation
documentation and routing to the detailed implementation artifact contract.

# Implementation Documentation Standard

## Purpose

SaltMarcher uses implementation documentation to make agent work auditable
without turning generated handoff evidence into canonical product truth. This
standard owns the boundary and routing for implementation documentation. The
detailed artifact contracts live in the
[Implementation Artifacts Standard](/home/aaron/Schreibtisch/projects/SaltMarcher/docs/project/architecture/implementation-artifacts.md:1).

Implementation documentation is operational evidence. It does not define
requirements, contracts, domain truth, delivery plans, feature behavior,
verification policy, or architecture beyond workflow documentation rules.
Those topics stay in their owning canonical documents.

## Scope

This standard applies to generated artifacts used for coordinated work:

- CRs and planning-review-coordinator-authored CR reviews
- roadmaps, phase plans, wave/step plans, and the coordinator-authored
  planning-bundle review
- Implementation Reading Packets in prompts, handoffs, plans, or notes
- implementation pass logs under `build/agent-pass-logs/`
- qualitative review packet reports or pass-log summaries
- Verification Runner final integrated proof evidence in review logs
- aggregated Implementation Review Coordinator pass logs
- broad-goal completion audits

Generated artifacts live under `build/agent-pass-logs/`. They are local
operational evidence, not canonical documentation. Do not commit them, cite
them as product truth, or use them as a second source for requirements,
contracts, domain truth, architecture, delivery, or verification policy.

## Artifact Contract

The
[Implementation Artifacts Standard](/home/aaron/Schreibtisch/projects/SaltMarcher/docs/project/architecture/implementation-artifacts.md:1)
owns:

- artifact group slugs and filename patterns
- CR-vs-plan semantics
- roadmap indexes and decision/blocker logs
- phase-plan and wave/step-plan field contracts
- coordinator-authored CR reviews and planning-bundle review artifacts
- implementation-log, review-log, and completion-audit content rules
- stale-evidence rules for generated proof and review evidence

Other instruction surfaces route there instead of copying those field lists.

## Implementation Reading Packet

An Implementation Reading Packet is required before a delegated agent plans or
edits repo-tracked implementation, refactor, governance repair, systemic
repair, or documentation/instruction mutation.

The packet may be embedded in a prompt, wave/step plan, or handoff note. It
must exist before the worker plans or edits; a post-work pass log cannot
replace the pre-work packet.

The packet content contract is owned by the
[Implementation Artifacts Standard](/home/aaron/Schreibtisch/projects/SaltMarcher/docs/project/architecture/implementation-artifacts.md:1).
At minimum, it must identify goal, read/write/forbidden sets, current baseline,
owners and skills, problem history, project-health state, source evidence,
implementation constraints, verification route, review route, and Done When.

## Proof And Review Ownership

Proof routes are owned by `AGENTS.md`, the quality-platform verification
standards, and assigned wave/step plans. This standard only says how to record
proof evidence in generated implementation artifacts. Worker-local proof is
recorded in implementation logs. Final integrated proof is Verification Runner
evidence recorded in the assigned review-log verification section.

Review routing is owned by
[Agent Instruction Standard](/home/aaron/Schreibtisch/projects/SaltMarcher/docs/project/architecture/agent-instructions.md:1)
and the repo-local coordinator skills that route to global review methods.
Generated review artifacts record reviewer evidence and verdicts; they do not
create SaltMarcher-local copies of global review-specialist workflow.

## Extension Rule

Do not keep expanding this entry document with detailed artifact fields. When a
new implementation artifact, status, review record, or generated evidence type
needs durable rules, add it to the Implementation Artifacts Standard or create
a narrower owner and link it here.

Meaning-preserving splitting is the preferred extension strategy when
generated-artifact governance grows. Repeated compression of this entry
document is not.

## References

- [Implementation Artifacts Standard](/home/aaron/Schreibtisch/projects/SaltMarcher/docs/project/architecture/implementation-artifacts.md:1)
- [Agent Instruction Standard](/home/aaron/Schreibtisch/projects/SaltMarcher/docs/project/architecture/agent-instructions.md:1)
- [Agent Context Standard](/home/aaron/Schreibtisch/projects/SaltMarcher/docs/project/architecture/agent-context.md:1)
- [Documentation Standard](/home/aaron/Schreibtisch/projects/SaltMarcher/docs/project/architecture/documentation.md:1)
- [Project Health Standard](/home/aaron/Schreibtisch/projects/SaltMarcher/docs/project/architecture/project-health.md:1)
- [Quality Platforms](/home/aaron/Schreibtisch/projects/SaltMarcher/docs/project/verification/quality-platforms.md:1)
- [Source References Standard](/home/aaron/Schreibtisch/projects/SaltMarcher/docs/project/verification/source-references.md:1)
