Status: Draft
Owner: SaltMarcher Team
Last Reviewed: 2026-07-11
Source of Truth: M5.3 target architecture for `remaining-view-and-shell` before any wiring-port or implementation commit.

# Remaining View And Shell Migration Target Design

## Purpose

This document is the M5.3 target design for the remaining view and shell
migration area. It answers three architecture concerns:

- which view/shell classes own composition after the migration;
- which legacy forwarding, binder, and holder classes must be deleted;
- which shell, shared-control, and published-domain seams remain
  byte-compatible because migrated or foreign areas still consume them.

The entity of interest is the M5 `remaining-view-and-shell` source area named
by the migration ledger. The primary consumers are implementation agents,
Phase 1 reviewers, the independent Phase 2 judge, and later conformance
reviewers. The target is architecture and migration shape only; user-visible
behavior remains owned by the existing behavior harnesses, requirements, and
production routes.

This design is based on the committed M5.2 baseline measurement point. Dirty
working-tree changes in adjacent Encounter files are not design inputs unless
they are separately committed or explicitly brought into the M5 cycle.

Documentation gates are not acceptance evidence for this M5 design. The
roadmap removed architecture-migration form gates earlier, so M5.3 acceptance
is this concrete target design, diff hygiene, and Phase 1/Phase 2 review.

## Scope

Primary M5 source roots:

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

Out of scope except as byte-compatible consumers:

- `src/data/**`, per the M5 data-layer decision;
- domain published model and command classes consumed by these views;
- already migrated Hex, World Planner, Session Planner, Dungeon Editor, Dungeon
  Travel, Encounter, and Party domain surfaces unless an approved M5 wiring
  boundary explicitly names a shared-control adaptation.

## Non-Negotiable Constraints

- Behavior parity is absolute. Any visible behavior change in a migration pass
  is a defect. Pre-existing bugs are preserved and filed as separate R2 issues.
- No questions to the owner. Never wait on the owner; the acceptance window
  never blocks the pipeline. Decide yourself, journal the reasoning.
- No security analysis. No pause/throttle/stop mechanisms. Git history plus
  revert is the safety model.
- Harness scenarios and assertions are frozen; only wiring may be ported, in a
  separate prior commit.
- Published seams consumed by other areas stay byte-compatible until both sides
  are migrated.
- CPD, PMD, CKJM, and other static findings must be repaired structurally.
  Rephrasing duplicate helpers to evade a checker is not migration.

## Current Defect

The M5.2 baseline records 82 primary Java files, 12,603 physical LOC, and
11,047 nonblank LOC in the M5 view/shell scope. The dominant routes reach six
meaningful class-boundary hops before the first production mutation,
publication, or readback. Seven concrete production classes are strict
forwarding/proxy candidates:

- `CatalogContribution`
- `PartyTopBarContribution`
- `TravelStateContribution`
- `EncounterStateContribution`
- `TravelStateContributionModel`
- `BootstrapFx`
- `ShellFx`

The four contribution classes cannot simply disappear without replacing the
shell discovery contract, because `ShellViewDiscovery` discovers top-level
`*Contribution` classes under the view roots and `AppBootstrap` registers their
`ShellContributionSpec` values. M5 therefore keeps the contribution class
names and shell keys byte-compatible, but changes the contribution classes from
passive wrappers into real composition points. Binder, holder, and JavaFX
forwarding helpers are deleted where they only preserve the old ceremony.

## Target Class List

