Status: Active
Owner: SaltMarcher Team
Last Reviewed: 2026-06-22
Source of Truth: Canonical implementation-documentation artifacts,
Implementation Reading Packet fields, and generated implementation/review log
content rules for SaltMarcher agent work.

# Implementation Documentation Standard

## Purpose

SaltMarcher uses implementation documentation to make agent work auditable
without turning generated handoff evidence into canonical product truth. This
standard owns the shape of implementation-facing packets, roadmaps, slice
briefs, implementation pass logs, code-simplifier evidence, and aggregated
review logs.

Implementation documentation is operational evidence. It does not define
requirements, contracts, domain truth, delivery plans, feature behavior,
verification policy, or architecture beyond the workflow rules in this file.
Those topics stay in their owning canonical documents.

## Scope

This standard applies to:

- wave roadmaps and reduced slice briefs used to hand implementation work to an
  agent
- Implementation Reading Packets in prompts, handoffs, reduced slice briefs, or
  local working notes, plus pass-log references to the packet actually used
- implementation pass logs under `build/agent-pass-logs/`
- code-simplifier review-agent reports or pass-log summaries
- aggregated Overview review pass logs under `build/agent-pass-logs/`

It does not require a new Gradle task, central gate, tracked ledger, PR
template, or compatibility duplicate of an existing protocol. Other instruction
surfaces should route here instead of copying the packet or log field lists.

## Implementation Reading Packet

An implementation handoff packet is required when a caller delegates a
repo-tracked implementation, refactor, governance repair, systemic repair, or
non-trivial documentation/instruction change to another agent. The packet may
be embedded in the user prompt, a wave brief, a reduced slice brief, or another
handoff note, but it must exist before the delegated worker plans or edits.
Implementation and review pass logs may record or reference the packet that was
used; a post-work pass log cannot replace the required pre-work reading packet.

The packet must include:

- `Goal`: concrete requested outcome.
- `Read Set`: owner docs, skills, source files, logs, and command evidence the
  worker must inspect before editing.
- `Write Set`: exact allowed paths, plus any conditional paths and the
  condition that permits them.
- `Forbidden Write Set`: paths, surfaces, or action classes the worker must not
  touch.
- `Current Baseline`: branch, dirty paths, same-file foreign hunks, and known
  generated or unrelated work that must remain untouched.
- `Owners And Skills`: mandatory owner documents and skills for every touched
  surface.
- `Problem History`: pass-log searches required or already performed, relevant
  logs, repeated symptoms, rejected shortcuts, and planner or blocker
  disposition when churn exists.
- `Project Health`: owner areas, active debt markers, repeated families,
  compatibility/delete signals, scan route, and supported-finding disposition.
- `Source Evidence`: local repo evidence and preserved external reference
  paths used for decisions; state `none` when the pass is not source-backed
  beyond local owner docs.
- `Implementation Constraints`: scope boundaries, non-goals, no-new-gate rules,
  line caps, compatibility limits, and publication limits.
- `Verification Route`: required command, optional narrow local checks, and
  whether final proof is worker-owned or caller-owned.
- `Review Route`: code-simplifier, Overview, specialist review, or caller-owned
  review obligations; unavailable or caller-owned required review keeps the
  slice WIP until completed or reported as a blocker.
- `Done When`: literal file, proof, log, review, and handoff facts required for
  the slice to be considered complete.

Do not add packet fields to `AGENTS.md`, repo skills, or adjacent standards.
Those surfaces may require, reference, or summarize the packet, but this file
owns the field list.

## Roadmaps

A roadmap is a temporary coordination artifact for decomposing broad work. It
may name waves, dependencies, risks, proof routes, review routes, and first
slice recommendations. It must keep feature behavior, architecture decisions,
domain truth, contracts, and verification policy linked to their owners rather
than redefining them.

Roadmaps must classify dirty baseline, candidate write sets, forbidden write
sets, and likely proof blockers before assigning implementation. A roadmap is
not authority to widen a worker's slice; workers follow the reduced slice brief
they receive.

## Reduced Slice Briefs

A reduced slice brief is the implementation worker's direct authority. It must
contain only the slice goal, read set, write set, direct constraints, steps, and
done-when facts needed for the worker. If a brief includes unrelated roadmap
rationale, parent conversation history, future waves, or broad review strategy,
the worker must treat that context as over-broad and ask for reduction or stay
within the explicit write set.

Slice briefs must identify whether final proof and final review are owned by
the worker or by Main. If final proof is caller-owned, the worker still runs
the assigned local checks and records any skipped required proof as WIP rather
than claiming a full handoff.

## Implementation Pass Logs

Implementation pass logs live under `build/agent-pass-logs/` and use:

- `build/agent-pass-logs/YYYY-MM-DD-<kebab-task-slug>-implementation.md`
- heading `# Implementation Pass Log: <task summary>`
- first metadata line `Timestamp: YYYY-MM-DD HH:MM:SS TZ +HHMM`

Use the local calendar date from the timestamp. If a same-day filename already
exists for a later pass, append `-2`, `-3`, or the next integer before the
suffix. Include `Parent Pass Log:` or `Related Pass Logs:` when the pass
continues, reviews, or fixes known prior work.

