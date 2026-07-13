Status: Active
Owner: SaltMarcher Team
Last Reviewed: 2026-07-12
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
| Branch | `main` |
| Milestone | T4 - CI authority and bespoke-layer deletion |
| Conversion batch | None |
| Status | Blocked |
| Required next proof | Wait for the first scheduled `quality-platforms / nightly-rerun-tasks` run after the 2026-07-14 02:17 UTC cron; record it here only if it is green. |
| Last status note | `2026-07-14 Nightly-not-yet-fired` |

## Milestone Ledger

| Milestone | Status | Branch commit | Merge commit | Proof | Notes |
| --- | --- | --- | --- | --- | --- |
| T0 Pilot conversion and pattern | Done on branch | Pending | Pending | Forced pilot run, UP-TO-DATE run, classpath re-run, failure isolation, final JUnit XML, `check --rerun-tasks`, Phase 1 Approved, Phase 2 Approved | `hexMapEditorBehaviorHarness` is the only pilot. Build logic gains a reusable `junitTest` behavior-harness registration template. |
| T1 Fleet conversion | Done on branch | Pending | Pending | Per-batch focused run, forced run, JUnit XML, final `check --rerun-tasks`, Phase 1 Approved, Phase 2 Approved | All registered behavior harness tasks are JUnit `Test` tasks; no JavaExec behavior harness registration, silent Dungeon Editor direct-main entrypoint, or harness-level `outputs.upToDateWhen { false }` remains. |
| T2 Cache correctness and hermeticity | Done on branch | Pending | Pending | Dungeon Editor and Render Parity cache-hit, classpath re-run, resource re-run, final consecutive `check --rerun-tasks`, Phase 1 Approved, Phase 2 Approved | Relative result paths replace absolute Test system-property result paths for the reviewed converted check-participating Dungeon Editor surfaces. |
| T3 Commit gate via versioned hooks | Done on branch | Pending | Pending | Rejected untested change naming `:compileTestJava`, accepted tested staged trees through clean worktree `check`, fresh-clone bootstrap set `core.hooksPath=tools/hooks`, dirty worktree isolation passed, Phase 1 Approved, Phase 2 Approved | Versioned `tools/hooks/pre-commit` now verifies the staged tree through a detached clean worktree. |
| T4 CI authority and bespoke-layer deletion | Blocked | `4946450b3`, `d528d0b13`, `712ac4f87` | `ea6e797d`, `8aa8ed350` | Local structural proof and Phase 1/Phase 2 approved; build-wiring PR CI forced `check --rerun-tasks` green; area-touch PR CI content-addressed cache behavior green; branch-protection readback Qualified; deleted selector files absent on `main`; `gh run list --workflow quality-platforms --event schedule --limit 10 --json ...` returned `[]`, 2026-07-14; `gh run list --event schedule --limit 20 --json ...` showed only `promote-stable` scheduled runs, 2026-07-14; `date -Is` returned `2026-07-14T00:29:24+02:00`, before the configured `quality-platforms` cron `17 2 * * *`, 2026-07-14 | PR #453 replaced the required CI surface with `check`, adds scheduled `nightly-rerun-tasks`, deletes `harness-map.json`, `select_harnesses.py`, and `behavior-gate`, removes `checkHarnessMapConsistency`, and updates required-check/frozen/governance surfaces. Blocked on external schedule timing, not on a red nightly; do not substitute a manual, PR, or push run for the required scheduled nightly evidence. |
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

## T1 Batch Evidence - `encounterStateTabHarness`

- Batch started after `hexTravelStateBehaviorHarness` close-out. Scope is
  limited to `encounterStateTabHarness`.
- Registration: the old
  `behaviorHarnesses.javaExec("encounterStateTabHarness")` registration,
  `mainClass.set("src.view.statetabs.encounter.EncounterStateTabHarness")`,
  `encounterStateTabHarnessDataDir`, and its
  `outputs.upToDateWhen { false }` entry are removed. The batch now uses
  `behaviorHarnesses.junitTest("encounterStateTabHarness")`, includes only
  `src/view/statetabs/encounter/EncounterStateTabHarness.class`, and is wired
  into `check`.
- Scripted parity mapping output:

  ```text
  old proof item          junit method
  ENCOUNTER-STATE-TAB-001 ENCOUNTER_STATE_TAB_001
  ENCOUNTER-STATE-TAB-002 ENCOUNTER_STATE_TAB_002
  result: 2 old proof item(s), 2 junit method(s), 2 exact normalized matches
  ```

- Focused batch run:
  `env -u CODEX_THREAD_ID SALTMARCHER_GRADLE_ISOLATION_ID=t1-encounter-state-green tools/gradle/run-observable-gradle.sh --fail-fast encounterStateTabHarness`
  passed. Retained log:
  `build/gradle-run-logs/20260712T050240156879843-pid982878-encounterStateTabHarness.log`.
  Literal result: `BUILD SUCCESSFUL in 18s`,
  `13 actionable tasks: 2 executed, 11 up-to-date`.
- Forced batch run:
  `env -u CODEX_THREAD_ID SALTMARCHER_GRADLE_ISOLATION_ID=t1-encounter-state-forced tools/gradle/run-observable-gradle.sh --fail-fast encounterStateTabHarness -- --rerun-tasks`
  passed. Retained log:
  `build/gradle-run-logs/20260712T050328976663039-pid984383-encounterStateTabHarness.log`.
  Literal result: `BUILD SUCCESSFUL in 58s`,
  `13 actionable tasks: 13 executed`.
- JUnit XML after the focused run:
  `build/test-results/encounterStateTabHarness/TEST-src.view.statetabs.encounter.EncounterStateTabHarness.xml`
  records `tests="2"`, `failures="0"`, `errors="0"` and contains
  `ENCOUNTER_STATE_TAB_001` and `ENCOUNTER_STATE_TAB_002`.
- Final full check:
  `env -u CODEX_THREAD_ID SALTMARCHER_GRADLE_ISOLATION_ID=t1-encounter-state-check tools/gradle/run-observable-gradle.sh --fail-fast check -- --rerun-tasks`
  passed. Retained log:
  `build/gradle-run-logs/20260712T050508383852406-pid985087-check.log`.
  Literal result: `BUILD SUCCESSFUL in 8m 29s`,
  `44 actionable tasks: 44 executed`.
- Review state: Phase 1 approved. Phase 2 approved.
- Drift note: Phase 2 observed that
  `docs/project/architecture/architecture-migration-creatures-target-design.md`
  still contains an older adjacent-inventory `50 XP` facts string. The
  conversion preserves the current frozen harness behavior: `origin/main`
  already asserts `CR 1/4  |  100 XP  |  humanoid`, and
  `docs/project/architecture/migration-ledger.md` plus the German migration
  owner note record that the old production projection is `xp * count` for two
  50-XP goblins. This T1 batch does not rewrite the historical architecture
  migration artifact.

## T1 Batch Evidence - `encounterTableReadbackHarness`

- Batch started after `encounterStateTabHarness` close-out. Scope is limited to
  `encounterTableReadbackHarness`.
- Registration: the old
  `behaviorHarnesses.javaExec("encounterTableReadbackHarness")` registration,
  `mainClass.set("src.domain.encountertable.EncounterTableReadbackHarness")`,
  `encounterTableReadbackHarnessDataDir`, and its
  `outputs.upToDateWhen { false }` entry are removed. The batch now uses
  `behaviorHarnesses.junitTest("encounterTableReadbackHarness")`, includes only
  `src/domain/encountertable/EncounterTableReadbackHarness.class`, and is wired
  into `check`.
- Scripted parity mapping output:

  ```text
  old proof item      junit method
  ENCOUNTER-TABLE-001 ENCOUNTER_TABLE_001
  ENCOUNTER-TABLE-002 ENCOUNTER_TABLE_002
  ENCOUNTER-TABLE-003 ENCOUNTER_TABLE_003
  ENCOUNTER-TABLE-004 ENCOUNTER_TABLE_004
  ENCOUNTER-TABLE-005 ENCOUNTER_TABLE_005
  result: 5 old proof item(s), 5 junit method(s), 5 exact normalized matches
  ```

- Focused batch run:
  `env -u CODEX_THREAD_ID SALTMARCHER_GRADLE_ISOLATION_ID=t1-encounter-table-fix-focused tools/gradle/run-observable-gradle.sh --fail-fast encounterTableReadbackHarness`
  passed. Retained log:
  `build/gradle-run-logs/20260712T053220600005426-pid1018245-encounterTableReadbackHarness.log`.
  Literal result: `BUILD SUCCESSFUL in 17s`,
  `13 actionable tasks: 2 executed, 1 from cache, 10 up-to-date`.
- Forced batch run:
  `env -u CODEX_THREAD_ID SALTMARCHER_GRADLE_ISOLATION_ID=t1-encounter-table-fix-forced tools/gradle/run-observable-gradle.sh --fail-fast encounterTableReadbackHarness -- --rerun-tasks`
  passed. Retained log:
  `build/gradle-run-logs/20260712T053244759728799-pid1018678-encounterTableReadbackHarness.log`.
  Literal result: `BUILD SUCCESSFUL in 50s`,
  `13 actionable tasks: 13 executed`.
- JUnit XML after the focused run:
  `build/test-results/encounterTableReadbackHarness/TEST-src.domain.encountertable.EncounterTableReadbackHarness.xml`
  records `tests="5"`, `failures="0"`, `errors="0"` and contains
  `ENCOUNTER_TABLE_001` through `ENCOUNTER_TABLE_005`.
- Final full check:
  `env -u CODEX_THREAD_ID SALTMARCHER_GRADLE_ISOLATION_ID=t1-encounter-table-fix-check tools/gradle/run-observable-gradle.sh --fail-fast check -- --rerun-tasks`
  passed. Retained log:
  `build/gradle-run-logs/20260712T053426074250896-pid1019645-check.log`.
  Literal result: `BUILD SUCCESSFUL in 8m 21s`,
  `45 actionable tasks: 45 executed`.
- Review state: Phase 1 first found a real parity bug: `ENCOUNTER_TABLE_005`
  initially started from a fresh empty candidate model before the storage-error
  check, while the old JavaExec flow first published the non-empty unbounded
  result. Rework now establishes and asserts that prior non-empty candidate
  state before dropping the `creatures` table. Phase 1 re-review approved.
  Phase 2 approved.

## T1 Batch Evidence - `creatureCatalogHarness`

- Batch started after `encounterTableReadbackHarness` close-out. Scope is
  limited to `creatureCatalogHarness`.
- Registration: the old
  `behaviorHarnesses.javaExec("creatureCatalogHarness")` registration,
  `mainClass.set("src.domain.creatures.CreatureCatalogHarness")`, and its
  `outputs.upToDateWhen { false }` entry are removed. The batch now uses
  `behaviorHarnesses.junitTest("creatureCatalogHarness")`, includes only
  `src/domain/creatures/CreatureCatalogHarness.class`, and is wired into
  `check`.
- Scripted parity mapping output:

  ```text
  old proof item      junit method
  CREATURE-CATALOG-001 CREATURE_CATALOG_001
  CREATURE-CATALOG-002 CREATURE_CATALOG_002
  CREATURE-CATALOG-003 CREATURE_CATALOG_003
  CREATURE-CATALOG-004 CREATURE_CATALOG_004
  CREATURE-CATALOG-005 CREATURE_CATALOG_005
  CREATURE-CATALOG-006 CREATURE_CATALOG_006
  CREATURE-CATALOG-007 CREATURE_CATALOG_007
  CREATURE-CATALOG-008 CREATURE_CATALOG_008
  CREATURE-CATALOG-009 CREATURE_CATALOG_009
  result: 9 old proof item(s), 9 junit method(s), 9 exact normalized matches
  ```

- Focused batch run:
  `env -u CODEX_THREAD_ID SALTMARCHER_GRADLE_ISOLATION_ID=t1-creature-rework-focused tools/gradle/run-observable-gradle.sh --fail-fast creatureCatalogHarness`
  passed. Retained log:
  `build/gradle-run-logs/20260712T060618312350400-pid1052681-creatureCatalogHarness.log`.
  Literal result: `BUILD SUCCESSFUL in 16s`,
  `13 actionable tasks: 2 executed, 1 from cache, 10 up-to-date`.
- Forced batch run:
  `env -u CODEX_THREAD_ID SALTMARCHER_GRADLE_ISOLATION_ID=t1-creature-rework-forced tools/gradle/run-observable-gradle.sh --fail-fast creatureCatalogHarness -- --rerun-tasks`
  passed. Retained log:
  `build/gradle-run-logs/20260712T060641091195281-pid1053141-creatureCatalogHarness.log`.
  Literal result: `BUILD SUCCESSFUL in 52s`,
  `13 actionable tasks: 13 executed`.
- JUnit XML after the forced run:
  `build/test-results/creatureCatalogHarness/TEST-src.domain.creatures.CreatureCatalogHarness.xml`
  records `tests="9"`, `failures="0"`, `errors="0"` and contains
  `CREATURE_CATALOG_001` through `CREATURE_CATALOG_009`.
- Final full check:
  `env -u CODEX_THREAD_ID SALTMARCHER_GRADLE_ISOLATION_ID=t1-creature-rework-check tools/gradle/run-observable-gradle.sh --fail-fast check -- --rerun-tasks`
  passed. Retained log:
  `build/gradle-run-logs/20260712T060750183361284-pid1054159-check.log`.
  Literal result: `BUILD SUCCESSFUL in 8m 18s`,
  `46 actionable tasks: 46 executed`.