| Class | Target responsibility |
| --- | --- |
| `bootstrap.AppBootstrap` | Stay the application startup composition root. It discovers services and shell contributions, registers shell slots, preserves default landing resolution, and does not gain feature-specific view wiring. |
| `bootstrap.ShellViewDiscovery` | Stay the byte-compatible contribution discovery mechanism for top-level `*Contribution` classes under the existing roots. M5 does not replace reflection/file/jar discovery. |
| `bootstrap.ServiceContributionDiscovery`, `ContributionRootClassScanner`, and `JarClassEntrySource` | Stay the byte-compatible service/bootstrap discovery support. They preserve service contribution discovery, file/jar class entry behavior, contribution-root scanning, public no-arg contribution construction, startup sorting, and error behavior. |
| `bootstrap.SaltMarcherApp`, `bootstrap.SaltMarcherPreloader`, and `bootstrap.DesktopWindowIcons` | Apply stylesheets and window icons directly through JavaFX APIs after `BootstrapFx` is deleted. They preserve the same stylesheet resource and icon behavior. |
| `shell.host.AppShell`, `ShellWorkspacePane`, `StateTabPane`, `InspectorPane`, `ShellNavigationGraphicLoader`, `ShellNavigationSvgRenderer`, `ShellNavigationSidebar`, and `ShellToolbarStrip` | Stay the shell host. They use direct JavaFX collection/style mutations after `ShellFx` is deleted and preserve slot layout, navigation, inspector, title, icon, and state-tab behavior. |
| `shell.host.ShellSlotContent` and `ShellSlotValidator` | Stay the shell slot sanitization and validation seam. They preserve slot/spec compatibility rules, duplicate-slot handling, and validation error behavior. |
| `shell.host.ShellContentLayout` | Stay the shell-owned content wrapper for scroll/fill/layout decisions used by workspace, inspector, and state-tab hosting. |
| `shell.host.InspectorHistory` and `InspectorEntryTrail` | Stay the inspector navigation state owners for push, close, back, forward, current-entry, and trail behavior. |
| `shell.host.ShellNavigationGraphicLoader`, `ShellNavigationSvgRenderer`, `ShellNavigationSvgNodeFactory`, `ShellNavigationSvgViewBox`, and `ShellNavigationSidebar` | Stay the navigation resource loading, SVG parsing/rendering, missing-icon fallback, ordering, separator, tooltip, accessible-text, and icon style-class owners. They no longer call `ShellFx` after implementation. |
| `shell.host.StateTabPane` and `ShellToolbarStrip` | Stay the state-tab selection/content host and toolbar-title/activation host. They preserve tab ordering, placeholder behavior, activation/deactivation calls, and title display. |
| `shell.api.ShellContribution`, `ShellBinding`, `ShellContributionSpec`, `ShellLeftBarTabSpec`, `ShellTopBarSpec`, `ShellStateTabSpec`, `ShellSlot`, `ShellLeftBarTabMode`, `ShellRuntimeContext`, `ShellControls`, `ServiceRegistry`, `ServiceContribution`, `NavigationGroupSpec`, `NavigationGraphicResource`, and `ContributionKey` | Stay byte-compatible shell API seams. Public class names, packages, method names, record component order/types, slot values, contribution keys, navigation metadata, service-registry behavior, titles, orders, and default landing behavior stay unchanged. |
| `src.view.leftbartabs.catalog.CatalogContribution` | Stay the public shell contribution and become the Catalog composition point. It owns service/model lookup, creates `CatalogViewModel`, binds `CatalogControlsView` and `CatalogMainView`, subscribes published models, opens Creature inspector details, and returns the same cockpit controls/main binding. |
| `src.view.leftbartabs.catalog.CatalogViewModel` | New package-private view model replacing `CatalogContributionModel` and `CatalogIntentHandler`. It owns Catalog controls/main content models, local detail-selection state, Catalog control input consumption, Catalog main input consumption, filter refresh, encounter-builder draft updates, sort/page changes, creature-detail selection, add-to-Encounter dispatch, and initial source refresh. |
| `src.view.leftbartabs.catalog.CatalogControlsContentModel` and `CatalogMainContentModel` | Stay the Catalog presentation models for the existing JavaFX views. They preserve current filter/dropdown, paging, sort, tuning-preview, world-planner, and search-result projection behavior. |
| `src.view.leftbartabs.catalog.CatalogControlsView`, `CatalogControlsViewInputEvent`, `CatalogMainView`, and `CatalogMainViewInputEvent` | Stay byte-compatible within the Catalog package and frozen raw-input harness route. M5 does not replace these records with renamed equivalents; any future typed Catalog view-event redesign is a separate behavior-neutral pass with its own harness inventory. |
| `src.view.dropdowns.party.PartyTopBarContribution` | Stay the public shell contribution and become the Party top-bar composition point. It owns service/model lookup, `DropdownPopupContentModel`, `DropdownPopupView`, `PartyTopBarViewModel`, panel views, callbacks, subscriptions, and the same `ShellSlot.TOP_BAR` binding. |
| `src.view.dropdowns.party.PartyTopBarViewModel` | Stay the Party dropdown view model. It owns trigger text, roster/editor projections, reserve search, draft validation, mutation in-flight state, command preparation, and visible status behavior. M5 may add a typed submit carrier only if it replaces the current `Object` dispatch structurally without changing published Party commands. |
| `src.view.dropdowns.party.PartyTopBarView`, `PartyRosterTopBarView`, `PartyEditorTopBarView`, and `PartyTopBarVocabulary` | Stay the JavaFX view/vocabulary set. They preserve visible text, accessible text, popup width, editor workflow, roster workflow, and callback behavior. |
| `src.view.slotcontent.topbar.dropdown.DropdownPopupContentModel`, `DropdownPopupView`, and `DropdownPopupViewInputEvent` | Stay byte-compatible shared top-bar popup seam because Adventuring Day still consumes the same input event. M5 may move Party's popup event handling into `PartyTopBarContribution`, but the shared popup API remains. |
| `src.view.statetabs.travel.TravelStateContribution` | Stay the public shell contribution and become the Travel state-tab composition point. It creates `TravelStateViewModel`, binds `TravelStateView`, subscribes optional `HexTravelModel`, applies current Hex travel snapshot when present, and returns the same cockpit-state binding. |
| `src.view.statetabs.travel.TravelStateViewModel` | New package-private view model replacing `TravelStateContributionModel` and `TravelStateContentModel`. It owns the read-only JavaFX properties, default compact travel state, Hex travel snapshot projection, and detail rows. |
| `src.view.statetabs.travel.TravelStateView` | Stay the JavaFX state-tab view. It binds to `TravelStateViewModel`, preserves style classes, row order, static default values, hidden action button behavior, and all visible text. |
| `src.view.statetabs.encounter.EncounterStateContribution` | Stay the public shell contribution and become the Encounter state-tab composition point. It owns service/model lookup, `EncounterStateViewModel` construction, subview construction, subscriptions, callback wiring, Creature inspector opening, and the same cockpit-state binding. |
| `src.view.statetabs.encounter.EncounterStateViewModel` | Stay the Encounter state-tab view model. It owns mode/panel projections, command preparation, result selection, XP award/readback state, Creature detail selection, and World Planner defeat marking. M5 does not redesign Encounter published commands or combatant identifiers. |
| `src.view.statetabs.encounter.EncounterStateView`, `EncounterBuilderStateView`, `EncounterInitiativeStateView`, `EncounterCombatStateView`, and `EncounterResultsStateView` | Stay the JavaFX state-tab views. They preserve rendered sections, callback shape, input text, order, selection behavior, and visible state. |
| `src.view.statetabs.encounter.EncounterStateVocabulary` | Stay the Encounter state-tab vocabulary/helper for mode-to-content index, initiative section labels, HP meter display, percent clamping, and HP fill style classes. |
| `src.view.slotcontent.controls.catalogcrud.CatalogCrudControlsContentModel`, `CatalogCrudControlsView`, and `CatalogCrudControlsViewInputEvent` | Stay byte-compatible shared controls consumed by Hex, Session Planner, Dungeon Editor, Dungeon Travel, harnesses, and M5. Their String item-id edge remains a shared-control seam, not an M5-owned internal round-trip. |
| `src.view.slotcontent.controls.searchfilter.SearchFilterControlsContentModel`, `SearchFilterControlsView`, and `SearchFilterControlsViewInputEvent` | Stay byte-compatible shared controls consumed by World Planner and harnesses. Group and option keys remain the shared filter seam. |
| `src.view.slotcontent.details.creature.CreatureDetailsContentModel` and `CreatureDetailsView` | Stay the reusable Creature inspector detail route. Catalog and Encounter continue to instantiate them from the selected Creature detail published model. |