An implementation pass log must record:

- actor role, task goal, scope boundary, and related pass logs
- Problem History Intake: search terms, inspected logs, prior attempts,
  outcomes, repeated symptoms, or `no related churn found`; when churn exists,
  include root-cause hypothesis, deeper repair, rejected shortcuts, and planner
  escalation or blocker disposition
- touched paths and intentionally untouched dirty paths
- owner documents and mandatory skills used
- implementation summary and key tradeoffs
- code-simplifier outcome for covered passes, including lenses or role used,
  patches, skipped status, evidence path or report, and each finding
  disposition
- planner escalation outcome when systemic review, architecture-check,
  behavior-harness, or proof feedback shaped the project-health plan
- delete signals consumed, markers added for new or retained transitional
  support, retire actions, and unmarked known-support blockers
- Project Health: scan command/result, debt IDs touched, repeated families, and
  supported findings fixed, closed, blocked, or materialized
- Behavior Harness Coverage: owning harness changes, dependency suites,
  literal harness result, `Harness Gap`, or no-behavior-change evidence
- verification commands and literal results
- Wait-Time Observations for recurring long-running processes: command or
  class, elapsed time, result, evidence path, and next first-poll interval
- reversals, abandoned approaches, repeated edits, architecture friction,
  quality friction, maintainability friction, elegance friction, performance
  friction, open blockers, and review needs

## Code-Simplifier Evidence

The code-simplifier step is qualitative review-agent evidence, not a gate. A
covered implementation pass must record whether it ran, which role or lenses
were used, what changed, and how Main disposed every finding. Valid
dispositions are fixed with required proof rerun, assigned to a same-run worker
and integrated, planner-integrated, explicitly user-excluded, blocked/WIP, or
closed as false positive or review-owned with evidence.

Unclassified `deferred`, `follow-up`, `later`, `outside write set`, or unowned
`review-owned` findings block Overview readiness.

## Review Pass Logs

Aggregated review pass logs live under `build/agent-pass-logs/` and use:

- `build/agent-pass-logs/YYYY-MM-DD-<kebab-task-slug>-review.md`
- heading `# Review Pass Log: <task summary>`
- first metadata line `Timestamp: YYYY-MM-DD HH:MM:SS TZ +HHMM`

The main handoff agent writes one aggregated review pass log after each
completed Overview review cycle from the Overview result and reviewer outputs.
Nested specialist reviewers remain read-only and report pass-log evidence and
trend observations in their reviewer output.

A review pass log must record:

- review role, reviewed scope, reviewed pass logs, and verification evidence
- behavior-harness coverage, including missing `Harness Gap` blockers
- wait-time evidence when review depends on long-running proof or harnesses
- selected review panel or unavailable nested-review blocker
- findings and fix outcomes
- Problem History Intake accepted or blocked
- Project Health marker/register sync and supported-finding disposition
- trend observations, including repeated reversals, looped implementation,
  growing complexity, recurring smells, architecture loopholes, normalized
  delete signals, or repeated governance/check misses
- escalation recommendations for systemic governance, skill, check, or
  architecture changes
- final clean, blocked, or WIP status

## Stale Evidence And Harness Support

Generated logs, harness output, screenshots, and command output are stale when
the reviewed paths, behavior surface, proof route, or dirty baseline changes
after the evidence was captured. Stale evidence may explain history, but it
must not support a handoff-readiness claim.

Harnesses support behavior claims only when they exercise the owning production
route or owner API named by the relevant feature/verification standard. Manual
testing may supplement harness proof. It must not replace available
production-path harness proof, and missing credible harness ownership is a
`Harness Gap`.

## Proof And Review Ownership

Proof routes are owned by `AGENTS.md` and the quality-platform verification
standards. This standard only says how to record proof evidence in
implementation documentation. Required proof tools run at the top-level
handoff layer unless a slice brief explicitly assigns a narrower worker-owned
check.

Review routing is owned by `docs/project/architecture/agent-instructions.md`
and the global review skills. This standard records the log artifacts and field
requirements for those reviews. It must not create SaltMarcher-local copies of
global review skills.

## References

- [Agent Instruction Standard](/home/aaron/Schreibtisch/projects/SaltMarcher/docs/project/architecture/agent-instructions.md:1)
- [Agent Context Standard](/home/aaron/Schreibtisch/projects/SaltMarcher/docs/project/architecture/agent-context.md:1)
- [Documentation Standard](/home/aaron/Schreibtisch/projects/SaltMarcher/docs/project/architecture/documentation.md:1)
- [Project Health Standard](/home/aaron/Schreibtisch/projects/SaltMarcher/docs/project/architecture/project-health.md:1)
- [Quality Platforms](/home/aaron/Schreibtisch/projects/SaltMarcher/docs/project/verification/quality-platforms.md:1)
- [Quality Platforms Local Entrypoints](/home/aaron/Schreibtisch/projects/SaltMarcher/docs/project/verification/quality-platforms-local-entrypoints.md:1)
- [Source References Standard](/home/aaron/Schreibtisch/projects/SaltMarcher/docs/project/verification/source-references.md:1)
