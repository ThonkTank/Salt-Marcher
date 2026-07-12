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