- Review state: Phase 1 first found two parity gaps: `CREATURE_CATALOG_005`
  did not enter the invalid catalog query from the old edited catalog
  publication, and `CREATURE_CATALOG_006` did not enter missing/broken detail
  checks from the old selected edited detail publication. Rework now rebuilds
  those prior states with setup-only labels before the proof-item assertions.
  Phase 1 re-review approved. Phase 2 approved.

## T1 Batch Evidence - `partyDropdownHarness`

- Batch started after `creatureCatalogHarness` close-out. Scope is limited to
  `partyDropdownHarness`.
- Registration: the old
  `behaviorHarnesses.javaExec("partyDropdownHarness")` registration,
  `mainClass.set("src.view.dropdowns.party.PartyDropdownHarness")`,
  `partyDropdownHarnessDataDir`, and its `outputs.upToDateWhen { false }`
  entry are removed. The batch now uses
  `behaviorHarnesses.junitTest("partyDropdownHarness")`, includes only
  `src/view/dropdowns/party/PartyDropdownHarness.class`, and is wired into
  `check`.
- Scripted parity mapping output:

  ```text
  old proof item      junit method
  PARTY-DROPDOWN-001  PARTY_DROPDOWN_001
  PARTY-DROPDOWN-002  PARTY_DROPDOWN_002
  PARTY-DROPDOWN-003  PARTY_DROPDOWN_003
  PARTY-DROPDOWN-004  PARTY_DROPDOWN_004
  result: 4 old proof item(s), 4 junit method(s), 4 exact normalized matches
  ```

- Focused batch run:
  `env -u CODEX_THREAD_ID SALTMARCHER_GRADLE_ISOLATION_ID=t1-party-rework-focused tools/gradle/run-observable-gradle.sh --fail-fast partyDropdownHarness`
  passed. Retained log:
  `build/gradle-run-logs/20260712T064800753743514-pid1092576-partyDropdownHarness.log`.
  Literal result: `BUILD SUCCESSFUL in 32s`,
  `13 actionable tasks: 2 executed, 1 from cache, 10 up-to-date`.
- Forced batch run:
  `env -u CODEX_THREAD_ID SALTMARCHER_GRADLE_ISOLATION_ID=t1-party-rework-forced tools/gradle/run-observable-gradle.sh --fail-fast partyDropdownHarness -- --rerun-tasks`
  passed. Retained log:
  `build/gradle-run-logs/20260712T064840569185133-pid1093327-partyDropdownHarness.log`.
  Literal result: `BUILD SUCCESSFUL in 1m 7s`,
  `13 actionable tasks: 13 executed`.
- JUnit XML after the forced run:
  `build/test-results/partyDropdownHarness/TEST-src.view.dropdowns.party.PartyDropdownHarness.xml`
  records `tests="4"`, `failures="0"`, `errors="0"` and contains
  `PARTY_DROPDOWN_001` through `PARTY_DROPDOWN_004`.
- Final full check:
  `env -u CODEX_THREAD_ID SALTMARCHER_GRADLE_ISOLATION_ID=t1-party-rework-check tools/gradle/run-observable-gradle.sh --fail-fast check -- --rerun-tasks`
  passed. Retained log:
  `build/gradle-run-logs/20260712T065006068242308-pid1094476-check.log`.
  Literal result: `BUILD SUCCESSFUL in 8m 35s`,
  `47 actionable tasks: 47 executed`.
- Review state: Phase 1 first found an assertion-order parity gap:
  `PARTY_DROPDOWN_001` checked the initial trigger text only after opening the
  popup. Rework now checks `Keine _Party ▼` before `trigger.fire()`, then
  checks accessible open state and empty roster after the same popup-opening
  input. Phase 1 re-review approved. Phase 2 approved.

## T1 Batch Evidence - `dungeonTravelProjectionLevelHarness`

- Batch started after `partyDropdownHarness` close-out. Scope is limited to
  `dungeonTravelProjectionLevelHarness`.
- Registration: the old
  `behaviorHarnesses.javaExec("dungeonTravelProjectionLevelHarness")`
  registration,
  `mainClass.set("src.view.leftbartabs.dungeoneditor.DungeonTravelProjectionLevelHarness")`,
  `dungeonTravelProjectionLevelHarnessDataDir`,
  `dungeonTravelProjectionLevelHarnessResultsDir`, its summary-results system
  property, and its `outputs.upToDateWhen { false }` entry are removed. The
  batch now uses
  `behaviorHarnesses.junitTest("dungeonTravelProjectionLevelHarness")`,
  includes only
  `src/view/leftbartabs/dungeoneditor/DungeonTravelProjectionLevelHarness.class`,
  keeps the existing `verification-dungeon-travel-*.md` input catalog, and is
  wired into `check`. The `dungeonEditorBehaviorHarness` source set now has the
  same JUnit Jupiter compile/runtime dependencies required by its converted
  JUnit harness task.
- Scripted parity mapping output:

  ```text
  old proof item       junit method
  DT-LVL-001           DT_LVL_001
  DT-LVL-002           DT_LVL_002
  DT-ACT-INVALID       DT_ACT_INVALID
  DT-ACT-001           DT_ACT_001
  DT-ACT-002           DT_ACT_002
  result: 5 old proof item(s), 5 junit method(s), 5 exact normalized matches
  ```

- Initial focused run:
  `env -u CODEX_THREAD_ID SALTMARCHER_GRADLE_ISOLATION_ID=t1-dungeon-travel-focused tools/gradle/run-observable-gradle.sh --fail-fast dungeonTravelProjectionLevelHarness`
  failed before harness execution because the custom
  `dungeonEditorBehaviorHarness` source set did not yet have JUnit API
  dependencies. Retained log:
  `build/gradle-run-logs/20260712T071159888222869-pid1125825-dungeonTravelProjectionLevelHarness.log`.
  Rework added the required source-set JUnit dependencies; no production code
  or harness semantics changed for this compile fix.
- Focused batch run:
  `env -u CODEX_THREAD_ID SALTMARCHER_GRADLE_ISOLATION_ID=t1-dungeon-travel-focused-2 tools/gradle/run-observable-gradle.sh --fail-fast dungeonTravelProjectionLevelHarness`
  passed. Retained log:
  `build/gradle-run-logs/20260712T071320878570425-pid1127357-dungeonTravelProjectionLevelHarness.log`.
  Literal result: `BUILD SUCCESSFUL in 56s`,
  `13 actionable tasks: 2 executed, 11 up-to-date`.
- Forced batch run:
  `env -u CODEX_THREAD_ID SALTMARCHER_GRADLE_ISOLATION_ID=t1-dungeon-travel-forced tools/gradle/run-observable-gradle.sh --fail-fast dungeonTravelProjectionLevelHarness -- --rerun-tasks`
  passed. Retained log:
  `build/gradle-run-logs/20260712T071507384514223-pid1129950-dungeonTravelProjectionLevelHarness.log`.
  Literal result: `BUILD SUCCESSFUL in 1m 12s`,
  `13 actionable tasks: 13 executed`.
- JUnit XML after the forced run:
  `build/test-results/dungeonTravelProjectionLevelHarness/TEST-src.view.leftbartabs.dungeoneditor.DungeonTravelProjectionLevelHarness.xml`
  records `tests="5"`, `failures="0"`, `errors="0"` and contains
  `DT_LVL_001`, `DT_LVL_002`, `DT_ACT_INVALID`, `DT_ACT_001`, and
  `DT_ACT_002`.
- Final full check:
  `env -u CODEX_THREAD_ID SALTMARCHER_GRADLE_ISOLATION_ID=t1-dungeon-travel-check tools/gradle/run-observable-gradle.sh --fail-fast check -- --rerun-tasks`
  passed. Retained log:
  `build/gradle-run-logs/20260712T071630742711503-pid1130595-check.log`.
  Literal result: `BUILD SUCCESSFUL in 9m 57s`,
  `49 actionable tasks: 49 executed`.
- Review state: Phase 1 first found a ledger-only blocker because the batch
  proof was not yet recorded in this ledger. Code parity, production-behavior
  isolation, JavaExec deletion, Gradle/JUnit task wiring, proof freshness, and
  JUnit XML were otherwise reviewed without a supported blocker. Phase 1
  re-review approved after this ledger section was added. Phase 2 approved.

## T1 Batch Evidence - `catalogInitialLoadHarness`

- Batch started after `dungeonTravelProjectionLevelHarness` close-out. Scope is
  limited to `catalogInitialLoadHarness`.
- Registration: the old
  `behaviorHarnesses.javaExec("catalogInitialLoadHarness")` registration,
  `mainClass.set("src.view.leftbartabs.catalog.CatalogInitialLoadHarness")`,
  `catalogInitialLoadHarnessDataDir`, and its `outputs.upToDateWhen { false }`
  entry are removed. The batch now uses
  `behaviorHarnesses.junitTest("catalogInitialLoadHarness")`, includes only
  `src/view/leftbartabs/catalog/CatalogInitialLoadHarness.class`, and is wired
  into `check`.
- Frozen proof-item names for this legacy harness are derived from the two
  pre-conversion assertion groups in `CatalogInitialLoadHarness`: DB-backed
  initial catalog load and World Planner source-control forwarding. Assertions
  and fixture values remain unchanged; the second test replays the initial-load
  readback as setup before exercising the old source-control claim.
- Scripted parity mapping output:

  ```text
  old proof item            junit method
  CATALOG-INITIAL-LOAD-001  CATALOG_INITIAL_LOAD_001
  CATALOG-INITIAL-LOAD-002  CATALOG_INITIAL_LOAD_002
  result: 2 old proof item(s), 2 junit method(s), 2 exact normalized matches
  ```

- Initial focused run:
  `env -u CODEX_THREAD_ID SALTMARCHER_GRADLE_ISOLATION_ID=t1-catalog-initial-focused tools/gradle/run-observable-gradle.sh --fail-fast catalogInitialLoadHarness`
  failed before harness execution because a new helper parameter name collided
  with a lambda variable in `assertInitialCatalogRows`. Retained log:
  `build/gradle-run-logs/20260712T073949513717002-pid1166766-catalogInitialLoadHarness.log`.
  Rework renamed only the lambda variable; no harness assertion, input, fixture,
  or production code changed.
- Focused batch run:
  `env -u CODEX_THREAD_ID SALTMARCHER_GRADLE_ISOLATION_ID=t1-catalog-initial-focused-2 tools/gradle/run-observable-gradle.sh --fail-fast catalogInitialLoadHarness`
  passed. Retained log:
  `build/gradle-run-logs/20260712T074042023510623-pid1167273-catalogInitialLoadHarness.log`.
  Literal result: `BUILD SUCCESSFUL in 24s`,
  `13 actionable tasks: 2 executed, 11 up-to-date`.
- Forced batch run:
  `env -u CODEX_THREAD_ID SALTMARCHER_GRADLE_ISOLATION_ID=t1-catalog-initial-forced tools/gradle/run-observable-gradle.sh --fail-fast catalogInitialLoadHarness -- --rerun-tasks`
  passed. Retained log:
  `build/gradle-run-logs/20260712T074139829326544-pid1168759-catalogInitialLoadHarness.log`.
  Literal result: `BUILD SUCCESSFUL in 1m`,
  `13 actionable tasks: 13 executed`.
- JUnit XML after the forced run:
  `build/test-results/catalogInitialLoadHarness/TEST-src.view.leftbartabs.catalog.CatalogInitialLoadHarness.xml`
  records `tests="2"`, `failures="0"`, `errors="0"` and contains
  `CATALOG_INITIAL_LOAD_001` and `CATALOG_INITIAL_LOAD_002`.
- Final full check:
  `env -u CODEX_THREAD_ID SALTMARCHER_GRADLE_ISOLATION_ID=t1-catalog-initial-check tools/gradle/run-observable-gradle.sh --fail-fast check -- --rerun-tasks`
  passed. Retained log:
  `build/gradle-run-logs/20260712T074247103401017-pid1169336-check.log`.
  Literal result: `BUILD SUCCESSFUL in 10m 2s`,
  `50 actionable tasks: 50 executed`.
- Review state: Phase 1 approved; Phase 2 first found a ledger-only stale
  review-state blocker after Phase 1 approval. Phase 2 re-review approved.

## T1 Batch Evidence - `searchFilterControlsHarness`

- Batch started after `catalogInitialLoadHarness` close-out. Scope is limited to
  `searchFilterControlsHarness`.
- Registration: the old
  `behaviorHarnesses.javaExec("searchFilterControlsHarness")` registration,
  `mainClass.set("src.view.slotcontent.controls.searchfilter.SearchFilterControlsHarness")`,
  `searchFilterControlsHarnessDataDir`, and its
  `outputs.upToDateWhen { false }` entry are removed. The batch now uses
  `behaviorHarnesses.junitTest("searchFilterControlsHarness")`, includes only
  `src/view/slotcontent/controls/searchfilter/SearchFilterControlsHarness.class`,
  and is wired into `check`.