## Target Call Chains

Counting rule: count named production class boundaries from shell/view entry to
the first production mutation, publication, or readback projection. Same-class
private helpers, direct JavaFX property binding, record construction, and
JavaFX collection mutations are not separate hops.

| Interaction | Target chain | Target |
| --- | --- | --- |
| Shell startup to Travel state readback | `AppBootstrap.createShell` -> `ShellViewDiscovery.discover` -> `TravelStateContribution.bind` -> `TravelStateViewModel.applyHexTravelSnapshot` | Four startup/discovery hops including retained byte-compatible discovery; the M5-owned Travel state path after contribution binding is one view-model hop. `TravelStateBinder` and `TravelStateContributionModel` are gone. |
| Shell contribution registration | `AppBootstrap.register` -> `AppShell.registerLeftBarTab/registerTopBar/registerStateTab` -> `ShellSlotValidator.validate` -> `ShellSlotContent.from` -> shell host slot registration/readback | Retained shell-host exception. The shell API and slot validation stay stable; deleting `ShellFx` removes JavaFX forwarding but does not replace the shell registration seam. |
| Catalog filter/search to Creature catalog publication | `CatalogControlsView` -> `CatalogViewModel.consume(CatalogControlsViewInputEvent)` -> `CreaturesApplicationService.refreshCatalog` -> `CreatureCatalogModel` publication | At most three meaningful M5/product boundaries to publication. `CatalogBinder`, `CatalogIntentHandler`, and `CatalogContributionModel` are gone; Catalog-owned control state remains in `CatalogControlsContentModel`. |
| Catalog add-creature action to Encounter state mutation | `CatalogMainView` -> `CatalogViewModel.consume(CatalogMainViewInputEvent)` -> `EncounterApplicationService.applyState` | At most three boundaries to Encounter state apply/publication. The Encounter published command seam stays byte-compatible. |
| Shared Catalog CRUD create route to Hex map mutation | `CatalogCrudControlsView` -> `HexMapBinder.consumeCatalogEvent` -> `HexEditorApplicationService.createMap` -> Hex mutation/publication | Foreign-consumer exception. M5 keeps shared CRUD records byte-compatible; Hex still owns its binder/view-model path until a later Hex/shared-control pass. |
| SearchFilter control to World Planner filtered projection | `SearchFilterControlsView` -> `WorldPlannerBinder.consumeSearch` -> `WorldPlannerViewModel.applySearchFilters` -> `WorldPlannerProjectionData.filteredNpcs` | Foreign-consumer exception. M5 keeps SearchFilter records byte-compatible; World Planner remains the owner of filter interpretation. |
| Party editor create route to roster mutation | `PartyEditorTopBarView` -> `PartyTopBarViewModel.prepareSubmit` -> `PartyApplicationService.createCharacter` -> Party mutation/publication | At most three meaningful Party/M5 boundaries. `PartyTopBarBinder` and its `dispatchSubmit(Object)` helper are gone or replaced by a typed local submit carrier inside `PartyTopBarViewModel`/`PartyTopBarContribution`. |
| Encounter combat HP/initiative action | `EncounterCombatStateView` -> `EncounterStateViewModel.mutateHitPoints/adjustInitiative` -> `EncounterApplicationService.applyState` | At most three boundaries to Encounter state apply/publication. `EncounterStateBinder` is gone; combatant ids stay the Encounter published seam. |
| Creature inspector detail from Catalog or Encounter | `CatalogViewModel` or `EncounterStateViewModel` -> feature contribution inspector callback -> `CreatureDetailsContentModel` -> `CreatureDetailsView` | Retains the reusable inspector route without adding a separate binder hop. The inspector entry id `creature:<id>` stays unchanged. |

