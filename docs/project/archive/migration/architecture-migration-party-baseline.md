Status: Active
Owner: SaltMarcher Team
Last Reviewed: 2026-07-10
Source of Truth: M3.2 diagnostic baseline metrics for the Party architecture
migration area before target design.

# Party Migration Baseline

## Purpose

This document records the M3.2 baseline metrics for the Party area before any
target design, wiring port, or implementation. The numbers are diagnostic:
they define the baseline for the later M3 conformance review, but they do not
approve a design or prescribe implementation.

## Scope

The roadmap's `party (141 files)` count is reproducible only with these roots:

- `src/domain/party`
- `src/view/dropdowns/party`
- `src/data/party`

The migration-owned product subset is `src/domain/party` plus
`src/view/dropdowns/party` with 119 Java files. The 22 `src/data/party` files
are counted because they make the roadmap number reproducible, but the ledger's
data-layer exclusion still applies: data code is not a normal per-area
migration target unless the approved Party design requires a gateway signature
adaptation.

Adjacent Hex, Dungeon, Encounter, and Session Planner files consume Party
published seams or command boundaries and remain outside the 141-file baseline.
The Party dropdown requirements define the main shell UI surface and require
the top-bar contribution route, party application service mutations, and
downstream runtime refresh behavior (`docs/party/requirements/requirements-party-dropdown.md:11`,
`docs/party/requirements/requirements-party-dropdown.md:43`,
`docs/party/requirements/requirements-party-dropdown.md:52`).

## Reproduction

File count:

```bash
find src/domain/party src/view/dropdowns/party src/data/party \
  -type f -name '*.java' | wc -l
# 141
```

Line count:

```bash
find src/domain/party src/view/dropdowns/party src/data/party \
  -type f -name '*.java' -print0 | sort -z | xargs -0 wc -l
# 7998 total
```

LOC means physical Java file lines from `wc -l`, including blank lines and
comments. Secondary nonblank count from the same file set is 6,859 lines.

## File And LOC Baseline

| Root | Files | Physical LOC | Nonblank LOC | Migration ownership |
| --- | ---: | ---: | ---: | --- |
| `src/domain/party` | 106 | 4,347 | 3,683 | Product structure |
| `src/view/dropdowns/party` | 13 | 2,434 | 2,129 | Product structure |
| `src/data/party` | 22 | 1,217 | 1,047 | Counted separately; not a normal migration target |
| Product subset | 119 | 6,781 | 5,812 | Main M3 design surface |
| Full roadmap set | 141 | 7,998 | 6,859 | M3 measurement denominator |

## Intent-To-Mutation Chains

Counting rule: count meaningful class-boundary hops from user or foreign-area
intent source to first Party-owned domain or durable mutation. Command/value
record construction and same-class private helpers are not counted.
Persistence internals and published readback tails are recorded separately
when they materially lengthen the path.