- Frozen proof-item names for this legacy harness are derived from the five
  pre-conversion assertion groups in `SearchFilterControlsHarness`: projection
  render does not emit input, search edit emits raw query, clear-all emits final
  cleared input, chip removal preserves unrelated state while removing one
  filter, and World Planner production-route filtering. Assertions and fixture
  values remain unchanged.
- Scripted parity mapping output:

  ```text
  old proof item              junit method
  SEARCH-FILTER-CONTROLS-001  SEARCH_FILTER_CONTROLS_001
  SEARCH-FILTER-CONTROLS-002  SEARCH_FILTER_CONTROLS_002
  SEARCH-FILTER-CONTROLS-003  SEARCH_FILTER_CONTROLS_003
  SEARCH-FILTER-CONTROLS-004  SEARCH_FILTER_CONTROLS_004
  SEARCH-FILTER-CONTROLS-005  SEARCH_FILTER_CONTROLS_005
  result: 5 old proof item(s), 5 junit method(s), 5 exact normalized matches
  ```

- Focused batch run:
  `env -u CODEX_THREAD_ID SALTMARCHER_GRADLE_ISOLATION_ID=t1-search-filter-focused tools/gradle/run-observable-gradle.sh --fail-fast searchFilterControlsHarness`
  passed. Retained log:
  `build/gradle-run-logs/20260712T080439267662006-pid1199300-searchFilterControlsHarness.log`.
  Literal result: `BUILD SUCCESSFUL in 44s`,
  `13 actionable tasks: 2 executed, 1 from cache, 10 up-to-date`.
- Forced batch run:
  `env -u CODEX_THREAD_ID SALTMARCHER_GRADLE_ISOLATION_ID=t1-search-filter-forced tools/gradle/run-observable-gradle.sh --fail-fast searchFilterControlsHarness -- --rerun-tasks`
  passed. Retained log:
  `build/gradle-run-logs/20260712T080544238867783-pid1200568-searchFilterControlsHarness.log`.
  Literal result: `BUILD SUCCESSFUL in 58s`,
  `13 actionable tasks: 13 executed`.
- JUnit XML after the forced run:
  `build/test-results/searchFilterControlsHarness/TEST-src.view.slotcontent.controls.searchfilter.SearchFilterControlsHarness.xml`
  records `tests="5"`, `failures="0"`, `errors="0"` and contains
  `SEARCH_FILTER_CONTROLS_001` through `SEARCH_FILTER_CONTROLS_005`.
- Final full check:
  `env -u CODEX_THREAD_ID SALTMARCHER_GRADLE_ISOLATION_ID=t1-search-filter-check tools/gradle/run-observable-gradle.sh --fail-fast check -- --rerun-tasks`
  passed. Retained log:
  `build/gradle-run-logs/20260712T080651427956237-pid1201368-check.log`.
  Literal result: `BUILD SUCCESSFUL in 9m 51s`,
  `51 actionable tasks: 51 executed`.
- Review state: Phase 1 approved; Phase 2 first found a ledger-only stale
  review-state blocker after Phase 1 approval. Phase 2 re-review approved.

## T1 Batch Evidence - `catalogControlsRawInputHarness`

- Batch started after `searchFilterControlsHarness` close-out. Scope is limited
  to `catalogControlsRawInputHarness`.
- Registration: the old
  `behaviorHarnesses.javaExec("catalogControlsRawInputHarness")` registration,
  `mainClass.set("src.view.leftbartabs.catalog.CatalogControlsRawInputHarness")`,
  `catalogControlsRawInputHarnessDataDir`, and its
  `outputs.upToDateWhen { false }` entry are removed. The batch now uses
  `behaviorHarnesses.junitTest("catalogControlsRawInputHarness")`, includes
  only `src/view/leftbartabs/catalog/CatalogControlsRawInputHarness.class`, and
  is wired into `check`.
- Frozen proof-item names for this legacy harness are derived from the eight
  pre-conversion assertion groups in `CatalogControlsRawInputHarness`:
  projection render silence, search raw-input publishing, clear-all final input,
  world-source typed input, type-chip removal, encounter-table chip removal,
  difficulty raw tuning, and production-route search/builder publishing.
  Assertions and fixture values remain unchanged; split tests replay the setup
  required for their frozen claim before exercising that claim.
- Scripted parity mapping output:

  ```text
  old proof item                    junit method
  CATALOG-CONTROLS-RAW-INPUT-001    CATALOG_CONTROLS_RAW_INPUT_001
  CATALOG-CONTROLS-RAW-INPUT-002    CATALOG_CONTROLS_RAW_INPUT_002
  CATALOG-CONTROLS-RAW-INPUT-003    CATALOG_CONTROLS_RAW_INPUT_003
  CATALOG-CONTROLS-RAW-INPUT-004    CATALOG_CONTROLS_RAW_INPUT_004
  CATALOG-CONTROLS-RAW-INPUT-005    CATALOG_CONTROLS_RAW_INPUT_005
  CATALOG-CONTROLS-RAW-INPUT-006    CATALOG_CONTROLS_RAW_INPUT_006
  CATALOG-CONTROLS-RAW-INPUT-007    CATALOG_CONTROLS_RAW_INPUT_007
  CATALOG-CONTROLS-RAW-INPUT-008    CATALOG_CONTROLS_RAW_INPUT_008
  result: 8 old proof item(s), 8 junit method(s), 8 exact normalized matches
  ```

- Focused batch run:
  `env -u CODEX_THREAD_ID SALTMARCHER_GRADLE_ISOLATION_ID=t1-catalog-raw-focused tools/gradle/run-observable-gradle.sh --fail-fast catalogControlsRawInputHarness`
  passed. Retained log:
  `build/gradle-run-logs/20260712T082758066377442-pid1233306-catalogControlsRawInputHarness.log`.
  Literal result: `BUILD SUCCESSFUL in 1m 10s`,
  `13 actionable tasks: 2 executed, 1 from cache, 10 up-to-date`.
- Forced batch run:
  `env -u CODEX_THREAD_ID SALTMARCHER_GRADLE_ISOLATION_ID=t1-catalog-raw-forced tools/gradle/run-observable-gradle.sh --fail-fast catalogControlsRawInputHarness -- --rerun-tasks`
  passed. Retained log:
  `build/gradle-run-logs/20260712T083058404642368-pid1234936-catalogControlsRawInputHarness.log`.
  Literal result: `BUILD SUCCESSFUL in 1m 6s`,
  `13 actionable tasks: 13 executed`.
- JUnit XML after the forced run:
  `build/test-results/catalogControlsRawInputHarness/TEST-src.view.leftbartabs.catalog.CatalogControlsRawInputHarness.xml`
  records `tests="8"`, `failures="0"`, `errors="0"` and contains
  `CATALOG_CONTROLS_RAW_INPUT_001` through
  `CATALOG_CONTROLS_RAW_INPUT_008`.
- Final full check:
  `env -u CODEX_THREAD_ID SALTMARCHER_GRADLE_ISOLATION_ID=t1-catalog-raw-check tools/gradle/run-observable-gradle.sh --fail-fast check -- --rerun-tasks`
  passed. Retained log:
  `build/gradle-run-logs/20260712T083211805679028-pid1235566-check.log`.
  Literal result: `BUILD SUCCESSFUL in 10m 18s`,
  `52 actionable tasks: 52 executed`.
- Review state: Phase 1 approved; Phase 2 approved.

## T1 Batch Evidence - `catalogCrudControlsHarness`

- Batch started after `catalogControlsRawInputHarness` close-out. Scope is
  limited to `catalogCrudControlsHarness`.
- Registration: the old
  `behaviorHarnesses.javaExec("catalogCrudControlsHarness")` registration,
  `mainClass.set("src.view.slotcontent.controls.catalogcrud.CatalogCrudControlsHarness")`,
  `catalogCrudControlsHarnessDataDir`, and its
  `outputs.upToDateWhen { false }` entry are removed. The batch now uses
  `behaviorHarnesses.junitTest("catalogCrudControlsHarness")`, includes only
  `src/view/slotcontent/controls/catalogcrud/CatalogCrudControlsHarness.class`,
  and is wired into `check`.
- Frozen proof-item names for this legacy harness are derived from the two
  pre-conversion top-level proof executions in `CatalogCrudControlsHarness`:
  the shared Catalog CRUD controls flow and the HexMap production-route create
  flow. Assertions and fixture values remain unchanged; the first JUnit method
  preserves the old full CRUD UI/event sequence as one proof execution.
- Scripted parity mapping output:

  ```text
  old proof item              junit method
  CATALOG-CRUD-CONTROLS-001   CATALOG_CRUD_CONTROLS_001
  CATALOG-CRUD-CONTROLS-002   CATALOG_CRUD_CONTROLS_002
  result: 2 old proof item(s), 2 junit method(s), 2 exact normalized matches
  ```

- Focused batch run:
  `env -u CODEX_THREAD_ID SALTMARCHER_GRADLE_ISOLATION_ID=t1-catalog-crud-focused tools/gradle/run-observable-gradle.sh --fail-fast catalogCrudControlsHarness`
  passed. Retained log:
  `build/gradle-run-logs/20260712T085153847137613-pid1260354-catalogCrudControlsHarness.log`.
  Literal result: `BUILD SUCCESSFUL in 1m 3s`,
  `13 actionable tasks: 2 executed, 1 from cache, 10 up-to-date`.
- Forced batch run:
  `env -u CODEX_THREAD_ID SALTMARCHER_GRADLE_ISOLATION_ID=t1-catalog-crud-forced tools/gradle/run-observable-gradle.sh --fail-fast catalogCrudControlsHarness -- --rerun-tasks`
  passed. Retained log:
  `build/gradle-run-logs/20260712T085315928515663-pid1261687-catalogCrudControlsHarness.log`.
  Literal result: `BUILD SUCCESSFUL in 1m 8s`,
  `13 actionable tasks: 13 executed`.
- JUnit XML after the forced/full proof:
  `build/test-results/catalogCrudControlsHarness/TEST-src.view.slotcontent.controls.catalogcrud.CatalogCrudControlsHarness.xml`
  records `tests="2"`, `failures="0"`, `errors="0"` and contains
  `CATALOG_CRUD_CONTROLS_001` and `CATALOG_CRUD_CONTROLS_002`.
- Final full check:
  `env -u CODEX_THREAD_ID SALTMARCHER_GRADLE_ISOLATION_ID=t1-catalog-crud-check tools/gradle/run-observable-gradle.sh --fail-fast check -- --rerun-tasks`
  passed. Retained log:
  `build/gradle-run-logs/20260712T085431410970818-pid1262293-check.log`.
  Literal result: `BUILD SUCCESSFUL in 11m 3s`,
  `53 actionable tasks: 53 executed`.
- Review state: Phase 1 approved; Phase 2 approved.

## T1 Batch Evidence - `dungeonMapRenderParityHarness`

- Batch started after `catalogCrudControlsHarness` close-out. Scope is limited
  to `dungeonMapRenderParityHarness`.
- Registration: the old
  `behaviorHarnesses.javaExec("dungeonMapRenderParityHarness")` registration,
  `mainClass.set("src.view.leftbartabs.dungeoneditor.DungeonMapRenderParitySnapshotHarness")`,
  `dungeonMapRenderParityHarnessDataDir`, and its
  `outputs.upToDateWhen { false }` entry are removed. The batch now uses
  `behaviorHarnesses.junitTest("dungeonMapRenderParityHarness")`, includes only
  `src/view/leftbartabs/dungeoneditor/DungeonMapRenderParitySnapshotHarness.class`,
  publishes the same `dungeon-map-render-parity-results` proof artifacts, and
  is wired into `check`.
- Frozen proof-item names come from the pre-conversion OwnerSuite rows:
  `DE-IMG-001`, `DE-IMG-002`, and `DT-IMG-001`. Assertions, fixture values,
  summary text, checksum publication, and image artifact publication remain
  unchanged; the conversion changes only the runner frame.
- Scripted parity mapping output:

  ```text
  old proof item  junit method
  DE-IMG-001      DE_IMG_001
  DE-IMG-002      DE_IMG_002
  DT-IMG-001      DT_IMG_001
  result: 3 old proof item(s), 3 junit method(s), 3 exact normalized matches
  ```

- Focused batch run:
  `env -u CODEX_THREAD_ID SALTMARCHER_GRADLE_ISOLATION_ID=t1-dungeon-map-render-focused tools/gradle/run-observable-gradle.sh --fail-fast dungeonMapRenderParityHarness`
  passed. Retained log:
  `build/gradle-run-logs/20260712T091528206426218-pid1292271-dungeonMapRenderParityHarness.log`.
  Literal result: `BUILD SUCCESSFUL in 1m 3s`,
  `13 actionable tasks: 2 executed, 1 from cache, 10 up-to-date`.
- Forced batch run:
  `env -u CODEX_THREAD_ID SALTMARCHER_GRADLE_ISOLATION_ID=t1-dungeon-map-render-forced tools/gradle/run-observable-gradle.sh --fail-fast dungeonMapRenderParityHarness -- --rerun-tasks`
  passed. Retained log:
  `build/gradle-run-logs/20260712T091651657563113-pid1293857-dungeonMapRenderParityHarness.log`.
  Literal result: `BUILD SUCCESSFUL in 1m 9s`,
  `13 actionable tasks: 13 executed`.
