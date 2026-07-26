Status: Evaluation complete
Owner: Aletheia B3 independent evaluation subagent
Charter Version: C-0.7.0
Process Version: B3-1.1.0
Evaluation Version: E-0.7.0
Brief: ./brief.md (frozen at c0e59ad6d)
Concept: ./concept.md (frozen at 543f7417f)
Test: ./test-report.md (frozen at ffffaa99b)
Product baseline: fb229a119

# B3 Evaluation — Switch-Cycle Containment And Resource Steady State

Independent evaluation of the candidate at ffffaa99b in an isolated worktree
(detached HEAD at ffffaa99b). The evaluator did not author brief, concept,
probe, or report. No production code was changed; all evaluation-local probe
edits stayed uncommitted in the evaluation worktree and are recorded literally
below.

## 1. Freeze And Integrity Verification — PASS

- All four commits exist locally: fb229a119 (baseline, merge PR #558),
  c0e59ad6d (brief), 543f7417f (concept), ffffaa99b (test).
- `git diff --stat fb229a119 ffffaa99b -- app features platform shell` is
  literally empty. `git diff --name-status fb229a119 ffffaa99b` shows exactly
  7 additions (A): the candidate directory (brief.md, concept.md,
  test-report.md, 3 run XMLs) and `test/app/CampaignSwitchCycleContainmentTest.java`.
  No production file touched, no file modified or deleted.
- Claimed environment matches the machine: Gradle 9.6.1, Kotlin 2.3.21,
  OpenJDK 21.0.11+10 (Red Hat), Linux 6.19.14-108.fc42.x86_64. Test JVM flags
  (`glass.platform=Monocle`, `monocle.platform=Headless`, `prism.order=sw`,
  `maxParallelForks`) confirmed in `build.gradle.kts:96-103`. sqlite-jdbc
  3.53.2.0 is a declared repo dependency (`build.gradle.kts:64`).
- The archived run1/run2/run3 XML sample lines match the report's §4.2 table
  byte-for-byte (all counters and all nine heap values re-extracted and
  compared).

## 2. Independent Replay — PASS, report confirmed

Command: `./gradlew uiTest --tests 'app.CampaignSwitchCycleContainmentTest' --rerun`
at ffffaa99b (compiled from the committed sources, before any evaluation-local
edit). Result: 3 tests, 0 failures, suite time 121.1 s (external load; verdicts
identical to the retained runs).

Replay samples (S0 / S1 / S2):

| Counter | Replay | Retained runs 1–3 |
|---|---|---|
| campaignThreads | 8 / 8 / 8 | identical |
| invocationWorkers | 2 / 2 / 2 | identical |
| nonDaemonThreads | 5 / 5 / 5 | identical |
| campaignFileDescriptors | 0 / 0 / 0 | identical |
| totalFileDescriptors | 68 / 68 / 68 | identical |
| sidecars at rest | absent | identical |
| retainedRuntimes (weak, post-GC) | 2 / 2 / 2 | identical |
| retainedShells (weak, post-GC) | 2 / 2 / 2 | identical |
| settled heap bytes | 67 473 120 / 81 243 984 / 88 276 440 | within 0.3% of all three runs |

- Deciding metric 1 (cross-Campaign rows = 0): replayed PASS.
- Deciding metric 2 (revoked writes = 0): replayed PASS — all 8 attempts
  `REJECTED_SYNC:IllegalStateException`, 0 REVOKED rows in either store.
- Deciding metric 3 (structural counters): replayed PASS, byte-identical.
- Deciding metric 4 (prior usable after cancel + restart survival): replayed
  PASS (asserted inside the passing deciding method).
- Guard (slowdown trend): firstMean 4473.2 ms vs lastMean 2473.4 ms
  (ratio 0.55 ≤ 1.5) — absolute values load-inflated, trend guard passes,
  consistent with the report's cold-path caveat.
- Negative control: oracle FAILED as required with literally the same
  violations as the retained runs (`campaignThreads 6 > band 3`,
  `campaignThreads 8 > band 3`, `monotonic growth trend on campaignThreads:
  2 < 6 < 8`). Benign control: zero violations.

## 3. Negative-Control Causality — PASS

Verified in source (`test/app/CampaignSwitchCycleContainmentTest.java:853-951`):
the fake candidate allocates a real `BoundedExecutionLane` with production
thread-name prefix `campaign-creatures-read`; the leaky variant's
`closeAsync()` completes successfully WITHOUT releasing the lane — the only
difference from the benign variant, which calls `lane.terminateNow(1s)` plus an
unrelated benign extra completed close stage. Same oracle code path for both.
The oracle trips exactly on the suppressed release (thread growth 2→6→8 across
retirements) and stays silent on the benign fake, so it discriminates the
cause (unreleased lane on close), not an unrelated condition. Calibration
limit (also stated honestly in the report): sensitivity is demonstrated for
thread-shaped leaks only; FD- or heap-shaped suppressed releases were not
negatively controlled.

## 4. Tool Audit — PASS with noted limits

- Thread counters: JDK `Thread.getAllStackTraces` with the same name filter as
  the frozen journey test; calibrated by the negative control (detects +4/+6
  threads over a baseline of 2).
- FD scan: `/proc/self/fd` symlink enumeration filtered to the probe's
  campaign root, with `UnixOperatingSystemMXBean` as secondary. Sanity
  cross-check: total process FDs constant at 68 across all samples of four
  independent runs while campaign FDs are 0 and WAL/SHM/journal sidecars are
  absent — mutually consistent, and consistent with `SqliteDatabase`'s
  per-operation connections (try-with-resources at
  `platform/persistence/SqliteDatabase.java:233,386,404,515,531`).
- WeakReference retention oracle: `WeakHashMap`-backed identity sets fed with
  every runtime/shell ever observed; post-GC size 2 = {active + parked}.
  Sanity cross-check: across 24 (and evaluation-locally 72) cycles dozens of
  runtimes/shells were inserted, yet the settled size returns to exactly 2 —
  the set demonstrably shrinks under GC, so it is live, not inert.
- External JDBC reads: read-only `DriverManager` connections to the campaign
  SQLite files (repo dependency sqlite-jdbc), independent of the runtime under
  test — appropriate as an out-of-band oracle for metrics 1/2/4.
- Provenance: everything is JDK, repo harness, or repo dependency; no external
  tools. Evaluation-local jcmd (JDK) was used for heap attribution (§5).

## 5. The Open Heap Signal — RESOLVED as (b) unbounded linear leak (within tested horizon)

(The interrupted draft's provisional heading claimed (a); the completed
extended run decides (b). The heading above reflects the evidence.)

The report's honest finding: settled post-GC heap grows ~67.5 → 81.3 → 88.3 MB
over 24 cycles (deceleration 13.8 MB over blocks 1–4, 7.0 MB over blocks 5–8),
unattributed, while every structural counter is flat. Under the brief's strict
metric-3 wording this component was left "inconclusive-leaning-fail".

Evaluation-local disposable probe (never committed; uncommitted edits in the
evaluation worktree only): `CYCLE_BLOCKS` raised 8 → 24 (72 mixed cycles),
settled samples every 4 blocks, plus `jcmd GC.class_histogram` at S0 and S2.

Literal settled-heap floors (bytes) from the extended run:

Extended run (72 cycles = 24 blocks): suite 3 tests, 0 failures; deciding
probe 271.6 s; all structural counters flat at every settled sample
(campaignThreads 8, invocationWorkers 2, nonDaemonThreads 5,
campaignFileDescriptors 0, sidecars absent, retainedRuntimes 2,
retainedShells 2); all 24 revoked attempts `REJECTED_SYNC:IllegalStateException`;
negative control 2→6→8 / benign flat, as before; switch-latency trend guard
3578.7 → 3875.6 ms (ratio 1.08 ≤ 1.5).

| Sample (after cycle) | heapUsedBytes | Δ per 12-cycle window | MB/cycle |
|---|---|---|---|
| S0 (0, post-warmup) | 67 122 008 | — | — |
| SB4 (12) | 81 071 968 | +13 949 960 | 1.162 |
| SB8 (24) | 87 973 568 | +6 901 600 | 0.575 |
| S1 (36) | 94 994 880 | +7 021 312 | 0.585 |
| SB16 (48) | 101 973 104 | +6 978 224 | 0.582 |
| SB20 (60) | 109 029 928 | +7 056 824 | 0.588 |
| S2 (72) | 116 211 528 | +7 181 600 | 0.598 |

- Reproducibility anchor: SB8 (24 cycles) = 87 973 568 B reproduces the
  original runs' S2 (88.0–88.5 MB) within 0.4%.
- Blocks 9–24 (cycles 25–72): +28 237 960 B over 48 cycles = 0.588 MB/cycle —
  constant; window slopes 0.575 → 0.585 → 0.582 → 0.588 → 0.598 MB/cycle.
  Zero deceleration; the last window is the steepest. Total S0→S2: +49.09 MB;
  S2 = 1.73 × S0.
- jcmd `GC.class_histogram` deltas S0→S2 (live after full GC): total
  633 760 → 758 817 objects, 62 524 152 → 110 549 416 B (+48.0 MB). Dominant:
  `int[]` 4 772 → 5 359 instances, 30 099 944 → 64 556 112 B (+587 arrays,
  +34.46 MB, avg ~59 KB each — pixel-buffer scale); `FillerElement[]`
  +8.97 MB (GC filler). Linear JavaFX scene-graph retention:
  `javafx.scene.control.Button` 189→333 (+2/cycle), `Label` 320→392
  (+1/cycle), `NGRegion` 611→971 (+5/cycle), `RectBounds` +5 411,
  `HashMap$Node` +11 523, `SimpleBooleanProperty` +3 094, `PseudoClassState`
  +2 972 — detached scene-graph subtrees and render buffers survive full GC
  in proportion to cycle count while the shells/runtimes that hosted them are
  weakly reachable only (exactly 2 strongly reachable).
- Measurement artifact, recorded honestly: `totalFileDescriptors` reads 69
  from SB4 onward (S0: 68) — constant, caused by the evaluation-local jcmd
  attach-listener socket opened at the S0 histogram, not by the product.
  Campaign-root FDs stayed 0 throughout.
- The extended-probe edit (CYCLE_BLOCKS 8→24, SB samples, jcmd histograms)
  was evaluation-local, never committed, and was reverted after the run
  (`git checkout -- test/app/CampaignSwitchCycleContainmentTest.java`). The
  literal numbers above are the retained evidence; the raw extended-run XML
  stayed in the evaluation worktree's `build/test-results/uiTest/`.

Decision rule (fixed before the run): if per-cycle growth continues at the
original ~0.87 MB/cycle rate through blocks 9–24, classify (b) unbounded leak;
if the slope collapses toward zero and the curve plateaus, classify (a)
bounded warmup/cache plateau; otherwise (c) undecidable within budget.

Rule application: the slope did not collapse toward a plateau — it is
constant-to-slightly-rising through blocks 9–24. Branch (a) is refuted.
Branch (b) applies: growth continues undiminished; the pre-registered
"~0.87 MB/cycle" figure was the warmup-contaminated 24-cycle average, and the
established post-warmup rate (~0.58–0.60 MB/cycle from block 5 onward)
continued literally unchanged through blocks 9–24. Classification:
**(b) unbounded leak** within the tested horizon, ~0.59 MB per switch cycle
steady-state, on top of a one-time ~14 MB first-window warmup component.

## 6. Workload Correlation — PASS

The probe reuses the frozen M1 production journey's composition route
verbatim: same `bootstrapAt` construction (NoopDiagnostics, SerialExecutionLane,
JavaFxUiDispatcher, SqliteDatabase), same
`AppBootstrap.openCampaignActivationAsync` entry, a `ProbeHostHarness` that
delegates every host call to a real `CampaignDeskHost` on a shown Stage (copy
of the journey's `ProductionHostHarness`), the same `WARM_SWITCH_WARMUPS = 5`,
and `seedCampaign` is a line-for-line copy of the journey's `mutateAndAssert`
(scene create + encounter pool-filter publish + party create/move) — compared
against `test/app/CampaignRuntimeProductionJourneyTest.java:1127-1157`. The
fault seams are the production ForTesting seams. The workload therefore
correlates with the frozen real journey; per-cycle mutations being scene-only
(deviation 5) is an acceptable intensity reduction, not a route change.

## 7. Deviations Review

The four material deviations in test-report.md §5 are each justified and none
weakens the frozen question:
1. Block reordering [fail→success→cancel] makes S0/S1/S2 structurally
   comparable ({active+parked} at every sample) and still exercises the
   re-park path — sound.
2. One-sided 10% band matches the frozen leakage hypothesis; raw values were
   flat anyway — sound.
3. Heap demoted from deciding to corroborating: this is the one true
   post-hoc relaxation of a concept §3.1 pass criterion. It was reported
   honestly, the raw numbers were retained, and the evaluation resolved the
   signal independently (§5) instead of accepting the relaxation on faith.
4. `retainsPublishedRoot()` not sampled on deterministic failed-after-commit
   cycles (no readiness attempt is armed on that path); structural root
   release covered by the weak-shell oracle (exactly 2 post-GC) — acceptable,
   with the timeout-flavored variant remaining journey-test territory.

## 8. Rollback — PASS

The candidate is three commits of pure additions on the role branch
(`worktree-aletheia-b3`); `git diff --name-status fb229a119 ffffaa99b` lists
only A-status files. Dropping c0e59ad6d..ffffaa99b restores the baseline tree
exactly; there is no residue outside the candidate directory and the single
test class. Production checkouts, `main`, and A's worktree were never touched;
the evaluation ran in its own isolated worktree.

## 9. Verdict

**Charter maturity of the candidate test: Preliminary.**
The probe is deterministic (3 archived runs + independent replay + extended
run, byte-identical structural counters), its oracle demonstrably
discriminates a suppressed lane release, and its reporting was honest. It is
not Final because, as committed at ffffaa99b, the deciding oracle cannot fail
on the very leak the probe surfaced: the heap criterion was demoted to
corroborating (test-report deviation 3), so the deciding method passes green
while resident memory grows without bound; and leak sensitivity is
negatively controlled for thread-shaped leaks only (no heap-/FD-shaped
negative control). It is more than Proof of Concept because everything it
does decide, it decides reproducibly on the production composition route.

**Disposition: repair** (the test, by B3; and a product finding for A).
Repair of the probe: re-promote settled-heap slope to a deciding criterion
(e.g. mean slope over the last 12+ cycles must stay below a calibrated bound
on the order of 0.05 MB/cycle), keep the exact aggregate-count oracle, and
add a heap-shaped negative control. Restart is not needed — the route,
workload, and oracles are sound. Qualified use until repaired: the committed
test is a valid regression guard for metrics 1, 2, 4 and the structural half
of metric 3, but its green verdict must not be read as "no memory leak".

**Product-hypothesis classification per deciding metric:**
1. Cross-Campaign mutation count = 0 — **confirmed** (0 rows in all runs
   including 72-cycle extension).
2. Writes on revoked generation = 0 — **confirmed** (8/8 and 24/24 attempts
   `REJECTED_SYNC:IllegalStateException`; 0 REVOKED rows).
3. Steady state after sustained cycles — **split**: threads, campaign FDs,
   sidecars, retained runtime/shell aggregates — **confirmed** flat through
   72 cycles; resident-memory component — **refuted**: settled post-GC heap
   grows linearly ~0.59 MB/cycle with zero deceleration (S2 = 1.73 × S0 at
   72 cycles), far outside the 10% band, i.e. the frozen structural
   hypothesis "the seam contains every runtime aggregate it creates" is
   falsified for heap-resident render/scene-graph state.
4. Cancelled activation leaves prior usable, durable, restart-surviving —
   **confirmed** (all 16, and extended-run, cancelled cycles; restart proof
   passed).

**Evidence summary (literal):** settled heap 67 122 008 → 87 973 568 (24
cycles, reproducing the committed runs within 0.4%) → 116 211 528 B (72
cycles); per-12-cycle slopes 0.575 / 0.585 / 0.582 / 0.588 / 0.598 MB/cycle
after a 1.162 MB/cycle first window; histogram attribution: `int[]`
+34.46 MB (+587 arrays, ~59 KB each), plus per-cycle scene-graph retention
(+2 Buttons, +1 Label, +5 NGRegions per cycle) surviving full GC while
strongly-reachable runtimes/shells stay exactly 2.

**Uncertainty:** the leak's owning reference chain is not identified — the
histogram gives class-level color (Prism software-rendering surfaces /
retained detached JavaFX subtrees are the leading candidates: CSS
StyleManager caches, listener retention, Monocle SW pipeline buffers), not
the retaining root; a GC-root path analysis (jmap/heap dump) was outside
this evaluation's budget. Horizon is 72 cycles; a plateau beyond it cannot
be excluded but nothing in the data suggests one. Headless-Monocle software
rendering may shift the `int[]` share versus a desktop pipeline; the linear
scene-graph object counts are pipeline-independent.

**Rollback status: PASS** — candidate remains three pure-addition commits on
`worktree-aletheia-b3`; baseline diff to production trees empty; the
evaluation's probe edit was local to the evaluation worktree and reverted;
only this report is added by the evaluation.

**Next owner action for A:** file the leak as a structural finding on the
M1 seam (PR #558 follow-up / umbrella issue #555): at fb229a119, every warm
Campaign switch cycle permanently retains ~0.59 MB of heap (JavaFX
scene-graph subtrees + ~59 KB int[] render buffers; ~100 switches ≈ 59 MB)
even though runtimes, shells, threads, and FDs are fully released. Suggested
investigation order: heap-dump GC-root path for one leaked `NGRegion`/
`Button`; check CSS StyleManager/stylesheet caches keyed per rebuilt root,
lingering listeners on shared singletons (dispatcher, host, Stage), and
Prism SW surface caching. Severity: moderate now, high blast radius (every
M2a–M13 feature mounts on this seam). Reopen trigger: after any fix, rerun
this probe with CYCLE_BLOCKS ≥ 24 and require the last-48-cycle heap slope
below the calibrated bound; then re-promote heap to deciding and re-evaluate
for Final.
