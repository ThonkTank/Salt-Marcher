Status: Active
Owner: SaltMarcher Team
Last Reviewed: 2026-07-10
Source of Truth: M3.3 target design for the Party architecture migration area
before any wiring-port or implementation commit.

# Party Migration Target Design

## Scope

This design covers the M3 Party product surface:

- `src/domain/party`
- `src/view/dropdowns/party`

The baseline surface is 119 product Java files and 6,781 physical LOC; the
full reproducible Party count is 141 Java files and 7,998 LOC when
`src/data/party` is included
(`docs/project/architecture/architecture-migration-party-baseline.md:55`).
Data-layer code remains outside the normal M3 migration surface unless a
gateway signature adaptation is explicitly named by this design. No such data
gateway adaptation is part of this design.

This design is the step-3 artifact required by the roadmap. It does not permit
implementation or harness scenario/assertion changes. The M3.4 wiring-port
step may only update harness or construction references if implementation
would otherwise delete a class imported by the frozen harness inventory.

## Non-Negotiable Constraints

- Behavior parity is absolute. Any visible behavior change in a migration pass
  is a defect. Pre-existing bugs are preserved and filed as separate R2 issues.
- No questions to the owner. Never wait on the owner; the acceptance window
  never blocks the pipeline. Decide yourself, journal the reasoning.
- No security analysis. No pause/throttle/stop mechanisms. Git history plus
  revert is the safety model.
- Harness scenarios and assertions are frozen; only wiring may be ported, in a
  separate prior commit.

## Current Defect

The Party roster model is not the defect. `PartyRoster` owns character
creation, membership, XP correction, rest transitions, and travel-position
mutation (`src/domain/party/model/roster/PartyRoster.java:28`,
`src/domain/party/model/roster/PartyRoster.java:52`,
`src/domain/party/model/roster/PartyRoster.java:75`,
`src/domain/party/model/roster/PartyRoster.java:95`,
`src/domain/party/model/roster/PartyRoster.java:103`).

The defect is the ceremony around that model. User and foreign-area actions
currently pass through `PartyTopBarIntentHandler`, forwarding service methods,
per-verb use cases, an internal published-state repository, readback
assemblies, channel assemblies, and proxy published models before observable
publication. The baseline measured dominant Party dropdown chains at 5 hops to
first roster mutation and 6 including nested character replacement; it also
found 10 product/published forwarding or proxy candidates plus 4 product String
boundary families
(`docs/project/architecture/architecture-migration-party-baseline.md:72`,
`docs/project/architecture/architecture-migration-party-baseline.md:114`,
`docs/project/architecture/architecture-migration-party-baseline.md:144`).

## Target Class List

