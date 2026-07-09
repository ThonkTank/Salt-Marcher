Status: Active
Owner: SaltMarcher Team
Last Reviewed: 2026-07-09
Source of Truth: Current architecture migration position, in-flight work,
area status, harness status, and close-out notes for the roadmap in
`docs/project/architecture/architecture-migration-roadmap.md`.

# Architecture Migration Ledger

## Purpose

This ledger is the single source of truth for the architecture migration state.
It records the active milestone, the current work item, area status, merge
commit state, and harness status. Chat plans and pass logs may describe work,
but they do not advance the migration unless this ledger advances too.

## State Rules

- At most one roadmap work item may be `In Flight`.
- Area rows stay `Pending` until their per-area cycle starts.
- `Merge Commit` records the commit that reaches the integration branch after
  PR merge. Local branch commits are recorded in the step log until merged.
- Harness status is `M1.1 Pending` until the parity-oracle inventory closes it.
- Data layer code is excluded from per-area migration unless a migrated area's
  slimmer boundary requires a gateway signature adaptation.

## Current Position

| Field | Value |
| --- | --- |
| Branch | `codex/architecture-migration-m0-charter` |
| Milestone | M2 - Pilot hex |
| Work item | M2.7 - Hex close-out |
| Cycle step | 7 - Close-out |
| In-flight area | `hex` |
| Required next proof | Ledger close-out, German status note, owner smoke checklist availability, Hex reference commit declaration, and M2 retro |
| Last status note | `2026-07-09 M2.6 hex-conformance-review` |

## M0 Step Ledger

| Step | Status | Local branch commit | Merge commit | Proof | Notes |
| --- | --- | --- | --- | --- | --- |
| M0.1 Charter | Done | `0ff4c2f82` | Pending PR merge | `./gradlew checkDocumentationEnforcement --console=plain` passed, 2026-07-09 | Roadmap materialized under `docs/project/architecture/`. |
| M0.2 AGENTS.md amendment | Done | `0b8aa4637` | Pending PR merge | `./gradlew checkDocumentationEnforcement --console=plain` passed, 2026-07-09 | Rule 3, R3c, source-owner routing, and migration-regime pointer updated. |
| M0.3 Migration ledger | Done on branch | `efd59b7cf` | Pending PR merge | `./gradlew checkDocumentationEnforcement --console=plain` passed, 2026-07-09 | This ledger becomes the state source; next work item is M0.4. |
| M0.4 Global removal of form enforcement | Done on branch | `e00a92990` | Pending PR merge | `tools/gradle/run-staged-verification.sh production-handoff` passed, 2026-07-09; `./gradlew architectureTest --console=plain` passed, 2026-07-09; `./gradlew checkDocumentationEnforcement --console=plain` passed, 2026-07-09; judge review Clean | Removed form-enforcing ErrorProne/build-harness doctrine gates and retained outcome gates, including package cycles, layer dependency direction, documentation basics, and behavior-harness gates. |
| M0.5 Doctrine doc and skill removal | Done on branch | `e38758af3` | Pending PR merge | `tools/gradle/run-staged-verification.sh production-handoff` passed, 2026-07-09; `./gradlew checkDocumentationEnforcement --console=plain` passed, 2026-07-09; stale-doctrine grep clean; fresh-agent check passed; judge review Approve | Deleted retired domain/view/feature-runtime pattern docs, architecture enforcement inventories, doctrine-teaching skills, and the dead domain-context documentation rule; live routers now point to the roadmap, ledger, retained outcome gates, and public proof routes. |

## M1 Step Ledger