- JUnit XML after the forced/full proof:
  `build/test-results/dungeonMapRenderParityHarness/TEST-src.view.leftbartabs.dungeoneditor.DungeonMapRenderParitySnapshotHarness.xml`
  records `tests="3"`, `failures="0"`, `errors="0"` and contains
  `DE_IMG_001`, `DE_IMG_002`, and `DT_IMG_001`.
- Published summary after the final full check:
  `build/dungeon-map-render-parity-results/summary.txt` contains the three
  OwnerSuite rows for `DE-IMG-001`, `DE-IMG-002`, and `DT-IMG-001`; each row
  reports same-frame `changedPixels=0` and references the matching
  `build/dungeon-map-render-parity-results/render-snapshots/<proof-id>`
  artifact directory.
- Final full check:
  `env -u CODEX_THREAD_ID SALTMARCHER_GRADLE_ISOLATION_ID=t1-dungeon-map-render-check tools/gradle/run-observable-gradle.sh --fail-fast check -- --rerun-tasks`
  passed. Retained log:
  `build/gradle-run-logs/20260712T091808680129923-pid1294488-check.log`.
  Literal result: `BUILD SUCCESSFUL in 11m 36s`,
  `54 actionable tasks: 54 executed`.
- Review state: Phase 1 approved; Phase 2 approved.

## T1 Batch Evidence - `sessionPlannerCatalogHarness`

- Batch started after `dungeonMapRenderParityHarness` close-out. Scope is
  limited to `sessionPlannerCatalogHarness`.
- Registration: the old
  `behaviorHarnesses.javaExec("sessionPlannerCatalogHarness")` registration,
  `mainClass.set("src.view.leftbartabs.sessionplanner.SessionPlannerCatalogHarness")`,
  `sessionPlannerCatalogHarnessDataDir`, and its
  `outputs.upToDateWhen { false }` entry are removed. The batch now uses
  `behaviorHarnesses.junitTest("sessionPlannerCatalogHarness")`, includes only
  `src/view/leftbartabs/sessionplanner/SessionPlannerCatalogHarness.class`, and
  is wired into `check`.
- Frozen proof-item name for this legacy harness is derived from its single
  pre-conversion top-level execution: the Session Planner catalog CRUD and
  timeline production-route flow. Assertions and fixture values remain
  unchanged.
- Scripted parity mapping output:

  ```text
  old proof item                junit method
  SESSION-PLANNER-CATALOG-001   SESSION_PLANNER_CATALOG_001
  result: 1 old proof item(s), 1 junit method(s), 1 exact normalized match
  ```

- Focused batch run:
  `env -u CODEX_THREAD_ID SALTMARCHER_GRADLE_ISOLATION_ID=t1-session-catalog-focused tools/gradle/run-observable-gradle.sh --fail-fast sessionPlannerCatalogHarness`
  passed. Retained log:
  `build/gradle-run-logs/20260712T093834737998875-pid1323966-sessionPlannerCatalogHarness.log`.
  Literal result: `BUILD SUCCESSFUL in 1m 2s`,
  `13 actionable tasks: 2 executed, 1 from cache, 10 up-to-date`.
- Forced batch run:
  `env -u CODEX_THREAD_ID SALTMARCHER_GRADLE_ISOLATION_ID=t1-session-catalog-forced tools/gradle/run-observable-gradle.sh --fail-fast sessionPlannerCatalogHarness -- --rerun-tasks`
  passed. Retained log:
  `build/gradle-run-logs/20260712T094001684595193-pid1325311-sessionPlannerCatalogHarness.log`.
  Literal result: `BUILD SUCCESSFUL in 1m 7s`,
  `13 actionable tasks: 13 executed`.
- JUnit XML after the forced/full proof:
  `build/test-results/sessionPlannerCatalogHarness/TEST-src.view.leftbartabs.sessionplanner.SessionPlannerCatalogHarness.xml`
  records `tests="1"`, `failures="0"`, `errors="0"` and contains
  `SESSION_PLANNER_CATALOG_001`.
- Final full check:
  `env -u CODEX_THREAD_ID SALTMARCHER_GRADLE_ISOLATION_ID=t1-session-catalog-check tools/gradle/run-observable-gradle.sh --fail-fast check -- --rerun-tasks`
  passed. Retained log:
  `build/gradle-run-logs/20260712T094123241524750-pid1325942-check.log`.
  Literal result: `BUILD SUCCESSFUL in 11m 23s`,
  `55 actionable tasks: 55 executed`.
- Review state: Phase 1 approved; Phase 2 approved.

## T1 Batch Evidence - `sessionPlannerShellLayoutHarness`

- Batch started after `sessionPlannerCatalogHarness` close-out. Scope is
  limited to `sessionPlannerShellLayoutHarness`.
- Registration: the old
  `behaviorHarnesses.javaExec("sessionPlannerShellLayoutHarness")`
  registration, `mainClass.set("shell.host.SessionPlannerShellLayoutHarness")`,
  `sessionPlannerShellLayoutHarnessDataDir`, and its
  `outputs.upToDateWhen { false }` entry are removed. The batch now uses
  `behaviorHarnesses.junitTest("sessionPlannerShellLayoutHarness")`, includes
  only `shell/host/SessionPlannerShellLayoutHarness.class`, and is wired into
  `check`.
- Frozen proof-item name for this legacy harness is derived from its single
  pre-conversion top-level execution: the Session Planner shell layout,
  navigation, icon loading, and Hex Map shell layout flow. Assertions and
  fixture values remain unchanged.
- Scripted parity mapping output:

  ```text
  old proof item                      junit method
  SESSION-PLANNER-SHELL-LAYOUT-001    SESSION_PLANNER_SHELL_LAYOUT_001
  result: 1 old proof item(s), 1 junit method(s), 1 exact normalized match
  ```

- Focused batch run:
  `env -u CODEX_THREAD_ID SALTMARCHER_GRADLE_ISOLATION_ID=t1-session-shell-focused tools/gradle/run-observable-gradle.sh --fail-fast sessionPlannerShellLayoutHarness`
  passed. Retained log:
  `build/gradle-run-logs/20260712T100132410739782-pid1354455-sessionPlannerShellLayoutHarness.log`.
  Literal result: `BUILD SUCCESSFUL in 58s`,
  `13 actionable tasks: 2 executed, 1 from cache, 10 up-to-date`.
- Forced batch run:
  `env -u CODEX_THREAD_ID SALTMARCHER_GRADLE_ISOLATION_ID=t1-session-shell-forced tools/gradle/run-observable-gradle.sh --fail-fast sessionPlannerShellLayoutHarness -- --rerun-tasks`
  passed. Retained log:
  `build/gradle-run-logs/20260712T100251004241468-pid1355746-sessionPlannerShellLayoutHarness.log`.
  Literal result: `BUILD SUCCESSFUL in 1m 6s`,
  `13 actionable tasks: 13 executed`.
- JUnit XML after the forced/full proof:
  `build/test-results/sessionPlannerShellLayoutHarness/TEST-shell.host.SessionPlannerShellLayoutHarness.xml`
  records `tests="1"`, `failures="0"`, `errors="0"` and contains
  `SESSION_PLANNER_SHELL_LAYOUT_001`.
- Final full check:
  `env -u CODEX_THREAD_ID SALTMARCHER_GRADLE_ISOLATION_ID=t1-session-shell-check tools/gradle/run-observable-gradle.sh --fail-fast check -- --rerun-tasks`
  passed. Retained log:
  `build/gradle-run-logs/20260712T100407971051981-pid1356400-check.log`.
  Literal result: `BUILD SUCCESSFUL in 11m 44s`,
  `56 actionable tasks: 56 executed`.
- Review state: Phase 1 approved; Phase 2 approved.

## T1 Batch Evidence - `worldPlannerBackendHarness`

- Batch started after `sessionPlannerShellLayoutHarness` close-out. Scope is
  limited to `worldPlannerBackendHarness`.
- Registration: the old
  `behaviorHarnesses.javaExec("worldPlannerBackendHarness")` registration,
  `mainClass.set("src.domain.worldplanner.WorldPlannerBackendHarness")`,
  `worldPlannerBackendHarnessDataDir`, and its
  `outputs.upToDateWhen { false }` entry are removed. The batch now uses
  `behaviorHarnesses.junitTest("worldPlannerBackendHarness")`, includes only
  `src/domain/worldplanner/WorldPlannerBackendHarness.class`, and is wired into
  `check`.
- Frozen proof-item name for this legacy harness is derived from its single
  pre-conversion top-level execution: the World Planner backend persistence,
  readback, error-preservation, malformed-row, finite-stock, and reference
  validation flow. Assertions and fixture values remain unchanged.
- Scripted parity mapping output:

  ```text
  old proof item             junit method
  WORLD-PLANNER-BACKEND-001  WORLD_PLANNER_BACKEND_001
  result: 1 old proof item(s), 1 junit method(s), 1 exact normalized match
  ```

- Initial focused run:
  `env -u CODEX_THREAD_ID SALTMARCHER_GRADLE_ISOLATION_ID=t1-world-backend-focused tools/gradle/run-observable-gradle.sh --fail-fast worldPlannerBackendHarness`
  failed before harness execution because the `worldPlannerBackendHarness`
  source set did not yet have JUnit API/runtime dependencies. Retained log:
  `build/gradle-run-logs/20260712T102432033216274-pid1380218-worldPlannerBackendHarness.log`.
  Rework added only the matching JUnit dependencies for that source set; no
  harness assertion, fixture, input, or production code changed.
- Focused batch run:
  `env -u CODEX_THREAD_ID SALTMARCHER_GRADLE_ISOLATION_ID=t1-world-backend-focused-2 tools/gradle/run-observable-gradle.sh --fail-fast worldPlannerBackendHarness`
  passed. Retained log:
  `build/gradle-run-logs/20260712T102547537773637-pid1381247-worldPlannerBackendHarness.log`.
  Literal result: `BUILD SUCCESSFUL in 29s`,
  `13 actionable tasks: 2 executed, 11 up-to-date`.
- Forced batch run:
  `env -u CODEX_THREAD_ID SALTMARCHER_GRADLE_ISOLATION_ID=t1-world-backend-forced tools/gradle/run-observable-gradle.sh --fail-fast worldPlannerBackendHarness -- --rerun-tasks`
  passed. Retained log:
  `build/gradle-run-logs/20260712T102638077938243-pid1382215-worldPlannerBackendHarness.log`.
  Literal result: `BUILD SUCCESSFUL in 1m`,
  `13 actionable tasks: 13 executed`.
- JUnit XML after the forced/full proof:
  `build/test-results/worldPlannerBackendHarness/TEST-src.domain.worldplanner.WorldPlannerBackendHarness.xml`
  records `tests="1"`, `failures="0"`, `errors="0"` and contains
  `WORLD_PLANNER_BACKEND_001`.
- Final full check:
  `env -u CODEX_THREAD_ID SALTMARCHER_GRADLE_ISOLATION_ID=t1-world-backend-check tools/gradle/run-observable-gradle.sh --fail-fast check -- --rerun-tasks`
  passed. Retained log:
  `build/gradle-run-logs/20260712T102746095894754-pid1382757-check.log`.
  Literal result: `BUILD SUCCESSFUL in 11m 46s`,
  `58 actionable tasks: 58 executed`.
- Review state: Phase 1 approved; Phase 2 approved.

## T1 Batch Evidence - `worldPlannerEncounterHarness`

- Batch started after `worldPlannerBackendHarness` close-out. Scope is limited
  to `worldPlannerEncounterHarness`.
- Registration: the old
  `behaviorHarnesses.javaExec("worldPlannerEncounterHarness")` registration,
  `mainClass.set("src.domain.encounter.WorldPlannerEncounterHarness")`,
  `worldPlannerEncounterHarnessDataDir`, and its
  `outputs.upToDateWhen { false }` entry are removed. The batch now uses
  `behaviorHarnesses.junitTest("worldPlannerEncounterHarness")`, includes only
  `src/domain/encounter/WorldPlannerEncounterHarness.class`, and is wired into
  `check`.
- Frozen proof-item names are derived from the five pre-conversion scenario
  calls in `main`: location source limits, explicit-table intersection,
  invalid-source blocking, finite-cap draft enumeration, and World NPC identity
  through Encounter result state. Assertions and fixture values remain
  unchanged.
- Scripted parity mapping output:

  ```text
  old proof item                 junit method
  WORLD-PLANNER-ENCOUNTER-001    WORLD_PLANNER_ENCOUNTER_001
  WORLD-PLANNER-ENCOUNTER-002    WORLD_PLANNER_ENCOUNTER_002
  WORLD-PLANNER-ENCOUNTER-003    WORLD_PLANNER_ENCOUNTER_003
  WORLD-PLANNER-ENCOUNTER-004    WORLD_PLANNER_ENCOUNTER_004
  WORLD-PLANNER-ENCOUNTER-005    WORLD_PLANNER_ENCOUNTER_005
  result: 5 old proof item(s), 5 junit method(s), 5 exact normalized matches
  ```

- Focused batch run:
  `env -u CODEX_THREAD_ID SALTMARCHER_GRADLE_ISOLATION_ID=t1-world-encounter-focused tools/gradle/run-observable-gradle.sh --fail-fast worldPlannerEncounterHarness`
  passed. Retained log:
  `build/gradle-run-logs/20260712T104932863812569-pid1411652-worldPlannerEncounterHarness.log`.
  Literal result: `BUILD SUCCESSFUL in 56s`,
  `13 actionable tasks: 2 executed, 1 from cache, 10 up-to-date`.
