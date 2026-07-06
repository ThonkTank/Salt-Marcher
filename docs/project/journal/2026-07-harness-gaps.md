Status: Active
Owner: SaltMarcher Team
Last Reviewed: 2026-07-07
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