| Step | Status | Local branch commit | Merge commit | Proof | Notes |
| --- | --- | --- | --- | --- | --- |
| M1.1 Harness inventory | Done on branch | `90e4ac7ac` | Pending PR merge | `./gradlew checkDocumentationEnforcement --console=plain` passed, 2026-07-09; `git diff --check` passed; judge review Approve | Existing harnesses, imported boundary surfaces, scenario coverage, and current gaps are listed below for every migration area. |
| M1.2 Parity protocol | Done on branch | `a027ac712` | Pending PR merge | `./gradlew checkDocumentationEnforcement --console=plain` passed, 2026-07-09; `git diff --check` passed; Phase 1 Clean; Phase 2 Approve | Roadmap protocol freezes scenario/assertion inventories in per-area designs, keeps wiring ports separate, closes gaps against old structure, and handles nondeterministic old behavior through deterministic envelopes plus R2 issue filing. |
| M1.3 Pilot harness hardening | Done on branch | `6d9747a5d` | Pending PR merge | `./gradlew hexMapEditorBehaviorHarness hexTravelStateBehaviorHarness --console=plain` passed, 2026-07-09; `./gradlew checkDocumentationEnforcement --console=plain` passed, 2026-07-09; `git diff --check` passed; Phase 1 Clean; Phase 2 Approve | Hex Map and Reise state-tab production-route gaps are closed against the old structure. |
| M1.4 Owner smoke scripts | Done on branch | `b63bdb458` | Pending PR merge | `./gradlew checkDocumentationEnforcement --console=plain` passed, 2026-07-09; `git diff --cached --check` passed; Phase 1 Clean; Phase 2 Approve | German owner smoke checklists for all 13 ledger areas are in `docs/project/architecture/architecture-migration-owner-smoke-checklists.md`. |
| M1.5 Render parity net | Done on branch | `819f95cc4` | Pending PR merge | `./gradlew dungeonMapRenderParityHarness --console=plain` passed, 2026-07-09; `./gradlew checkDocumentationEnforcement --console=plain` passed, 2026-07-09; `git diff --check` passed; Phase 1 Clean; Phase 2 Approve | `dungeonMapRenderParityHarness` adds same-frame image snapshot parity for editor projection, editor wall preview, and travel projection; generated images stay under `build/dungeon-map-render-parity-results/`. |

## M2 Hex Cycle Ledger

| Cycle step | Status | Local branch commit | Merge commit | Proof | Notes |
| --- | --- | --- | --- | --- | --- |
| 1. Harness check/closure | Done on branch | `4eb00535c` | Pending PR merge | `./gradlew hexMapEditorBehaviorHarness hexTravelStateBehaviorHarness --console=plain` passed, 2026-07-09; `./gradlew checkDocumentationEnforcement --console=plain` passed, 2026-07-09; `git diff --check` passed; Phase 1 Clean; Phase 2 Approve | `HEX-EDITOR-013` closes the production-route map-save failure visibility gap against the old Hex structure. |
| 2. Baseline metrics | Done on branch | `d7b66a3da` | Pending PR merge | `./gradlew checkDocumentationEnforcement --console=plain` passed, 2026-07-09; `git diff --check` passed; Phase 1 Clean after rework; Phase 2 Approve | Baseline artifact: `docs/project/architecture/architecture-migration-hex-baseline.md`; full roadmap set is 87 files / 5,564 physical LOC; product subset is 70 files / 4,560 physical LOC; dominant Hex-owned chains are 5 hops; 6 product/published forwarding candidates plus 1 data candidate; 5 product String round-trip families. |
| 3. Target design | Done on branch | `153aebd3b` | Pending PR merge | `./gradlew checkDocumentationEnforcement --console=plain` passed, 2026-07-09; `git diff --check` passed; Phase 1 Clean after rework; Phase 2 Approve | Approved design artifact: `docs/project/architecture/architecture-migration-hex-target-design.md`; names target classes, representative call chains, deletion list, byte-compatible seams, frozen parity inventory, wiring-port boundary, and metric exceptions. |
| 4. Harness wiring port | Done on branch | `492ceb3eb` | Pending PR merge | `./gradlew compileJava compileTestJava --console=plain` passed, 2026-07-09; `./gradlew checkNoDeadCode pmdStrictMain --console=plain` passed, 2026-07-09; `./gradlew hexMapEditorBehaviorHarness hexTravelStateBehaviorHarness --console=plain` passed, 2026-07-09; `tools/gradle/run-staged-verification.sh production-handoff` passed, 2026-07-09; `git diff --check` passed; Phase 1 Clean; Phase 2 Approve | `HexMapViewModel` is a compatibility facade over the existing content/contribution models; Hex view and harness wiring now route through it. Harness scenario/assertion labels are frozen, and the old content models, input event records, and `HexMapIntentHandler` remain for M2.5 replacement. |
| 5. Implementation | Done on branch | `3679a19e2` | Pending PR merge | `./gradlew compileJava compileTestJava --console=plain` passed, 2026-07-09; `./gradlew checkNoDeadCode pmdStrictMain --console=plain` passed, 2026-07-09; `env -u CODEX_THREAD_ID ./gradlew hexMapEditorBehaviorHarness hexTravelStateBehaviorHarness --console=plain` passed with 21 + 2 proof items, 2026-07-09; `tools/gradle/run-staged-verification.sh production-handoff` passed, 2026-07-09; `git diff --cached --check` passed; Phase 1 and Phase 2 Approve with explicit metric exception | Implemented the approved Hex target shape, deleted the per-verb usecase/port/published-state/view content/input/handler stack, kept byte-compatible published seams, and accepted the bounded 41-file / 3,701-LOC M2.5 exception from amendment commit `9e852113b`. Retained harness-log attempts hit a Gradle wildcard-IP startup environment failure before task execution; direct non-redirected harness execution was green. |
| 6. Conformance review | Done on branch | `6432a1b2f` | Pending PR merge | Phase 1 Approve with explicit metric exception; Phase 2 Approve with explicit metric exception; product subset 41 Java files / 3,701 physical LOC; deletion list executed; forwarding-only Hex product classes absent; Hex-owned intent-to-mutation chains <=3; non-seam String round-trips absent; `tools/gradle/run-staged-verification.sh production-handoff` passed, 2026-07-09 | Conformance review accepted the M2.5 LOC exception from design amendment `9e852113b`, verified byte-compatible seams, accepted direct Hex harness proof after retained-log attempts failed before task execution on Gradle wildcard-IP environment startup, and found no Must-Fix findings. |
| 7. Close-out | In Flight | Pending | Pending PR merge | Pending | Ledger update, German status note, owner smoke checklist available, Hex reference commit declaration, and M2 retro. |