| Class | Target responsibility |
| --- | --- |
| `src.domain.party.PartyServiceContribution` | Keep the byte-compatible service-registry entrypoint for `PartyApplicationService` and the seven published Party models. |
| `src.domain.party.PartyServiceAssembly` | Be the single Party composition root for `PartyRosterRepository`, stateful published models, and `PartyApplicationService`, following the pilot reference assembly shape. |
| `src.domain.party.PartyApplicationService` | Keep all current public command method descriptors while directly owning command normalization, roster load/save mutation flows, storage-error handling, published model refresh, mutation result publication, travel target conversion, and adventuring-day calculation publication. |
| `src.domain.party.PartyPublishedProjection` | New package-private mapper for roster snapshots, active-party readbacks, travel readbacks, mutation statuses, adventuring-day summary, and adventuring-day calculation results. |
| `src.domain.party.published.PartySnapshotModel` | Become a stateful published model that owns current snapshot/listeners while preserving `current()`, `subscribe(...)`, and the existing compatibility constructor. |
| `src.domain.party.published.ActivePartyModel` | Become a stateful published model for active-party ids while preserving `current()`, `subscribe(...)`, and the existing compatibility constructor. |
| `src.domain.party.published.ActivePartyCompositionModel` | Become a stateful published model for active-party composition while preserving `current()`, `subscribe(...)`, and the existing compatibility constructor. |
| `src.domain.party.published.AdventuringDaySummaryModel` | Become a stateful published model for rest-budget summary while preserving `current()`, `subscribe(...)`, and the existing compatibility constructor. |
| `src.domain.party.published.PartyTravelPositionsModel` | Become a stateful published model for character travel positions and party-token location while preserving `current()`, `subscribe(...)`, and the existing compatibility constructor. |
| `src.domain.party.published.PartyMutationModel` | Become a stateful published mutation-result model while preserving `current()`, `subscribe(...)`, and the existing compatibility constructor. |
| `src.domain.party.published.AdventuringDayCalculationModel` | Become a stateful published model for calculated adventuring-day plans/progress while preserving `current()`, `subscribe(...)`, and the existing compatibility constructor. |
| `src.domain.party.model.roster.repository.PartyRosterRepository` | Stay the unchanged data gateway seam for `src/data/party.repository.SqlitePartyRosterRepository`. |
| `src.domain.party.model.roster.PartyRoster` | Stay the aggregate for party character collection, membership, XP/rest mutation, travel mutation, next id, and projection access. |
| `src.domain.party.model.roster.PartyCharacter` and roster value types | Stay the authored character, identity, progress, combat, membership, rest, travel, and adventuring-day value model used by domain and data code. |
| `src.domain.party.model.roster.helper.AdventuringDayProgressCalculationHelper` | Stay the adventuring-day progress calculator used by `PartyApplicationService` through `PartyPublishedProjection`. |
| `src/domain/party/published/**` command, result, snapshot, enum, and carrier records | Stay byte-compatible public Party surfaces consumed by Party dropdown, Adventuring Day dropdown, Hex travel, Dungeon travel, Encounter, Session Planner, harnesses, and future migrated areas. |
| `src.view.dropdowns.party.PartyTopBarContribution` | Keep the shell contribution id/title and `ShellSlot.TOP_BAR` binding semantics. |
| `src.view.dropdowns.party.PartyTopBarBinder` | Stay the top-bar composition point for services, stateful models, dropdown popup, views, subscriptions, and direct callbacks without becoming a forwarding controller. |
| `src.view.dropdowns.party.PartyTopBarViewModel` | New single typed view model replacing the contribution/content-model stack; owns trigger text, roster/editor panel projections, reserve-search state, draft validation, mutation in-flight state, and stable callback preparation. |
| `src.view.dropdowns.party.PartyTopBarVocabulary` | New view vocabulary for visible German labels, status messages, rest/membership actions, and enum-to-label mapping; display labels are not parsed as state. |
| `src.view.dropdowns.party.PartyTopBarView`, `PartyRosterTopBarView`, `PartyEditorTopBarView` | Keep the JavaFX views while binding to `PartyTopBarViewModel` projections and emitting direct typed callbacks wired by `PartyTopBarBinder`. |

## Target Call Chains

Counting rule: count named production class boundaries from user or foreign
intent source to first Party-owned domain or durable mutation. `PartyTopBarBinder`
callback registration and `PartyTopBarViewModel` local projection/validation are
view wiring, not command-forwarding controllers.

| Interaction | Target chain | Target |
| --- | --- | --- |
| Create character from dropdown | `PartyEditorTopBarView` submit action -> `PartyApplicationService.createCharacter` -> `PartyRoster.createCharacter` / `PartyRosterRepository.save` / stateful model refresh | 3 hops to roster/repository mutation and published readback. |
| Move member between active and reserve | `PartyRosterTopBarView` add/remove action -> `PartyApplicationService.setMembership` -> `PartyRoster.setMembership` / `PartyRosterRepository.save` / stateful model refresh | 3 hops to roster/repository mutation and published readback. |
| XP correction or rest action | `PartyRosterTopBarView` XP/rest action -> `PartyApplicationService.adjustXp` or `performRest` -> `PartyRoster.adjustXp` or `performRest` / `PartyRosterRepository.save` / stateful model refresh | 3 hops to roster/repository mutation and published readback. |
| Move travel position from Hex or Dungeon | `HexTravelApplicationService` or `DungeonTravelPartyPositionServiceAssembly` -> `PartyApplicationService.moveCharacters` -> `PartyRoster.moveCharacters` / `PartyRosterRepository.save` / `PartyTravelPositionsModel.publish` | 2 Party-owned hops after the foreign seam; typed snapshot components are used internally. |
| Adventuring-day calculation | Adventuring Day dropdown or Session Planner -> `PartyApplicationService.calculateAdventuringDay` -> `AdventuringDayProgressCalculationHelper.compute` / `PartyAdventuringDayPlan.forLevels` -> `PartyPublishedProjection.mapAdventuringDayCalculationResult` -> `AdventuringDayCalculationModel.publish` | 4 Party-owned class boundaries; design exception because the retained helper owns pure domain calculation and is not a forwarding hop. |

