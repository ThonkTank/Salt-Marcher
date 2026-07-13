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
  conversion batch.
- Step `Status` values: `Pending`, `In Flight`, `Blocked`, `Done on branch`,
  `Done`.
- A step without a literally green proof (command plus result plus date) is
  WIP and stays `In Flight`.
- `Blocked` requires the blocking reason in Notes and stops the executor.

## Current Position

| Field | Value |
| --- | --- |
| Branch | `codex/verif-greenfield-m0-nightly-t4` |
| Milestone | M0 - Charter, Local Sync, Baseline, Predecessor Close-Out |
| Status | Blocked |
| Required next proof | Wait for the first scheduled `quality-platforms / nightly-rerun-tasks` run after the 2026-07-14 02:17 UTC cron, then record it and close predecessor T4 if it is green. |
| Last status note | `2026-07-14 Nightly-not-yet-fired` |

## Baseline Measurements (owner machine, headless, filled in M0)

| Measurement | Command | Result | Date |
| --- | --- | --- | --- |
| Full cold `check --rerun-tasks` | Pending | Pending | Pending |
| Full warm `check --rerun-tasks` | Pending | Pending | Pending |
| Warm no-change `check` | Pending | Pending | Pending |
| Pre-commit gate, untouched-area commit | Pending | Pending | Pending |

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
| Local checkout on origin/main; in-flight work preserved | Done on branch | Pending | Pending | Pending | Encounter WIP committed on `codex/architecture-migration-m0-charter`; `codex/architecture-roadmap-phase2` pushed to origin 2026-07-13. |
| Green scheduled nightly run recorded; predecessor T4 closed | Blocked | Pending | Pending | `gh run list --workflow quality-platforms --event schedule --limit 10 --json ...` returned `[]`, 2026-07-14; `gh run list --event schedule --limit 20 --json ...` showed only `promote-stable` scheduled runs, 2026-07-14; `date -Is` returned `2026-07-14T00:29:24+02:00`, before the configured `quality-platforms` cron `17 2 * * *`, 2026-07-14 | Blocked on external schedule timing, not on a red nightly. Do not substitute a manual, PR, or push run for the required scheduled `nightly-rerun-tasks` evidence. |
| Predecessor roadmap deprecated with successor pointer | Pending | Pending | Pending | Pending | `Status: Deprecated` plus pointer under the title. |
| Baseline measured headless on owner machine | Pending | Pending | Pending | Pending | Four measurements into the baseline table. |
| Targets calibrated; German status note | Pending | Pending | Pending | Pending | Targets flip Provisional -> Binding. |

## M1 Ledger

| Step | Status | Local branch commit | Merge commit | Proof | Notes |
| --- | --- | --- | --- | --- | --- |
| Monocle headless default in gradle.properties and Test config | Pending | Pending | Pending | Pending | Non-frozen surfaces only. |
| Parallel settings and `maxParallelForks` | Pending | Pending | Pending | Pending | |
| V9 rehearsal: local check opens zero windows, no focus theft | Pending | Pending | Pending | Pending | Run while typing elsewhere. |
| Parallel-safety and verdict parity; >= 40% wall-time cut; note | Pending | Pending | Pending | Pending | Against M0 warm baseline. |

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