- Forced batch run:
  `env -u CODEX_THREAD_ID SALTMARCHER_GRADLE_ISOLATION_ID=t1-world-encounter-forced tools/gradle/run-observable-gradle.sh --fail-fast worldPlannerEncounterHarness -- --rerun-tasks`
  passed. Retained log:
  `build/gradle-run-logs/20260712T105048209371154-pid1412183-worldPlannerEncounterHarness.log`.
  Literal result: `BUILD SUCCESSFUL in 1m 4s`,
  `13 actionable tasks: 13 executed`.
- JUnit XML after the forced proof:
  `build/test-results/worldPlannerEncounterHarness/TEST-src.domain.encounter.WorldPlannerEncounterHarness.xml`
  records `tests="5"`, `failures="0"`, `errors="0"` and contains
  `WORLD_PLANNER_ENCOUNTER_001` through `WORLD_PLANNER_ENCOUNTER_005`.
- Final full check:
  `env -u CODEX_THREAD_ID SALTMARCHER_GRADLE_ISOLATION_ID=t1-world-encounter-check tools/gradle/run-observable-gradle.sh --fail-fast check -- --rerun-tasks`
  passed. Retained log:
  `build/gradle-run-logs/20260712T105225743907333-pid1413261-check.log`.
  Literal result: `BUILD SUCCESSFUL in 11m 59s`,
  `59 actionable tasks: 59 executed`.
- Review state: Phase 1 approved; Phase 2 approved.

## T1 Batch Evidence - `worldPlannerControlsRawInputHarness`

- Batch started after `worldPlannerEncounterHarness` close-out. Scope is
  limited to `worldPlannerControlsRawInputHarness`.
- Registration: the old
  `behaviorHarnesses.javaExec("worldPlannerControlsRawInputHarness")`
  registration,
  `mainClass.set("src.view.leftbartabs.worldplanner.WorldPlannerControlsRawInputHarness")`,
  `worldPlannerControlsRawInputHarnessDataDir`, and its
  `outputs.upToDateWhen { false }` entry are removed. The batch now uses
  `behaviorHarnesses.junitTest("worldPlannerControlsRawInputHarness")`,
  includes only
  `src/view/leftbartabs/worldplanner/WorldPlannerControlsRawInputHarness.class`,
  and is wired into `check`.
- Frozen proof-item names are derived from the four pre-conversion scenario
  calls after view startup: projection render silence, user module-switch raw
  input, user refresh raw input, and startup refresh ownership. Assertions and
  fixture values remain unchanged.
- Scripted parity mapping output:

  ```text
  old proof item                         junit method
  WORLD-PLANNER-CONTROLS-RAW-INPUT-001   WORLD_PLANNER_CONTROLS_RAW_INPUT_001
  WORLD-PLANNER-CONTROLS-RAW-INPUT-002   WORLD_PLANNER_CONTROLS_RAW_INPUT_002
  WORLD-PLANNER-CONTROLS-RAW-INPUT-003   WORLD_PLANNER_CONTROLS_RAW_INPUT_003
  WORLD-PLANNER-CONTROLS-RAW-INPUT-004   WORLD_PLANNER_CONTROLS_RAW_INPUT_004
  result: 4 old proof item(s), 4 junit method(s), 4 exact normalized matches
  ```

- Focused batch run:
  `env -u CODEX_THREAD_ID SALTMARCHER_GRADLE_ISOLATION_ID=t1-world-controls-focused tools/gradle/run-observable-gradle.sh --fail-fast worldPlannerControlsRawInputHarness`
  passed. Retained log:
  `build/gradle-run-logs/20260712T111317435274300-pid1435091-worldPlannerControlsRawInputHarness.log`.
  Literal result: `BUILD SUCCESSFUL in 51s`,
  `13 actionable tasks: 2 executed, 1 from cache, 10 up-to-date`.
- Forced batch run:
  `env -u CODEX_THREAD_ID SALTMARCHER_GRADLE_ISOLATION_ID=t1-world-controls-forced tools/gradle/run-observable-gradle.sh --fail-fast worldPlannerControlsRawInputHarness -- --rerun-tasks`
  passed. Retained log:
  `build/gradle-run-logs/20260712T111426301758034-pid1435837-worldPlannerControlsRawInputHarness.log`.
  Literal result: `BUILD SUCCESSFUL in 1m 3s`,
  `13 actionable tasks: 13 executed`.
- JUnit XML after the forced proof:
  `build/test-results/worldPlannerControlsRawInputHarness/TEST-src.view.leftbartabs.worldplanner.WorldPlannerControlsRawInputHarness.xml`
  records `tests="4"`, `failures="0"`, `errors="0"` and contains
  `WORLD_PLANNER_CONTROLS_RAW_INPUT_001` through
  `WORLD_PLANNER_CONTROLS_RAW_INPUT_004`.
- Final full check:
  `env -u CODEX_THREAD_ID SALTMARCHER_GRADLE_ISOLATION_ID=t1-world-controls-check tools/gradle/run-observable-gradle.sh --fail-fast check -- --rerun-tasks`
  passed. Retained log:
  `build/gradle-run-logs/20260712T111556821574554-pid1437084-check.log`.
  Literal result: `BUILD SUCCESSFUL in 12m 5s`,
  `61 actionable tasks: 61 executed`.
- Review state: Phase 1 approved; Phase 2 approved.

## T1 Batch Evidence - `worldPlannerUiHarness`

- Batch started after `worldPlannerControlsRawInputHarness` close-out. Scope is
  limited to `worldPlannerUiHarness`.
- Registration: the old `behaviorHarnesses.javaExec("worldPlannerUiHarness")`
  registration,
  `mainClass.set("src.view.leftbartabs.worldplanner.WorldPlannerUiHarness")`,
  `worldPlannerUiHarnessDataDir`, and its
  `outputs.upToDateWhen { false }` entry are removed. The batch now uses
  `behaviorHarnesses.junitTest("worldPlannerUiHarness")`, includes only
  `src/view/leftbartabs/worldplanner/WorldPlannerUiHarness.class`, and is
  wired into `check`.
- Frozen proof-item name is derived from the single pre-conversion top-level
  `runHarness` flow: shell slots, removed old labels, NPC/faction/location UI
  mutations, selected-NPC Encounter handoff, filtering, inspector behavior,
  source module, and readback lists. Assertions and fixture values remain
  unchanged.
- Scripted parity mapping output:

  ```text
  old proof item        junit method
  WORLD-PLANNER-UI-001  WORLD_PLANNER_UI_001
  result: 1 old proof item(s), 1 junit method(s), 1 exact normalized match
  ```

- Focused batch run:
  `env -u CODEX_THREAD_ID SALTMARCHER_GRADLE_ISOLATION_ID=t1-world-ui-focused tools/gradle/run-observable-gradle.sh --fail-fast worldPlannerUiHarness`
  passed. Retained log:
  `build/gradle-run-logs/20260712T113519313103188-pid1452976-worldPlannerUiHarness.log`.
  Literal result: `BUILD SUCCESSFUL in 53s`,
  `13 actionable tasks: 2 executed, 1 from cache, 10 up-to-date`.
- Forced batch run:
  `env -u CODEX_THREAD_ID SALTMARCHER_GRADLE_ISOLATION_ID=t1-world-ui-forced tools/gradle/run-observable-gradle.sh --fail-fast worldPlannerUiHarness -- --rerun-tasks`
  passed. Retained log:
  `build/gradle-run-logs/20260712T113630515244432-pid1453573-worldPlannerUiHarness.log`.
  Literal result: `BUILD SUCCESSFUL in 1m 5s`,
  `13 actionable tasks: 13 executed`.
- JUnit XML after the forced proof:
  `build/test-results/worldPlannerUiHarness/TEST-src.view.leftbartabs.worldplanner.WorldPlannerUiHarness.xml`
  records `tests="1"`, `failures="0"`, `errors="0"` and contains
  `WORLD_PLANNER_UI_001`.
- Final full check:
  `env -u CODEX_THREAD_ID SALTMARCHER_GRADLE_ISOLATION_ID=t1-world-ui-check tools/gradle/run-observable-gradle.sh --fail-fast check -- --rerun-tasks`
  passed. Retained log:
  `build/gradle-run-logs/20260712T113815085587882-pid1454705-check.log`.
  Literal result: `BUILD SUCCESSFUL in 11m 47s`,
  `62 actionable tasks: 62 executed`.
- Review state: Phase 1 approved; Phase 2 approved.

## T1 Batch Evidence - `smokeStartupHarness`

- Batch started after `worldPlannerUiHarness` close-out. Scope is limited to
  `smokeStartupHarness`.
- Registration: the old `behaviorHarnesses.javaExec("smokeStartupHarness")`
  registration, `mainClass.set("bootstrap.SmokeStartupHarness")`,
  `smokeStartupHarnessDataDir`, and its `outputs.upToDateWhen { false }`
  entry are removed. The batch now uses
  `behaviorHarnesses.junitTest("smokeStartupHarness")`, includes only
  `bootstrap/SmokeStartupHarness.class`, and is wired into `check`.
- Frozen proof-item name is derived from the single pre-conversion top-level
  startup smoke flow: JavaFX startup, shell contribution discovery, shell
  creation, temporary SQLite connection, integrity check, and timeout guard.
  Assertions and fixture values remain unchanged.
- Scripted parity mapping output:

  ```text
  old proof item        junit method
  SMOKE-STARTUP-001     SMOKE_STARTUP_001
  result: 1 old proof item(s), 1 junit method(s), 1 exact normalized match
  ```

- Focused batch run:
  `env -u CODEX_THREAD_ID SALTMARCHER_GRADLE_ISOLATION_ID=t1-smoke-focused tools/gradle/run-observable-gradle.sh --fail-fast smokeStartupHarness`
  passed. Retained log:
  `build/gradle-run-logs/20260712T115747820068290-pid1475959-smokeStartupHarness.log`.
  Literal result: `BUILD SUCCESSFUL in 1m 5s`,
  `13 actionable tasks: 2 executed, 1 from cache, 10 up-to-date`.
- Forced batch run:
  `env -u CODEX_THREAD_ID SALTMARCHER_GRADLE_ISOLATION_ID=t1-smoke-forced tools/gradle/run-observable-gradle.sh --fail-fast smokeStartupHarness -- --rerun-tasks`
  passed. Retained log:
  `build/gradle-run-logs/20260712T115914500454559-pid1476523-smokeStartupHarness.log`.
  Literal result: `BUILD SUCCESSFUL in 1m 8s`,
  `13 actionable tasks: 13 executed`.
- JUnit XML after the forced proof:
  `build/test-results/smokeStartupHarness/TEST-bootstrap.SmokeStartupHarness.xml`
  records `tests="1"`, `failures="0"`, `errors="0"` and contains
  `SMOKE_STARTUP_001`.
- Final full check:
  `env -u CODEX_THREAD_ID SALTMARCHER_GRADLE_ISOLATION_ID=t1-smoke-check tools/gradle/run-observable-gradle.sh --fail-fast check -- --rerun-tasks`
  passed. Retained log:
  `build/gradle-run-logs/20260712T120104256353183-pid1477644-check.log`.
  Literal result: `BUILD SUCCESSFUL in 12m 49s`,
  `63 actionable tasks: 63 executed`.
- Review state: Phase 1 approved; Phase 2 approved.

## T1 Batch Evidence - `dungeonEditorBehaviorHarness` fleet

- Batch started after `smokeStartupHarness` close-out. Scope is limited to the
  registered Dungeon Editor behavior harness task fleet and its suite inventory
  utility.
- Registration: the old `registerDungeonEditorBehaviorHarnessTask` helper now
  calls `behaviorHarnesses.junitTest(...)` instead of
  `behaviorHarnesses.javaExec(...)`. The old
  `behaviorHarnesses.javaExec("dungeonEditorBehaviorHarnessSuites")` utility is
  replaced by `behaviorHarnesses.junitTest("dungeonEditorBehaviorHarnessSuites")`.
  The 12 Dungeon Editor tasks are wired into `check`, filter to one method on
  `DungeonEditorBehaviorSuiteHarness`, and retain the old suite selections,
  metadata, documentation inputs, results directory, and temporary
  `XDG_DATA_HOME` isolation.
- Deletion: the old silent `main` entrypoint on
  `DungeonEditorBehaviorSuiteHarness` is removed. Superseded direct-main wrapper
  entrypoints with no remaining references are deleted:
  `DungeonCoreModelInvariantHarness`, `DungeonEditorRouteBehaviorHarness`, and
  `DungeonEditorToolBehaviorHarness`. `DungeonEditorHarnessPublicationSupport`
  no longer calls `System.exit(...)`, so JUnit records executed tests instead
  of skipped tests.
- Documentation: `verification-dungeon-editor-wide-invariants.md` now states
  that `dungeonEditorBehaviorHarnessSuites` reports suite IDs through JUnit.
- Frozen proof-item names are derived from the pre-conversion registered
  Dungeon Editor Gradle tasks and their suite selections. Assertions, inputs,
  suite graph, proof rows, and behavior claims remain unchanged.