| Interaction | Baseline chain | Hop count | Evidence |
| --- | --- | ---: | --- |
| Create character from Party dropdown | `PartyEditorTopBarView.publish` -> `PartyTopBarIntentHandler.createCharacter` -> `PartyApplicationService.createCharacter` -> `CreateCharacterUseCase.execute` -> `PartyRoster.createCharacter` / `repository.save` | 5 | `src/view/dropdowns/party/PartyEditorTopBarView.java:113`, `src/view/dropdowns/party/PartyTopBarIntentHandler.java:274-285`, `src/domain/party/PartyApplicationService.java:61-69`, `src/domain/party/model/roster/usecase/CreateCharacterUseCase.java:31-56`, `src/domain/party/model/roster/PartyRoster.java:28-34` |
| Move member between active and reserve | `PartyRosterTopBarView.publishRemoveRequested/publishAddExistingRequested` -> `PartyTopBarIntentHandler.changeMembership` -> `PartyApplicationService.setMembership` -> `SetPartyMembershipUseCase.execute` -> `PartyRoster.setMembership` / `repository.save` | 5 | `src/view/dropdowns/party/PartyRosterTopBarView.java:328-350`, `src/view/dropdowns/party/PartyTopBarIntentHandler.java:148-158`, `src/domain/party/PartyApplicationService.java:85-89`, `src/domain/party/model/roster/usecase/SetPartyMembershipUseCase.java:29-47`, `src/domain/party/model/roster/PartyRoster.java:52-60` |
| XP correction from active member row | `PartyRosterTopBarView.publishXp` -> `PartyTopBarIntentHandler.adjustXp` -> `PartyApplicationService.adjustXp` -> `AdjustPartyXpUseCase.execute` -> `PartyRoster.adjustXp` -> `PartyCharacter.withAdjustedXp` / `PartyCharacterProgress.adjustXp` | 5 to roster mutation; 6 including character progress replacement | `src/view/dropdowns/party/PartyRosterTopBarView.java:193-203`, `src/view/dropdowns/party/PartyRosterTopBarView.java:336-350`, `src/view/dropdowns/party/PartyTopBarIntentHandler.java:161-178`, `src/domain/party/PartyApplicationService.java:97-101`, `src/domain/party/model/roster/usecase/AdjustPartyXpUseCase.java:29-42`, `src/domain/party/model/roster/PartyRoster.java:75-91`, `src/domain/party/model/roster/PartyCharacter.java:70` |
| Party rest action | `PartyRosterTopBarView.publishShortRestRequested/publishLongRestRequested` -> `PartyTopBarIntentHandler.performRest` -> `PartyApplicationService.performRest` -> `PerformPartyRestUseCase.execute` -> `PartyRoster.performRest` -> active `PartyCharacter.withRest` | 5 to roster mutation; 6 including character rest-state replacement | `src/view/dropdowns/party/PartyRosterTopBarView.java:78-79`, `src/view/dropdowns/party/PartyRosterTopBarView.java:309-315`, `src/view/dropdowns/party/PartyTopBarIntentHandler.java:140-185`, `src/domain/party/PartyApplicationService.java:103-104`, `src/domain/party/model/roster/usecase/PerformPartyRestUseCase.java:31-46`, `src/domain/party/model/roster/PartyRoster.java:95-99`, `src/domain/party/model/roster/PartyCharacter.java:74` |
| Move party travel position from foreign surface | Hex or Dungeon travel route -> `PartyApplicationService.moveCharacters` -> `MovePartyCharactersUseCase.execute` -> `TravelTarget.toLocation` -> `PartyRoster.moveCharacters` / `repository.save` | 4 Party-owned hops; longer cross-area path before Party boundary | `src/domain/hex/HexTravelApplicationService.java:54-66`, `src/domain/dungeon/DungeonTravelPartyPositionServiceAssembly.java:50-73`, `src/domain/party/PartyApplicationService.java:107-135`, `src/domain/party/model/roster/usecase/MovePartyCharactersUseCase.java:26-50`, `src/domain/party/model/roster/usecase/MovePartyCharactersUseCase.java:83-103`, `src/domain/party/model/roster/PartyRoster.java:103-123` |
| Adventuring-day calculation publication | `PartyApplicationService.calculateAdventuringDay` -> `CalculateAdventuringDayUseCase.publish` -> `PartyPublishedStateServiceAssembly.publishAdventuringDayCalculation` -> `PartyPublishedReadbackServiceAssembly.readAdventuringDayCalculationResult` -> `CalculateAdventuringDayUseCase.execute` -> `PartyPublishedModelChannelServiceAssembly.publish` | 6 to published calculation state | `src/domain/party/PartyApplicationService.java:138-142`, `src/domain/party/model/roster/usecase/CalculateAdventuringDayUseCase.java:28-37`, `src/domain/party/PartyPublishedStateServiceAssembly.java:53-61`, `src/domain/party/PartyPublishedReadbackServiceAssembly.java:84-88`, `src/domain/party/PartyPublishedModelChannelServiceAssembly.java:23-30` |

The dominant Party dropdown user-action baseline is 5 meaningful hops to the
first roster mutation. XP and rest routes become 6 hops when the nested
character progress or rest-state replacement is counted separately. Travel
position writes are a public Party seam consumed by Hex and Dungeon; their
Party-owned portion is shorter than the full cross-area route, and the M3
target design must keep the foreign published/command seams byte-compatible.

