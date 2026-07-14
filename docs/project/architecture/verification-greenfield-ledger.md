Status: Active
Owner: SaltMarcher Team
Last Reviewed: 2026-07-14
Source of Truth: Live execution state, baselines, proofs, and target
adjudication for the verification greenfield roadmap.

# Verification Greenfield Ledger

## Purpose

Single source of truth for progress on the
[Verification Greenfield Roadmap](verification-greenfield-roadmap.md). Chat
plans and pass logs may describe work, but they do not advance the roadmap
unless this ledger advances too.

## State Rules

- At most one milestone may be `In Flight`; inside M2, at most one area
  conversion batch. The single exception is the M1a-before-M0-baseline
  interleave the roadmap fixes: M1a runs while M0's baseline step is still
  open, because headless must exist before the baseline can be measured
  headless.
- Step `Status` values: `Pending`, `In Flight`, `Blocked`, `Done on branch`,
  `Done`.
- A step without a literally green proof (command plus result plus date) is
  WIP and stays `In Flight`.
- `Blocked` requires the blocking reason in Notes and stops the executor.

## Current Position

| Field | Value |
| --- | --- |
| Branch | `codex/verif-greenfield-m1b-final-timing` |
| Milestone | M1b - Parallel Local Execution (Non-Frozen Surfaces Only) |
| Status | Blocked |
| Required next proof | Unblock the M1b final timing comparison: the first parallel full `check --rerun-tasks` must be green before the required second consecutive run can start. Current blocker is the unchanged check topology running the full Dungeon Editor aggregate beside its component harnesses under parallel UI load, which trips latency/timeouts before a green timing proof exists. |
| Last status note | `2026-07-14 M1b-final-timing-blocked` |

## Baseline Measurements (owner machine, headless, filled in M0 after M1a)

Measured only after M1a has made runs headless: a windowed baseline would
violate V9 and the Local-First Mandate. Serial, i.e. before M1b.

| Measurement | Command | Result | Date |
| --- | --- | --- | --- |
| Full cold `check --rerun-tasks` | Not measured - no binding target | Not measured - no binding target | Not measured - no binding target |
| Full warm `check --rerun-tasks` | `tools/gradle/run-observable-gradle.sh check -- --rerun-tasks` | `BUILD SUCCESSFUL in 24m 28s`; wrapper elapsed `00h:24m:29s`; `74 actionable tasks: 74 executed`; retained log `build/gradle-run-logs/20260714T164711390209469-pid560170-check.log` | 2026-07-14 |
| Warm no-change `check` | `tools/gradle/run-observable-gradle.sh check` | `BUILD SUCCESSFUL in 12s`; wrapper elapsed `00h:00m:12s`; `74 actionable tasks: 6 executed, 1 from cache, 67 up-to-date`; retained log `build/gradle-run-logs/20260714T171153492803370-pid575396-check.log` | 2026-07-14 |
| Pre-commit gate, untouched-area commit | `tools/hooks/pre-commit` on a temporary staged `.gitignore` docs-neutral marker, synthetic staged tree `26659f56c14130cfcddd1f67d2d65a824f05999f`; marker restored before commit | Hook accepted; retained log `build/pre-commit-gate/26659f56c14130cfcddd1f67d2d65a824f05999f.log` records `BUILD SUCCESSFUL in 13m 39s`; `74 actionable tasks: 53 executed, 20 from cache, 1 up-to-date` | 2026-07-14 |

Prior evidence for calibration, from the predecessor's records: the largest
full forced local `check` on record is `BUILD SUCCESSFUL in 26m 8s` / `26m 17s`
with `75 actionable tasks: 75 executed`
(`harness-modernization-owner-status-notes.md`), while the scheduled CI nightly
runs the same graph (74 tasks) in `5m 44s` (run 29307758537). No ~90-minute
local run is recorded anywhere in the repository. The M0 measurement decides
the real number; targets are calibrated against it, not against the estimate.

## Binding Numeric Targets (calibrated in M0, adjudicated in M5)