- Scripted parity mapping output after the final full check:

  ```text
  old task / proof item                      junit method
  dungeonEditorBehaviorHarness               DUNGEON_EDITOR_BEHAVIOR_001
  dungeonEditorCoreBehaviorHarness           DUNGEON_EDITOR_CORE_BEHAVIOR_001
  dungeonEditorRouteBehaviorHarness          DUNGEON_EDITOR_ROUTE_BEHAVIOR_001
  dungeonEditorDoorBehaviorHarness           DUNGEON_EDITOR_DOOR_BEHAVIOR_001
  dungeonEditorWallBehaviorHarness           DUNGEON_EDITOR_WALL_BEHAVIOR_001
  dungeonEditorRoomBehaviorHarness           DUNGEON_EDITOR_ROOM_BEHAVIOR_001
  dungeonEditorClusterBehaviorHarness        DUNGEON_EDITOR_CLUSTER_BEHAVIOR_001
  dungeonEditorCorridorBehaviorHarness       DUNGEON_EDITOR_CORRIDOR_BEHAVIOR_001
  dungeonEditorStairBehaviorHarness          DUNGEON_EDITOR_STAIR_BEHAVIOR_001
  dungeonEditorTransitionBehaviorHarness     DUNGEON_EDITOR_TRANSITION_BEHAVIOR_001
  dungeonEditorFeatureBehaviorHarness        DUNGEON_EDITOR_FEATURE_BEHAVIOR_001
  dungeonEditorBehaviorHarnessSuites         DUNGEON_EDITOR_BEHAVIOR_SUITES_001
  result: 12 old task proof item(s), 12 junit method(s), 12 XML-confirmed exact unskipped match(es)
  ```

- Infrastructure incident: an attempted one-command focused run of all 12
  Dungeon Editor tasks failed before Gradle execution because
  `run-observable-gradle.sh` derived a log filename longer than the filesystem
  limit. Literal shell result:
  `File name too long`. This produced no harness result and is not counted as
  proof.
- Harness-frame incident: the first JUnit conversion retained the old
  JavaExec-oriented `System.exit(0)` publication path. Gradle returned green
  but the behavior test XMLs recorded `skipped="1"`. This was rejected as
  invalid proof and fixed in the same batch by returning normally to JUnit.
- Task-cache-frame incident: a post-review T1 done-when scan found the old
  `outputs.upToDateWhen { false }` predicate still present in the new Dungeon
  Editor `Test` helper. This was rejected as an incomplete frame conversion and
  removed before final proof.
- R2 flake incident: the first focused aggregate rerun after removing that
  predicate failed in the existing `DE-STAIR-001` preview-latency assertion:
  283 ms observed against the 250 ms budget. The same focused task passed on an
  immediate repeat. The failed run is not counted as proof and is filed in
  `docs/project/journal/2026-07-harness-modernization-r2-issues.md`.
- Final focused aggregate run:
  `env -u CODEX_THREAD_ID SALTMARCHER_GRADLE_ISOLATION_ID=t1-dungeon-editor-aggregate-focused-4 tools/gradle/run-observable-gradle.sh --fail-fast dungeonEditorBehaviorHarness`
  passed. Retained log:
  `build/gradle-run-logs/20260712T141010401983124-pid1572658-dungeonEditorBehaviorHarness.log`.
  Literal result: `BUILD SUCCESSFUL in 2m 12s`,
  `13 actionable tasks: 1 executed, 12 up-to-date`.
- Focused suite-inventory run:
  `env -u CODEX_THREAD_ID SALTMARCHER_GRADLE_ISOLATION_ID=t1-dungeon-editor-suites-focused tools/gradle/run-observable-gradle.sh --fail-fast dungeonEditorBehaviorHarnessSuites`
  passed. Retained log:
  `build/gradle-run-logs/20260712T123023275794971-pid1510331-dungeonEditorBehaviorHarnessSuites.log`.
  Literal result: `BUILD SUCCESSFUL in 17s`,
  `13 actionable tasks: 1 executed, 12 up-to-date`.
- Final forced aggregate run:
  `env -u CODEX_THREAD_ID SALTMARCHER_GRADLE_ISOLATION_ID=t1-dungeon-editor-aggregate-forced-3 tools/gradle/run-observable-gradle.sh --fail-fast dungeonEditorBehaviorHarness -- --rerun-tasks`
  passed. Retained log:
  `build/gradle-run-logs/20260712T141303396799336-pid1573796-dungeonEditorBehaviorHarness.log`.
  Literal result: `BUILD SUCCESSFUL in 3m 9s`,
  `13 actionable tasks: 13 executed`.
- Forced suite-inventory run:
  `env -u CODEX_THREAD_ID SALTMARCHER_GRADLE_ISOLATION_ID=t1-dungeon-editor-suites-forced tools/gradle/run-observable-gradle.sh --fail-fast dungeonEditorBehaviorHarnessSuites -- --rerun-tasks`
  passed. Retained log:
  `build/gradle-run-logs/20260712T123407657229310-pid1512252-dungeonEditorBehaviorHarnessSuites.log`.
  Literal result: `BUILD SUCCESSFUL in 58s`,
  `13 actionable tasks: 13 executed`.
- JUnit XML after the final full check:
  each file under
  `build/test-results/dungeonEditor*/*DungeonEditorBehaviorSuiteHarness.xml`
  records `tests="1"`, `skipped="0"`, `failures="0"`, and `errors="0"` for
  its mapped `DUNGEON_EDITOR_*` method.
- Final full check:
  `env -u CODEX_THREAD_ID SALTMARCHER_GRADLE_ISOLATION_ID=t1-dungeon-editor-check-4 tools/gradle/run-observable-gradle.sh --fail-fast check -- --rerun-tasks`
  passed. Retained log:
  `build/gradle-run-logs/20260712T141619858327773-pid1575173-check.log`.
  Literal result: `BUILD SUCCESSFUL in 24m 6s`,
  `75 actionable tasks: 75 executed`.
- Static deletion proof: `rg -n "behaviorHarnesses\.javaExec\(" build.gradle.kts`
  and `rg -n "public static void main" test/src/view/leftbartabs/dungeoneditor`
  both returned no matches.
- Review state: Phase 1 first pass blocked on stale documentation wording that
  still said legacy entrypoints delegate to the suite registry after the direct
  `main` wrappers were deleted. The wording was repaired in
  `verification-dungeon-editor-wide-invariants.md`, followed by the final full
  `check --rerun-tasks` above. A later T1 done-when scan found and removed the
  stale Dungeon Editor `outputs.upToDateWhen { false }`; proof and both reviews
  were repeated after that code change. Phase 1 final re-review approved.
  Phase 2 final judge approved.

## T1 Close-Out Evidence

- Zero JavaExec behavior harness registrations remain:
  `rg -n "behaviorHarnesses\.javaExec\(" build.gradle.kts` returned no
  matches.
- No Dungeon Editor silent direct-main harness entrypoint remains:
  `rg -n "public static void main" test/src/view/leftbartabs/dungeoneditor`
  returned no matches.
- No harness-level `outputs.upToDateWhen { false }` remains in
  `build.gradle.kts` or the converted Dungeon Editor harness surface:
  `rg -n "outputs\.upToDateWhen" build.gradle.kts test/src/view/leftbartabs/dungeoneditor`
  returned no matches.
- `check` executes the converted harness fleet. Final retained proof:
  `build/gradle-run-logs/20260712T141619858327773-pid1575173-check.log`,
  `BUILD SUCCESSFUL in 24m 6s`, `75 actionable tasks: 75 executed`.
- Scripted parity output is recorded in each T1 batch section. The final
  Dungeon Editor batch records the last JavaExec fleet replacement and the
  suite-inventory utility replacement.
- Phase 1 and Phase 2 approved the final T1 diff after the stale doc wording,
  stale `outputs.upToDateWhen { false }`, and `DE-STAIR-001` flake filing were
  handled.
- Documentation enforcement follow-up: after T1 close-out metadata repairs,
  `./gradlew checkDocumentationEnforcement --console=plain` still failed with
  11 documentation-governance violations. Ten are architecture-migration or
  legacy documentation findings outside the T1 harness conversion. The
  remaining finding is the known `harness-modernization-ledger.md` line count;
  the ledger keeps the roadmap-required evidence rather than omitting or
  scattering facts during close-out. This check is recorded as red and is not
  used as T1 acceptance proof.

## T2 Evidence - Dungeon Editor Cache Hermeticity

- Scope: start T2 on the highest-risk converted harness surface, the Dungeon
  Editor aggregate, because it has custom published summary output in addition
  to the standard JUnit outputs.
- Hermeticity change: each registered Dungeon Editor behavior `Test` task now
  writes its published summary under
  `build/dungeon-editor-behavior-results/<taskName>/summary.txt` instead of
  sharing one declared output directory. Per-run `XDG_DATA_HOME` directories
  still live under the task action's run-data root and are not declared
  outputs.
- Phase 1 first pass found that the initial output split still passed an
  absolute `saltmarcher.dungeonEditorBehavior.resultsDir` system property into
  the cacheable `Test` task. That was rejected because `Test` system
  properties are task inputs and absolute worktree paths are not relocatable.
  The task now keeps the declared output provider but passes the relative
  `build/dungeon-editor-behavior-results/<taskName>` path to the test JVM.
- Phase 2 first pass found the same absolute system-property pattern in the
  converted `dungeonMapRenderParityHarness`, which also participates in
  `check`. That harness now keeps its declared output provider and passes the
  relative `build/dungeon-map-render-parity-results` path to the test JVM.
- Focused validation after the relative output path fix:
  `env -u CODEX_THREAD_ID SALTMARCHER_GRADLE_ISOLATION_ID=t2-dungeon-editor-output-relative tools/gradle/run-observable-gradle.sh --fail-fast dungeonEditorBehaviorHarness`
  passed. Retained log:
  `build/gradle-run-logs/20260712T160202623725154-pid1635647-dungeonEditorBehaviorHarness.log`.
  Literal result: `BUILD SUCCESSFUL in 3m 41s`,
  `13 actionable tasks: 1 executed, 1 from cache, 11 up-to-date`.
- Cache-hit rehearsal with an unrelated changed file:
  `docs/project/journal/README.md` carried a temporary marker outside the
  Dungeon Editor task inputs. The first clean-and-run populated the cache for
  the current key and is not counted as the cache-hit proof. The second
  clean-and-run:
  `env -u CODEX_THREAD_ID SALTMARCHER_GRADLE_ISOLATION_ID=t2-dungeon-editor-relative-cache-hit tools/gradle/run-observable-gradle.sh --fail-fast cleanDungeonEditorBehaviorHarness dungeonEditorBehaviorHarness`
  passed with `:dungeonEditorBehaviorHarness FROM-CACHE`. Retained log:
  `build/gradle-run-logs/20260712T160555789968386-pid1637121-cleanDungeonEditorBehaviorHarness__dungeonEditorBehaviorHarness.log`.
  Literal result: `BUILD SUCCESSFUL in 8s`,
  `14 actionable tasks: 1 executed, 1 from cache, 12 up-to-date`.
  The temporary marker was removed after the rehearsal.
- In-classpath change rehearsal:
  a temporary bytecode-affecting constant in
  `DungeonEditorBehaviorSuiteHarness` forced recompilation and task execution.
  The temporary constant was removed after the rehearsal. Command:
  `env -u CODEX_THREAD_ID SALTMARCHER_GRADLE_ISOLATION_ID=t2-dungeon-editor-relative-classpath-rerun tools/gradle/run-observable-gradle.sh --fail-fast dungeonEditorBehaviorHarness`
  passed. Retained log:
  `build/gradle-run-logs/20260712T163343244622176-pid1648358-dungeonEditorBehaviorHarness.log`.
  Literal result: `BUILD SUCCESSFUL in 2m 32s`,
  `13 actionable tasks: 2 executed, 1 from cache, 10 up-to-date`.
- Resource change rehearsal:
  a temporary marker in
  `docs/dungeon/verification/verification-dungeon-editor-stairs.md`, which is
  covered by the Dungeon Editor behavior catalog input declaration, forced task
  execution. The marker was removed after the rehearsal. Command:
  `env -u CODEX_THREAD_ID SALTMARCHER_GRADLE_ISOLATION_ID=t2-dungeon-editor-relative-resource-rerun tools/gradle/run-observable-gradle.sh --fail-fast dungeonEditorBehaviorHarness`
  passed. Retained log:
  `build/gradle-run-logs/20260712T163636144610203-pid1649449-dungeonEditorBehaviorHarness.log`.
  Literal result: `BUILD SUCCESSFUL in 2m 23s`,
  `13 actionable tasks: 1 executed, 1 from cache, 11 up-to-date`.
- Render parity focused validation after the relative output path fix:
  `env -u CODEX_THREAD_ID SALTMARCHER_GRADLE_ISOLATION_ID=t2-render-parity-relative-focused tools/gradle/run-observable-gradle.sh --fail-fast dungeonMapRenderParityHarness`
  passed. Retained log:
  `build/gradle-run-logs/20260712T173621096971634-pid1682651-dungeonMapRenderParityHarness.log`.
  Literal result: `BUILD SUCCESSFUL in 1m 28s`,
  `13 actionable tasks: 1 executed, 2 from cache, 10 up-to-date`.