If a review counts durable SQLite row mutation instead of the domain/repository
mutation, successful saves add `SqlitePartyRosterRepository`,
`AbstractPartyRosterRepository`, `SqlitePartyLocalGateway`, the mapper, and the
concrete SQLite stores before the SQL statement. If a review counts published
readback mutation, successful roster mutations add
`PartyPublishedStateServiceAssembly.publishRepositoryBackedState`, the
readback service, projection assemblies, and `PartyPublishedModelChannelServiceAssembly.publish`.

## Forwarding-Only Baseline

Forwarding-only means a concrete class whose production behavior is primarily
unpacking, delegating, or proxying to another object without owning meaningful
decision logic. Interfaces are noted as seam overhead but not counted as
forwarding-only classes.

| Class | Baseline classification | Evidence |
| --- | --- | --- |
| `src/domain/party/PartyApplicationService.java` | Forwarding-only candidate | Public methods mostly unpack command records and delegate to per-verb use cases (`src/domain/party/PartyApplicationService.java:61-142`). |
| `src/domain/party/PartyServiceContribution.java` | Register-only composition candidate | `register` creates one assembly and registers factories that delegate to assembly methods (`src/domain/party/PartyServiceContribution.java:16-25`). |
| `src/domain/party/PartyServiceAssembly.java` | Composition/pass-through candidate | Creates `PartyApplicationService` from per-verb use cases and returns published models from shared state assembly (`src/domain/party/PartyServiceAssembly.java:31-83`). |
| `src/domain/party/published/PartySnapshotModel.java` | Published seam proxy | `current()` and `subscribe()` proxy supplied functions with a storage-error default (`src/domain/party/published/PartySnapshotModel.java:26-35`). |
| `src/domain/party/published/ActivePartyModel.java` | Published seam proxy | `current()` and `subscribe()` proxy supplied functions with a storage-error default (`src/domain/party/published/ActivePartyModel.java:25-30`). |
| `src/domain/party/published/ActivePartyCompositionModel.java` | Published seam proxy | `current()` and `subscribe()` proxy supplied functions with a storage-error default (`src/domain/party/published/ActivePartyCompositionModel.java:28-33`). |
| `src/domain/party/published/AdventuringDaySummaryModel.java` | Published seam proxy | `current()` and `subscribe()` proxy supplied functions with a storage-error default (`src/domain/party/published/AdventuringDaySummaryModel.java:26-35`). |
| `src/domain/party/published/PartyTravelPositionsModel.java` | Published seam proxy | `current()` and `subscribe()` proxy supplied functions with a storage-error default (`src/domain/party/published/PartyTravelPositionsModel.java:25-30`). |
| `src/domain/party/published/PartyMutationModel.java` | Published seam proxy | `current()` and `subscribe()` proxy supplied functions with a success default (`src/domain/party/published/PartyMutationModel.java:25-30`). |
| `src/domain/party/published/AdventuringDayCalculationModel.java` | Published seam proxy | `current()` and `subscribe()` proxy supplied functions with a storage-error default (`src/domain/party/published/AdventuringDayCalculationModel.java:30-35`). |
| `src/data/party/PartyServiceContribution.java` | Data-layer forwarding candidate, counted separately | `register` only registers `SqlitePartyRosterRepository` as `PartyRosterRepository` (`src/data/party/PartyServiceContribution.java:14-15`). |
| `src/data/party/repository/SqlitePartyRosterRepository.java` | Data-layer gateway wrapper candidate, counted separately | Constructor wraps `SqlitePartyLocalGateway` load/save into the abstract repository (`src/data/party/repository/SqlitePartyRosterRepository.java:8-16`). |

Baseline count: 10 product/published forwarding or proxy candidates plus 2
data-layer candidates counted separately.

Seam overhead to account for in the design, but not counted as concrete
forwarding-only classes: `PartyRosterRepository` is the storage seam,
`PartyPublishedStateRepository` is the internal publication seam, and
`PartyEncounterSessionRepository` is the encounter refresh seam. The generic
`PartyPublishedModelChannelServiceAssembly` owns state and listener fanout, so
it is not a pure proxy despite its small size. `AbstractPartyRosterRepository`
owns record/domain mapping around the gateway and is therefore data adapter
overhead rather than pure forwarding.

## String Boundary Round-Trips

String round-trip means a typed, finite-domain, or selected reference value is
carried as a String across an internal Party boundary and later parsed,
normalized, or matched back into the same finite-domain meaning. Free-form
user text fields, localized visible labels, and persistence text columns do
not count.