| # | Target | Status |
| --- | --- | --- |
| 1 | Full warm `check --rerun-tasks` <= 20 min | Binding - M0 baseline miss: measured 24m 28s after M1a. M1b must reduce this by at least 40% against the M0 serial baseline or M5 must record an individually justified exception. |
| 2 | Warm no-change `check` <= 2 min | Binding - M0 baseline pass: measured 12s. |
| 3 | Pre-commit gate, untouched area <= 5 min | Binding - M0 baseline miss: measured 13m 39s because the detached staged-tree hook still executed 53 tasks. M1b/M4/M5 must repair this or M5 must record an individually justified exception. |
| 4 | Verification `Test` tasks <= 4; harness source sets 0 | Binding - adjudicated by M2 and final M5 measurement. |
| 5 | Architecture rule engines = 1 | Binding - adjudicated by M4 and final M5 measurement. |
| 6 | New behavior test diff confined to `test/**` | Binding - adjudicated by M2 and final M5 deletion-list audit. |
| 7 | Local `check` opens zero windows, never steals focus | Binding - M1a local proof passed; remain binding through M1b/M5 rehearsals. |
| 8 | Zero `upToDateWhen{false}` / `cacheIf{false}` on verification tasks | Binding - existing guard remains active; final grep audit in M5. |

## M0 Ledger

| Step | Status | Local branch commit | Merge commit | Proof | Notes |
| --- | --- | --- | --- | --- | --- |
| Charter docs committed and indexed | Done | `dbfe28955` | `738ebe6b` | `git diff --check main...HEAD` passed with no output, 2026-07-13; `./gradlew checkDocumentationEnforcement --console=plain` passed with `Documentation checks passed.` and `BUILD SUCCESSFUL in 6s`, 2026-07-13; docs-gate repair PR #458 merged as `735331a11` after green `check`, `warden-freeze`, owner-only `judge-review`, `ckjm-report`, SonarCloud, and CodeScene, 2026-07-13; charter PR #459 merged as `738ebe6b` after green `check`, `warden-freeze`, `judge-review`, `ckjm-report`, SonarCloud, and CodeScene, 2026-07-13 | Roadmap, target design, ledger, owner notes, and index links are merged. Prior blocker cleared by PR #458: the active Documentation Standard now owns size as a non-fatal signal and keeps `Owner` / `Last Reviewed` optional. PR #459 head `dbfe28955` only refreshed the risk-label event after the proof commit; no violation was reported against the verification-greenfield files. |
| Local checkout on origin/main; in-flight work preserved | Done | `739526e4d` | `8f0d24459` | `git status -sb` showed `## main...origin/main` with no divergence at `093a7f96e`, 2026-07-14; `git ls-remote --heads origin codex/architecture-roadmap-phase2 codex/architecture-migration-m0-charter` returned both refs (`d95c9f685`, `02c0c95fea53fdb7aca3fdba7499dfda8244fdad`), 2026-07-14; `git worktree list` returned only `/home/aaron/Schreibtisch/projects/SaltMarcher`, 2026-07-14; PR #462 merged as `8f0d24459`, 2026-07-14 | Both in-flight architecture branches are now pushed, which is what the M0 done-when requires. Encounter WIP is `02c0c95fe` on `codex/architecture-migration-m0-charter`; `codex/architecture-roadmap-phase2` carries the W1 service baseline. Merged and superseded local branches were deleted; only these two plus `main` remain. |
| Green scheduled nightly run recorded; predecessor T4 closed | Done | `739526e4d` | `8f0d24459` | `gh run view 29307758537 --json headSha,event,conclusion,createdAt,updatedAt,jobs` returned `event=schedule`, `conclusion=success`, `headSha=093a7f96e8565458af4cf9c2935f7a0d4d7ee540`, job `nightly-rerun-tasks=success`, `createdAt=2026-07-14T05:08:48Z`, `updatedAt=2026-07-14T05:15:25Z`, 2026-07-14; its job log records `[observable-gradle] Command: ./gradlew check --console=plain --continue --rerun-tasks` and `BUILD SUCCESSFUL in 5m 44s`, `74 actionable tasks: 73 executed, 1 up-to-date`, 2026-07-14; PR #462 merged as `8f0d24459`, 2026-07-14 | The earlier block was external schedule timing only: the cron `17 2 * * *` had not yet fired when it was checked at `2026-07-14T00:29:24+02:00`. The first scheduled run after it is green and is recorded here without substituting a manual, PR, or push run. Predecessor T4 closed in `harness-modernization-ledger.md`. |
| Predecessor roadmap deprecated with successor pointer | Done | `739526e4d` | `8f0d24459` | `head -6 docs/project/architecture/harness-modernization-roadmap.md` shows `Status: Deprecated` and `Last Reviewed: 2026-07-14`, 2026-07-14; the successor pointer to this roadmap stands directly under the title, 2026-07-14; PR #462 merged as `8f0d24459`, 2026-07-14 | `Status: Deprecated` plus pointer under the title. Retained rather than deleted because T5's specification lives there and is referenced by this roadmap's Deferred Annex. |
| Baseline measured headless on owner machine | Done | `26fa95fe2` | `33937ce6c` | `tools/gradle/run-observable-gradle.sh check -- --rerun-tasks` passed with `BUILD SUCCESSFUL in 24m 28s`, `74 actionable tasks: 74 executed`, retained log `build/gradle-run-logs/20260714T164711390209469-pid560170-check.log`, 2026-07-14; `tools/gradle/run-observable-gradle.sh check` passed with `BUILD SUCCESSFUL in 12s`, `74 actionable tasks: 6 executed, 1 from cache, 67 up-to-date`, retained log `build/gradle-run-logs/20260714T171153492803370-pid575396-check.log`, 2026-07-14; `tools/hooks/pre-commit` accepted staged tree `26659f56c14130cfcddd1f67d2d65a824f05999f` with `BUILD SUCCESSFUL in 13m 39s`, `74 actionable tasks: 53 executed, 20 from cache, 1 up-to-date`, retained log `build/pre-commit-gate/26659f56c14130cfcddd1f67d2d65a824f05999f.log`, 2026-07-14; PR #464 merged as `33937ce6c`, 2026-07-14 | Cold run intentionally remains unmeasured because it has no binding target. The temporary `.gitignore` marker used for the untouched-area hook baseline was restored before this branch commit. |
| Targets calibrated; German status note | Done | `26fa95fe2` | `33937ce6c` | Binding target table updated from M0 measurements, 2026-07-14; German owner note `2026-07-14 M0-headless-baseline-kalibriert` added, 2026-07-14; PR #464 merged as `33937ce6c`, 2026-07-14 | Targets flip Provisional -> Binding. Full warm forced check and untouched-area pre-commit are binding misses, not hidden waivers. |

