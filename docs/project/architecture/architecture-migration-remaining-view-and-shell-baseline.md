Status: Active
Owner: SaltMarcher Team
Last Reviewed: 2026-07-11
Source of Truth: M5.2 diagnostic baseline metrics for the
`remaining-view-and-shell` architecture migration area before target design.

# Remaining View And Shell Migration Baseline

## Purpose

This document records the M5.2 baseline metrics for the remaining view and
shell area before any target design, wiring port, or implementation. The
numbers are diagnostic: they define the baseline for later M5 conformance
review, but they do not approve a design, a deletion list, or a wiring port.

The measurement point is committed `HEAD`
`8f7d73e0ec49da0e0b282202648fdf043a5900d7`. Metrics were taken with
`git ls-tree` and `git show HEAD:<file>`, so unrelated dirty working-tree
files are not counted.

Documentation gates are not part of M5.2 proof. Architecture-migration form
gates were removed earlier in the roadmap, so this baseline uses reproducible
measurement, diff hygiene, and the required Phase 1/Phase 2 review path.

## Scope

Primary M5 view/shell scope:

- `bootstrap/**`
- `shell/**`
- `src/view/leftbartabs/catalog/**`
- `src/view/slotcontent/controls/catalogcrud/**`
- `src/view/slotcontent/controls/searchfilter/**`
- `src/view/slotcontent/topbar/dropdown/**`
- `src/view/dropdowns/party/**`
- `src/view/statetabs/travel/**`
- `src/view/statetabs/encounter/**`

Design-visible adjacent route:

- `src/view/slotcontent/details/creature/CreatureDetailsContentModel.java`
- `src/view/slotcontent/details/creature/CreatureDetailsView.java`

The adjacent Creature detail files are counted separately because both
`CatalogBinder` and `EncounterStateBinder` instantiate them for production
inspector detail routes
(`src/view/leftbartabs/catalog/CatalogBinder.java:96-114`,
`src/view/statetabs/encounter/EncounterStateBinder.java:75-95`). They are
therefore visible to the M5 design, but not part of the primary path
denominator.

Excluded:

- tests, behavior harnesses, generated/build files, and non-Java files;
- imported `src/domain/**` and `src/data/**` seams;
- concrete SQLite gateway/factory code under `src/data/**`.

The roadmap's M5 data-layer decision remains binding: data code keeps its
structure unless a migrated area's slimmer boundary requires a gateway
signature adaptation. Startup service discovery is measured in `bootstrap/**`;
concrete SQLite factories are not normal M5 migration targets.

## Reproduction

```bash
git rev-parse HEAD
# 8f7d73e0ec49da0e0b282202648fdf043a5900d7

git ls-tree -r --name-only HEAD -- \
  bootstrap shell \
  src/view/leftbartabs/catalog \
  src/view/slotcontent/controls/catalogcrud \
  src/view/slotcontent/controls/searchfilter \
  src/view/slotcontent/topbar/dropdown \
  src/view/dropdowns/party \
  src/view/statetabs/travel \
  src/view/statetabs/encounter |
  rg '\.java$' | sort

# For each file:
git show HEAD:<file> | wc -l
git show HEAD:<file> | awk 'NF {c++} END {print c+0}'
```

LOC means physical Java file lines from `wc -l`, including blank lines and
comments. Nonblank LOC uses the `awk` command above.

## File And LOC Baseline

| Set | Files | Physical LOC | Nonblank LOC | Migration ownership |
| --- | ---: | ---: | ---: | --- |
| Primary M5 view/shell scope | 82 | 12,603 | 11,047 | Main M5 design surface |
| Direct-route adjacent Creature details | 2 | 533 | 455 | Design-visible inspector route |
| Combined design-visible route scope | 84 | 13,136 | 11,502 | Primary plus adjacent detail route |

Primary subgroup breakdown:

| Root | Files | Physical LOC | Nonblank LOC |
| --- | ---: | ---: | ---: |
| `bootstrap/**` | 9 | 734 | 645 |
| `shell/**` | 33 | 1,920 | 1,652 |
| `src/view/leftbartabs/catalog/**` | 10 | 3,315 | 2,980 |
| `src/view/slotcontent/controls/catalogcrud/**` | 3 | 1,024 | 908 |
| `src/view/slotcontent/controls/searchfilter/**` | 3 | 258 | 220 |
| `src/view/slotcontent/topbar/dropdown/**` | 3 | 206 | 176 |
| `src/view/dropdowns/party/**` | 7 | 2,216 | 1,940 |
| `src/view/statetabs/travel/**` | 5 | 293 | 240 |
| `src/view/statetabs/encounter/**` | 9 | 2,637 | 2,286 |

## Representative View/Shell Chains

Counting rule: count meaningful class-boundary hops from a shell/view entry
point to the first production mutation, publication, or readback projection.
Command/value record construction, same-class private helpers, and JavaFX
property binding mechanics are not counted. Foreign domain internals are named
when they are the route target, but they are outside the primary denominator.

| Interaction | Baseline chain | Hop count | Evidence |
| --- | --- | ---: | --- |
| Shell startup to Travel state readback | `AppBootstrap.createShell` -> `AppBootstrap.discoverContributions` -> `ShellViewDiscovery.discover` -> `TravelStateContribution.bind` -> `TravelStateBinder.bind` -> `TravelStateContentModel.applyHexTravelSnapshot` | 6 to state readback | `bootstrap/AppBootstrap.java:36-67`, `bootstrap/ShellViewDiscovery.java:30-62`, `src/view/statetabs/travel/TravelStateContribution.java:21-24`, `src/view/statetabs/travel/TravelStateBinder.java:19-27`, `src/view/statetabs/travel/TravelStateContentModel.java:55-68` |
| Shell contribution registration | `AppBootstrap.register` -> `AppShell.registerLeftBarTab/registerTopBar/registerStateTab` -> `ShellSlotValidator.validate` -> `ShellSlotContent.from` -> shell host slot registration/readback | 4 to validated slot content; 5 including host registration | `bootstrap/AppBootstrap.java:70-84`, `shell/host/AppShell.java:46-75`, `shell/host/ShellSlotValidator.java:16-35`, `shell/host/ShellSlotContent.java:21-60` |
| Catalog filter/search to Creature catalog publication | `CatalogControlsView.publishSnapshot` -> `CatalogBinder.bindControls` -> `CatalogIntentHandler.consume` -> `CatalogIntentHandler.refreshSearch` -> `CatalogIntentHandler.refreshCatalog` -> `CreaturesApplicationService.publishCatalog` | 6 to Creature publication | `src/view/leftbartabs/catalog/CatalogControlsView.java:261-297`, `src/view/leftbartabs/catalog/CatalogBinder.java:78-85`, `src/view/leftbartabs/catalog/CatalogIntentHandler.java:45-116`, `src/view/leftbartabs/catalog/CatalogIntentHandler.java:141-167`, `src/domain/creatures/CreaturesApplicationService.java:161-165` |
| Catalog add-creature action to Encounter state mutation | `CatalogMainView.publishCreatureEvent` -> `CatalogBinder.bindMain` -> `CatalogIntentHandler.consume` -> `CatalogIntentHandler.addCreatureToEncounter` -> `EncounterApplicationService.RuntimeCommandActions.applyState` | 5 to Encounter session apply/publication route | `src/view/leftbartabs/catalog/CatalogMainView.java:92-99`, `src/view/leftbartabs/catalog/CatalogBinder.java:87-94`, `src/view/leftbartabs/catalog/CatalogIntentHandler.java:118-139`, `src/view/leftbartabs/catalog/CatalogIntentHandler.java:180-182`, `src/domain/encounter/EncounterApplicationService.java:191-199` |
| Shared Catalog CRUD create route to Hex map mutation | `CatalogCrudControlsView.publishSubmit` -> `HexMapBinder.consumeCatalogEvent` -> `HexMapBinder.consumeCatalogSubmit` -> `HexMapBinder.createMap` -> `HexEditorApplicationService.createMap` -> `HexEditorApplicationService.EditorMutations.createMap` | 6 to Hex mutation | `src/view/slotcontent/controls/catalogcrud/CatalogCrudControlsView.java:341-353`, `src/view/leftbartabs/hexmap/HexMapBinder.java:85-98`, `src/view/leftbartabs/hexmap/HexMapBinder.java:211-224`, `src/view/leftbartabs/hexmap/HexMapBinder.java:264-276`, `src/domain/hex/HexEditorApplicationService.java:47-48`, `src/domain/hex/HexEditorApplicationService.java:105-106` |
| SearchFilter control to World Planner filtered projection | `SearchFilterControlsView.publishIfInteractive` -> `WorldPlannerBinder.consumeSearch` -> `WorldPlannerViewModel.applySearchFilters` -> `WorldPlannerViewModel.refreshProjections` -> `WorldPlannerProjectionData.filteredNpcs` | 4 to view-model projection, 5 including filtered readback helper | `src/view/slotcontent/controls/searchfilter/SearchFilterControlsView.java:123-134`, `src/view/leftbartabs/worldplanner/WorldPlannerBinder.java:106-113`, `src/view/leftbartabs/worldplanner/WorldPlannerViewModel.java:148-150`, `src/view/leftbartabs/worldplanner/WorldPlannerViewModel.java:246-253`, `src/view/leftbartabs/worldplanner/WorldPlannerViewModel.java:1098-1110` |
| Party editor create route to roster mutation | `PartyEditorTopBarView.publishSubmitRequested` -> `PartyTopBarBinder.installEditorCallbacks` -> `PartyTopBarViewModel.prepareSubmit` -> `PartyTopBarViewModel.prepareCreateCharacter` -> `PartyTopBarBinder.dispatchSubmit` -> `PartyApplicationService.runRosterMutation` | 6 to Party mutation/save/publication route | `src/view/dropdowns/party/PartyEditorTopBarView.java:141-144`, `src/view/dropdowns/party/PartyTopBarBinder.java:95-109`, `src/view/dropdowns/party/PartyTopBarViewModel.java:212-219`, `src/view/dropdowns/party/PartyTopBarViewModel.java:235-253`, `src/view/dropdowns/party/PartyTopBarBinder.java:111-117`, `src/domain/party/PartyApplicationService.java:160-179` |
| Encounter combat HP/initiative action | `EncounterCombatStateView` action sink -> `EncounterStateBinder` callback -> `EncounterStateViewModel.mutateHitPoints/adjustInitiative` -> `EncounterStateViewModel.applyCommand` -> `EncounterApplicationService.RuntimeCommandActions.applyState` | 5 to Encounter state apply/publication route | `src/view/statetabs/encounter/EncounterCombatStateView.java:121-131`, `src/view/statetabs/encounter/EncounterStateBinder.java:64-68`, `src/view/statetabs/encounter/EncounterStateViewModel.java:158-187`, `src/domain/encounter/EncounterApplicationService.java:191-199` |

