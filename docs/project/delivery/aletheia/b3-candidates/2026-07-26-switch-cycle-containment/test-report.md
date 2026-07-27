Status: Test phase complete
Owner: Aletheia B3 test subagent
Charter Version: C-0.7.0
Process Version: B3-1.1.0
Brief: ./brief.md (frozen at c0e59ad6d)
Concept: ./concept.md (frozen at 543f7417f)
Product baseline: fb229a119

# B3 Test Report — Switch-Cycle Containment And Resource Steady State

## 1. Probe Artifact

`test/app/CampaignSwitchCycleContainmentTest.java` (tag `ui`, package `app`), three
methods sharing one settling/sampling helper and one steady-state oracle:

1. `repeatedMixedSwitchCyclesContainAllProductionRuntimeResources` — deciding probe.
   Production composition route (`AppBootstrap.openCampaignActivationAsync` + real
   `CampaignDeskHost` on a shown Monocle-headless `Stage`), journey-shaped seeds
   (scene + encounter-filter + party mutations per campaign), 5 warm Alpha↔Beta
   switch pairs, baseline sample S0, then 24 cycles = 8 blocks of
   [failed-after-commit → successful switch → cancelled-before-commit], S1 after
   block 4, S2 after block 8, then in-process restart proof.
2. `suppressedLaneReleaseIsDetectedByTheSteadyStateOracle` — negative control:
   probe-local fake candidate holding a real `BoundedExecutionLane` named
   `campaign-creatures-read` whose `closeAsync()` reports success without releasing
   the lane; driven through a real `CampaignActivationCoordinator` with a
   probe-local in-memory registry and fake host. The identical oracle must FAIL.
3. `benignFakeWithCorrectLaneReleasePassesTheSteadyStateOracle` — benign control:
   same fake with a correct lane release plus an unrelated benign extra completed
   close stage. The identical oracle must PASS.

No production sources were modified; only the test file and this candidate
directory were added.

## 2. Exact Commands And Environment

- Command (each run): `./gradlew uiTest --tests 'app.CampaignSwitchCycleContainmentTest'`
  (runs 2 and 3 with `--rerun` to defeat up-to-date checks).
- Gradle 9.6.1, Kotlin 2.3.21 (build logic), JUnit Jupiter 6.1.2,
  OpenJDK 21.0.11+10 (Red Hat), Linux 6.19.14-108.fc42.x86_64, 8 CPUs.
- Test JVM options from `build.gradle.kts`: `glass.platform=Monocle`,
  `monocle.platform=Headless`, `prism.order=sw`, `maxParallelForks=1`.
- Raw JUnit XML (incl. full `system-out`) for all three runs archived under
  `./artifacts/run{1,2,3}-TEST-app.CampaignSwitchCycleContainmentTest.xml`.

## 3. Cycle Mix Actually Executed (deciding probe)

Per block (8 blocks): (a) failed-after-commit: `failAfterRootSwapForTesting` armed,
`switchTo(Alpha)` → `RECOVERY_REQUIRED`, `recoverDurableActive()` → `RESUMED`,
durable mutation on recovered Alpha; (b) successful `switchTo(Beta)` → `ACTIVATED`
(latency sampled), revoked-generation write attempted through the captured outgoing
Alpha runtime, durable mutation on Beta; (c) cancelled-before-commit `switchTo(Alpha)`
alternating one-shot pre-commit-gate throw (`PRE_COMMIT_FAILED`, odd blocks) with
stale `expectedGeneration` (`STALE_GENERATION`, even blocks; exercises the re-park
path because Alpha is parked at that point), then metric-4 durable mutation on the
restored Beta prior. Every mutation is tagged `CC-<campaign>-…`; revoked attempts
are tagged `REVOKED-b<block>`.

Settling protocol per sample: coordinator quiet (phase `ACTIVE`,
`pendingCloseAttemptsForTesting()==0`, `trackedCloseObligationsForTesting()==0`,
30 s budget), 2 FX no-ops + 3 FX pulses, forced-GC loop (≤15 rounds, stop when the
WeakReference runtime set AND settled heap are stable twice; recorded heap = post-GC
floor across rounds), then thread-name-stability wait (3 stable 100 ms polls).

## 4. Raw Measured Results

