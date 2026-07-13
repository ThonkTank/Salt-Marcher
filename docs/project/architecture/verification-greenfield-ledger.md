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
| Branch | `codex/verif-greenfield-m0-charter` |
| Milestone | M0 - Charter, Local Sync, Baseline, Predecessor Close-Out |
| Status | Blocked |
| Required next proof | Owner decision required: approve a documentation-enforcement relaxation or name a different repair path, then rerun `./gradlew checkDocumentationEnforcement --console=plain` for the charter branch. |
| Last status note | `2026-07-13 Charter-proof-blocked-by-judge` |

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
| Charter docs committed and indexed | Blocked | `72304398d` | Pending | `git diff --check` passed with no output, 2026-07-13; `./gradlew checkDocumentationEnforcement --console=plain` failed, 2026-07-13; PR #458 judge rejected documentation-gate relaxation, 2026-07-13; blocker ledger update `git diff --check` passed and `./gradlew checkDocumentationEnforcement --console=plain` failed with 12 stale documentation-enforcement violations, 2026-07-13 | Roadmap, target design, ledger, owner notes, and index links are committed on the branch. Blocked by pre-existing `checkDocumentationEnforcement` violations on current `origin/main`: stale hard line-cap failures, two `Status: Baseline` files, and optional `Owner`/`Last Reviewed` metadata still treated as required. Repair PR #458 proved the local docs gate but CI judge rejected the relaxation as gate weakening; owner must approve relaxing the documentation gate or choose a different repair path before this step can advance. No violation was reported against the new verification-greenfield files. |
| Local checkout on origin/main; in-flight work preserved | Done on branch | Pending | Pending | Pending | Encounter WIP committed on `codex/architecture-migration-m0-charter`; `codex/architecture-roadmap-phase2` pushed to origin 2026-07-13. |
| Green scheduled nightly run recorded; predecessor T4 closed | Pending | Pending | Pending | Pending | Update predecessor ledger T4 to Done with the nightly evidence. |
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
