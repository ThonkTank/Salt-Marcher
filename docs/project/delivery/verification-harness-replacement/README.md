Status: Active
Owner: SaltMarcher Team
Last Reviewed: 2026-07-15
Source of Truth: Temporary W000-W007 delivery contract, milestone state,
blocker, and next transition for replacing the verification harness and cutting
over its governance.

# Verification Harness Replacement Delivery

## Why This Exists

The owner goal is one simple, honest, fast, headless verification system and
one required proof command. Accepted observable behavior is preserved while
legacy harnesses, duplicate proof routes, migration controls, and external
review/analyzer jobs are deleted. This file is temporary and is deleted when
W007 closes.

Stable behavior remains in requirements and feature verification. Stable
safety and acceptance boundaries remain in project policy and ADRs.

## Scope Boundary

In scope: governance and required-check cutover, `test/**`, verification
wiring, build logic, architecture rules, analyzer configuration, area harness
replacement, branch protection, and the documentation needed to publish the
resulting stable task model.

Out of scope: new product behavior, persistence/data migration, paid services,
secret movement, and preservation of internal harness form as behavioral truth.

## Owner-Approved Target

### Proof Surface

- The sole required local and CI public proof is `./gradlew check`.
- `test`, `uiTest`, and `architectureTest` are diagnostic tasks. They help
  investigate failures but never replace the required `check` verdict.
- `production-handoff`, `focused-handoff`, the staged-verification wrapper,
  pre-commit execution, and the scheduled nightly forced route are Reject/Delete
  after the replacement is authoritative.
- Forced qualification uses the same public surface:
  `./gradlew check --rerun-tasks`.

### Verification Structure

- One `test` source set contains JUnit tests selected by tags; Gradle exposes
  only the three diagnostic tasks above plus the required `check` aggregate.
- Monocle provides one shared headless JavaFX bootstrap per worker JVM.
- Duplicate aggregate execution is removed. Each accepted scenario executes
  once per required run with named, machine-readable results and honest inputs.
- ArchUnit is the one architecture engine across every production root.
- Internal analyzers survive only when the W005 uniqueness audit proves an
  exclusive defect class. External analyzer jobs are deleted.

### Governance

- Delete Warden, the AI Judge, risk labels/classes, tier controls, frozen
  controls, the former marker/register mechanism, and external analyzer jobs.
- Retain feature branches, pull requests, one green required `check`,
  data/cost/secret safety, and owner authority over stable acceptance.
- Current R3c rules are temporary constraints only until the W002 governance
  cutover; they are not part of the target operating model.

### Behavior Replacement

For each area wave, derive the accepted observable scenarios from requirements,
current feature verification, and owner acceptance. Record each scenario as
`Adopt`, `Adapt`, or `Reject`, implement the accepted set in the new JUnit
surface, prove it through `check`, and delete that area's old harness in the
same slice. No wave leaves a permanent dual system.

Internal assertion form, task topology, implementation shape, and hard
wallclock scenario thresholds are not acceptance obligations. Functional
straight-stair preview behavior remains accepted; the old `DE-STAIR-001`
250 ms threshold is Reject.

## Binding Qualification Targets

- Two consecutive warm owner-machine `./gradlew check --rerun-tasks` runs each
  complete in 12 minutes or less with identical green verdicts.
- Warm no-change `./gradlew check` completes in 30 seconds or less.
- `check` opens no visible windows and never steals focus.
- One test source set, one JUnit/tag selection mechanism, one ArchUnit engine,
  and no duplicate execution of accepted scenarios.
- Adding ordinary behavior coverage changes test code only; no registry or
  bespoke build mapping is required.

## Obligation Dispositions

| Prior obligation | Disposition | Owner-approved target |
| --- | --- | --- |
| Proportional latency | Adapt | One required `check`; <=12m forced and <=30s no-change targets. |
| Trustworthy skips | Adapt | Honest Gradle inputs; final qualification includes two forced runs. |
| One mechanism per concern | Adopt | JUnit/tags, ArchUnit, and Gradle input tracking each have one role. |
| Hermetic reproducibility | Adapt | Same tree and inputs yield the same observable verdict; no scenario duration contract. |
| Named scenario results | Adapt | Accepted scenarios are derived area-by-area before conversion. |
| Low marginal test cost | Adopt | Ordinary tests require no registry or build-map edit. |
| Hardware utilization | Adapt | Bounded parallelism must meet both binding owner-machine targets. |
| Minimal infrastructure | Adapt | W005 keeps unique internal analyzers; external analyzer jobs are Delete. |
| Non-disruptive local execution | Adopt | Required and diagnostic UI proof remains headless. |
| Stable wrapper entrypoints | Reject/Delete | `check` is the sole required public proof after W002/W007 cutover. |
| Scheduled nightly forced proof | Reject/Delete | Final forced qualification uses two direct owner-machine `check --rerun-tasks` runs. |
| Frozen scenario form | Reject | Observable behavior is classified Adopt/Adapt/Reject per area. |
| Per-commit dossier and cross-model reviewer | Reject/Delete | No reviewer service or dossier remains. |