Dominant M5 view/shell routes reach 6 meaningful hops before first production
mutation, publication, or readback. The longest paths are the startup
discovery/readback route, Catalog search, shared Catalog CRUD into Hex, and
Party editor create.

## Forwarding And Ceremony Baseline

Forwarding-only means a concrete class whose production behavior is primarily
unpacking, delegating, registering, or proxying without owning meaningful
decision logic. This M5 surface also has design-visible ceremony that is not
strictly forwarding-only because it owns JavaFX state, visible validation, or
startup/discovery behavior.

| Class or set | Baseline classification | Evidence |
| --- | --- | --- |
| `CatalogContribution`, `PartyTopBarContribution`, `TravelStateContribution`, `EncounterStateContribution` | Strict shell-contribution wrapper candidates | Each returns passive registration metadata and delegates `bind(...)` to a binder (`src/view/leftbartabs/catalog/CatalogContribution.java:16-30`, `src/view/dropdowns/party/PartyTopBarContribution.java:13-20`, `src/view/statetabs/travel/TravelStateContribution.java:13-24`, `src/view/statetabs/encounter/EncounterStateContribution.java:13-24`). |
| `TravelStateContributionModel` | Strict holder/proxy candidate | Holds only one `TravelStateContentModel` and exposes it (`src/view/statetabs/travel/TravelStateContributionModel.java:3-9`). |
| `BootstrapFx`, `ShellFx` | Strict JavaFX delegation helper candidates | `BootstrapFx` only forwards stylesheet/icon mutations to JavaFX collections, and `ShellFx` only forwards style/child/item mutations to JavaFX collections (`bootstrap/BootstrapFx.java:7-20`, `shell/host/ShellFx.java:8-47`). |
| `CatalogContributionModel` | Small presentation coordinator candidate, not pure forwarding | Holds two content models and a creature-detail selection property (`src/view/leftbartabs/catalog/CatalogContributionModel.java:6-26`). |
| `CatalogBinder`, `PartyTopBarBinder`, `TravelStateBinder`, `EncounterStateBinder` | Binder/composition ceremony candidates | They assemble views/models, subscribe to published models, install callbacks, and publish `ShellBinding` slot maps. They are not pure proxies because they currently own production route wiring. |
| `CatalogIntentHandler` and `EncounterStateViewModel` | Intent/command bridge candidates, not pure forwarding | They translate view events to application commands and own visible local behavior such as drafts, selection, status, and inspector details (`src/view/leftbartabs/catalog/CatalogIntentHandler.java:45-182`, `src/view/statetabs/encounter/EncounterStateViewModel.java:81-187`). |
| `DropdownPopupContentModel`, `DropdownPopupView`, `DropdownPopupViewInputEvent` | Generic top-bar popup ceremony candidate | The model stores presentation/open state, the view translates button/popup events, and the record carries two booleans (`src/view/slotcontent/topbar/dropdown/DropdownPopupContentModel.java:7-111`, `src/view/slotcontent/topbar/dropdown/DropdownPopupView.java:13-88`, `src/view/slotcontent/topbar/dropdown/DropdownPopupViewInputEvent.java:3-6`). |
| `CatalogCrudControlsViewInputEvent`, `CatalogControlsViewInputEvent`, `CatalogMainViewInputEvent`, `SearchFilterControlsViewInputEvent` | Generic input-record ceremony candidates | They flatten typed UI state into records consumed by feature binders/handlers (`src/view/slotcontent/controls/catalogcrud/CatalogCrudControlsViewInputEvent.java:3-30`, `src/view/leftbartabs/catalog/CatalogControlsViewInputEvent.java:5-56`, `src/view/leftbartabs/catalog/CatalogMainViewInputEvent.java:3-13`, `src/view/slotcontent/controls/searchfilter/SearchFilterControlsViewInputEvent.java:5-21`). |
| `AppBootstrap`, `ShellViewDiscovery`, `ServiceContributionDiscovery`, `ContributionRootClassScanner`, `JarClassEntrySource` | Bootstrap/discovery ceremony candidates | They discover, instantiate, sort, and register services and shell contributions by roots/suffixes. Startup behavior must stay byte-compatible unless the design replaces the discovery model explicitly (`bootstrap/AppBootstrap.java:36-84`, `bootstrap/ShellViewDiscovery.java:22-62`, `bootstrap/ServiceContributionDiscovery.java:23-43`, `bootstrap/ContributionRootClassScanner.java:22-43`, `bootstrap/JarClassEntrySource.java:17-35`). |
| `ShellSlotContent`, `ShellSlotValidator`, `ShellControls` | Shell utility/seam candidates | Slot content sanitizes binding maps, validator enforces slot/spec compatibility, and `ShellControls.stack` builds shared controls layout (`shell/host/ShellSlotContent.java:21-60`, `shell/host/ShellSlotValidator.java:16-52`, `shell/api/ShellControls.java:8-37`). |