## Milestone Ledger

| Milestone | Status | Merge commit | Done-when evidence |
| --- | --- | --- | --- |
| M0 - Constitution and doctrine removal | Done on branch | Pending | Gates green; removed checker/doc/skill grep clean; fresh-agent behavior check passed. |
| M1 - Parity oracle | Done on branch | Pending | Ledger lists harness status for every area; parity protocol committed; hex harness verified end to end; render snapshot parity net added. |
| M2 - Pilot hex | In Flight | Pending | Binding targets met or justified; harness green with frozen scenarios; smoke checklist delivered; reference commit declared; retro journaled. |
| M3 - Rollout wave 1 | Pending | Pending | worldplanner, creatures, party, sessionplanner, encountertable, encounter all complete their cycles. |
| M4 - Dungeon | Pending | Pending | Five dungeon sub-slices complete full cycles with dungeon harness suite and required image snapshots. |
| M5 - Remaining view surfaces and shell seam | Pending | Pending | Remaining view surfaces and shell seams complete cycles; data layer exceptions only where gateway signatures require. |
| M6 - Completion | Pending | Pending | Old role family no longer taught or enforced; final measurement and German closing report complete. |

## Area Ledger

| Area | Standard | Status | Merge commit | Harness status |
| --- | --- | --- | --- | --- |
| `hex` | Legacy surrounding code until M2 design; then pilot reference commit | In Flight | Pending | M2.1 closed: `hexMapEditorBehaviorHarness` covers the shell-bound Hex Map route through `HexMapContribution`, production-route map save failure visibility, and Hex editor read/write behavior; `hexTravelStateBehaviorHarness` covers the production Hex/Party publication route into the Reise state tab. |
| `worldplanner` | Legacy surrounding code until M3 design; then pilot reference | Pending | Pending | M1.1 inventory: backend, UI, raw-input, and encounter harnesses; P1 cross-context worldplanner-to-encounter route gap remains. |
| `creatures` | Legacy surrounding code until M3 design; then pilot reference | Pending | Pending | M1.1 inventory: adjacent worldplanner and encounter harness imports only; P2 dedicated creature catalog harness gap remains. |
| `party` | Legacy surrounding code until M3 design; then pilot reference | Pending | Pending | M1.1 inventory: `partyDropdownHarness` plus travel-adjacent imports; P1 shell-bound dropdown route gap remains. |
| `sessionplanner` | Legacy surrounding code until M3 design; then pilot reference | Pending | Pending | M1.1 inventory: catalog and shell-layout harnesses; no registered M1.1 gap. |
| `encountertable` | Legacy surrounding code until M3 design; then pilot reference | Pending | Pending | M1.1 inventory: adjacent worldplanner UI imports only; P2 dedicated encounter-table readback harness gap remains. |
| `encounter` | Legacy surrounding code until M3 design; then pilot reference | Pending | Pending | M1.1 inventory: `worldPlannerEncounterHarness`, `encounterStateTabHarness`; P1 production publication route gaps remain. |
| `dungeon-authored-core` | Legacy surrounding code until M4.1 design; then pilot reference plus approved dungeon design | Pending | Pending | M1.1 inventory: `dungeonEditorCoreBehaviorHarness` plus mapped domain tasks `dungeonEditorBehaviorHarness`, `dungeonEditorRouteBehaviorHarness`, `dungeonEditorDoorBehaviorHarness`, `dungeonEditorWallBehaviorHarness`, `dungeonEditorRoomBehaviorHarness`, `dungeonEditorClusterBehaviorHarness`, `dungeonEditorCorridorBehaviorHarness`, `dungeonEditorStairBehaviorHarness`, `dungeonEditorTransitionBehaviorHarness`, `dungeonEditorFeatureBehaviorHarness`; no registered M1.1 gap. |
| `dungeon-editor-session-runtime` | Legacy surrounding code until M4.2 design; then pilot reference plus approved dungeon design | Pending | Pending | M1.1 inventory: mapped feature tasks `dungeonEditorBehaviorHarness`, `dungeonEditorCoreBehaviorHarness`, `dungeonEditorRouteBehaviorHarness`, `dungeonEditorDoorBehaviorHarness`, `dungeonEditorWallBehaviorHarness`, `dungeonEditorRoomBehaviorHarness`, `dungeonEditorClusterBehaviorHarness`, `dungeonEditorCorridorBehaviorHarness`, `dungeonEditorStairBehaviorHarness`, `dungeonEditorTransitionBehaviorHarness`, `dungeonEditorFeatureBehaviorHarness`, and `dungeonTravelProjectionLevelHarness`; no registered M1.1 gap. |
| `dungeon-travel` | Legacy surrounding code until M4.3 design; then pilot reference plus approved dungeon design | Pending | Pending | M1.1 inventory: `dungeonTravelProjectionLevelHarness`; no registered M1.3 Hex Reise state-tab gap remains. |
| `dungeon-rendering-pipeline` | Legacy surrounding code until M4.4 design; then pilot reference plus approved dungeon design | Pending | Pending | M1.1 inventory: exact indirect render consumers are `dungeonEditorBehaviorHarness`, `dungeonEditorRouteBehaviorHarness`, `dungeonEditorDoorBehaviorHarness`, `dungeonEditorWallBehaviorHarness`, `dungeonEditorRoomBehaviorHarness`, `dungeonEditorClusterBehaviorHarness`, `dungeonEditorCorridorBehaviorHarness`, `dungeonEditorStairBehaviorHarness`, `dungeonEditorTransitionBehaviorHarness`, `dungeonEditorFeatureBehaviorHarness`, and `dungeonTravelProjectionLevelHarness`; M1.5 image snapshot parity is mandatory before migration. |
| `dungeon-editor-view` | Legacy surrounding code until M4.5 design; then pilot reference plus approved dungeon design | Pending | Pending | M1.1 inventory: mapped view tasks `dungeonEditorBehaviorHarness`, `dungeonEditorCoreBehaviorHarness`, `dungeonEditorRouteBehaviorHarness`, `dungeonEditorDoorBehaviorHarness`, `dungeonEditorWallBehaviorHarness`, `dungeonEditorRoomBehaviorHarness`, `dungeonEditorClusterBehaviorHarness`, `dungeonEditorCorridorBehaviorHarness`, `dungeonEditorStairBehaviorHarness`, `dungeonEditorTransitionBehaviorHarness`, `dungeonEditorFeatureBehaviorHarness`; no registered M1.1 gap. |
| `remaining-view-and-shell` | Legacy surrounding code until M5 design; then pilot reference | Pending | Pending | M1.1 inventory: catalog, search-filter, dropdown, state-tab, shell-layout, and startup harnesses; P1 dropdown and encounter state-tab gaps plus image parity where rendering is involved. |