The Party dropdown remains the only M3 Party UI migration surface. Encounter,
Session Planner, Hex travel, Dungeon travel, and Adventuring Day stay foreign
consumers of the byte-compatible Party API and models.

## Frozen Parity Inventory

The selected M3 Party parity task is:

- `./gradlew partyDropdownHarness --console=plain`

The frozen scenario and assertion inventory is the union below. M3.4 and M3.5
may port wiring references only if needed, but MUST NOT add, remove, rename,
split, merge, weaken, or reinterpret these scenarios or their pass/fail
oracles.

| Harness evidence | Frozen scenario/assertion families |
| --- | --- |
| `test/src/view/dropdowns/party/PartyDropdownHarness.java:50-71`; `test/src/view/dropdowns/party/PartyDropdownHarness.java:103-107` | Service registry setup through data and domain `PartyServiceContribution`, shell binding through `PartyTopBarContribution`, `ShellSlot.TOP_BAR`, initial trigger readback, trigger accessible text, popup root discovery, and empty roster rendering. |
| `test/src/view/dropdowns/party/PartyDropdownHarness.java:73-88` | Rendered create-character flow through visible form controls, created name `Aria`, active roster count, active-party publication, active-composition publication, and top-bar trigger readback. |
| `test/src/view/dropdowns/party/PartyDropdownHarness.java:90-100` | Rendered remove-to-reserve flow, reserve-add flow, active/reserve counts, active-party publication after each transition, active-composition levels, and restored trigger readback. |
| `test/src/view/dropdowns/party/PartyDropdownHarness.java:117-142` | Visible roster-count oracles, no storage-error text, `ReadStatus.SUCCESS` for active-party and active-composition published readbacks, and exact active ids/levels. |
| `tools/quality/config/harness-map.json:65`; `tools/quality/config/harness-map.json:67`; `tools/quality/config/harness-map.json:68`; `build.gradle.kts:589`; `build.gradle.kts:597` | `src/data/party/**`, `src/domain/party/**`, and `src/view/dropdowns/party/**` route to `partyDropdownHarness`; the task main class is `src.view.dropdowns.party.PartyDropdownHarness`. |
| `docs/project/architecture/migration-ledger.md:101` | M3.1 recorded the old-structure proof: `compileTestJava`, `partyDropdownHarness`, harness map/topology, focused handoff, and diff checks were green after the shell-bound route closure. |

## Deletion List

The implementation step is incomplete until these classes no longer exist:

- `src/domain/party/PartyAdventuringDayProgressProjectionServiceAssembly.java`
- `src/domain/party/PartyAdventuringDayProjectionServiceAssembly.java`
- `src/domain/party/PartyMutationProjectionServiceAssembly.java`
- `src/domain/party/PartyPublishedModelChannelServiceAssembly.java`
- `src/domain/party/PartyPublishedModelsServiceAssembly.java`
- `src/domain/party/PartyPublishedReadbackServiceAssembly.java`
- `src/domain/party/PartyPublishedStateServiceAssembly.java`
- `src/domain/party/PartyRosterPublishedModelsServiceAssembly.java`
- `src/domain/party/PartySnapshotProjectionServiceAssembly.java`
- `src/domain/party/PartyTravelProjectionServiceAssembly.java`
- `src/domain/party/model/roster/repository/PartyEncounterSessionRepository.java`
- `src/domain/party/model/roster/repository/PartyPublishedStateRepository.java`
- `src/domain/party/model/roster/usecase/AdjustPartyXpUseCase.java`
- `src/domain/party/model/roster/usecase/AwardPartyXpUseCase.java`
- `src/domain/party/model/roster/usecase/CalculateAdventuringDayUseCase.java`
- `src/domain/party/model/roster/usecase/CreateCharacterUseCase.java`
- `src/domain/party/model/roster/usecase/DeleteCharacterUseCase.java`
- `src/domain/party/model/roster/usecase/LoadActivePartyCompositionUseCase.java`
- `src/domain/party/model/roster/usecase/LoadActivePartyUseCase.java`
- `src/domain/party/model/roster/usecase/LoadAdventuringDaySummaryUseCase.java`
- `src/domain/party/model/roster/usecase/LoadPartySnapshotUseCase.java`
- `src/domain/party/model/roster/usecase/LoadPartyTravelPositionsUseCase.java`
- `src/domain/party/model/roster/usecase/MovePartyCharactersUseCase.java`
- `src/domain/party/model/roster/usecase/PerformPartyRestUseCase.java`
- `src/domain/party/model/roster/usecase/SetPartyMembershipUseCase.java`
- `src/domain/party/model/roster/usecase/UpdateCharacterUseCase.java`
- `src/view/dropdowns/party/PartyEditorTopBarContentModel.java`
- `src/view/dropdowns/party/PartyEditorTopBarViewInputEvent.java`
- `src/view/dropdowns/party/PartyRosterTopBarContentModel.java`
- `src/view/dropdowns/party/PartyRosterTopBarViewInputEvent.java`
- `src/view/dropdowns/party/PartyTopBarContentModel.java`
- `src/view/dropdowns/party/PartyTopBarContributionModel.java`
- `src/view/dropdowns/party/PartyTopBarIntentHandler.java`
- `src/view/dropdowns/party/PartyTopBarViewInputEvent.java`