Strict forwarding/proxy baseline count: 7 concrete production classes (the
four contribution wrappers, `TravelStateContributionModel`, `BootstrapFx`, and
`ShellFx`). Design-visible
ceremony count is larger and must be classified by the M5 target design as
delete, absorb, retain, or untouched; the baseline does not authorize deletion.

## String Boundary Families

String boundary family means a finite-domain value, selected reference, or
startup contract is carried through a String or primitive token and later
interpreted as the same finite meaning. Display-only labels and free-form
names do not count.

| Family | Baseline boundary | Evidence |
| --- | --- | --- |
| Shell contribution identity and discovery roots | `ContributionKey(String)` plus literal keys such as `catalog`, `party`, `travel`, and `encounter`; discovery roots and suffixes are also String contracts. | `shell/api/ContributionKey.java:8`, `src/view/leftbartabs/catalog/CatalogContribution.java:18-24`, `src/view/dropdowns/party/PartyTopBarContribution.java:13-16`, `src/view/statetabs/travel/TravelStateContribution.java:13-19`, `src/view/statetabs/encounter/EncounterStateContribution.java:13-19`, `bootstrap/ShellViewDiscovery.java:22-29` |
| Catalog Creature filter taxonomy and CR values | Catalog controls carry CR min/max and taxonomy selections as Strings through `CatalogControlsViewInputEvent`; the handler forwards them to `RefreshCreatureCatalogCommand`. | `src/view/leftbartabs/catalog/CatalogControlsViewInputEvent.java:5-56`, `src/view/leftbartabs/catalog/CatalogControlsView.java:261-292`, `src/view/leftbartabs/catalog/CatalogIntentHandler.java:152-167` |
| Catalog sort key and sort field/direction names | `CatalogMainContentModel.SortOption` maps UI sort keys to String sort field/direction names that are sent to the Creature catalog command. | `src/view/leftbartabs/catalog/CatalogMainContentModel.java:77-114`, `src/view/leftbartabs/catalog/CatalogMainContentModel.java:180-199`, `src/view/leftbartabs/catalog/CatalogIntentHandler.java:152-167` |
| Shared Catalog CRUD item identity | Generic CRUD controls store/select item ids as Strings; adjacent owners such as Hex parse those IDs back to `long` and preserve the legacy invalid-id-to-zero behavior. | `src/view/slotcontent/controls/catalogcrud/CatalogCrudControlsContentModel.java:21-56`, `src/view/slotcontent/controls/catalogcrud/CatalogCrudControlsView.java:380-432`, `src/view/slotcontent/controls/catalogcrud/CatalogCrudControlsViewInputEvent.java:3-30`, `src/view/leftbartabs/hexmap/HexMapBinder.java:298-304` |
| SearchFilter group and option keys | Filter groups/options/chips carry `groupKey` and `optionKey` Strings; World Planner interprets them with enum `.name()` and ID-key comparisons. | `src/view/slotcontent/controls/searchfilter/SearchFilterControlsContentModel.java:39-63`, `src/view/slotcontent/controls/searchfilter/SearchFilterControlsView.java:74-83`, `src/view/slotcontent/controls/searchfilter/SearchFilterControlsView.java:145-167`, `src/view/leftbartabs/worldplanner/WorldPlannerViewModel.java:1098-1110` |
| Party editor numeric text | Level, passive perception, and armor class enter as raw Strings, are parsed in `DraftParser`, and become typed `CharacterDraft` values. | `src/view/dropdowns/party/PartyTopBarViewModel.java:187-197`, `src/view/dropdowns/party/PartyTopBarViewModel.java:235-253`, `src/view/dropdowns/party/PartyTopBarViewModel.java:966-999` |
| Encounter combatant and action tokens at the state-tab seam | Combatant IDs and initiative IDs stay String values in the view model; the published command seam also carries the existing action-code bridge. | `src/view/statetabs/encounter/EncounterStateViewModel.java:140-148`, `src/view/statetabs/encounter/EncounterStateViewModel.java:158-187`, `src/view/statetabs/encounter/EncounterStateViewModel.java:514-559`, `src/domain/encounter/published/ApplyEncounterStateCommand.java:33-52` |