| Family | Baseline round-trip | Evidence |
| --- | --- | --- |
| Membership state | The view handler uses public `MembershipState`, `SetPartyMembershipCommand` and `CreateCharacterCommand` expose `membershipName()` as String, `PartyApplicationService` passes that String, and the use cases convert it through `PartyMembership.valueOf`. | `src/view/dropdowns/party/PartyTopBarIntentHandler.java:148-158`, `src/domain/party/published/SetPartyMembershipCommand.java:5-6`, `src/domain/party/published/CreateCharacterCommand.java:27-28`, `src/domain/party/PartyApplicationService.java:68`, `src/domain/party/PartyApplicationService.java:88`, `src/domain/party/model/roster/usecase/CreateCharacterUseCase.java:37-41`, `src/domain/party/model/roster/usecase/SetPartyMembershipUseCase.java:29-31` |
| Rest type | The view handler uses public `RestType`, `PerformPartyRestCommand.restTypeName()` returns String, `PartyApplicationService` passes that String, and `PerformPartyRestUseCase` maps the String to `PartyRestType`. | `src/view/dropdowns/party/PartyTopBarIntentHandler.java:140-185`, `src/domain/party/published/PerformPartyRestCommand.java:5-6`, `src/domain/party/PartyApplicationService.java:103-104`, `src/domain/party/model/roster/usecase/PerformPartyRestUseCase.java:31-61` |
| Dungeon travel kind and heading command seam | `PartyDungeonTravelLocationSnapshot` exposes location kind and heading names as Strings, `PartyApplicationService` copies those into `MovePartyCharactersUseCase.TravelTarget`, and `PartyTravelLocation.dungeon` converts the names with `PartyDungeonTravelLocationKind.valueOf` and `PartyTravelHeading.valueOf`. | `src/domain/party/published/PartyDungeonTravelLocationSnapshot.java:23-49`, `src/domain/party/PartyApplicationService.java:107-135`, `src/domain/party/model/roster/usecase/MovePartyCharactersUseCase.java:83-103`, `src/domain/party/model/roster/PartyTravelLocation.java:48-60` |
| Travel readback enum projection | Domain travel location kind and heading are projected to public travel enums through `.name()` plus `valueOf`, then foreign Hex/Dungeon surfaces can feed those public snapshots back through the move command seam. | `src/domain/party/PartyTravelProjectionServiceAssembly.java:62-68`, `src/domain/hex/HexTravelApplicationService.java:54-66`, `src/domain/dungeon/DungeonTravelPartyPositionServiceAssembly.java:50-73` |

Baseline count: 4 product String boundary families. Character name/player name
fields and reserve search text are user text and are not finite-domain
round-trips. Editor level, passive perception, and AC are raw user input parsed
at the view/intent boundary (`src/view/dropdowns/party/PartyTopBarIntentHandler.java:362-385`);
they are not counted as internal finite-domain round-trips. Null-default enum
literal conversions inside published records or projection defaults are not
counted because no typed boundary value is carried out as String and parsed
back (`src/domain/party/published/RestCadenceStatus.java:13-14`,
`src/domain/party/published/AdventuringDayProgressEvent.java:13`,
`src/domain/party/PartyAdventuringDayProjectionServiceAssembly.java:77-79`).
Data-layer serialization of membership, dungeon travel kind, and heading is
counted separately because `src/data/**` remains outside normal per-area
migration.

## Residual Notes For Design

- The M3 Party target design must use the 119-file product subset as its normal
  structural surface and explicitly name any data-layer gateway signature
  adaptation if one is required.
- Published seams consumed by Hex travel, Dungeon travel, Encounter,
  Session Planner, the Party dropdown, Adventuring Day dropdown, and shell
  surfaces remain byte-compatible unless both sides are migrated in the same
  approved design.
- The M3.1 harness closure makes `partyDropdownHarness` the frozen
  shell-bound Party dropdown parity oracle before any wiring or implementation
  work. Its scenario covers empty roster, create, active/reserve transitions,
  published active-party readback, and trigger-label readback.
- M3.2 does not authorize a wiring port or implementation. The next step is a
  judge-approved Party target design with target classes, representative call
  chains, deletion list, seam statement, and untouched-list.