## Frozen Parity Inventory

The selected M5 parity inventory is the M5 Step 1 inventory recorded in the
ledger and baseline. M5 Step 1 closed the remaining production-route gaps for
shared Catalog CRUD controls, Catalog raw input, and SearchFilter controls.
No registered state-tab, dropdown, shell, startup, shared-control, or Catalog
route gap remains open for M5. These scenario and assertion families are
frozen:

| Harness | Frozen scenario and assertion families |
| --- | --- |
| `catalogInitialLoadHarness` | `CatalogContribution` binds production cockpit controls/main through `ShellRuntimeContext`; initial DB-backed Creature rows render in the table; count label reads `2 Monster gefunden`; World Planner faction/location source controls update `EncounterBuilderInputsModel` with faction id `1` and location id `501` (`test/src/view/leftbartabs/catalog/CatalogInitialLoadHarness.java:59-115`). |
| `catalogCrudControlsHarness` | Shared CRUD control projection render, selector row order, selected-label readback, local filtering, no-match placeholder, status layout stability, open/create/rename/delete/reload event fields, external popup hide dismissal, no-selection/invalid-selection blocking, read-only/empty/busy states, button/menu visibility, geometry bounds, and the production Hex route `HexMapContribution -> CatalogCrudControlsView -> HexEditorApplicationService` creating and selecting `Route Map` (`test/src/view/slotcontent/controls/catalogcrud/CatalogCrudControlsHarness.java:45-405`). |
| `catalogControlsRawInputHarness` | Catalog controls projection render emits no input; search edit emits exactly one raw input; clear-all emits one final input and clears search/filters/sources; World Planner source selection emits typed faction/location ids; type and encounter-table chip removal preserve unrelated filters and clear only the selected chip; difficulty auto/slider edits preserve query and publish visible tuning state; production `CatalogContribution` route forwards search text to Creature catalog query and selected type to `EncounterBuilderInputsModel` (`test/src/view/leftbartabs/catalog/CatalogControlsRawInputHarness.java:56-213`). |
| `searchFilterControlsHarness` | SearchFilter projection render emits no input; user search edit emits raw query; clear-all emits one final event and clears query/filters; chip removal preserves query and selected-filter group/option identity; production `WorldPlannerContribution -> SearchFilterControlsView -> WorldPlannerViewModel` keeps matching `Captain Vale` visible and filters nonmatching rows out (`test/src/view/slotcontent/controls/searchfilter/SearchFilterControlsHarness.java:39-130`). |
| `partyDropdownHarness` | `PartyTopBarContribution` binds `ShellSlot.TOP_BAR`; initial trigger text `Keine _Party ▼`, trigger accessible open state, and empty active/reserve roster render; visible create-character flow creates `Aria`; active roster count, `ActivePartyModel`, `ActivePartyCompositionModel`, and trigger text update; remove-to-reserve and add-existing flows update visible counts and published models; no storage-error text is visible (`test/src/view/dropdowns/party/PartyDropdownHarness.java:50-141`). |
| `hexTravelStateBehaviorHarness` | Gradle binds this task to `TravelStateHexHarness`. Proof labels `HEX-TRAVEL-STATE-001` and `HEX-TRAVEL-STATE-002` cover empty compact `Reise` state, then active compact Hex travel readback after creating `Westmark`, creating an active Party member, and moving the Party token: visible icon `W`/`H`, empty/active location text, status `Reisend`, context `Hex-Reise`, weather/time/pace keys and fallback values, pace `Normal`, and hint `Reisegruppe auf der Hex-Karte bewegen` (`test/src/view/statetabs/travel/TravelStateHexHarness.java:44-95`, `build.gradle.kts:637-645`). |
| `encounterStateTabHarness` | `EncounterStateContribution` binds `EncounterStateView` in `ShellSlot.COCKPIT_STATE`; visible title and empty roster text are present; opening saved `Gate Ambush` renders saved plan title, adjusted XP, creature name/facts/count; saving named plan renders `Named Gate Patrol` with proof label `REQ-encounter-named-plan-save`; passive state-tab rendering does not use the inspector (`test/src/view/statetabs/encounter/EncounterStateTabHarness.java:75-100`). |
| `sessionPlannerShellLayoutHarness` | Shell controls panel grows vertically; inserted controls grow; controls/main/state scroll panes preserve scrolling and fit-to-width behavior; Session Planner main renders compact setup strip and scene target; sidebar renders five navigation buttons with two mode separators, expected titles/accessibility/tooltips/resources, missing-graphic fallback for malformed SVG, and loaded World Planner icon; Hex map shell layout still receives visible main area and width (`test/shell/host/SessionPlannerShellLayoutHarness.java:88-185`, `test/shell/host/SessionPlannerShellLayoutHarness.java:200-237`). |
| `smokeStartupHarness` | `ShellViewDiscovery` finds nonempty left-bar, state-tab, and dropdown contributions; `AppBootstrap.createShell()` completes; temp SQLite connection opens and passes `PRAGMA integrity_check`; startup stays within the 60-second envelope (`test/src/bootstrap/SmokeStartupHarness.java:20-57`). |
| `checkBehaviorHarnessTopology` | The retained harness-map topology oracle remains task-success frozen for the M5 harness map. M5 must not relabel or remove selected harnesses to satisfy topology. |
| `checkHarnessMapConsistency` | The retained harness-map consistency oracle remains task-success frozen for the M5 harness map. M5 must not change harness/source mappings except an approved wiring-port reference update. |