Baseline count: 7 product/startup String boundary families. The next target
design must reduce these where the M5 surface owns both sides, or explicitly
name byte-compatible seam exceptions where foreign migrated areas still
consume the current public records/classes.

Diagnostic non-counts:

- visible labels, status text, search text, character names, and creature names
  are display or free-form user text;
- SVG viewbox/path numeric parsing in shell navigation is resource rendering,
  not product state round-trip;
- SQLite file names, table names, and persistence serialization are excluded
  by the M5 data-layer decision.

## Design-Visible Deletion Candidates

The M5 target design must turn this diagnostic inventory into a concrete
target class list, named call chains, an explicit deletion list, and a seam
statement. The following candidates are design-visible; this baseline does not
declare them deletions.

| Candidate set | Concrete files | Design obligation |
| --- | --- | --- |
| Pure contribution wrappers | `CatalogContribution.java`, `PartyTopBarContribution.java`, `TravelStateContribution.java`, `EncounterStateContribution.java` | Delete or retain explicitly. If deleted, the design must name the replacement shell registration mechanism and preserve startup ordering, keys, labels, icons, and slot contracts. |
| Binder/intent ceremony | `CatalogBinder.java`, `CatalogIntentHandler.java`, `PartyTopBarBinder.java`, `TravelStateBinder.java`, `EncounterStateBinder.java`, `TravelStateContributionModel.java`, `CatalogContributionModel.java` | Collapse into local view models/composition points or justify retention with concrete behavior ownership. |
| Shared control input records | `CatalogControlsViewInputEvent.java`, `CatalogMainViewInputEvent.java`, `CatalogCrudControlsViewInputEvent.java`, `SearchFilterControlsViewInputEvent.java`, `DropdownPopupViewInputEvent.java` | Replace with typed callbacks or retain as byte-compatible shared control seams. Scenario/assertion behavior must not change. |
| Shared control/popup models | `CatalogCrudControlsContentModel.java`, `SearchFilterControlsContentModel.java`, `DropdownPopupContentModel.java` | Classify as delete, absorb, retain, or untouched. These classes own visible selection, filtering, popup, and validation behavior, so they are not cosmetic deletion targets. |
| Shell/bootstrap discovery | `AppBootstrap.java`, `ShellViewDiscovery.java`, `ServiceContributionDiscovery.java`, `ContributionRootClassScanner.java`, `JarClassEntrySource.java` | If simplified, preserve app startup, service registration order, shell contribution sorting, default landing selection, and jar/file discovery behavior. |
| JavaFX utility forwarding | `BootstrapFx.java`, `ShellFx.java` | Delete, inline, or retain explicitly. If inlined, preserve stylesheet/icon application and shell host child/style/list mutations. |
| Shell host utilities | `ShellSlotContent.java`, `ShellSlotValidator.java`, `ShellControls.java` | Preserve Shell API compatibility and slot validation messages unless an approved design names a byte-compatible replacement. |
| Direct Creature detail route | `CreatureDetailsContentModel.java`, `CreatureDetailsView.java` | Decide whether the inspector detail route remains separate or is absorbed by Catalog/Encounter state-tab view models. Creature published seams stay byte-compatible. |