- Render parity cache-hit rehearsal with an unrelated changed file:
  `docs/project/journal/README.md` carried a temporary marker outside the
  Render Parity task inputs. Command:
  `env -u CODEX_THREAD_ID SALTMARCHER_GRADLE_ISOLATION_ID=t2-render-parity-unrelated-cache-hit tools/gradle/run-observable-gradle.sh --fail-fast cleanDungeonMapRenderParityHarness dungeonMapRenderParityHarness`
  passed with `:dungeonMapRenderParityHarness FROM-CACHE`. Retained log:
  `build/gradle-run-logs/20260712T173821638672040-pid1683737-cleanDungeonMapRenderParityHarness__dungeonMapRenderParityHarness.log`.
  Literal result: `BUILD SUCCESSFUL in 12s`,
  `14 actionable tasks: 1 executed, 1 from cache, 12 up-to-date`.
  The temporary marker was removed after the rehearsal.
- Render parity in-classpath change rehearsal:
  a temporary bytecode-affecting constant in
  `DungeonMapRenderParitySnapshotHarness` forced recompilation and task
  execution. The temporary constant was removed after the rehearsal. Command:
  `env -u CODEX_THREAD_ID SALTMARCHER_GRADLE_ISOLATION_ID=t2-render-parity-classpath-rerun tools/gradle/run-observable-gradle.sh --fail-fast dungeonMapRenderParityHarness`
  passed. Retained log:
  `build/gradle-run-logs/20260712T173907686552882-pid1684548-dungeonMapRenderParityHarness.log`.
  Literal result: `BUILD SUCCESSFUL in 32s`,
  `13 actionable tasks: 2 executed, 11 up-to-date`.
- Render parity resource change rehearsal:
  a temporary marker in
  `docs/dungeon/verification/verification-dungeon-render-snapshot-parity.md`,
  which is covered by the Render Parity catalog input declaration, forced task
  execution. The marker was removed after the rehearsal. Command:
  `env -u CODEX_THREAD_ID SALTMARCHER_GRADLE_ISOLATION_ID=t2-render-parity-resource-rerun tools/gradle/run-observable-gradle.sh --fail-fast dungeonMapRenderParityHarness`
  passed. Retained log:
  `build/gradle-run-logs/20260712T174019778943027-pid1685439-dungeonMapRenderParityHarness.log`.
  Literal result: `BUILD SUCCESSFUL in 27s`,
  `13 actionable tasks: 1 executed, 1 from cache, 11 up-to-date`.
- Consecutive full forced rerun A:
  `env -u CODEX_THREAD_ID SALTMARCHER_GRADLE_ISOLATION_ID=t2-check-render-parity-final-rerun-a tools/gradle/run-observable-gradle.sh --fail-fast check -- --rerun-tasks`
  passed. Retained log:
  `build/gradle-run-logs/20260712T174125645896677-pid1686832-check.log`.
  Literal result: `BUILD SUCCESSFUL in 26m 8s`,
  `75 actionable tasks: 75 executed`.
- Consecutive full forced rerun B:
  `env -u CODEX_THREAD_ID SALTMARCHER_GRADLE_ISOLATION_ID=t2-check-render-parity-final-rerun-b tools/gradle/run-observable-gradle.sh --fail-fast check -- --rerun-tasks`
  passed. Retained log:
  `build/gradle-run-logs/20260712T180742922646191-pid1694629-check.log`.
  Literal result: `BUILD SUCCESSFUL in 26m 17s`,
  `75 actionable tasks: 75 executed`.
- Review state: Phase 1 first pass approved. Phase 2 first pass blocked on
  the remaining absolute Render Parity results-dir system property; that
  finding is fixed and proof above was repeated. Phase 1 re-review approved.
  Phase 2 re-review approved.

## T2 Close-Out Evidence

- Unrelated change cache-hit rehearsals passed for the Dungeon Editor aggregate
  helper and Render Parity converted harness:
  `:dungeonEditorBehaviorHarness FROM-CACHE` in
  `build/gradle-run-logs/20260712T160555789968386-pid1637121-cleanDungeonEditorBehaviorHarness__dungeonEditorBehaviorHarness.log`
  and `:dungeonMapRenderParityHarness FROM-CACHE` in
  `build/gradle-run-logs/20260712T173821638672040-pid1683737-cleanDungeonMapRenderParityHarness__dungeonMapRenderParityHarness.log`.
- In-classpath rehearsals re-ran the affected compile and harness tasks:
  Dungeon Editor
  `build/gradle-run-logs/20260712T163343244622176-pid1648358-dungeonEditorBehaviorHarness.log`
  and Render Parity
  `build/gradle-run-logs/20260712T173907686552882-pid1684548-dungeonMapRenderParityHarness.log`.
- Resource rehearsals re-ran the affected harness tasks:
  Dungeon Editor
  `build/gradle-run-logs/20260712T163636144610203-pid1649449-dungeonEditorBehaviorHarness.log`
  and Render Parity
  `build/gradle-run-logs/20260712T174019778943027-pid1685439-dungeonMapRenderParityHarness.log`.
- Consecutive final full forced runs after all T2 fixes both passed:
  `build/gradle-run-logs/20260712T174125645896677-pid1686832-check.log`
  with `BUILD SUCCESSFUL in 26m 8s`,
  `75 actionable tasks: 75 executed`, and
  `build/gradle-run-logs/20260712T180742922646191-pid1694629-check.log`
  with `BUILD SUCCESSFUL in 26m 17s`,
  `75 actionable tasks: 75 executed`.
- Same-pattern scan found no remaining `resultsDir` assignment using
  `.get().asFile.absolutePath` in `build.gradle.kts`.
- Phase 1 and Phase 2 approved after the Render Parity blocker was fixed.

## T3 Evidence - Versioned Commit Gate

- Design note: `docs/project/journal/2026-07.md` records the L-tier T3 target
  state, rejected alternatives, scope boundary, and done-when facts under
  `2026-07-12 harness-modernization-t3-gate-design`.
- Implementation commits:
  `08e374f42` added the versioned `tools/hooks/pre-commit`;
  `ebf413913`, `e156c3b37`, and `980e9f963` hardened repo-root discovery,
  skipped hook bootstrap inside gate worktrees, and made bootstrap Git config
  robust with `git -C` plus Git environment cleanup.
- Tested-change pass rehearsal:
  `tools/hooks/pre-commit` accepted staged tree
  `67b6becbd9d6557f99c7663893163df5a4f3f67e` through a detached clean
  worktree. Retained log:
  `build/pre-commit-gate/67b6becbd9d6557f99c7663893163df5a4f3f67e.log`.
  Literal result in the hook output:
  `pre-commit: accepted; staged tree passed ./gradlew check.`
- Final tested-change pass after robust Git-config hardening:
  `tools/hooks/pre-commit` accepted staged tree
  `6ef614b646f0c5e0249d0c63c62705e7688b1018`. Retained log:
  `build/pre-commit-gate/6ef614b646f0c5e0249d0c63c62705e7688b1018.log`.
  Literal log result: `BUILD SUCCESSFUL in 19m 5s`,
  `75 actionable tasks: 54 executed, 20 from cache, 1 up-to-date`.
- Deliberately untested change rejection rehearsal:
  a temporary staged syntax regression in
  `test/src/bootstrap/SmokeStartupHarness.java` made the staged tree
  `4d807eaa8e7a1c033dff3c0188fbc8045e9a48ee` fail. The hook rejected it
  with `pre-commit: rejected; failing tasks: :compileTestJava`. Retained log:
  `build/pre-commit-gate/4d807eaa8e7a1c033dff3c0188fbc8045e9a48ee.log`.
  The temporary regression was removed after the rehearsal.
- Dirty-worktree isolation rehearsal:
  an unstaged syntax regression in `SmokeStartupHarness.java` was left in the
  shared checkout while the staged tree remained clean. The hook accepted
  staged tree `eb8b60e498c750f2bb647c719eac22a8cfdc0d43` through the detached
  clean worktree. Retained log:
  `build/pre-commit-gate/eb8b60e498c750f2bb647c719eac22a8cfdc0d43.log`.
  Literal log result: `BUILD SUCCESSFUL in 18m 24s`, and
  `:compileTestJava FROM-CACHE`, proving the uncommitted broken file did not
  leak into the gate tree. The temporary regression was removed after the
  rehearsal.
- Fresh clone rehearsal:
  local clone `/tmp/saltmarcher-t3-fresh-pass.ZUjR0v/repo` at `980e9f963`
  started with no local `core.hooksPath`. The versioned hook was executable.
  `./gradlew help --task check --console=plain` passed in 9s and bootstrapped
  `core.hooksPath=tools/hooks`. Running `tools/hooks/pre-commit` with an empty
  index printed `pre-commit: no staged changes; skipping SaltMarcher check
  gate.`
- Phase 1 review approved. Phase 2 independent judge approved.

## T3 Close-Out Evidence

- T3 roadmap done-when rehearsed literally:
  deliberately untested staged change rejected and named `:compileTestJava`;
  tested staged trees passed through `./gradlew check` in clean detached
  worktrees; fresh clone bootstrap set `core.hooksPath=tools/hooks`; dirty
  worktree edits did not leak into the gate tree.
- Final committed gate implementation is at `980e9f963` on branch
  `codex/harness-modernization-t0`.
- T4 is now the active milestone. CI cache authority, nightly forced runs,
  required-check changes, and deletion of `harness-map.json`,
  `select_harnesses.py`, and `behavior-gate` were deliberately not performed
  in T3.

## T4 Local Implementation Evidence

- Workflow patch:
  `.github/workflows/quality-platforms.yml` now defines required `check`,
  required `warden-freeze`, required `judge-review`, informational
  `ckjm-report`, `sonarcloud`, and `codescene` jobs for PR/main events, plus
  scheduled `nightly-rerun-tasks`. The old `behavior-gate` job and
  `SALT_MARCHER_HARNESS_MAP_BASE_REF` selector environment are removed.
  Pull requests and merge-queue runs use the GitHub Actions Gradle cache
  read-only; pushes to `main` own cache writes. The required `check` run and
  nightly forced run both execute under `xvfb-run -a` for JavaFX harnesses.
  The nightly forced run uses `tools/gradle/run-observable-gradle.sh check --
  --rerun-tasks` and reads the CI cache without writing it.
- Deletion patch:
  `tools/quality/config/harness-map.json` and
  `tools/quality/scripts/select_harnesses.py` are deleted in the worktree.
  `tools/quality/config/frozen-surfaces.txt` and
  `tools/quality/scripts/warden_freeze.py` no longer list those deleted
  selector files as frozen representatives.
- Build-logic patch:
  `CheckHarnessMapConsistencyTask`, the harness-map JSON parser, and
  `checkHarnessMapConsistency` wiring are removed from the verification core.
  `checkBehaviorHarnessTopology` remains wired into `check` and
  `production-handoff`.
- Governance patch:
  ADR 0001, ADR 0002, ADR 0003,
  `docs/project/verification/quality-platforms-ci-and-branch-protection.md`,
  `docs/project/verification/quality-platforms.md`,
  `docs/project/verification/harness-gaps.md`, the branch-protection readback
  script, the status-issue updater, and judge wording now name `check`,
  `warden-freeze`, and `judge-review` as required contexts and no longer treat
  the deleted selector as live machinery. The branch-protection readback
  script now reads classic protection, paginated branch rules, and paginated
  branch-targeted rulesets before qualifying the intended contexts.
- Local proof so far:
  `PYTHONDONTWRITEBYTECODE=1 python3 -m py_compile
  tools/quality/scripts/branch_protection_readback.py
  tools/quality/scripts/update_status_issue.py
  tools/quality/scripts/warden_freeze.py tools/agents/judge_review.py`
  passed with no output. `python3 tools/quality/scripts/warden_freeze.py
  --self-test` passed with `warden-freeze: self-test passed`.
  `./gradlew compileJava --console=plain` passed with
  `BUILD SUCCESSFUL in 1m 23s`. `./gradlew help --task
  checkHarnessMapConsistency --console=plain` failed as expected with
  `Task 'checkHarnessMapConsistency' not found in root project 'SaltMarcher'`.
  `./gradlew checkBehaviorHarnessTopology --console=plain` passed with
  `BUILD SUCCESSFUL in 8s`. Workflow YAML parsed with `yaml ok`, both deleted
  selector files are absent from the worktree, and `git diff --check` passed.
  Full local `check` passed:
  `env -u CODEX_THREAD_ID SALTMARCHER_GRADLE_ISOLATION_ID=t4-local-check
  tools/gradle/run-observable-gradle.sh --fail-fast check`. Retained log:
  `build/gradle-run-logs/20260712T231702365402679-pid1862628-check.log`.
  Literal result: `BUILD SUCCESSFUL in 27m 4s`,
  `74 actionable tasks: 59 executed, 15 up-to-date`. Reviews, PR CI,
  branch-protection readback, and nightly readback are still pending.

## T4 Phase 1 Rework Evidence

- Phase 1 found two Must Fix items before handoff:
  CI `check`/nightly `check --rerun-tasks` lacked the `xvfb-run` display setup
  that the old `behavior-gate` used for JavaFX harness execution, and
  `tools/quality/scripts/branch_protection_readback.py` still qualified only
  the classic branch-protection endpoint while the owner doc requires classic
  protection, branch rules, and branch-targeted rulesets.