## M1a Ledger (runs before the M0 baseline)

| Step | Status | Local branch commit | Merge commit | Proof | Notes |
| --- | --- | --- | --- | --- | --- |
| Amendment commit for the M1a/M1b split and D2 coordinates | Done | `03b0a9ed0` | `8f0d24459` | PR #462 merged the amendment commit as `8f0d24459`, 2026-07-14; target design D2 now records the M1a/M1b split, Monocle coordinates, classpath-only constraint, and Xvfb rejection. | Must precede the implementing commit per the target design's amendment rule. |
| `openjfx-monocle:21.0.2` on test + 4 harness runtime classpaths | Done | `510e183ff` | `beee85ba7` | `build.gradle.kts` now derives `org.testfx:openjfx-monocle:21.0.2` from the JavaFX version pin and adds it to `testRuntimeOnly`, `dungeonEditorBehaviorHarnessRuntimeOnly`, `hexMapEditorBehaviorHarnessRuntimeOnly`, `worldPlannerBackendHarnessRuntimeOnly`, and `worldPlannerUiHarnessRuntimeOnly`, 2026-07-14; `tools/gradle/run-observable-gradle.sh check` passed with `BUILD SUCCESSFUL in 20m 25s`, `74 actionable tasks: 51 executed, 9 from cache, 14 up-to-date`, retained log `build/gradle-run-logs/20260714T135216811451835-pid530683-check.log`; the versioned pre-commit gate accepted staged tree `1d7cadadd9701361898fad737ccc06c94443f184` with `BUILD SUCCESSFUL in 13m 18s`, `74 actionable tasks: 53 executed, 20 from cache, 1 up-to-date`; PR #463 merged as `beee85ba7`, 2026-07-14. | `build.gradle.kts` only; version-locked to the `javafx { version }` pin. Classpath, never module path. |
| `withType<Test>` block with the Monocle system properties | Done | `510e183ff` | `beee85ba7` | `build.gradle.kts` now configures every `Test` task with `glass.platform=Monocle`, `monocle.platform=Headless`, `prism.order=sw`, and `java.awt.headless=true`, 2026-07-14; `tools/gradle/run-observable-gradle.sh check` passed with `BUILD SUCCESSFUL in 20m 25s`, `74 actionable tasks: 51 executed, 9 from cache, 14 up-to-date`; PR #463 merged as `beee85ba7`, 2026-07-14. | One block covers `test`, `architectureTest`, and all `junitTest` harnesses. Frozen `BehaviorHarnessRegistration.kt` untouched. |
| V9 rehearsal: local check opens zero windows, no focus theft | Done | `510e183ff` | `beee85ba7` | `tools/gradle/run-observable-gradle.sh check` initially failed only before Gradle startup in the sandbox with `Could not determine a usable wildcard IP for this machine`; rerun outside the sandbox passed with `BUILD SUCCESSFUL in 20m 25s`, `74 actionable tasks: 51 executed, 9 from cache, 14 up-to-date`, 2026-07-14. The successful run exercised the full local `check` graph under Monocle Headless properties; no JavaFX display startup error or focus-theft interruption was observed or reported during the run. PR #463 merged as `beee85ba7`, 2026-07-14. | Full local `check` rehearsal completed under the new headless default. |
| Verdict parity against the pre-M1a windowed run; note | Done | `510e183ff` | `beee85ba7` | The pre-M1a local T4 proof recorded green `./gradlew check` verdicts with the same 74-task graph: `BUILD SUCCESSFUL in 18m 30s`, `74 actionable tasks: 53 executed, 20 from cache, 1 up-to-date`, and the follow-up proof `BUILD SUCCESSFUL in 18m 50s`, `74 actionable tasks: 53 executed, 20 from cache, 1 up-to-date` (`harness-modernization-ledger.md`); M1a local `check` is also green with 74 tasks, 2026-07-14. PR #463 merged as `beee85ba7`, 2026-07-14. | Same task-graph cardinality and green verdicts. Cache distribution changed because the new runtime dependency invalidated task inputs. This unblocks the M0 baseline after merge. |