## Seam And Harness Context

Published seams and shell APIs consumed by migrated or foreign areas remain
byte-compatible until both sides are migrated:

- `ShellContribution`, `ShellBinding`, `ShellContributionSpec`, `ShellSlot`,
  `ContributionKey`, `ShellRuntimeContext`, and the shell spec records;
- shared control classes and public members used by Hex, Worldplanner, Session
  Planner, Dungeon Editor, and harnesses, including
  `CatalogCrudControlsView.OPERATION_CONTENT_PROPERTY`;
- published model and command surfaces consumed here: Creature catalog/detail/
  filter, Encounter builder/state, Encounter Table catalog, Party snapshot/
  mutation/day summary, Hex editor/travel, and World Planner snapshot.

M5 Step 1 froze the active proof inventory for this area:

- `catalogInitialLoadHarness`
- `catalogCrudControlsHarness`
- `catalogControlsRawInputHarness`
- `searchFilterControlsHarness`
- `partyDropdownHarness`
- `hexTravelStateBehaviorHarness`
- `encounterStateTabHarness`
- `sessionPlannerShellLayoutHarness`
- `smokeStartupHarness`
- `checkBehaviorHarnessTopology`
- `checkHarnessMapConsistency`

Image parity is not newly implicated by this baseline because the measured M5
surfaces do not own canvas/rendering output. If the target design touches a
rendering surface, the M1.5 parity net becomes binding for that route.

## Residual Notes For Design

- M5.2 does not authorize a wiring port or implementation. The next step is a
  judge-approved M5 target design with target classes, representative call
  chains, deletion list, seam statement, frozen parity inventory, and metric
  targets or explicitly justified exceptions.
- Preserve pre-existing behaviors during migration: invalid shared CRUD IDs
  parse to `0L` and are ignored or locally validated in Hex; `SearchFilter`
  relies on `String[]` user-data tokens and throws when malformed; Travel
  state shows static defaults if `HexTravelModel` is absent; Encounter result
  return marks selected World NPCs defeated before returning Encounter to
  builder.
- Any owner-visible bug discovered in these residual behaviors is filed as a
  separate R2 issue and is not fixed inside the migration pass.
