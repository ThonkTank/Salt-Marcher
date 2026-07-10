Status: Active
Owner: SaltMarcher Team
Last Reviewed: 2026-07-10
Source of Truth: July 2026 harness-gap closure journal entries.
Entry Document: [July 2026 Journal](2026-07.md)

# July 2026 Harness Gap Journal

## 2026-07-06 encounter-state-tab-harness-gap - Close Encounter state-tab harness gap

Problem: `docs/project/verification/harness-gaps.md` listed
`src/view/statetabs/encounter` as P1 because only the domain-side
`worldPlannerEncounterHarness` covered Encounter-adjacent behavior.
Target state: add a focused `encounterStateTabHarness` that opens the Encounter
state tab through the shell binding and proves saved encounter readback renders
through the contribution/view route.
Scope boundary: this pass changes only the harness, harness registration,
harness map, gap register, and journal; it does not alter visible Encounter
behavior or persistence.

## 2026-07-06 party-dropdown-harness-gap - Close Party dropdown harness gap

Problem: `docs/project/verification/harness-gaps.md` listed
`src/domain/party` and `src/view/dropdowns/party` as P1 because no dedicated
Party behavior harness covered dropdown-driven active-party publication.
Target state: add a focused `partyDropdownHarness` that creates a character
through the Party top-bar intent route, moves it between active and reserve
membership through production `PartyApplicationService`, and verifies
`PartySnapshotModel`, `ActivePartyModel`, active composition, and top-bar
projection readback.
Scope boundary: this pass changes only the harness, harness registration,
harness map, gap register, and journal; it does not alter visible Party
behavior or persistence.

## 2026-07-07 encountertable-gap-contract - Correct EncounterTable gap scope

Problem: the EncounterTable harness-gap row asked for table creation and row
persistence, but the active EncounterTable domain model says authored rows are
external SQLite input and the application does not own runtime mutation flows.
Target state: the open gap now asks for a dedicated readback harness over the
actual public boundary: authored summary lookup, weighted candidate lookup,
empty selection, XP ceiling, and storage-error publication.
Scope boundary: this pass changes only the gap contract and journal evidence;
it does not close the gap or add new behavior.

## 2026-07-10 sessionplanner-production-route-gap - Close Session Planner timeline route gap

Problem: the Session Planner M3.1 harness review found that
`sessionPlannerCatalogHarness` covered catalog CRUD and the blank-scene route
through `SessionPlannerContribution`, but some timeline, loot, and draft
oracles were direct model/view fixtures. That overstated production-route
coverage before the Session Planner migration baseline.
Target state: extend `sessionPlannerCatalogHarness` against the old structure
so rendered Session Planner controls drive `SessionPlannerContribution` ->
`SessionPlannerBinder` -> `SessionPlannerIntentHandler` -> Session Planner
application services, with assertions through the published Session Planner
models for saved encounter attach, scene save/select/move/allocation/remove,
rest set/clear, loot add/remove, participant add/remove, encounter-days, and
catalog CRUD.
Scope boundary: this pass changes only the Session Planner harness and
migration status documentation. Stable fixture data is limited to foreign
Encounter published seams; Party and World Planner setup uses their real
application services. No visible Session Planner behavior or production code
changes.

## 2026-07-10 encountertable-readback-harness-gap - Close EncounterTable readback gap

Problem: `docs/project/verification/harness-gaps.md` listed
`src/domain/encountertable` as P2 because no dedicated harness proved the
Encounter Table public readback route.
Target state: add focused `encounterTableReadbackHarness` coverage over the old
structure. The harness seeds authored SQLite table rows in an isolated
`XDG_DATA_HOME`, drives `EncounterTableApplicationService`, and asserts
published `EncounterTableCatalogModel` / `EncounterTableCandidatesModel`
readback for authored summaries, weighted candidates, empty selection,
XP-ceiling handling, and storage-error publication.
Scope boundary: this pass changes only the harness, harness registration,
harness map, gap register, journal, and migration status documentation. It
does not add Encounter Table mutation behavior or change production code.

## 2026-07-10 encounter-state-tab-production-route-gap - Close Encounter state-tab production route

Problem: the M3 Encounter review found the existing `encounterStateTabHarness`
still published a harness-created `MutableEncounterStateFeed` snapshot with
no-op Encounter services. That proved render text, but not the production
Encounter publication route into the state tab.
Target state: `encounterStateTabHarness` binds the real Encounter state tab,
seeds old-route Party and Encounter persistence in an isolated `XDG_DATA_HOME`,
opens a saved plan through `EncounterApplicationService.applyState`, and
asserts readback through the real published `EncounterStateModel`.
Scope boundary: this pass changes only harness wiring/fixture setup,
Gradle data isolation, gap register, journal, and migration status
documentation. No Encounter production implementation changes before design.
The visible `100 XP` assertion records the old production `xp * count`
projection for two 50-XP goblins, replacing the earlier fake-snapshot value.