- Rework:
  `.github/workflows/quality-platforms.yml` now runs both authoritative
  `check` invocations through `xvfb-run -a`. The CI/branch-protection
  verification document names the same Xvfb-wrapped commands. The
  `warden-freeze` job now runs the trusted base-ref Warden self-test against
  the base-ref frozen-surface list, then restores the PR frozen-surface list
  before enforcement so T4 can delete superseded frozen representatives without
  self-test failure from the previous inventory.
  `branch_protection_readback.py` now reads
  `repos/<repo>/branches/<branch>/protection`,
  paginated `repos/<repo>/rules/branches/<branch>?per_page=100`, and
  paginated `repos/<repo>/rulesets?targets=branch&per_page=100`; branch
  ruleset details are fetched by id when available. Qualification is
  conservative: failed classic protection reads return `Not Qualified` unless
  the classic endpoint returns `404`, failed paginated rule reads or failed
  active ruleset detail reads return `Not Qualified`; exact intended contexts
  return `Qualified`; extra blocking contexts return `Stricter Drift`.
- Second Phase 1 rework:
  The `warden-freeze` workflow transition was adjusted after re-review found
  that PR CI would otherwise run the trusted base-ref Warden self-test against
  the PR's post-T4 frozen list. The workflow now preserves the PR frozen list,
  checks out the base-ref Warden script and base-ref frozen list, runs the
  trusted self-test, then restores the PR frozen list before enforcement. The
  readback qualification now also treats a failed classic protection endpoint
  as `Not Qualified` unless the detail is the accepted classic-protection
  `HTTP 404` absence case.
- Rework proof:
  Python source compilation via in-memory `compile(...)` passed with
  `python syntax ok`; no bytecode files were written. `python3
  tools/quality/scripts/warden_freeze.py --self-test` passed with
  `warden-freeze: self-test passed`. Workflow YAML parsed with `yaml ok`.
  `git diff --check` passed. A quick post-fix `check` passed with
  `BUILD SUCCESSFUL in 14s`, `74 actionable tasks: 6 executed, 1 from cache,
  67 up-to-date`, retained log
  `build/gradle-run-logs/20260712T235124427753965-pid1882587-check.log`.
  Because local cache is not proof, the final post-fix local proof was forced:
  `env -u CODEX_THREAD_ID
  SALTMARCHER_GRADLE_ISOLATION_ID=t4-phase1-fix-rerun
  tools/gradle/run-observable-gradle.sh --fail-fast check -- --rerun-tasks`
  passed. Retained log:
  `build/gradle-run-logs/20260712T235158265406245-pid1883014-check.log`.
  Literal result: `BUILD SUCCESSFUL in 25m 51s`,
  `74 actionable tasks: 74 executed`.
  After the second rework, Python source compilation passed with
  `python syntax ok`; readback qualification assertions for `HTTP 401`,
  accepted classic `HTTP 404`, and `Stricter Drift` passed with
  `readback qualification ok`; workflow YAML parsed with `yaml ok`;
  `git diff --check` passed; current Warden self-test passed with
  `warden-freeze: self-test passed`; and an exact local simulation of the
  PR Warden self-test transition passed with `warden transition path ok`.
  The final post-rework forced proof passed:
  `env -u CODEX_THREAD_ID
  SALTMARCHER_GRADLE_ISOLATION_ID=t4-warden-readback-fix-rerun
  tools/gradle/run-observable-gradle.sh --fail-fast check -- --rerun-tasks`.
  Retained log:
  `build/gradle-run-logs/20260713T002544416408400-pid1901946-check.log`.
  Literal result: `BUILD SUCCESSFUL in 27m 4s`,
  `74 actionable tasks: 74 executed`.
- Third Phase 1 rework:
  Phase 1 found that ruleset branch applicability was checked before fetching
  detailed ruleset payloads, but not after a detail payload replaced a summary
  payload. The readback now re-runs `ruleset_applies_to_branch(...)` after a
  successful ruleset detail fetch before extracting required checks.
  Python source compilation passed with `python syntax ok`; readback
  qualification assertions now also cover a fetched detail payload that applies
  only to `refs/heads/release/*`, and passed with `readback qualification ok`;
  workflow YAML parsed with `yaml ok`; `git diff --check` passed. The final
  forced proof after this fix passed:
  `env -u CODEX_THREAD_ID
  SALTMARCHER_GRADLE_ISOLATION_ID=t4-ruleset-detail-fix-rerun
  tools/gradle/run-observable-gradle.sh --fail-fast check -- --rerun-tasks`.
  Retained log:
  `build/gradle-run-logs/20260713T005829240561482-pid1918958-check.log`.
  Literal result: `BUILD SUCCESSFUL in 26m 55s`,
  `74 actionable tasks: 74 executed`.
- Phase 1 re-review approved after the third rework with no Must Fix findings.
  Residual risks are the T4 publication-side done-when items: PR CI cache
  readbacks, build-wiring full rerun behavior, deleted files gone from `main`,
  live branch-protection enforcement readback, and one green nightly
  `--rerun-tasks` run.
- Phase 2 independent judge review approved the local patch readiness with no
  Must Fix findings. The same publication-side T4 done-when items remain
  pending and are not claimed complete.
- PR CI rehearsal found one T4 Must Fix before merge: PR #453's first green
  `check` job ran `xvfb-run -a tools/gradle/run-observable-gradle.sh check`
  and passed, but the retained CI log
  `https://github.com/ThonkTank/Salt-Marcher/actions/runs/29215001399/job/86709048926`
  ended with `BUILD SUCCESSFUL in 5m 8s`,
  `74 actionable tasks: 69 executed, 4 from cache, 1 up-to-date`. Because
  this PR touches build/CI/gate wiring, the T4 done-when requirement for a
  build-wiring PR to re-run everything was not met. The workflow now classifies
  changed paths before `check` and appends `-- --rerun-tasks` for build, CI,
  hook, frozen-surface, branch-protection-readback, status-issue, or judge
  wiring changes; if diff detection is unavailable, it fails closed to the
  same forced mode. Ordinary source-area PRs remain content-addressed so the
  area-touch cache-hit rehearsal is still meaningful.
  Post-rework proof: workflow YAML parsed and the embedded Bash decision block
  passed `bash -n`; a local simulation against `origin/main..HEAD` emitted
  `mode=forced-rerun-build-wiring` and `extra_args=-- --rerun-tasks`. The
  forced local proof
  `env -u CODEX_THREAD_ID
  SALTMARCHER_GRADLE_ISOLATION_ID=t4-build-wiring-rerun-mode
  tools/gradle/run-observable-gradle.sh --fail-fast check -- --rerun-tasks`
  passed. Retained log:
  `build/gradle-run-logs/20260713T023022422066492-pid1976223-check.log`.
  Literal result: `BUILD SUCCESSFUL in 26m 3s`,
  `74 actionable tasks: 74 executed`. Fresh Phase 1 and Phase 2 review are
  required because implementation changed after the prior approval.
- Fresh Phase 1 found two Must Fix items in the build-wiring classifier:
  root `gradle.properties` was not treated as build wiring, and merge-queue
  base-ref resolution failures would hard-fail the argument-decision step
  before writing the documented forced mode. Rework added `gradle.properties`
  to the forced-rerun classifier and changed merge-queue/push base-resolution
  failures to emit `forced-rerun-undetermined-diff` with
  `-- --rerun-tasks`. Post-fix syntax and whitespace proof passed:
  `git diff --check`, workflow YAML parse, and `bash -n` for the embedded
  decision block. Targeted simulations passed: current branch diff emitted
  `mode=forced-rerun-build-wiring`; a `gradle.properties`-only diff emitted
  `mode=forced-rerun-build-wiring`; a source-area-only diff emitted
  `mode=content-addressed` with empty `extra_args`; and a merge-group fetch
  failure emitted `mode=forced-rerun-undetermined-diff` with
  `extra_args=-- --rerun-tasks`.
  Final post-fix forced proof passed:
  `env -u CODEX_THREAD_ID
  SALTMARCHER_GRADLE_ISOLATION_ID=t4-build-wiring-classifier-fix
  tools/gradle/run-observable-gradle.sh --fail-fast check -- --rerun-tasks`.
  Retained log:
  `build/gradle-run-logs/20260713T030249254855537-pid1991545-check.log`.
  Literal result: `BUILD SUCCESSFUL in 26m 20s`,
  `74 actionable tasks: 74 executed`.
  Phase 1 re-review approved with no remaining Must Fix findings. Phase 2
  independent judge review approved with no Must Fix findings. Both reviews
  leave publication-side T4 done-when items pending: PR CI area-touch cache
  behavior, PR CI build-wiring full re-run, deleted files gone from `main`,
  live required-check enforcement readback, and one green nightly
  `--rerun-tasks` run.
  Local T4 rework commit:
  `d528d0b13 ci: force check for build wiring changes`. The versioned
  pre-commit gate accepted staged tree
  `14233a7733fb08b70e086ea97f515d578eb8dfaf`; retained log
  `build/pre-commit-gate/14233a7733fb08b70e086ea97f515d578eb8dfaf.log`
  ends with `BUILD SUCCESSFUL in 18m 30s`,
  `74 actionable tasks: 53 executed, 20 from cache, 1 up-to-date`.
  Ledger proof commit:
  `712ac4f87 docs: record t4 rework proof`. The versioned pre-commit gate
  accepted staged tree `1a1e1272cecc843d08ef1bce27e039e063e83b5e`;
  retained log
  `build/pre-commit-gate/1a1e1272cecc843d08ef1bce27e039e063e83b5e.log`
  ends with `BUILD SUCCESSFUL in 18m 50s`,
  `74 actionable tasks: 53 executed, 20 from cache, 1 up-to-date`.
- PR #453 merged at `2026-07-13T02:25:46Z` with merge commit
  `ea6e797d192517bc1fda4559ef1bde42c9d190f7`. The final build-wiring CI
  rehearsal ran on head `712ac4f8759258210ef50dbde90167872fffa0be`. Retained
  GitHub job:
  `https://github.com/ThonkTank/Salt-Marcher/actions/runs/29219089697/job/86720585022`.
  Literal CI result: the decision step emitted
  `mode=forced-rerun-build-wiring`; the Gradle command was
  `./gradlew check --console=plain --continue --rerun-tasks`; the job ended
  with `BUILD SUCCESSFUL in 5m 43s`,
  `74 actionable tasks: 73 executed, 1 up-to-date`. The single up-to-date task
  was `cleanSpotbugsMainEvidence`, a `Delete` cleanup task with no evidence
  files to delete. There were no `FROM-CACHE` tasks in the forced CI run.
  The required jobs `check`, `warden-freeze`, and `judge-review` were green;
  `nightly-rerun-tasks` was skipped for the PR event as expected.
- Branch protection readback before updating GitHub was `Not Qualified`:
  classic protection still required `behavior-gate`, `production-handoff`,
  `warden-freeze`, and `judge-review`. The classic branch-protection required
  checks were then updated to `check`, `warden-freeze`, and `judge-review`
  while keeping `strict=true`. The follow-up readback at
  `2026-07-13T02:26:06+00:00` returned `Qualified`; observed required checks
  are exactly `check`, `judge-review`, and `warden-freeze`.
- PR #455 merged at `2026-07-13T02:51:38Z` with merge commit
  `8aa8ed3503abdad37661092e26318aca269454e4`, recording the branch-protection
  readback and build-wiring CI evidence in this ledger and the July journal.
  A main readback after that merge confirmed
  `tools/quality/config/harness-map.json` and
  `tools/quality/scripts/select_harnesses.py` are absent from `main`.
- Area-touch CI rehearsal used PR #456 with a single no-op comment in
  `test/src/domain/worldplanner/WorldPlannerBackendHarness.java`, which belongs
  to the dedicated `worldPlannerBackendHarness` source set. The PR was not
  merged after evidence collection. Retained GitHub job:
  `https://github.com/ThonkTank/Salt-Marcher/actions/runs/29221196557/job/86726474910`.
  Literal CI result: the decision step emitted `mode=content-addressed`; the
  Gradle command was `./gradlew check --console=plain --continue`; the job
  ended with `BUILD SUCCESSFUL in 34s`,
  `74 actionable tasks: 24 executed, 49 from cache, 1 up-to-date`.
  The touched-area tasks
  `compileWorldPlannerBackendHarnessJava`, `worldPlannerBackendHarness`, and
  adjacent same-source-set `worldPlannerEncounterHarness` executed, while
  unrelated harnesses such as catalog, dungeon editor, hex, party, session
  planner, smoke startup, World Planner UI, and search-filter harnesses restored
  from the CI cache. Required jobs `check`, `warden-freeze`, and
  `judge-review` were green; `nightly-rerun-tasks` was skipped for the PR event
  as expected.
- No scheduled `quality-platforms` run existed as of `2026-07-13T03:18:28Z`;
  the first real Nightly proof can only close T4 after a scheduled
  `nightly-rerun-tasks` job runs green on the merged workflow.
- Local T4 implementation commit:
  `4946450b3 ci: replace behavior gate with check`. The versioned
  pre-commit gate accepted staged tree
  `74a6b458517fc6492390892c2e6aeb0f05ff2378`; retained log
  `build/pre-commit-gate/74a6b458517fc6492390892c2e6aeb0f05ff2378.log`
  ends with `BUILD SUCCESSFUL in 18m 37s`,
  `74 actionable tasks: 53 executed, 20 from cache, 1 up-to-date`.