`src/domain/party/model/roster/usecase/` must be empty or gone after
implementation. Deleting comments, compressing code, or merely renaming these
classes without executing the list is not migration.

## Seam Statement

These surfaces stay byte-compatible in M3 until their consumer sides migrate:

- `src.domain.party.PartyApplicationService`: class name, package, public
  method names, and published command parameter types.
- `src.domain.party.PartyServiceContribution`: service-registry registration
  of `PartyApplicationService`, `PartySnapshotModel`, `ActivePartyModel`,
  `ActivePartyCompositionModel`, `AdventuringDaySummaryModel`,
  `PartyTravelPositionsModel`, `PartyMutationModel`, and
  `AdventuringDayCalculationModel`.
- The seven published model classes: `PartySnapshotModel`, `ActivePartyModel`,
  `ActivePartyCompositionModel`, `AdventuringDaySummaryModel`,
  `PartyTravelPositionsModel`, `PartyMutationModel`, and
  `AdventuringDayCalculationModel` keep class/package names, service-registry
  keys, `current()`, `subscribe(Consumer<...>)`, existing constructor
  signatures, null/default behavior, listener delivery, and readback result
  semantics.
- Every record, enum, interface, and carrier in `src/domain/party/published/**`:
  record component order, component types, accessor names, enum constants,
  null/default behavior, and compatibility helper accessors such as
  `membershipName()`, `restTypeName()`, `dungeonLocationKindName()`, and
  `dungeonHeadingName()`.
- `src.domain.party.model.roster.repository.PartyRosterRepository` and the
  domain value types it exposes to `src/data/party`.
- Travel command/readback semantics consumed by Hex and Dungeon: overworld tile
  id, dungeon map id, owner id, tile coordinates/level, heading, location kind,
  `attachToPartyToken`, and party-token location publication.
- Active-party, active-composition, snapshot, mutation, adventuring-day summary,
  and adventuring-day calculation model semantics consumed by Party dropdown,
  Adventuring Day dropdown, Encounter, Session Planner, and harnesses.
- `src.view.dropdowns.party.PartyTopBarContribution`: contribution key `party`,
  `ShellTopBarSpec` order 20 after Adventuring Day order 10, binding title
  `Party`, top-bar popup behavior, shell slot `ShellSlot.TOP_BAR`, trigger
  label/mnemonic semantics, and popup width/accessible text behavior.
- Shell APIs, dropdown popup APIs, shared top-bar view infrastructure, adjacent
  Hex/Dungeon/Encounter/Session Planner code, and SQLite schema/persistence
  semantics.

The implementation may add typed internal accessors or use existing typed
record components, but it must keep the String compatibility accessors above
until every consumer side is migrated.

## Wiring-Port Boundary

`PartyDropdownHarness` already binds the production `PartyTopBarContribution`
through a real `ShellRuntimeContext`, discovers `ShellSlot.TOP_BAR`, fires the
rendered dropdown trigger, and drives visible controls
(`test/src/view/dropdowns/party/PartyDropdownHarness.java:51`,
`test/src/view/dropdowns/party/PartyDropdownHarness.java:55`,
`test/src/view/dropdowns/party/PartyDropdownHarness.java:64`,
`test/src/view/dropdowns/party/PartyDropdownHarness.java:73`). It imports none
of the view content-model, input-event, or `PartyTopBarIntentHandler` classes
named in the deletion list.