The Gradle task main-class bindings for the selected harnesses are frozen in
`build.gradle.kts` for `CatalogInitialLoadHarness`,
`CatalogCrudControlsHarness`, `CatalogControlsRawInputHarness`,
`SearchFilterControlsHarness`, `PartyDropdownHarness`,
`TravelStateHexHarness`, `EncounterStateTabHarness`,
`SessionPlannerShellLayoutHarness`, and `SmokeStartupHarness`
(`build.gradle.kts:525-838`).

A harness wiring-port commit may only update imports, class references,
task/source-set wiring, adapter construction, or production-route binding
required to run the same scenarios against the old structure. It must not add,
remove, rename, split, merge, weaken, or reinterpret scenarios or assertions.

Image parity is not newly implicated by this design because the target does
not change canvas or rendering output. If implementation touches a rendering
surface, the M1.5 render parity net becomes binding for that route.

## Deletion List

The implementation step is incomplete until these files no longer exist:

- `bootstrap/BootstrapFx.java`
- `shell/host/ShellFx.java`
- `src/view/leftbartabs/catalog/CatalogBinder.java`
- `src/view/leftbartabs/catalog/CatalogContributionModel.java`
- `src/view/leftbartabs/catalog/CatalogIntentHandler.java`
- `src/view/dropdowns/party/PartyTopBarBinder.java`
- `src/view/statetabs/travel/TravelStateBinder.java`
- `src/view/statetabs/travel/TravelStateContributionModel.java`
- `src/view/statetabs/travel/TravelStateContentModel.java`
- `src/view/statetabs/encounter/EncounterStateBinder.java`

