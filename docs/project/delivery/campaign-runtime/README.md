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
- Before GM-Core completion there are no users or non-disposable legacy data,
  so this slice has no legacy-store compatibility or conversion obligation.
  Future released-format updates remain governed by `TN-18` and export/import
  compatibility by `TN-19`.
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

## Accepted Foundation Checkpoint

Commit `1c570d287` establishes only the runtime, registry, admission, readiness,
and close foundation. The local candidate ran literal `./gradlew check` green
in 6m 47s. A fresh independent reviewer then replayed the selected production,
lifecycle, rollback, crash-recovery, and concurrency routes in one Gradle
invocation: 77 tests, 0 failures, 0 errors, and 0 skips in 1m 2s. The reviewer
reported no blocker, major, or minor finding and confirmed unchanged candidate
HEAD and tracked tree. Store separation, activation coordination, the visible
journey, desktop acceptance, and merge qualification remain open.

## Accepted Store-Lifetime Checkpoint

Commit `df4d42071` separates the installation registry and reusable-definition
stores from Campaign-owned stores and gives each Campaign fresh components,
published state, UI dispatch, admitted lanes, and database ownership. The
production route uses `installation.sqlite` only for installation-owned truth
and a separate SQLite file for each Campaign; the removed mixed `game.db`
startup topology is neither opened nor converted. Literal `./gradlew check`
passed in 6m 46s. A fresh independent replay
with build cache disabled executed 46 selected tests in 1m 20s with 0 failures,
errors, or skips, unchanged HEAD/tree, and no blocker, major, or minor finding.
Activation coordination and the visible switch journey remain open.

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

Independent evaluation at `1c570d287` was `inconclusive`. The overlapping
baseline and serialized candidate pairs all failed before Gradle tasks because
the isolated environment could not create its local lock-contention socket.
The candidate lock intervals did not overlap, but neither the historical
shared-output race nor any JUnit semantics ran. The four-invocation budget was
exhausted and rollback removed the external lock and isolated worktree cleanly.
`A-0.3.0` and this slice's pin therefore remain unchanged.

### Adopted Causal-Oracle Candidate

After the inconclusive concurrency trial, compare `A-0.3.0` with one candidate
that adds exactly one checkpoint rule: the acceptance-deciding oracle receives
one disposable causal negative control, which must make that proof fail or
become inconclusive before the unchanged positive route may pass. Freeze the
historical Campaign-fence workload where a no-op `initialize()` and an
unadmitted Party hydration tail could both appear green in isolation but the
full suite timed out. The candidate substitutes the known no-op root and holds
the transitive hydration tail separately, then replays the repaired
`createSession("post-resume")` route with the production-equivalent admitted
lane. Limit the trial to one additional focused invocation and 10 minutes in an
isolated, Gradle-capable worktree.

Adopt only if the negative controls reject both false proofs, the repaired
positive route remains green, severe-finding detection and product acceptance
are unchanged, and rollback is clean. Reject false rejection or candidate-
attributed regression; non-comparable execution is `inconclusive`. This is a
reversible one-checkpoint canary. Aletheia B supplies the comparison but cannot
evaluate or approve it; no process version or slice pin changes before an
independent verdict.

At `7895aa938`, the independent evaluator ran the frozen three-method Gradle
replay in an isolated worktree:

```shell
./gradlew test \
  --tests 'features.sessionplanner.qualification.SessionPreparationProductionRouteTest.causalControlNoOpInitializeCannotClaimResumedPublication' \
  --tests 'features.sessionplanner.qualification.SessionPreparationProductionRouteTest.causalControlRawPartyHydrationExposesPrematureDrain' \
  --tests 'features.sessionplanner.qualification.SessionPreparationProductionRouteTest.campaignFenceDrainsAcceptedRealPreparationCommitAndRejectsLaterRootThenResumes' \
  --console=plain --no-daemon
```

It completed `BUILD SUCCESSFUL` in 1m 21s; the XML result was 3 tests, 0
failures, 0 errors, and 0 skips in 4.793s, with SHA-256
`a18507563b7a65605ef82f2b13625838e5730a06927371a2a86aa3f1f591e65b`.
Both causal controls rejected their false proof and the unchanged repaired
route passed. The evaluator reported no finding and restored the candidate
checkpoint and clean tree through canary rollback, then returned `ADOPT`.
Product Process `A-0.3.1` therefore applies at subsequent slice boundaries;
this running slice retains its `A-0.3.0` pin. The disposable test patch,
worktree, and transient report were removed by the required rollback, so no
durable proof file remains for later byte-level reinspection; that limits
auditability of the preserved report, not the evaluator's practical run.

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