## M1 Harness Inventory

| Area | Existing harnesses | Imported boundary surfaces | Scenario coverage | Known gaps |
| --- | --- | --- | --- | --- |
| `hex` | `hexMapEditorBehaviorHarness`, `hexTravelStateBehaviorHarness` | `HexEditorApplicationService`, `HexTravelApplicationService`, `HexEditorModel`, `HexEditorSnapshot`, hex command records, `HexTravelModel`, `HexTravelSnapshot`, party travel models, Hex Map content/control models, `HexMapContribution`, `ShellBinding`, `ShellSlot`, `TravelStateContribution` | Create, update, select, paint, marker save, radius errors, persistence readback, save failure visibility, travel token readback, shell-bound Hex Map route, and production Hex/Party Reise state-tab readback | M1.3 route gaps and the M2.1 save-failure visibility gap are closed; scenarios and assertions are frozen for M2 baseline unless a separate wiring-port commit is approved. |
| `worldplanner` | `worldPlannerBackendHarness`, `worldPlannerUiHarness`, `worldPlannerControlsRawInputHarness`, `worldPlannerEncounterHarness` | `WorldPlannerApplicationService`, `WorldPlannerSnapshotModel`, world planner commands/reference ports, `WorldPlannerSnapshot`, creature and encounter-table published catalogs, encounter application/usecase surfaces | NPC/faction/location mutations, reference validation, persistence errors/readback, raw input controls, UI projection, encounter generation/session bridge | P1 cross-context route uses fixture world snapshots and fixture encounter repository |
| `creatures` | None dedicated; adjacent worldplanner UI and encounter state-tab harnesses import creature surfaces | `CreaturesApplicationService`, `CreatureCatalogPort`, catalog usecases, `CreatureCatalogModel/Page/Row`, `CreatureDetailModel`, `CreatureLookupStatus` | Adjacent lookup, display, and encounter candidate use only | P2 dedicated create/edit/filter/readback catalog harness |
| `party` | `partyDropdownHarness`; also imported by hex and dungeon travel harnesses | `PartyApplicationService`, active-party composition/model, party snapshot/mutation models, character commands, travel position snapshots, dropdown content model | Create character, move between active/reserve, active-party publication, trigger label, travel-token publication consumers | P1 shell-bound dropdown route |
| `sessionplanner` | `sessionPlannerCatalogHarness`, `sessionPlannerShellLayoutHarness` | `SessionPlannerContribution`, `SessionPlannerCatalogModel`, current-session, scene timeline, participants projections, `ShellBinding`, `ShellSlot`, session data mappers | Catalog create/rename/select/delete, scene timeline, loot placeholders, session-scoped drafts, compact shell layout | No registered M1.1 gap |
| `encountertable` | None dedicated; adjacent worldplanner UI harness imports table catalog surfaces | `EncounterTableCatalogModel`, `EncounterTableCatalogResult`, `EncounterTableSummary`, `EncounterTableReadStatus` | Adjacent catalog display/reference lookup only | P2 readback harness for authored summary, weighted candidates, empty selection, XP ceiling, and storage-error publication |
| `encounter` | `worldPlannerEncounterHarness`, `encounterStateTabHarness` | `EncounterApplicationService`, encounter generation/session/plan usecases, `ApplyEncounterStateCommand`, `EncounterStateModel`, `EncounterStateSnapshot`, saved-plan summaries, creature candidate surfaces | Encounter draft generation, saved-plan/session publication, encounter state-tab empty and populated render assertions | P1 encounter state-tab and worldplanner cross-context production publication route gaps |
| `dungeon-authored-core` | `dungeonEditorCoreBehaviorHarness` aggregate; harness-map also routes domain changes through `dungeonEditorBehaviorHarness`, `dungeonEditorRouteBehaviorHarness`, `dungeonEditorDoorBehaviorHarness`, `dungeonEditorWallBehaviorHarness`, `dungeonEditorRoomBehaviorHarness`, `dungeonEditorClusterBehaviorHarness`, `dungeonEditorCorridorBehaviorHarness`, `dungeonEditorStairBehaviorHarness`, `dungeonEditorTransitionBehaviorHarness`, `dungeonEditorFeatureBehaviorHarness` | Dungeon core geometry, component, structure, room, door, corridor, stair, transition, topology, and published ref/value surfaces | Core suite IDs `geometry`, `component`, `floor`, `wall-core`, `door-core`, `path-core`, `corridor-core`, `stair-core`, `transition-core`, `runtime-projection`, `topology`, `cluster-core`, `room-core`, `structure`; focused route tasks exercise authored-core consumers | No registered M1.1 gap |
| `dungeon-editor-session-runtime` | `dungeonEditorBehaviorHarness`, `dungeonEditorCoreBehaviorHarness`, `dungeonEditorRouteBehaviorHarness`, `dungeonEditorDoorBehaviorHarness`, `dungeonEditorWallBehaviorHarness`, `dungeonEditorRoomBehaviorHarness`, `dungeonEditorClusterBehaviorHarness`, `dungeonEditorCorridorBehaviorHarness`, `dungeonEditorStairBehaviorHarness`, `dungeonEditorTransitionBehaviorHarness`, `dungeonEditorFeatureBehaviorHarness`, `dungeonTravelProjectionLevelHarness` | `DungeonServiceContribution`, dungeon editor published snapshots/commands, runtime pointer targets, prepared frame/render frame surfaces, `DungeonMapView`, `DungeonMapContentModel` | Route suite IDs `map-catalog`, `map-controls`, `projection-overlay`, `selection`, `stairs`, `transitions`, `features`, `corridors`, `labels`, `shared-handles`, `door-handles`, `cluster-handles`, `cluster-routes`, `doors`, `rooms`, `walls`; projection-level travel runtime checks | No registered M1.1 gap |
| `dungeon-travel` | `dungeonTravelProjectionLevelHarness` | `DungeonTravelRuntimeApplicationService`, `ApplyTravelDungeonSessionCommand`, `TravelDungeonModel`, `TravelDungeonSnapshot`, party travel positions, `DungeonTravelContribution`, `DungeonMapView` | Projection-level controls, rendered level changes, transition marker refs, party-token actor layer, no authored truth mutation | No registered M1.1 gap |
| `dungeon-rendering-pipeline` | Indirect consumers: `dungeonEditorBehaviorHarness`, `dungeonEditorRouteBehaviorHarness`, `dungeonEditorDoorBehaviorHarness`, `dungeonEditorWallBehaviorHarness`, `dungeonEditorRoomBehaviorHarness`, `dungeonEditorClusterBehaviorHarness`, `dungeonEditorCorridorBehaviorHarness`, `dungeonEditorStairBehaviorHarness`, `dungeonEditorTransitionBehaviorHarness`, `dungeonEditorFeatureBehaviorHarness`, `dungeonTravelProjectionLevelHarness` | `DungeonMapContentModel`, `DungeonMapView`, prepared frame facts, render frame/scene state, dungeon editor map snapshots | Render model state, visible topology refs, actors, projection overlays, level-specific map content | M1.5 image snapshot parity required before render migration |
| `dungeon-editor-view` | `dungeonEditorBehaviorHarness`, `dungeonEditorCoreBehaviorHarness`, `dungeonEditorRouteBehaviorHarness`, `dungeonEditorDoorBehaviorHarness`, `dungeonEditorWallBehaviorHarness`, `dungeonEditorRoomBehaviorHarness`, `dungeonEditorClusterBehaviorHarness`, `dungeonEditorCorridorBehaviorHarness`, `dungeonEditorStairBehaviorHarness`, `dungeonEditorTransitionBehaviorHarness`, `dungeonEditorFeatureBehaviorHarness` | `DungeonEditorContribution`, controls/main/state slot surfaces, editor published controls/map/inspector snapshots, dungeon map content/control views | Shell-bound editor contribution route plus focused control, selection, marker, room, wall, door, corridor, stair, and transition assertions | No registered M1.1 gap |
| `remaining-view-and-shell` | `catalogInitialLoadHarness`, `catalogCrudControlsHarness`, `catalogControlsRawInputHarness`, `searchFilterControlsHarness`, `partyDropdownHarness`, `hexTravelStateBehaviorHarness`, `encounterStateTabHarness`, `sessionPlannerShellLayoutHarness`, `smokeStartupHarness` | Catalog/search controls, dropdown content model, state-tab published models, shell contributions/bindings/slots, startup SQLite factory | Catalog load/CRUD/raw input, search filtering, dropdown component behavior, travel/encounter state-tab render, shell layout, startup smoke | P1 dropdown and encounter state-tab production-route gaps; image parity required where rendering is touched |