In-file removal requirements:

- `CatalogContribution` no longer constructs `CatalogBinder`; it constructs
  the Catalog target graph directly.
- `PartyTopBarContribution` no longer constructs `PartyTopBarBinder`; it
  constructs the top-bar target graph directly.
- `TravelStateContribution` no longer constructs `TravelStateBinder`; it
  constructs the Travel target graph directly.
- `EncounterStateContribution` no longer constructs `EncounterStateBinder`; it
  constructs the Encounter state-tab target graph directly.
- `TravelStateView` no longer references `TravelStateContentModel`; it binds
  to `TravelStateViewModel`.
- `SaltMarcherApp`, `SaltMarcherPreloader`, and `DesktopWindowIcons` no longer
  reference `BootstrapFx`.
- Shell host classes no longer reference `ShellFx`.
- No deleted class appears in `src`, `test`, `tools/quality/config`, or
  retained docs except in historical migration records or this design's
  deletion-list evidence.

This deletion list deliberately does not include `CatalogContribution`,
`PartyTopBarContribution`, `TravelStateContribution`, or
`EncounterStateContribution`. They are converted from strict wrappers into
composition points because the byte-compatible shell discovery contract still
finds top-level `*Contribution` classes.

This deletion list also deliberately does not include
`CatalogCrudControlsViewInputEvent`, `SearchFilterControlsViewInputEvent`, or
`DropdownPopupViewInputEvent`; those records are shared seams with live
consumers. Deleting them in M5 would require a wider shared-control migration
and a separate frozen harness inventory.

## Seam Statement

These surfaces stay byte-compatible in M5:

- Shell public APIs: `ShellContribution`, `ShellBinding`,
  `ShellContributionSpec`, `ShellLeftBarTabSpec`, `ShellTopBarSpec`,
  `ShellStateTabSpec`, `ShellSlot`, `ShellLeftBarTabMode`,
  `ShellRuntimeContext`, `ShellControls`, `InspectorSink`,
  `InspectorEntrySpec`, `ServiceRegistry`, `ServiceContribution`,
  `NavigationGroupSpec`, `NavigationGraphicResource`, and `ContributionKey`.
- Shell contribution identity and order: `catalog`, `party`, `travel`, and
  `encounter` keys; Catalog navigation group/order/icon/runtime mode; Party
  top-bar order and `ShellSlot.TOP_BAR`; Travel and Encounter state-tab titles
  and order.
- Shell discovery roots and suffix behavior in `ShellViewDiscovery`, including
  file and jar discovery of top-level `*Contribution` classes.
- Bootstrap service-discovery behavior in `ServiceContributionDiscovery`,
  `ContributionRootClassScanner`, and `JarClassEntrySource`, including service
  contribution class discovery, public no-arg contribution construction,
  service registration order, startup sorting, and current error text.
- Shell layout and validation semantics in `AppShell`, `ShellSlotContent`,
  `ShellSlotValidator`, `ShellWorkspacePane`, `StateTabPane`, and
  `InspectorPane`.
- Shared Catalog CRUD controls: public class/package names, constructor
  behavior, `bind(...)`, `onViewInputEvent(...)`,
  `OPERATION_CONTENT_PROPERTY`, `CatalogCrudControlsViewInputEvent` component
  order/types/accessors, null/trim normalization, and current invalid-id
  behavior in foreign consumers.