Therefore no M3.4 harness code port is expected. M3.4 must still be a separate
cycle step: verify the frozen harness against the approved design and record
that no harness wiring change is required. If implementation discovers an
unavoidable harness construction reference to a deletion-list class, M3.4 may
port only that reference while preserving the scenario, fixture values, visible
texts, assertion labels, and pass/fail oracles above. M3.4 must not delete
production classes from the deletion list; M3.5 executes the approved design.

## Metric Targets And Exceptions

| Metric | Target for implementation | Design exception |
| --- | --- | --- |
| LOC | Product subset should attempt the roadmap target: 6,781 physical LOC to 4,069 or less. | If byte-compatible published records, roster value model, and JavaFX popup views make that impossible, M3.6 may request a reviewed exception capped at 5,750 physical LOC with a class-by-class LOC breakdown. Full-set LOC reduction is a data-layer exception unless a gateway signature adaptation becomes necessary. |
| File count | Product subset should fall from 119 Java files to about 88 by deleting the 34 listed files and adding only `PartyPublishedProjection`, `PartyTopBarViewModel`, and `PartyTopBarVocabulary`. | More files require a design amendment before implementation. |
| Forwarding-only classes | Zero product behavior-forwarding classes: `PartyApplicationService` owns route logic, published models own state/listeners, and the usecase/repository/publication/content/input/intent-handler stack is deleted. | `PartyServiceContribution` and `PartyServiceAssembly` remain service-registry composition seams like the pilot reference, but must not add a behavior-forwarding hop between callers and `PartyApplicationService`. Data-layer contribution/repository wrappers remain outside the product migration surface. |
| Intent-to-mutation chain | Party-owned mutations use at most 3 meaningful class-boundary hops; travel move uses at most 2 Party-owned hops after the foreign seam. | Adventuring-day calculation may use 4 Party-owned class boundaries because `AdventuringDayProgressCalculationHelper` owns retained domain calculation, not forwarding. Foreign Hex/Dungeon/Encounter/Session Planner paths before or after the Party seam remain outside this M3 Party denominator. |
| String round-trips | Zero non-seam internal Party String round-trips: `PartyApplicationService`, projections, and view model use `MembershipState`, `RestType`, `PartyDungeonTravelLocationKind`, and `PartyTravelHeading` typed values internally. | Byte-compatible published helper accessors and data-layer serialization may still expose String names until all consumer sides or data gateways migrate. Visible labels/search text remain user-facing strings and are not finite-domain state. |

The exceptions are individually justified by existing consumer seams, not by
preference. The conformance review must reject any additional unexplained
metric miss.

## Untouched Surfaces

- `src/data/party/**` persistence, schema, mapper, gateway, and repository
  semantics stay unchanged.
- `src/domain/hex/**`, `src/domain/dungeon/**`, `src/domain/encounter/**`,
  `src/domain/sessionplanner/**`, Adventuring Day dropdown code, and their
  harnesses stay unchanged; they consume the current Party published seams.
- `src/view/slotcontent/topbar/dropdown/**` stays unchanged as the shared
  dropdown popup seam.
- `src/view/dropdowns/party/PartyTopBarContribution.java`,
  `PartyTopBarBinder.java`, `PartyTopBarView.java`, `PartyRosterTopBarView.java`,
  and `PartyEditorTopBarView.java` stay as the Party top-bar UI shell and
  JavaFX view surface, though their model/callback bindings may be ported
  during implementation.
- `src/domain/party/published/**` record and enum semantics stay
  byte-compatible; model classes may gain stateful publication methods but must
  preserve `current()`, `subscribe(...)`, and compatibility constructors.
- Harness scenarios and assertions stay frozen. Any behavior anomaly found
  during implementation is an R2 issue or area revert, not an in-pass fix.

## Required Reviews

Phase 1 and Phase 2 must approve this artifact before M3.4 starts. Reviewers
must check that the design names target classes, representative call chains,
the full deletion list, seam compatibility, untouched surfaces, frozen parity
inventory, wiring-port boundary, and each metric exception above. A vague
implementation-only answer is rework.
