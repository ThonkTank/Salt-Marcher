Status: Concept complete
Owner: Aletheia B3 concept subagent
Charter Version: C-0.7.0
Process Version: B3-1.1.0
Brief: ./brief.md (frozen at c0e59ad6d, product baseline fb229a119)

# B3 Concept — Switch-Cycle Containment And Resource Steady State

## 1. Mechanism Map: What One Activation Cycle Allocates And Where It Is Released

All paths below verified against the worktree sources at baseline `fb229a119`.

### 1.1 Resource inventory per activation cycle

One production candidate preparation (`AppBootstrap.prepareCampaignCandidate`,
`app/AppBootstrap.java:293-390`) allocates, per cycle:

| # | Resource | Created at | Type |
|---|----------|-----------|------|
| R1 | `SerialExecutionLane` ("salt-marcher-runtime") | `AppBootstrap.java:314` | 1 daemon thread + single-thread executor |
| R2 | 8 `BoundedExecutionLane`s ("campaign-creatures-read", "campaign-items-read", "campaign-session-generation-cpu/io", "campaign-encounter-generated-cpu/io", "campaign-session-preparation-cpu/io") | `AppBootstrap.java:315-328` | ~15–2N daemon threads (fixed pools, 2 or `max(2, cores-1)` each) |
| R3 | `RevocableUiDispatcher` around the shared `JavaFxUiDispatcher` | `AppBootstrap.java:309` | queued-task set + drain future (no thread of its own) |
| R4 | `WorkflowAdmissionController` + admitted lane/dispatcher wrappers | `CampaignRuntime.open`, `CampaignRuntime.java:274-284` | identity maps of admitted delegates, workflow counters |
| R5 | `SqliteDatabase` (per-Campaign `campaign.sqlite`) | `AppBootstrap.java:331-337` | JDBC connections are strictly per-operation (`openConfigured` in try-with-resources or `closePreparationConnection`, `SqliteDatabase.java:386-434,696`); `SqliteDatabase.close()` only flips a `closed` flag (`SqliteDatabase.java:417-419`) — the durable resource is the file handle lifetime of each short-lived connection plus WAL/SHM/journal sidecars |
| R6 | Closure executor ("salt-marcher-campaign-closure") | `CampaignRuntime.java:200-205` | 1 daemon thread |
| R7 | Feature-component graph (`Components`: creatures, party, encounter, scene, session planner, catalog, …) | `CampaignRuntime.createComponents`, `AppBootstrap.buildPreparedCandidate` | model subscriptions, `AppShell` + `Scene` UI nodes |
| R8 | `CampaignShell` (the production `Candidate`) | `AppBootstrap.java:359-361` | owns R1–R7 as one aggregate |

Coordinator-level, allocated once per coordinator (not per cycle): "salt-marcher-campaign-activation" transitions thread and up to 4 "salt-marcher-campaign-invocation" workers (30 s idle keep-alive), `CampaignActivationCoordinator.java:373-391`. Per create-cycle only: `CreateReservation` directory + `campaign.sqlite` file (`reserveNewCampaign`, `:1998-2024`).

### 1.2 Release paths