- Shared SearchFilter controls: public class/package names, `bind(...)`,
  `onViewInputEvent(...)`, `SearchFilterControlsViewInputEvent` component
  order/types/accessors, selected-filter nested record, and group/option key
  semantics.
- Shared Dropdown popup controls: `DropdownPopupContentModel`,
  `DropdownPopupView`, `DropdownPopupViewInputEvent`, popup presentation/state
  records, trigger/autohide behavior, accessible text, tooltip, popup width,
  and current event component meanings.
- Published domain surfaces consumed by M5: Creature catalog/filter/detail
  commands and models, Encounter builder/state commands and models, Encounter
  Table catalog, Party snapshot/mutation/day summary, Hex editor/travel, and
  World Planner snapshot.
- Creature inspector detail route: inspector title `Creature`, entry id prefix
  `creature:`, and current detail model/view behavior.

The implementation may add internal typed helpers or local carriers, but it
must not remove or weaken these compatibility surfaces in M5.

## String Boundary Targets And Exceptions

| Boundary family | M5 target |
| --- | --- |
| Shell contribution identity and discovery roots | Retained byte-compatible seam. `ContributionKey(String)` and discovery roots/suffixes stay because shell startup and externalized contribution identity depend on them. |
| Catalog Creature filter taxonomy and CR values | Retained published Creature/filter seam and raw-input harness seam. `CatalogViewModel` centralizes conversion from `CatalogControlsViewInputEvent` to domain commands without introducing duplicate parsers. |
| Catalog sort key and sort field/direction names | Retained Catalog UI/published Creature seam. Sort key interpretation stays in `CatalogMainContentModel`; `CatalogViewModel` consumes the existing accessors. |
| Shared Catalog CRUD item identity | Retained shared-control seam for Hex, Session Planner, Dungeon Editor, Dungeon Travel, harnesses, and M5. Invalid shared CRUD ids continue to parse to `0L` in foreign consumers where that is current behavior. |
| SearchFilter group and option keys | Retained shared-control seam for World Planner and harnesses. Malformed user-data behavior remains current behavior and is not fixed in this migration pass. |
| Party editor numeric text | Retained user-input edge. `PartyTopBarViewModel.DraftParser` remains the single parsing owner for level, passive perception, and armor class. These are incomplete user-entered text fields, not finite-domain product-state round-trips. |
| Encounter combatant and action tokens | Retained Encounter published seam. Combatant and initiative ids remain String values at `EncounterStateSnapshot` and `ApplyEncounterStateCommand`; primitive action-code compatibility stays separate from true String combatant-id round-trips. |
| Catalog chip keys including `encounter-table:<id>` | Retained Catalog controls seam. The prefix remains a view-control identity key and must not be silently changed while frozen Catalog harnesses and controls consume it. |

M5 must still eliminate M5-owned forwarding around these seams. A retained
String seam is not permission to keep `CatalogIntentHandler`,
`TravelStateContributionModel`, or binder-only delegation.

## Metric Targets And Exceptions

Baseline values come from the M5.2 baseline artifact measured at committed
`HEAD` `8f7d73e0ec49da0e0b282202648fdf043a5900d7`.

| Metric | Baseline | Target for implementation | Design exception |
| --- | ---: | ---: | --- |
| Primary M5 view/shell files | 82 | <= 75 | The target deletes 10 listed files and may add `CatalogViewModel` plus `TravelStateViewModel`. A higher count requires a design amendment before implementation. |
| Primary M5 view/shell physical LOC | 12,603 | Attempt <= 12,000; reviewed ceiling <= 12,250 | The roadmap's 40% LOC target is not realistic for this UI-heavy shell surface while preserving byte-compatible shell APIs, shared controls, published seams, JavaFX views, and harness raw-input oracles. Any miss over 12,000 requires class-by-class explanation; any miss over 12,250 is Rework unless a judge accepts a new amendment. |
| Direct-route adjacent Creature detail files/LOC | 2 files / 533 LOC | 2 files / <= 533 LOC | Adjacent detail route is retained as a reusable inspector seam; it must not grow unless Catalog/Encounter detail behavior forces a reviewed change. |
| Strict concrete forwarding/proxy classes | 7 | 0 | Contribution classes are not counted as forwarding if and only if they directly own composition after binder deletion. `BootstrapFx`, `ShellFx`, and `TravelStateContributionModel` must be absent. |
| Design-visible binder/intent/holder ceremony | 8 named binder/intent/holder/content files in deletion candidates | <= 2 retained real composition/model owners per M5 subarea | Retained owners must own behavior or projection state; renamed binders, anonymous god-method composition, or empty holder classes are Rework. |
| Longest M5-owned view-to-mutation/readback chain | 6 | <= 3 for Catalog, Party, Travel, and Encounter routes after contribution binding | Retained shell startup/discovery and foreign shared-control consumers may exceed three hops because their seams stay byte-compatible and are not M5-owned route internals. |
| Non-seam M5-owned String round-trips | 7 families baseline | 0 unexplained non-seam M5-owned round-trips | The table above names retained seams/user-input edges. Introducing another String round-trip or duplicating parsers requires a reviewed exception. |
| Shared-control public API breakage | N/A | 0 | Public shared-control records/classes remain byte-compatible. Replacing them with renamed equivalents to claim metric progress is Rework. |