## Owner Status Notes

### 2026-07-09 M0.1 charter

Die Migrations-Roadmap ist als aktives Architektur-Dokument im Repo
eingetragen. Es gab keine Produktionscode-Aenderung; das Dokumentationsgate
war gruen.

### 2026-07-09 M0.2 agent-guide

`AGENTS.md` routet die Migration jetzt auf die Roadmap: Outcome-Gates bleiben
bindend, alte Form-Checks werden im M0-Pfad entfernt, und R3c blockiert die
Roadmap-Migration nicht.

### 2026-07-09 M0.3 ledger-start

Der Ledger ist angelegt und setzt M0.4 als naechsten In-Flight-Schritt. Noch
ist keine Produkt-Area gestartet; alle Area-Zeilen bleiben pending bis zur
M1/M2-Zyklusarbeit.

### 2026-07-09 M0.4 form-enforcement-removal

Die alten Form-Enforcement-Gates sind aus Build-Logic, Build-Harness,
Error-Prone, architecture-policy und jQAssistant entfernt. Die behaltenen
Outcome-Gates bleiben aktiv: Package-Zyklen, Layer-Dependency-Direction,
Dokumentationsgrundregeln und Behavior-Harness-Gates sind gruen; der
unabhaengige Judge hat die Nachpruefung ohne Must-Fix geschlossen.