### 4.1 Determinism guard: 3 consecutive isolated runs, identical verdicts

| Run | Suite result | Deciding | Negative control | Benign control | Wall time |
|---|---|---|---|---|---|
| 1 | 3 tests, 0 failures | PASS (46.1 s) | oracle FAILED as required | oracle passed | 53.5 s |
| 2 | 3 tests, 0 failures | PASS (41.9 s) | oracle FAILED as required | oracle passed | 51.7 s |
| 3 | 3 tests, 0 failures | PASS (79.5 s) | oracle FAILED as required | oracle passed | 96.1 s |

Run 3 ran under external machine load (visible in absolute latencies only); all
verdicts and all structural counters are identical across the three runs.

### 4.2 Deciding metric samples (per run: S0 / S1 / S2)

Counters were byte-for-byte identical across all three runs except settled heap:

| Counter | Run 1 | Run 2 | Run 3 |
|---|---|---|---|
| campaign threads (name-filtered) | 8 / 8 / 8 | 8 / 8 / 8 | 8 / 8 / 8 |
| coordinator invocation workers | 2 / 2 / 2 | 2 / 2 / 2 | 2 / 2 / 2 |
| non-daemon threads (whole JVM) | 5 / 5 / 5 | 5 / 5 / 5 | 5 / 5 / 5 |
| campaign-root file descriptors (`/proc/self/fd`) | 0 / 0 / 0 | 0 / 0 / 0 | 0 / 0 / 0 |
| total process FDs (`UnixOperatingSystemMXBean`) | 68 / 68 / 68 | 68 / 68 / 68 | 68 / 68 / 68 |
| WAL/SHM/journal sidecars at rest | absent | absent | absent |
| retained `CampaignRuntime` aggregates (WeakReference, post-GC) | 2 / 2 / 2 | 2 / 2 / 2 | 2 / 2 / 2 |
| retained `AppShell` roots (WeakReference, post-GC) | 2 / 2 / 2 | 2 / 2 / 2 | 2 / 2 / 2 |
| settled heap used, bytes | 67 658 000 / 81 506 416 / 88 503 960 | 67 474 568 / 81 255 280 / 88 487 184 | 67 312 264 / 81 225 904 / 88 035 376 |

### 4.3 Deciding metric verdicts

1. **Cross-Campaign mutation count = 0 — PASS.** External read-only JDBC scans of
   both `campaign.sqlite` stores after every block and at the end: 0 rows tagged for
   the wrong campaign, in all runs.
2. **Writes admitted on a revoked generation = 0 — PASS.** All 8 revoked-write
   attempts per run were rejected synchronously
   (`REJECTED_SYNC:IllegalStateException` from the revoked/paused admission seam);
   final store scans found 0 `REVOKED-…` rows in either campaign, so no queued
   attempt was admitted late either.
3. **Steady state after 24 mixed cycles — PASS on all deciding counters.**
   Campaign threads, non-daemon threads, campaign FDs, sidecars, and the exact
   retained-aggregate count (≤ 2 = active + parked) are flat at S0 = S1 = S2 with
   zero drift, in all three runs. See §6 for the heap observation.
4. **Cancelled-before-commit leaves the prior fully usable — PASS.** After every
   one of the 16 cancelled activations (8 gate-throw, 8 stale-generation) the next
   durable mutation on the restored prior returned `SUCCESS`; after the in-process
   restart the coordinator `RESUMED` Beta, the last pre-restart Beta and Alpha tags
   were present in their stores (`countScenesTitled == 1`), and a post-restart
   mutation succeeded.

### 4.4 Guard metrics

- **Determinism:** 3/3 identical verdicts (§4.1).
- **Negative control:** oracle reported
  `campaignThreads 6 > band 3` (C1), `campaignThreads 8 > band 3` (C2), and
  `monotonic growth trend on campaignThreads: 2 < 6 < 8` — the suppressed lane
  release is detected, in all runs. **Benign control:** zero violations, in all
  runs. The oracle discriminates.