## M1b Ledger (runs after the M0 baseline)

| Step | Status | Local branch commit | Merge commit | Proof | Notes |
| --- | --- | --- | --- | --- | --- |
| Parallel settings in `gradle.properties` and `maxParallelForks` | Done | `5fabc2b3d` | `9c22d552b` | `gradle.properties` now sets `org.gradle.parallel=true`, `org.gradle.configuration-cache=true`, calibrated `org.gradle.workers.max=3`, and `org.gradle.jvmargs=-Xmx4g -XX:MaxMetaspaceSize=1g -Dfile.encoding=UTF-8`; `build.gradle.kts` now sets every `Test` task's `maxParallelForks` to `(availableProcessors / 2).coerceIn(1, 2)`, 2026-07-14. `./gradlew help --console=plain` passed with `BUILD SUCCESSFUL in 41s` and `Configuration cache entry stored`; the rerun passed with `BUILD SUCCESSFUL in 3s` and `Configuration cache entry reused`, 2026-07-14. The calibration probe `./gradlew hexMapEditorBehaviorHarness dungeonEditorBehaviorHarness dungeonEditorDoorBehaviorHarness dungeonEditorRoomBehaviorHarness --configuration-cache --rerun-tasks --console=plain` passed with `BUILD SUCCESSFUL in 3m 22s`, `9 actionable tasks: 9 executed`, `Configuration cache entry reused`, 2026-07-14. The staged pre-commit gate accepted tree `e05e17b6e9c3fd6152d1b3e128864538b68d5d07` with `BUILD SUCCESSFUL in 13m 31s`, `74 actionable tasks: 61 executed, 12 from cache, 1 up-to-date`, `Configuration cache entry stored`, retained log `build/pre-commit-gate/e05e17b6e9c3fd6152d1b3e128864538b68d5d07.log`, 2026-07-14. Final owner route `tools/gradle/run-staged-verification.sh production-handoff` passed with `BUILD SUCCESSFUL in 5m 18s`, wrapper elapsed `00h:05m:19s`, `39 actionable tasks: 18 executed, 4 from cache, 17 up-to-date`, `Configuration cache entry stored`, retained log `build/gradle-run-logs/20260714T185216935512923-pid632179-production-handoff.log`, 2026-07-14; PR #465 merged as `9c22d552b`, 2026-07-14. | Configuration-cache blockers were repaired without touching frozen surfaces: the settings plugin no longer starts `git config` during configuration, and harness runtime directory setup now uses `PrepareHarnessRuntimeDirectoriesAction` instead of script-object `doFirst` closures. Initial 8-worker and 4-worker attempts were too aggressive for current JavaFX latency budgets; the recorded branch setting is the calibrated 3-worker / 2-fork setting. |
| Parallel-safety rehearsal: `XDG_DATA_HOME` isolation holds | Done | `3dafa22d6` | `0a2d4c260` | Trace-enabled rehearsal `tools/gradle/run-observable-gradle.sh hexMapEditorBehaviorHarness dungeonEditorDoorBehaviorHarness -- --configuration-cache --rerun-tasks -Dsaltmarcher.traceHarnessRuntime=true` passed with `BUILD SUCCESSFUL in 2m 29s`, wrapper elapsed `00h:02m:31s`, `15 actionable tasks: 15 executed`, `Configuration cache entry stored`, retained log `build/gradle-run-logs/20260714T191643906168129-pid640188-hexMapEditorBehaviorHarness__dungeonEditorDoorBehaviorHarness.log`, 2026-07-14. Trace lines prove overlap and distinct Gradle-managed paths: `:hexMapEditorBehaviorHarness` started at `119319318289209` and ended at `119354153442633` with `XDG_DATA_HOME=build/tmp/hexMapEditorBehaviorHarness/xdg-data`; `:dungeonEditorDoorBehaviorHarness` started at `119323081474586` and ended at `119368262114871` with `XDG_DATA_HOME=build/dungeon-editor-behavior-data/dungeonEditorDoorBehaviorHarness` and results under `build/dungeon-editor-behavior-results/dungeonEditorDoorBehaviorHarness`, so the tasks overlapped for about 31.1s. Staged pre-commit gate accepted tree `b302d02821df1df95d111ecd7f9caaf844599f01` with `BUILD SUCCESSFUL in 13m 23s`, `74 actionable tasks: 63 executed, 10 from cache, 1 up-to-date`, `Configuration cache entry stored`, retained log `build/pre-commit-gate/b302d02821df1df95d111ecd7f9caaf844599f01.log`, 2026-07-14. Final owner route `tools/gradle/run-staged-verification.sh production-handoff` passed with `BUILD SUCCESSFUL in 6m 15s`, wrapper elapsed `00h:06m:16s`, `39 actionable tasks: 22 executed, 17 up-to-date`, `Configuration cache entry stored`, retained log `build/gradle-run-logs/20260714T191926924951154-pid641015-production-handoff.log`, 2026-07-14; PR #466 merged as `0a2d4c260`, 2026-07-14. | `PrepareHarnessRuntimeDirectoriesAction` now rejects runtime and results directories outside the Gradle build directory, and trace output is opt-in via `saltmarcher.traceHarnessRuntime`; no scenario assertions, frozen registry surface, or gate contract changed. |
| Verdict parity; >= 40% wall-time cut; V9 still holds; note | Blocked | Pending | Pending | `tools/gradle/run-observable-gradle.sh check -- --rerun-tasks` did not produce the required first green full run, 2026-07-14. First attempt failed with `BUILD FAILED in 15m 3s`, wrapper elapsed `00h:15m:04s`, `74 actionable tasks: 74 executed`, retained log `build/gradle-run-logs/20260714T195520161786024-pid657529-check.log`; failures were `DUNGEON_EDITOR_ROOM_BEHAVIOR_001` latency budget `335ms` and `HEX_EDITOR_012` JavaFX wait timeout. The immediate rerun failed with `BUILD FAILED in 14m 3s`, wrapper elapsed `00h:14m:04s`, `66 actionable tasks: 66 executed`, retained log `build/gradle-run-logs/20260714T201736052214251-pid681778-check.log`; failure was `HEX_EDITOR_012` JavaFX wait timeout. Isolation checks show the named scenarios are not independently red: `tools/gradle/run-observable-gradle.sh dungeonEditorRoomBehaviorHarness -- --rerun-tasks` passed with `BUILD SUCCESSFUL in 3m 27s`, retained log `build/gradle-run-logs/20260714T201127882616754-pid679977-dungeonEditorRoomBehaviorHarness.log`, and `tools/gradle/run-observable-gradle.sh hexMapEditorBehaviorHarness -- --rerun-tasks` passed with `BUILD SUCCESSFUL in 1m`, retained log `build/gradle-run-logs/20260714T201510707773501-pid681187-hexMapEditorBehaviorHarness.log`, 2026-07-14. | Blocked before the required two-run comparison can start. The unchanged M1b check graph still runs the complete Dungeon Editor aggregate alongside the component harnesses under parallel UI load; the hard latency/timeouts fail before a green verdict exists. Do not record a timing win or advance to M2 from this row without either a target-design amendment that allows a topology repair in M1b or a separate owner/judge-accepted exception path. |