- **Successful switch** (`activate` → `rollForward`, `:1005-1242`): prior candidate goes through `retirePriorAfterActivation` (`:1902-1925`) — either PARKED (kept alive intentionally: `prepareForParking` → `database.capturePreparedParkedState`; at most one parked slot, `parked == null` guard) or `closeDetached` → `Candidate.closeAsync` = `CampaignShell.closeAsync` (`app/CampaignShell.java:157-…`): revokes/drains R3, closes catalog, `runtime.quiesceAsync()` (`CampaignRuntime.java:621-689`) which revokes admission (R4), closes components (R7), `admission.closeDelegatesAfterDrain()` closes R1+R2 (bounded lanes via `terminateNow(1s)`, `WorkflowAdmissionController.java:123-171`), closes R5 flag, then `closureExecutor.shutdown()` (R6). Expected steady state for the alternating warm A/B mix: exactly 2 live aggregates (active + parked); the journey test already asserts `observedRuntimes.size() == 2` and named-thread count ≤ 60.
- **Cancel-before-commit** (pointer never committed): `releaseBeforeCommit(lease, reservation)` (`:1878-1888`) — a PARKED-origin lease is re-parked instead of closed; a FRESH lease goes to `cleanupBeforeCommit` → `closeDetached` (+ reservation delete for creates). The prior is restored via `restoreConfirmedPrior` (`:1759-1816`): `resumeAdmission()` if paused, republish if publication was lost. Paths: pre-commit gate throw / commit exception → `resolveAmbiguousCommit` (`:1165-1209`) with durable == prior; non-committed pointer statuses (STALE_GENERATION etc.) at `:1154-1160`.
- **Failure-after-commit** (pointer committed, publication/activation failed): `rollForward` catch → `closeDetached(prior)` then `enterRecovery`/`enterPublicationTimeoutRecovery`; the *new* candidate is retained inside `RecoveryCampaign` until `recoverDurableActive` (`:461-651`) either promotes it (RESUMED) or contains it (`containRecoveryCandidateBeforeCommit`/`closeDetached`). Revoked publications: `PublicationAttempt` (`:2676-2871`) cancels `PublishedRootReadinessAttempt` and `CampaignDeskHost.RootReadinessAttempt.retainsPublishedRoot()` must go false.
- **Failed closes**: `closeDetached` failures park the aggregate in `pendingClose` (IdentityHashMap) and set the coordinator degraded (`allocationBlocked`, `:1986-1988`); every subsequent submit retries (`retryDetachedClosures`, `retryCleanupObligations`, `:2136-2156`). `CloseObligationTracker` counts in-flight close stages.
- **PARKED retirement**: `evictParkedBeforePreparation` (`:1862-1876`) closes the parked aggregate before any *third* campaign is prepared; `takeReusableParked` revalidates via `parkedStateStillValid` → `database.verifyPreparedParkedState` and closes on invalidity (`activate`, `:1024-1045`).

**Structural leak candidates the probe must be able to see** (why the workload must include cancels and failures, not only the already-qualified success path): (a) re-park on `releaseBeforeCommit` when the parked slot is already occupied by a different aggregate falls to close — any miss leaves 30+ threads per miss; (b) `RecoveryCampaign` retains candidate + pending stages; a stage that never settles blocks close obligations; (c) `invocations` pool growth under repeated cancels (bounded at 4, but `invocationWorkersForTesting()` exposes it); (d) SQLite sidecar files (WAL/SHM/journal) left by a candidate whose lanes were shut down mid-write.

### 1.3 Existing observability (no production change needed)

- `CampaignActivationCoordinator`: `pendingCloseAttemptsForTesting()`, `trackedCloseObligationsForTesting()`, `invocationWorkersForTesting()`, `snapshot()`, `activeRuntimeForTesting()`.
- `CampaignRuntime`: `state()`, `components()` for durable-mutation checks.
- Journey test precedent: `campaignRuntimeThreadCount()` (name-filtered `Thread.getAllStackTraces`), `observedRuntimes` identity set, WAL/SHM/journal absence assertions, `acceleratorSnapshot`.
- `CampaignDeskHost.RootReadinessAttempt`: `retainsPublishedRoot()`, `pulseObservations()`.
- JVM: `ManagementFactory` thread/memory beans; `com.sun.management.UnixOperatingSystemMXBean.getOpenFileDescriptorCount()` plus `/proc/self/fd` enumeration filtered to paths under the probe's campaign root (Linux dev machine per RP-R).

## 2. Harness Study: Production Composition Route To Reuse

`test/app/CampaignRuntimeProductionJourneyTest.java` (tag `ui`, Monocle headless via `build.gradle.kts:96-103`, FX started once per fork by `test/testsupport/JavaFxRuntime`) is the frozen M1 Alpha/Beta journey. Its composition route, which the probe reuses verbatim:

1. `new AppBootstrap(NoopDiagnostics, new SerialExecutionLane, new JavaFxUiDispatcher(), new SqliteDatabase(installationPath))` (`bootstrapAt`, journey test `:1119-1125`).
2. `bootstrap.openCampaignActivationAsync(campaignRoot, host)` → real `InstallationRuntime` + real `CampaignActivationCoordinator` with the production `CandidateFactory` (`prepareCampaignCandidate`) that builds real lanes, real per-campaign `SqliteDatabase`, real `RevocableUiDispatcher`, real `AppShell`/`Scene`.
3. `SwitchingHost` = a probe-local harness wrapping the production `CampaignDeskHost` on a real `Stage` (copy of the journey test's private `ProductionHostHarness`; it delegates `switchCampaign` / `showRecovery` / `awaitPublishedRootReady` / `installSelectorAccess` to the real desk host).
4. Mutations = `coordinator.activeRuntimeForTesting().components().scene().application().execute(SceneCommand.Create…)` and hex/party mutations, exactly the frozen `mutateAndAssert` shape.
5. Restart = second `AppBootstrap` over the same `installationPath` + `resumeDurableActive()` (journey test does this in-process; sufficient for deciding metric 4).

Fault-injection seams that already exist (no production change):
- `bootstrap.installCampaignPreCommitGateForTesting(gate)` — throw before pointer commit → cancelled-before-commit (`resolveAmbiguousCommit` restores prior, releases lease).
- Stale `expectedGeneration` on `switchTo`/`create` → non-committed pointer → clean `releaseBeforeCommit` (second cancel variant, exercises re-park path).
- `harness.failAfterRootSwap()` → `CampaignDeskHost.failAfterRootSwapForTesting()` — deterministic failed-after-commit without waiting on timeouts.
- `publisher.hideOnNextReadiness()` + `installCampaignActivationPhaseTimeoutForTesting(2s)` — timeout-flavored failed-after-commit (used sparingly; wall-clock cost).
- `installNextPreparationSettlementForTesting` / `installNextPriorDrainSettlementForTesting` — contained-recovery stages if needed.

## 3. Chosen Probe Design

**Test class**: `test/app/CampaignSwitchCycleContainmentTest.java`, `@Tag("ui")`, run with `./gradlew uiTest --tests app.CampaignSwitchCycleContainmentTest` (also selectable from `test`). One deciding test method plus one negative-control test method plus one benign-control test method in the same class so all three share one oracle implementation.

### 3.1 Deciding probe (one method, single JVM fork)

Setup: probe-local copy of `ProductionHostHarness`; bootstrap at `@TempDir`; create Alpha and Beta (`create("Alpha",0)`, `create("Beta",1)`), each seeded with a campaign-tagged scene note and hex/party mutation.

**Warmup**: 5 successful Alpha↔Beta switch pairs (matches the frozen journey's `WARM_SWITCH_WARMUPS = 5`), so the steady state contains exactly the intended {active, parked} pair and JIT/lane pools are warm.

**Baseline sample S0** after warmup + settling protocol (below).

**Cycle mix — 24 cycles**, 8 repetitions of a 3-cycle block:
1. *Successful switch* to the other campaign (`switchTo`, expect ACTIVATED); write a cycle-tagged durable scene note; assert the previous campaign's last note is untouched after the next switch back (cross-Campaign oracle).
2. *Cancelled-before-commit*, alternating two variants: (a) pre-commit gate armed to throw once (`installCampaignPreCommitGateForTesting` with an `AtomicBoolean`), expect `PRE_COMMIT_FAILED`, phase back to ACTIVE; (b) `switchTo` with stale generation, expect `STALE_GENERATION`. After each: deciding metric 4 — execute one durable mutation on the restored prior runtime and assert SUCCESS (restart survival asserted once at the end).
3. *Failed-after-commit*: `harness.failAfterRootSwap()` then `switchTo`, expect `RECOVERY_REQUIRED`; `recoverDurableActive()`, expect `RESUMED`; assert `retainsPublishedRoot()` false on the revoked readiness attempt; durable mutation on the recovered runtime.

**Mid sample S1** after cycle 12, **end sample S2** after cycle 24 (three points ⇒ trend detection, not just endpoint delta).

**Revoked-generation oracle** (deciding metric 2): before each successful switch, capture the outgoing runtime's `components().scene().application()` and the outgoing `Candidate`'s dispatcher path; after the switch commits, attempt one mutation through the captured stale runtime and assert it is rejected (`IllegalStateException`/`RejectedExecutionException`/`DispatchRejectedException` — admission is revoked or paused) AND that a fresh read-only JDBC connection to that campaign's `campaign.sqlite` shows no new row. Count of admitted revoked writes must be 0.

**Cross-Campaign oracle** (deciding metric 1): every mutation is tagged with campaign name + cycle index; after every switch, read both campaigns' authoritative rows (active via components, inactive via read-only external JDBC as the journey test does with `DriverManager`) and count any row appearing in the wrong campaign file. Must be 0 across all cycles.

**Settling protocol for each sample S0/S1/S2** (deciding metric 3):
1. Await coordinator quiet: `snapshot().phase() == ACTIVE`, `pendingCloseAttemptsForTesting() == 0`, `trackedCloseObligationsForTesting() == 0` (bounded poll, 30 s).
2. Drain FX: `runOnFx(no-op)` twice + 3 `awaitFxPulses`.
3. Forced-GC settle: loop up to 10×: `System.gc()`, 100 ms sleep, until the WeakReference set (below) stops shrinking twice in a row.
4. Record:
   - `campaignThreadCount` — name-filtered live threads ("salt-marcher-runtime", "salt-marcher-campaign-closure", "campaign-*" pool prefixes; same filter as the frozen journey test);
   - total live non-daemon thread count (whole JVM, for the brief's metric wording);
   - open campaign file handles — `/proc/self/fd` entries resolving under the probe's campaign root (counts DB + WAL/SHM/journal), plus `UnixOperatingSystemMXBean.getOpenFileDescriptorCount()` as secondary;
   - WAL/SHM/journal sidecar existence for both campaign files (journey-test precedent: must be absent at rest);
   - retained aggregates — every `CampaignRuntime` ever observed via `activeRuntimeForTesting()` is put into a `WeakHashMap`-backed identity set; after GC, strongly-reachable count must be ≤ 2 (active + parked);
   - `invocationWorkersForTesting()`, `ManagementFactory.getMemoryMXBean().getHeapMemoryUsage().getUsed()` post-GC.

**Pass criteria** (deciding metric 3): S1 and S2 within 10% of S0 on campaign threads, non-daemon threads, campaign FDs, retained aggregates (exact: ≤ 2), post-GC heap; and no monotonic growth S0 < S1 < S2 on any counter (trend guard). Per-cycle warm-switch latency recorded; scaling guard = mean of last 4 successful-switch cycles ≤ 1.5 × mean of first 4 post-warmup successful-switch cycles.

**Restart proof** (metric 4 tail): close bootstrap, reopen `AppBootstrap` on the same installation, `resumeDurableActive()`, assert the last cycle-tagged notes of both campaigns are present.

### 3.2 Negative control (guard metric)

Separate test method, probe-local fake, zero production change: drive `CampaignActivationCoordinator` directly (fake-candidate style of `CampaignActivationCoordinatorTest`) with a probe-local `Candidate` whose factory allocates a real `BoundedExecutionLane` named with a production prefix (`campaign-creatures-read`) but whose `closeAsync()` deliberately completes **without** closing that lane (suppressed lane release). Run 3 switch cycles, apply the identical sampling/settling helper, and assert the oracle **fails** (campaign thread count grows above baseline+10%). Benign control: the same fake with a correct `closeAsync` plus an unrelated benign change (e.g., extra completed no-op stage) must **pass** the same oracle. This proves oracle sensitivity and specificity without touching production code.

### 3.3 Determinism guard

The evaluation phase runs the deciding class 3× consecutively (`./gradlew uiTest --tests app.CampaignSwitchCycleContainmentTest --rerun-tasks`, or 3 invocations); all three must agree.

## 4. Alternatives Considered

| Design | Verdict | Reasoning |
|---|---|---|
| **A (chosen): in-process production-composition probe** via `AppBootstrap.openCampaignActivationAsync` + real `CampaignDeskHost` under Monocle headless; faults via existing ForTesting seams; in-process restart via second `AppBootstrap` | chosen | Allocates the *real* resources the hypothesis is about (real lanes, real per-campaign SQLite files, real FX nodes, real admission controller). Signals correlate 1:1 with the frozen M1 journey (same bootstrap, same host, same mutations). Fault injection is deterministic (gate throw, stale generation, `failAfterRootSwapForTesting`) rather than timing-dependent. |
| **B: pure-unit fake-candidate probe** on the coordinator alone (as in `CampaignActivationCoordinatorTest`) | rejected as deciding probe; adopted for the negative control | Fully deterministic and fast, but fakes allocate no lanes, no DB, no UI — it can only decide coordinator bookkeeping (`pendingClose` counts), not whether the *production* aggregate actually releases threads/FDs/heap. A pass would not falsify the leak hypothesis; the brief's metric 3 is about real resources. It is, however, the ideal vehicle for the suppressed-release negative control because the fake is probe-owned. |
| **C: process-level restart probe** (spawn fresh JVMs per phase, compare RSS/`/proc` of child processes) | rejected | Highest realism for "resident memory", but resolution is poor (JVM heap sizing, JIT, GC and malloc arenas dominate RSS deltas far beyond a 10% band), per-resource attribution is lost (cannot count retained aggregates or ask the coordinator its obligation counts), it needs bespoke child-process plumbing outside the repo's harness, and it burns the compute budget. In-process restart (journey-test precedent) already decides the durable-survival metric. |
| **A′: timeout-driven failure injection only** (`hideOnNextReadiness` + short phase timeout) instead of `failAfterRootSwap` | folded in as a minority variant, not the backbone | Timeout paths add wall-clock stalls and are load-sensitive (flaky under parallel forks); `failAfterRootSwapForTesting` reaches the same failed-after-commit recovery deterministically. One timeout-flavored cycle may be kept if run time allows, since `PublicationTimeoutException` recovery retains extra pending stages worth covering. |

## 5. Risks / Confounders And Controls

1. **JavaFX toolkit in headless CI/test JVM** — all `Test` tasks already force Monocle headless (`glass.platform=Monocle`, `monocle.platform=Headless`, `prism.order=sw`); FX is started once per fork by `testsupport.JavaFxRuntime` and its application thread is a persistent expected thread. Control: probe never asserts absolute whole-JVM thread lists; the strict oracle is name-filtered; whole-JVM non-daemon count is compared S0→S2 within the same JVM, so the FX thread cancels out.
2. **GC nondeterminism** — `System.gc()` is advisory. Control: retention is decided by the WeakReference identity-set oracle with a bounded settle loop (stable-twice criterion), which turns "heap within 10%" from the deciding signal into a corroborating one; the deciding aggregate count (≤ 2) is exact, not statistical.
3. **Gradle worker / daemon thread noise** (`maxParallelForks`, other test classes sharing the fork) — Control: name-filtered counters; campaign-root-scoped FD filter (`/proc/self/fd` targets only files under the probe's `@TempDir`); evaluation runs the class isolated via `--tests`. The coordinator's own 4 invocation workers have a 30 s idle timeout — sampled via `invocationWorkersForTesting()` and given the same 30 s allowance in the settle loop rather than counted as leaks.
4. **Global singletons** — `JavaFxRuntime.STARTED` (per-fork, benign); each probe phase constructs its own `AppBootstrap`/`InstallationRuntime`/coordinator, so no cross-test coordinator state. The shared `JavaFxUiDispatcher` is per-bootstrap, wrapped per-cycle by a fresh `RevocableUiDispatcher` — retained references to old dispatchers are exactly what the WeakReference oracle watches.
5. **PARKED slot masking a leak** — a parked aggregate legitimately holds ~30 threads. Control: baseline S0 is taken *after* warmup in the same alternating A/B regime, so {active + parked} is inside the baseline; the pass criterion is "no growth", and the aggregate-count oracle pins it at ≤ 2.
6. **Timeout flakiness under load** — deterministic seams preferred (gate throw, stale generation, `failAfterRootSwapForTesting`); phase timeouts stay at their 10 s default for the deterministic cycles; any timeout-flavored cycle sets the seam-provided 2 s timeout and tolerates its fixed wall cost.
7. **`/proc` portability** — Linux-only; acceptable under RP-R (local Linux dev machine per brief). Fallback to `UnixOperatingSystemMXBean` if `/proc` enumeration fails, degrading precision but not the decision (sidecar-file existence checks remain).
8. **Budget** — one deciding class, ~30 cycles of real activation (journey test already runs 210 switch pairs in one method within CI budget, so 24 cycles + controls is well inside); ≤ 2 test-phase subagent runs remain the cap.

## 6. Handoff To Test Phase

Build exactly: `test/app/CampaignSwitchCycleContainmentTest.java` with (a) deciding mixed-cycle probe, (b) suppressed-lane-release negative control, (c) benign control, sharing one sampling/settling helper; no production-code edits; run via `./gradlew uiTest --tests app.CampaignSwitchCycleContainmentTest`, 3× for the determinism guard. Record raw S0/S1/S2 samples and per-cycle latencies in the test output for the evaluation phase.