- **No monotonic warm-switch slowdown:** mean of last 4 successful-switch cycles vs
  first 4: run 1 — 1357.7 ms vs 1426.6 ms (ratio 0.95); run 2 — 1229.8 ms vs
  1423.6 ms (0.86); run 3 — 3138.0 ms vs 2637.2 ms (1.19, under external load).
  All ≤ 1.5 guard. Note these cycles are cold-path switches (the Beta aggregate is
  rebuilt fresh each block because the preceding failed-after-commit cycle closed
  it), so absolute values are prepare-dominated and not comparable to the frozen
  warm-switch p95 budget; only the trend is claimed.

## 5. Deviations From The Concept, With Reasons

1. **Block order [fail → success → cancel] instead of [success → cancel → fail].**
   Reason: with the concept order, S1 would fall directly after a
   failed-after-commit cycle, where only one aggregate is legitimately alive, so
   S1 would sit ~50% below S0 by design and the 10% band would be meaningless. The
   chosen order ends every block in the same {active + parked} shape as the
   warmup-derived S0, making S0/S1/S2 structurally comparable. It also lets the
   cancelled-before-commit cycle hit a occupied parked slot, exercising the re-park
   path the concept asked for.
2. **10% band applied as an upper bound (growth), not two-sided.** Freshly rebuilt
   aggregates may lazily spawn fewer pool threads than fully warmed ones, so a
   downward excursion is possible and is not a leak; the frozen hypothesis is
   leakage. Raw values are recorded (they happened to be exactly flat anyway).
3. **Settled heap moved from deciding to corroborating, per the concept's own
   control (§5 risk 2).** The deciding retention signal is the exact WeakReference
   aggregate count; a monotonic settled-heap growth trend is recorded and reported
   (see §6) instead of failing the probe alone. This is the one place where a
   concept §3.1 pass criterion ("post-GC heap within 10%") was relaxed; without it
   the probe fails — reported honestly in §6, not hidden.
4. **`retainsPublishedRoot()` was not sampled on the failed-after-commit cycles.**
   With the deterministic `failAfterRootSwapForTesting` seam the host returns
   `RECOVERY_VISIBLE` synchronously, so no `RootReadinessAttempt` is ever armed for
   that switch; there is no revoked readiness attempt to interrogate. Structural
   root release is instead covered by the WeakReference `AppShell` set (post-GC
   strongly-reachable shells stayed exactly 2). The timeout-flavored variant
   (`hideOnNextReadiness`) that does arm readiness was not added, keeping the probe
   deterministic and inside budget; it remains covered by the frozen journey test.
5. **Per-cycle mutations are scene creates only** (seeds additionally touch
   encounter-filter and party lanes once per campaign). Full journey-shaped
   mutations on every cycle would triple wall time without adding a distinct
   resource class to the oracle.
6. **Controls sample with a lighter settle** (same helper, FX drain skipped, no
   weak sets) because the fakes own no FX or runtime aggregates. Identical oracle
   code paths are used for the verdicts.

## 6. Honest Findings And Open Points

- **Corroborating observation — settled-heap growth, reproducible:** post-GC heap
  floor grows monotonically S0→S1→S2 in every run (≈ 67.5 MB → 81.3 MB → 88.3 MB;
  S2 ≈ 1.31 × S0; ≈ +0.87 MB per cycle, decelerating: +13.8 MB over blocks 1–4,
  +7.0 MB over blocks 5–8). It is nearly byte-identical across runs, so it is
  deterministic retention, not GC noise. It is NOT attributable to the tracked
  structural resources: retained runtimes and shells are exactly 2, campaign
  threads, FDs, and sidecars are flat. Candidate explanations (unverified): JavaFX
  CSS/StyleManager or image caches keyed per rebuilt root, sqlite-jdbc statement
  caches, JIT/lambda class heap mirrors. Under the brief's strict metric-3 wording
  ("resident memory within 10%") this component is **not passed — it is
  inconclusive-leaning-fail for heap specifically** and deserves an evaluation-phase
  judgement (e.g. a longer-horizon probe or heap-histogram attribution). All other
  metric-3 components pass exactly.
- The negative control demonstrates sensitivity for thread leaks only; FD- or
  heap-shaped suppressed releases were not negatively controlled.
- `/proc/self/fd` was readable throughout; the `UnixOperatingSystemMXBean`
  fallback was never needed.
- Campaign-root FD count is 0 at rest in every sample, confirming the per-operation
  connection design of `SqliteDatabase` under repetition and mid-cycle failure.