### 2026-07-09 M0.5 doctrine-removal

Die alten Domain/View/Feature-Runtime-Doktrin-Dokumente, die
Architecture-Enforcement-Inventare und die zugehoerigen Lehr-Skills sind aus
dem Repo entfernt. Lebende Router zeigen jetzt auf Roadmap, Ledger, echte
Outcome-Gates und die oeffentlichen Proof-Routen; der Fresh-Agent-Check hat
keine alte Rule-3/Formdoktrin mehr reproduziert, und der unabhaengige Judge hat
M0.5 nach Rework freigegeben.

### 2026-07-09 M1.1 harness-inventory

Der Ledger listet jetzt fuer jede Migrations-Area die vorhandenen Harnesses,
importierten Boundary-Surfaces, Szenarioabdeckung und bekannten Gaps. Die
Dokumentationspruefung ist gruen; der unabhaengige Judge hat die Inventur nach
Rework freigegeben. Naechster Schritt ist M1.2, das Einfrieren des
Parity-Protokolls.

### 2026-07-09 M1.2 parity-protocol

Die Roadmap enthaelt jetzt das verbindliche Parity-Protokoll: Szenarien und
Assertions werden im per-area Design-Artefakt materialisiert und vor dem ersten
Wiring-Port eingefroren; Wiring-Ports bleiben eigene Vorab-Commits, und
nichtdeterministisches Altverhalten wird nur als deterministische Envelope plus
R2-Issue dokumentiert. Phase 1 und der unabhaengige Judge haben den Schritt
freigegeben. Naechster Schritt ist M1.3 Hex-Harness-Haertung.

