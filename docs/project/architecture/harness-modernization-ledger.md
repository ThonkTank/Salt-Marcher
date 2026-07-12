Status: Active
Source of Truth: Current harness-modernization position, in-flight conversion
batch, proof status, and close-out state for
`docs/project/architecture/harness-modernization-roadmap.md`.

# Harness Modernization Ledger

## Purpose

This ledger is the single source of truth for harness modernization state.
It records the active milestone, current conversion batch, branch, required
next proof, and close-out evidence. Chat history does not advance the
modernization unless this ledger advances too.

## State Rules

- At most one T1 conversion batch may be `In Flight`.
- T0 may touch only the pilot harness and reusable registration template.
- Conversion batches preserve scenario semantics 1:1.
- Revert unit is one milestone step or one conversion batch.
- Local cache hits are convenience, never proof.

## Current Position

| Field | Value |
| --- | --- |
| Branch | `codex/harness-modernization-t0` |
| Milestone | T1 - Fleet conversion |
| Conversion batch | Pending selection |
| Status | Pending |
| Required next proof | Select the next T1 conversion batch, update this ledger to `In Flight`, and produce scripted 1:1 scenario parity output for that batch. |
| Last status note | `2026-07-12 T0-close-out` |

## Milestone Ledger

| Milestone | Status | Branch commit | Merge commit | Proof | Notes |
| --- | --- | --- | --- | --- | --- |
| T0 Pilot conversion and pattern | Done on branch | Pending | Pending | Forced pilot run, UP-TO-DATE run, classpath re-run, failure isolation, final JUnit XML, `check --rerun-tasks`, Phase 1 Approved, Phase 2 Approved | `hexMapEditorBehaviorHarness` is the only pilot. Build logic gains a reusable `junitTest` behavior-harness registration template. |
| T1 Fleet conversion | Pending | Pending | Pending | Pending | One area conversion batch at a time after T0 close-out. |
| T2 Cache correctness and hermeticity | Pending | Pending | Pending | Pending | Local build cache behavior and rerun honesty checks are not active until T2. |
| T3 Commit gate via versioned hooks | Pending | Pending | Pending | Pending | No hook wiring before T3. |
| T4 CI authority and bespoke-layer deletion | Pending | Pending | Pending | Pending | `harness-map.json`, `select_harnesses.py`, and `behavior-gate` stay until T4. |
| T5 Resolution report and honesty reviewer | Pending | Pending | Pending | Pending | Resource policy amendment must precede reviewer calls. |
| T6 Governance consolidation | Pending | Pending | Pending | Pending | AGENTS/check-entrypoint consolidation waits until the system exists. |

## Pilot Proof-Item Inventory

`hexMapEditorBehaviorHarness` must map these former proof item IDs to same-name
JUnit test methods, with hyphens converted to underscores:

- `HEX-EDITOR-001`
- `HEX-EDITOR-002`
- `HEX-EDITOR-003`
- `HEX-EDITOR-004`
- `HEX-EDITOR-005`
- `HEX-EDITOR-006`
- `HEX-EDITOR-007`
- `HEX-EDITOR-008`
- `HEX-EDITOR-009`
- `HEX-EDITOR-010`
- `HEX-EDITOR-011`
- `HEX-EDITOR-012`
- `HEX-EDITOR-013`
- `HEX-TRAVEL-001`
- `HEX-TRAVEL-002`
- `HEX-TRAVEL-003`
- `HEX-TRAVEL-004`
- `HEX-TRAVEL-005`
- `HEX-TRAVEL-006`
- `HEX-TRAVEL-007`
- `HEX-TRAVEL-008`

## T0 Pilot Proof Evidence

- Pilot task shape: `hexMapEditorBehaviorHarness` is registered as a Gradle
  `Test` task and wired into `check`; the old JavaExec registration for this
  pilot is removed.
- Final forced pilot run:
  `env -u CODEX_THREAD_ID SALTMARCHER_GRADLE_ISOLATION_ID=t0-beforeall-rerun tools/gradle/run-observable-gradle.sh --fail-fast hexMapEditorBehaviorHarness -- --rerun-tasks`
  passed. Retained log:
  `build/gradle-run-logs/20260712T041148844002816-pid920386-hexMapEditorBehaviorHarness.log`.
  Literal result: `BUILD SUCCESSFUL in 1m 17s`, `13 actionable tasks: 13 executed`.
- Final unchanged pilot run:
  `env -u CODEX_THREAD_ID SALTMARCHER_GRADLE_ISOLATION_ID=t0-beforeall-uptodate tools/gradle/run-observable-gradle.sh --fail-fast hexMapEditorBehaviorHarness`
  passed. Retained log:
  `build/gradle-run-logs/20260712T041314860459171-pid921208-hexMapEditorBehaviorHarness.log`.
  Literal result: `BUILD SUCCESSFUL in 6s`, `13 actionable tasks: 13 up-to-date`;
  `:hexMapEditorBehaviorHarness UP-TO-DATE`.
- Classpath change rehearsal:
  a temporary field in
  `test/src/view/leftbartabs/hexmap/HexMapEditorBehaviorHarness.java` forced
  re-execution without `--rerun-tasks`.
  `env -u CODEX_THREAD_ID SALTMARCHER_GRADLE_ISOLATION_ID=t0-classpath tools/gradle/run-observable-gradle.sh --fail-fast hexMapEditorBehaviorHarness`
  passed. Retained log:
  `build/gradle-run-logs/20260712T040311424865278-pid913432-hexMapEditorBehaviorHarness.log`.
  Literal result: `BUILD SUCCESSFUL in 30s`, `13 actionable tasks: 2 executed, 11 up-to-date`.