## M2 Ledger

| Step | Status | Local branch commit | Merge commit | Proof | Notes |
| --- | --- | --- | --- | --- | --- |
| Pilot area on tag topology plus shared headless extension; ADR | Pending | Pending | Pending | Pending | Pattern frozen before fleet. |
| R3c batch: registry tolerance/removal | Pending | Pending | Pending | Pending | Only frozen-surface edit of M2. |
| Fleet conversion (one batch per area) | Pending | Pending | Pending | Pending | Scripted 1:1 test-name parity per area. |
| Source sets merged; task count <= 4; V6 rehearsal; note | Pending | Pending | Pending | Pending | |

## M3 Ledger

| Step | Status | Local branch commit | Merge commit | Proof | Notes |
| --- | --- | --- | --- | --- | --- |
| Audits with finding diffs (Lizard, CPD, SpotBugs, ckjm, dead-code) | Pending | Pending | Pending | Pending | Per D5 audit rules. |
| findsecbugs owner decision | Pending | Pending | Pending | Pending | Owner decides, not the audit. |
| Near-miss merge into single compile | Pending | Pending | Pending | Pending | Second recompile gone. |
| Analyzer justification table complete; note | Pending | Pending | Pending | Pending | |

## M4 Ledger

| Step | Status | Local branch commit | Merge commit | Proof | Notes |
| --- | --- | --- | --- | --- | --- |
| Rule-parity list ported; synthetic-violation rehearsals | Pending | Pending | Pending | Pending | Every rule fires in its new home. |
| `docsCheck` cacheable task; docs-only rehearsal | Pending | Pending | Pending | Pending | Docs edit re-runs only `docsCheck`. |
| JavaExec mains deleted; build-harness shrunk or deleted; note | Pending | Pending | Pending | Pending | |

## M5 Ledger

| Step | Status | Local branch commit | Merge commit | Proof | Notes |
| --- | --- | --- | --- | --- | --- |
| R3c batch: barriers to dependencies; script internals; frozen refresh | Pending | Pending | Pending | Pending | Second and last frozen batch. |
| Governance docs consolidated (absorbed T6) | Pending | Pending | Pending | Pending | AGENTS.md wording, task-model page, pruning. |
| Deletion-list grep audit | Pending | Pending | Pending | Pending | All greps empty. |
| Final measurement; targets adjudicated; closing note; ledger closed | Pending | Pending | Pending | Pending | Misses need judge-accepted exceptions. |

## Deferred Checks

| Check | Reason | Trigger |
| --- | --- | --- |
| T5 honesty reviewer activation | Extends governance; needs resource-policy amendment | Explicit owner decision |