## Current Foundation And Blocker

Monocle headless configuration, bounded parallel settings, configuration cache,
and isolated Gradle-managed runtime paths have landed. The historical warm
baseline was 24m 28s forced and 12s no-change; it is evidence only and does not
weaken the binding targets above.

The duplicate aggregate execution blocker is not independently failing
behavior. The full Dungeon Editor aggregate runs beside its component harnesses
under parallel UI load. Forced full runs failed in 15m 3s and 14m 3s on a
room-preview duration assertion and `HEX_EDITOR_012` JavaFX wait timeout; the
isolated room harness passed in 3m 27s and the isolated hex harness passed in
1m. W003 removes duplicate aggregate execution before final timing proof.

## Milestones

| Milestone | State | Completion contract |
| --- | --- | --- |
| W000 Cleanup and delivery bootstrap | In progress; candidate sealed for publication | Publish governance cleanup, this manifest, focused proof, independent review, and merge. |
| W001 Clean Planning Bundle | Pending | Sync `main`; map live governance, tasks, roots, analyzers, areas, and accepted proof owners; produce reviewed W002-W007 waves. |
| W002 Governance and one-check cutover | Pending | Make `check` the sole required local/CI proof; explicitly supersede ADR 0001's Warden, Judge, risk-class, and frozen-surface guardians; update ADR 0001 and every affected stable owner document or ADR during the cutover so no contradictory stable authority remains; delete their implementations, legacy wrappers/routes, tier controls, and external analyzer jobs; retain branch/PR/green-check and safety/acceptance boundaries. |
| W003 One source set and duplicate removal | Pending | One test source set, JUnit tags, Monocle shared bootstrap, diagnostic `test`/`uiTest`/`architectureTest`, and no duplicate aggregate execution. |
| W004 One ArchUnit engine | Pending | ArchUnit covers all production roots; every retained rule has a direct negative rehearsal; old architecture engines and mains are deleted. |
| W005 Analyzer uniqueness audit and diet | Pending | Finding diffs prove each kept internal analyzer's unique class; duplicates and external analyzer jobs are deleted. |
| W006 Area waves | Pending | Replace and delete old harnesses in exact order: Encountertable; Creatures; Party; Encounter + World Planner backend; small UI surfaces; Hex; Dungeon core; Dungeon Editor. Each slice records scenario Adopt/Adapt/Reject and leaves no dual system. |
| W007 Final legacy teardown and acceptance | Pending | Delete remaining legacy routes/machinery; two warm forced runs each <=12m; warm no-change <=30s; branch-protection readback; owner acceptance; delete this delivery directory. |

## Deletion Target

Delete the staged wrapper and its public routes, pre-commit/nightly routing,
Warden, AI Judge, risk labels/classes, tier and frozen controls, external
analyzer jobs, old area harnesses, duplicate aggregate registrations, bespoke
selection registries/maps, extra source sets, duplicate architecture engines,
and obsolete display routing. Delete each superseded area harness in its W006
slice; delete remaining shared legacy machinery in W007.

## Current Position

- Active milestone: W000 Cleanup and delivery bootstrap.
- Candidate identity: the W000 candidate is sealed by the containing commit;
  after publication, its PR and CI evidence are authoritative.
- Current blocker: None. The duplicate aggregate execution blocker is assigned
  to W003 after W002 establishes the one-check governance surface.
- W001-W007 remain pending; no later implementation starts before the clean
  W001 Planning Bundle is reviewed.

## Writer Allocation

- Active writer: the W000 Implementer, limited to the cleanup, governance,
  delivery, workflow-instrument, and seal-proof surfaces required to publish
  this milestone.
- Verification Runner and Reviewer: read-only roles against the sealed W000
  candidate; neither shares write ownership.
- Post-merge writer: the W001 Planner after W000 merges and `main` is synced.
  No W001-W007 implementation worker is active before its Planning Bundle is
  reviewed.

## Next Transition

Publish and merge W000, sync `main`, then launch the W001 Clean Planning Bundle.

## Neighboring Canonical Owners

- [Documentation Standard](../../documentation.md)
- [Agent Instruction Standard](../../architecture/agent-instructions.md)
- [Verification Core Architecture](../../architecture/verification-core.md)
- [Quality Platforms](../../verification/quality-platforms.md)
- [ADR 0004](../../decisions/0004-content-addressed-harness-verification.md)
- [ADR 0005](../../decisions/0005-governance-cleanup-and-local-hook-removal.md)