- Scenario failure isolation rehearsal:
  a temporary real assertion change in `HEX_EDITOR_006` caused the pilot task
  to fail while later scenarios still appeared in JUnit XML.
  `env -u CODEX_THREAD_ID SALTMARCHER_GRADLE_ISOLATION_ID=t0-failure tools/gradle/run-observable-gradle.sh --fail-fast hexMapEditorBehaviorHarness`
  failed as expected. Retained log:
  `build/gradle-run-logs/20260712T040154283756574-pid911774-hexMapEditorBehaviorHarness.log`.
  Literal result: `21 tests completed, 1 failed`; the XML contained
  `HEX_EDITOR_007` through `HEX_EDITOR_013` after the failed
  `HEX_EDITOR_006`.
- Final JUnit XML:
  `build/test-results/hexMapEditorBehaviorHarness/TEST-src.view.leftbartabs.hexmap.HexMapEditorBehaviorHarness.xml`
  records `tests="21"`, `failures="0"`, `errors="0"` and contains one
  testcase per inventory item above, with hyphens converted to underscores.
- Final full check:
  `env -u CODEX_THREAD_ID SALTMARCHER_GRADLE_ISOLATION_ID=t0-judge-rerun-check tools/gradle/run-observable-gradle.sh --fail-fast check -- --rerun-tasks`
  passed. Retained log:
  `build/gradle-run-logs/20260712T042400628401016-pid942331-check.log`.
  Literal result: `BUILD SUCCESSFUL in 8m 23s`,
  `42 actionable tasks: 42 executed`.
- Review state: initial Phase 1 found real blockers. The harness was then split
  into scenario-specific test bodies, docs were staged, retained proof logs
  were added, and the JavaFX lifecycle was aligned with the roadmap's
  `@BeforeAll`/`@AfterAll` pattern. Phase 1 re-review approved. Phase 2 first
  found a proof-only blocker because the final full `check` used two local cache
  hits; after `check --rerun-tasks`, Phase 2 re-review approved.

## T1 Batch Evidence - `hexTravelStateBehaviorHarness`

- Batch started after T0 close-out. Scope is limited to
  `hexTravelStateBehaviorHarness` and the shared Hex harness source set task
  filtering required because `hexMapEditorBehaviorHarness` and
  `TravelStateHexHarness` compile into the same source set.
- Registration: the old
  `behaviorHarnesses.javaExec("hexTravelStateBehaviorHarness")` registration,
  `mainClass.set("src.view.statetabs.travel.TravelStateHexHarness")`,
  `hexTravelStateBehaviorHarnessDataDir`, and its
  `outputs.upToDateWhen { false }` entry are removed. The batch now uses
  `behaviorHarnesses.junitTest("hexTravelStateBehaviorHarness")`, includes only
  `src/view/statetabs/travel/TravelStateHexHarness.class`, and is wired into
  `check`.
- Scripted parity mapping output:

  ```text
  old proof item       junit method
  HEX-TRAVEL-STATE-001 HEX_TRAVEL_STATE_001
  HEX-TRAVEL-STATE-002 HEX_TRAVEL_STATE_002
  result: 2 old proof item(s), 2 junit method(s), 2 exact normalized matches
  ```

- Focused batch run:
  `env -u CODEX_THREAD_ID SALTMARCHER_GRADLE_ISOLATION_ID=t1-hextravel-green tools/gradle/run-observable-gradle.sh --fail-fast hexTravelStateBehaviorHarness`
  passed. Retained log:
  `build/gradle-run-logs/20260712T043911411259250-pid951960-hexTravelStateBehaviorHarness.log`.
  Literal result: `BUILD SUCCESSFUL in 25s`,
  `13 actionable tasks: 1 executed, 12 up-to-date`.
- Forced Hex pair run:
  `env -u CODEX_THREAD_ID SALTMARCHER_GRADLE_ISOLATION_ID=t1-hextravel-forced tools/gradle/run-observable-gradle.sh --fail-fast hexMapEditorBehaviorHarness hexTravelStateBehaviorHarness -- --rerun-tasks`
  passed. Retained log:
  `build/gradle-run-logs/20260712T044036955964736-pid953478-hexMapEditorBehaviorHarness__hexTravelStateBehaviorHarness.log`.
  Literal result: `BUILD SUCCESSFUL in 1m 20s`,
  `14 actionable tasks: 14 executed`.
- JUnit XML after the forced run:
  `build/test-results/hexTravelStateBehaviorHarness/TEST-src.view.statetabs.travel.TravelStateHexHarness.xml`
  records `tests="2"`, `failures="0"`, `errors="0"` and contains
  `HEX_TRAVEL_STATE_001` and `HEX_TRAVEL_STATE_002`. The pilot XML still
  records `tests="21"`, `failures="0"`, `errors="0"` after task filtering.
- Final full check:
  `env -u CODEX_THREAD_ID SALTMARCHER_GRADLE_ISOLATION_ID=t1-hextravel-check tools/gradle/run-observable-gradle.sh --fail-fast check -- --rerun-tasks`
  passed. Retained log:
  `build/gradle-run-logs/20260712T044258178396794-pid955715-check.log`.
  Literal result: `BUILD SUCCESSFUL in 8m 33s`,
  `43 actionable tasks: 43 executed`.
- Review state: Phase 1 approved. Phase 2 first found a ledger-only parity
  formatting mismatch; after the explicit old-ID to JUnit-method mapping fix,
  Phase 2 re-review approved.
