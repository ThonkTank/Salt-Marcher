Status: Active
Owner: SaltMarcher Team
Last Reviewed: 2026-07-13
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
| Branch | `codex/verif-greenfield-m0-nightly-close` |
| Milestone | M0 - Charter, Local Sync, Baseline, Predecessor Close-Out |
| Status | In Flight |
| Required next proof | M1a (Monocle headless) before the M0 baseline: the baseline must never be measured on the real display. Land the amendment commit, then `org.testfx:openjfx-monocle:21.0.2` plus the `withType<Test>` system properties in `build.gradle.kts`, then the V9 rehearsal (zero windows, no focus theft). The M0 baseline follows on the headless serial harness. |
| Last status note | `2026-07-14 Nightly-green-T4-closed` |

## Baseline Measurements (owner machine, headless, filled in M0 after M1a)

Measured only after M1a has made runs headless: a windowed baseline would
violate V9 and the Local-First Mandate. Serial, i.e. before M1b.

| Measurement | Command | Result | Date |
| --- | --- | --- | --- |
| Full cold `check --rerun-tasks` | Not measured - no binding target | Not measured - no binding target | Not measured - no binding target |
| Full warm `check --rerun-tasks` | Pending | Pending | Pending |
| Warm no-change `check` | Pending | Pending | Pending |
| Pre-commit gate, untouched-area commit | Pending | Pending | Pending |

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
| 1 | Full warm `check --rerun-tasks` <= 20 min | Provisional |
| 2 | Warm no-change `check` <= 2 min | Provisional |
| 3 | Pre-commit gate, untouched area <= 5 min | Provisional |
| 4 | Verification `Test` tasks <= 4; harness source sets 0 | Provisional |
| 5 | Architecture rule engines = 1 | Provisional |
| 6 | New behavior test diff confined to `test/**` | Provisional |
| 7 | Local `check` opens zero windows, never steals focus | Provisional |
| 8 | Zero `upToDateWhen{false}` / `cacheIf{false}` on verification tasks | Provisional |

## M0 Ledger

| Step | Status | Local branch commit | Merge commit | Proof | Notes |
| --- | --- | --- | --- | --- | --- |
| Charter docs committed and indexed | Done | `dbfe28955` | `738ebe6b` | `git diff --check main...HEAD` passed with no output, 2026-07-13; `./gradlew checkDocumentationEnforcement --console=plain` passed with `Documentation checks passed.` and `BUILD SUCCESSFUL in 6s`, 2026-07-13; docs-gate repair PR #458 merged as `735331a11` after green `check`, `warden-freeze`, owner-only `judge-review`, `ckjm-report`, SonarCloud, and CodeScene, 2026-07-13; charter PR #459 merged as `738ebe6b` after green `check`, `warden-freeze`, `judge-review`, `ckjm-report`, SonarCloud, and CodeScene, 2026-07-13 | Roadmap, target design, ledger, owner notes, and index links are merged. Prior blocker cleared by PR #458: the active Documentation Standard now owns size as a non-fatal signal and keeps `Owner` / `Last Reviewed` optional. PR #459 head `dbfe28955` only refreshed the risk-label event after the proof commit; no violation was reported against the verification-greenfield files. |
| Local checkout on origin/main; in-flight work preserved | Done on branch | Pending | Pending | `git status -sb` showed `## main...origin/main` with no divergence at `093a7f96e`, 2026-07-14; `git ls-remote --heads origin codex/architecture-roadmap-phase2 codex/architecture-migration-m0-charter` returned both refs (`d95c9f685`, `02c0c95fea53fdb7aca3fdba7499dfda8244fdad`), 2026-07-14; `git worktree list` returned only `/home/aaron/Schreibtisch/projects/SaltMarcher`, 2026-07-14 | Both in-flight architecture branches are now pushed, which is what the M0 done-when requires. Encounter WIP is `02c0c95fe` on `codex/architecture-migration-m0-charter`; `codex/architecture-roadmap-phase2` carries the W1 service baseline. Merged and superseded local branches were deleted; only these two plus `main` remain. |
| Green scheduled nightly run recorded; predecessor T4 closed | Done on branch | Pending | Pending | `gh run view 29307758537 --json headSha,event,conclusion,createdAt,updatedAt,jobs` returned `event=schedule`, `conclusion=success`, `headSha=093a7f96e8565458af4cf9c2935f7a0d4d7ee540`, job `nightly-rerun-tasks=success`, `createdAt=2026-07-14T05:08:48Z`, `updatedAt=2026-07-14T05:15:25Z`, 2026-07-14; its job log records `[observable-gradle] Command: ./gradlew check --console=plain --continue --rerun-tasks` and `BUILD SUCCESSFUL in 5m 44s`, `74 actionable tasks: 73 executed, 1 up-to-date`, 2026-07-14 | The earlier block was external schedule timing only: the cron `17 2 * * *` had not yet fired when it was checked at `2026-07-14T00:29:24+02:00`. The first scheduled run after it is green and is recorded here without substituting a manual, PR, or push run. Predecessor T4 closed in `harness-modernization-ledger.md`. |
| Predecessor roadmap deprecated with successor pointer | Done on branch | Pending | Pending | `head -6 docs/project/architecture/harness-modernization-roadmap.md` shows `Status: Deprecated` and `Last Reviewed: 2026-07-14`, 2026-07-14; the successor pointer to this roadmap stands directly under the title, 2026-07-14 | `Status: Deprecated` plus pointer under the title. Retained rather than deleted because T5's specification lives there and is referenced by this roadmap's Deferred Annex. |
| Baseline measured headless on owner machine | Pending | Pending | Pending | Pending | Four measurements into the baseline table. |
| Targets calibrated; German status note | Pending | Pending | Pending | Pending | Targets flip Provisional -> Binding. |

## M1a Ledger (runs before the M0 baseline)

| Step | Status | Local branch commit | Merge commit | Proof | Notes |
| --- | --- | --- | --- | --- | --- |
| Amendment commit for the M1a/M1b split and D2 coordinates | Done on branch | Pending | Pending | Pending | Must precede the implementing commit per the target design's amendment rule. |
| `openjfx-monocle:21.0.2` on test + 4 harness runtime classpaths | Pending | Pending | Pending | Pending | `build.gradle.kts` only; version-locked to the `javafx { version }` pin. Classpath, never module path. |
| `withType<Test>` block with the Monocle system properties | Pending | Pending | Pending | Pending | One block covers `test`, `architectureTest`, and all `junitTest` harnesses. Frozen `BehaviorHarnessRegistration.kt` untouched. |
| V9 rehearsal: local check opens zero windows, no focus theft | Pending | Pending | Pending | Pending | Run a full local `check` while typing in another application. |
| Verdict parity against the pre-M1a windowed run; note | Pending | Pending | Pending | Pending | Same executed task set, same verdicts. Unblocks the M0 baseline. |

## M1b Ledger (runs after the M0 baseline)

| Step | Status | Local branch commit | Merge commit | Proof | Notes |
| --- | --- | --- | --- | --- | --- |
| Parallel settings in `gradle.properties` and `maxParallelForks` | Pending | Pending | Pending | Pending | `parallel`, `workers.max`, `configuration-cache`, `jvmargs`. |
| Parallel-safety rehearsal: `XDG_DATA_HOME` isolation holds | Pending | Pending | Pending | Pending | 19 hand-copied assignments in `build.gradle.kts`; prove two behavior tasks run concurrently without collision. |
| Verdict parity; >= 40% wall-time cut; V9 still holds; note | Pending | Pending | Pending | Pending | Against the M0 warm headless baseline. |

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