### 2026-07-09 M1.3 hex-harness-hardening

Die beiden offenen Hex-Produktionsrouten sind gegen die alte Struktur
abgedeckt: `hexMapEditorBehaviorHarness` bindet `HexMapContribution` durch die
Shell-Slots und prueft Erstellen, Bearbeiten, Malen, Auswaehlen, Marker,
Reisegruppe und Reload; `hexTravelStateBehaviorHarness` treibt Hex- und
Party-Services bis in das kompakte `Reise`-State-Tab. Der kombinierte
Hex-Harness, das Dokumentationsgate, Phase 1 und der unabhaengige Judge sind
gruen. Naechster Schritt ist M1.4 mit deutschen Owner-Smoke-Checklisten.

### 2026-07-09 M1.4 owner-smoke-checklists

Die deutschen Owner-Smoke-Checklisten liegen jetzt neben Roadmap und Ledger in
`docs/project/architecture/architecture-migration-owner-smoke-checklists.md`.
Alle 13 aktuellen Ledger-Areas haben je zehn kurze, sichtbare Pruefschritte;
die Checklisten definieren kein neues Produktverhalten und blockieren die
Pipeline nicht. Dokumentationsgate, Phase 1 und der unabhaengige Judge sind
gruen. Naechster Schritt ist M1.5 mit Render-Snapshot-Parity.

### 2026-07-09 M1.5 render-parity-net

Der neue `dungeonMapRenderParityHarness` erzeugt Bild-Snapshots fuer die
Dungeon-Karte und vergleicht echte Canvas-Pixel paarweise: Editor-Projektion,
Editor-Wandpreview und Dungeon-Travel-Projektion rendern denselben Frame
zweimal mit `changedPixels=0`; die Editor-Kontrollvergleiche beweisen
zusaetzlich, dass der Diff-Orakel sichtbare Aenderungen erkennt. PNG-Belege
liegen nur unter `build/dungeon-map-render-parity-results/`. Die alte
Dungeon-Travel-Auffaelligkeit, dass `z=0` und `z=1` aktuell pixelgleich bleiben
koennen, ist als separater R2-Eintrag journalisiert und in der Migration nicht
repariert. M1 ist damit auf dem Branch abgeschlossen; naechster Schritt ist
M2.1 Hex-Harness-Check.

### 2026-07-09 M2.1 hex-harness-closure