These exceptions are individually justified by byte-compatible consumers and
frozen harness oracles, not by preference. Conformance review must reject any
additional unexplained metric miss or any gamed hit from line compression,
comment deletion, unrelated merges, duplicate-helper rephrasing, or class
renaming without deletion-list execution.

## Wiring Port Boundary

M5.4 may:

- verify that no harness wiring change is needed for the retained shared-control
  and Catalog event records;
- mechanically update harness imports or construction references only if the
  approved deletion-list classes are referenced by frozen harness code;
- introduce `CatalogViewModel` and `TravelStateViewModel` as compatibility
  seams while old binders still delegate through the old route, if that is
  needed to keep the wiring-port commit behavior-neutral and buildable;
- move direct JavaFX helper calls only when required to keep compilation green
  before deletion, without changing visible behavior.

M5.4 must not:

- delete production classes from the approved deletion list;
- change visible text, accessible text, CSS classes, ordering, default state,
  fixture values, assertion labels, proof labels, popup behavior, or startup
  selection;
- change domain published command/model semantics;
- weaken, suppress, bypass, or game CPD/PMD/CKJM/layer/cycle checks;
- change the frozen harness scenarios or assertions.

If no harness wiring change is required, M5.4 still records that result in the
ledger before M5.5 implementation starts.

## Untouched Surfaces

- `src/data/**` persistence, schema, mapper, gateway, and repository structure
  stay unchanged unless a migrated boundary requires an approved gateway
  signature adaptation.
- `src/domain/**` published commands, snapshots, models, and service APIs
  consumed by M5 stay byte-compatible.
- Already migrated Hex, World Planner, Session Planner, Dungeon Editor, Dungeon
  Travel, Encounter, and Party domain internals stay outside M5 implementation
  except where they consume retained shared-control seams.
- Shared Catalog CRUD, SearchFilter, and Dropdown popup control APIs stay
  byte-compatible.
- Harness scenarios, assertion labels, fixture values, proof labels, owner
  smoke oracles, and visible user behavior stay unchanged.
- Image/render parity remains unchanged unless implementation touches a
  rendering surface.

## Conformance Review Checklist

The M5.6 conformance review must verify:

- all deletion-list files are absent;
- stale references to deletion-list classes are absent from `src`, `test`, and
  quality configuration unless retained historical docs are explicitly
  excluded;
- the four contribution classes directly own composition and are no longer
  strict forwarding wrappers;
- `CatalogViewModel` and `TravelStateViewModel` own the target responsibilities
  without recreating deleted binders/holders under new names;
- `BootstrapFx` and `ShellFx` are deleted through direct JavaFX API use, not
  replaced by renamed forwarding helpers;
- shared-control public APIs remain byte-compatible;
- shell service registry/contribution SPI, navigation metadata, service
  discovery, and file/jar contribution discovery remain byte-compatible;
- Encounter primitive action-code compatibility remains separated from true
  combatant-id String round-trips;
- Catalog chip keys including `encounter-table:<id>` remain stable;
- frozen harness inventory, topology/map consistency, production handoff,
  Phase 1 review, and Phase 2 judge review are green;
- metric targets are met or each miss is individually justified and accepted
  by the judge;
- static/duplication findings are structurally addressed, with no CPD gaming by
  duplicate-helper rephrasing.

## Required Reviews

Phase 1 and Phase 2 must approve this artifact before M5.4 starts. Reviewers
must check that the design names target classes, representative call chains,
the full deletion list, byte-compatible seams, untouched surfaces, frozen
parity inventory, wiring-port boundary, and each metric target or exception
above. A vague "details during implementation" response is Rework.
