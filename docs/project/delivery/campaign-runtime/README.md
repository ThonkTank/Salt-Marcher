Status: Active
Owner: SaltMarcher Team
Last Reviewed: 2026-07-24
Process Pin: A-0.3.0 at 25a3610b83b8959099cf84a8de5d309fb62cea91
Candidate Base: 25a3610b83b8959099cf84a8de5d309fb62cea91
Source of Truth: Temporary delivery state for Campaign runtime slice #557.

# Campaign Runtime Slice

## Acceptance

This slice implements canonical `AC-F01` and `AC-F02`, with only the minimum
`AC-L01` and `AC-D01` state needed to prove a usable empty primary Scene and
exact restart resume. Product behavior remains owned by the [Program Capability
Requirements](../../requirements/requirements-program-capabilities.md); this
file owns only current delivery state.

The production journey creates Campaigns Alpha and Beta using only a name,
gives each distinct Scene, Encounter, and Party travel state, switches
`Alpha -> Beta -> Alpha -> Beta` without closure or confirmation, restarts the
process, compares semantic state, and accepts another durable mutation.

## Entry Evidence

A disposable production-assembly probe at `95fcdb199` composed a shared
Creature-definition store plus separate real SQLite/feature graphs for Alpha
and Beta. Distinct Scene, Encounter-filter, and Party-travel state survived
parallel use, close/reopen, and a following mutation without leakage. The
focused JUnit run was green (`1` test, `0` failures, `2.124 s`). Product sources
were unchanged between that revision and the candidate base, but this entry
probe is hypothesis evidence only and is not a candidate replay.

The same probe falsified treating today's `AppBootstrap` as a switchable
runtime: it owns one mixed store/component graph, its assembled components are
private and start-only, and the shell has no unregister/dispose boundary. The
first implementation step is therefore the runtime/composition lifetime cut,
not a selector, table-copy bridge, or partial `campaign_id` retrofit.

## Safety And Exclusions

- Do not modify real Campaign data during development or automated proof.
- Legacy-store conversion requires a restore-tested backup, isolated rehearsal,
  semantic readback, and separate owner approval before real-data cutover.
- Campaign copy/import/export/deletion, new travel semantics, Encounter
  completion, weather, music, history, and multi-OS qualification remain later
  acceptance slices.
- The permanent owner boundary must already isolate all current Campaign-owned
  stores; later behavior must not require rescoping new global truth.

## Current Work

1. Introduce an explicit Campaign runtime lifetime with readiness, quiescence,
   and deterministic close around Campaign-owned stores and feature graphs.
2. Separate installation-owned definitions/registry from Campaign-owned stores.
3. Add name-only create and atomic runtime activation through the production
   shell.
4. Qualify isolation, switch/restart truth, failure boundaries, responsiveness,
   keyboard operation, and the representative next durable mutation.

## Aletheia B Process Candidate

Concurrent `clean test` invocations in this shared worktree demonstrably raced
while deleting and rebuilding `build/classes`, so their failures could not be
attributed to the product candidate. Compare baseline `A-0.3.0` with
`A-0.3.1-candidate` at one pinned checkpoint. Change only the maximum Gradle
concurrency per shared worktree: the candidate designates one Gradle owner and
uses one per-worktree OS lock outside `build/` so at most one invocation runs;
separate worktrees remain independent.

Freeze these workloads with `clean test --rerun-tasks --no-build-cache
--no-configuration-cache --no-daemon --console=plain`: `G1` selects
`WorkflowAdmissionControllerTest`, `SqliteDatabaseTest`, the
`SessionPreparationProductionRouteTest.campaignFenceDrainsAcceptedRealPreparationCommitAndRejectsLaterRootThenResumes`
method, `CampaignRuntimeLifecycleTest`, `AppBootstrapLifecycleTest`, and
`SmokeStartupTest`; `G2` selects `CampaignRegistryIntegrationTest`. A fresh
independent evaluator runs one concurrently submitted baseline pair and one
concurrently submitted candidate pair, with at most five Gradle invocations and
90 minutes total. Capture checkpoint/tree identity, literal output, exit status,
submission and lock intervals, expected JUnit results, and post-run Git state.

Adopt only if the overlapping baseline reproduces the shared-output race, the
candidate intervals do not overlap, both candidate workloads retain all
selected semantic checks and pass, no severe-finding detection regresses, and
rollback is clean. Reject a candidate-attributed failure, overlap, hidden or
weakened proof, or dirty rollback. If the baseline race is not reproduced or
conditions are not comparable, record `inconclusive`, never improvement. The
candidate is a reversible canary: cease owner/lock scheduling and remove only
its disposable external state after preserving proof. The independent
evaluator alone records the verdict; no process definition, version, or this
slice's process pin changes before adoption.

## Frozen Exit Replay

The candidate must provide `app.CampaignRuntimeProductionJourneyTest`; an
independent evaluator reruns it from the candidate commit with
`./gradlew test --tests app.CampaignRuntimeProductionJourneyTest
--console=plain`. The test must exercise production composition and SQLite in a
temporary data directory for the complete `Alpha -> Beta -> Alpha -> Beta`,
process-restart, semantic-readback, and next-mutation journey. A passing result
is necessary but does not replace visible keyboard and desktop acceptance.

## Exit

Exit requires production-route and fault evidence for every acceptance outcome,
independent replay against the pinned process, literal green `./gradlew check`
and required CI, installed desktop proof, and Aaron's personal acceptance of
all visible functions in scope. On exit this temporary file is deleted and
durable behavior remains only in its canonical owners.