Die M2.1-Harness-Pruefung hat die verbleibende Hex-Save-Failure-Luecke gegen
die alte Struktur geschlossen: `HEX-EDITOR-013` treibt das State-Panel
`Speichern` durch `HexMapStateView`, `HexMapIntentHandler`, Domain-Use-Case und
SQLite-Update und erzwingt dort einen Speicherfehler. Der Fehler erscheint
sichtbar im State-Panel, und der persistierte Kartenname bleibt unveraendert.
Der kombinierte Hex-Harness, das Dokumentationsgate, `git diff --check`, Phase
1 und der unabhaengige Judge sind gruen. Naechster Schritt ist M2.2 mit
Baseline-Metriken fuer die Hex-Pilotflaeche.

### 2026-07-09 M2.2 hex-baseline-metrics

Die Hex-Baseline ist in
`docs/project/architecture/architecture-migration-hex-baseline.md`
festgehalten. Der reproduzierbare Roadmap-Schnitt umfasst 87 Java-Dateien mit
5.564 physischen LOC; die normale M2-Produktstruktur ohne Data-Layer umfasst
70 Dateien mit 4.560 LOC. Die laengsten Hex-eigenen User-Action-Ketten liegen
bei 5 Hops bis zur ersten Mutation; der Reisegruppen-Pfad ist als laengerer
Cross-Area-Seam fuer das Target-Design markiert. Forwarding-Kandidaten und
String-Roundtrips sind konkret mit Repo-Pfaden und Zeilen belegt.
Dokumentationsgate, `git diff --check`, Phase 1 und der unabhaengige Judge sind
gruen. Naechster Schritt ist M2.3 mit judge-geprueftem Hex-Target-Design; es
wurde noch keine Wiring- oder Implementierungsarbeit begonnen.

### 2026-07-09 M2.3 hex-target-design

Das Hex-Target-Design ist in
`docs/project/architecture/architecture-migration-hex-target-design.md`
genehmigt. Es legt die Zielklassen, Repraesentativketten, Loeschliste,
byte-kompatiblen Seams, eingefrorene Parity-Inventur, Wiring-Port-Grenze und
Metrik-Ausnahmen konkret fest. Nach Rework war Phase 1 sauber; der
unabhaengige Judge hat M2.3 freigegeben. Dokumentationsgate und
`git diff --check` sind gruen. Naechster Schritt ist M2.4: ein reiner
Wiring-Port auf die `HexMapViewModel`-Kompatibilitaetsgrenze, ohne Szenario-
oder Assertion-Aenderung und ohne Implementierung.

### 2026-07-09 M2.4 hex-wiring-port

Der Hex-Wiring-Port ist als eigener Commit abgeschlossen. `HexMapViewModel`
buendelt vorlaeufig die alten Content- und Contribution-Modelle; Binder,
IntentHandler, Views und Hex-Harness nutzen diese Kompatibilitaetsgrenze,
ohne Szenarien, Assertion-Texte oder sichtbares Verhalten zu aendern. Die
alten Content-Models, Input-Event-Records und `HexMapIntentHandler` bleiben
fuer M2.5 noch vorhanden. Hex-Harnesses, Produktions-Handoff, Phase 1 und der
unabhaengige Judge sind gruen. Naechster Schritt ist M2.5: Umsetzung des
genehmigten Designs mit ausgefuehrter Loeschliste und weiter eingefrorenen
Harness-Orakeln.

### 2026-07-09 M2.5 hex-implementation

Die Hex-Implementierung ersetzt den vorlaeufigen Facade-Inhalt durch das
genehmigte Zielmodell: Editor- und Reise-Services besitzen jetzt die alten
Use-Case-Pfade direkt, `HexMapViewModel` und `HexMapVocabulary` tragen die
getypte View-Projektion, und die Loeschliste fuer Usecases, Ports,
Published-State-Adapter, Content-Models, Input-Events und `HexMapIntentHandler`
ist ausgefuehrt. Die Produktflaeche liegt bei 41 Dateien und 3.701 LOC; diese
Abweichung ist durch das M2.5-Design-Amendment begrenzt und von Phase 1 sowie
dem unabhaengigen Judge akzeptiert. Produktions-Handoff und die direkten
Hex-Harnesses sind gruen; retained Harness-Logs scheitern nur vor Task-Start
an der dokumentierten Gradle-Wildcard-IP-Umgebung. Naechster Schritt ist M2.6:
Conformance-Evidence final bestaetigen und dann den Hex-Close-out vorbereiten.
