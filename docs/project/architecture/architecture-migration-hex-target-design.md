Status: Active
Owner: SaltMarcher Team
Last Reviewed: 2026-07-09
Source of Truth: Approved M2.3 target design for the Hex architecture
migration pilot before any wiring-port or implementation commit.

# Hex Migration Target Design

## Scope

This design covers the M2 Hex product surface:

- `src/domain/hex`
- `src/view/leftbartabs/hexmap`

The baseline surface is 70 product Java files and 4,560 physical LOC; the
full reproducible Hex count is 87 Java files and 5,564 LOC when `src/data/hex`
is included (`docs/project/architecture/architecture-migration-hex-baseline.md:55`).
Data-layer code remains outside the normal M2 migration surface unless a
gateway signature adaptation is explicitly named by this design. No such data
gateway adaptation is part of this design.

This design is the step-3 artifact required by the roadmap. It does not permit
implementation or harness scenario/assertion changes. The M2.4 wiring-port
commit may only update references and callbacks needed to run the frozen Hex
harness scenarios against the old behavior.

## Non-Negotiable Constraints

- No questions directed at the owner. The owner acts only as behavioral
  oracle and reads German status notes.
- No security analysis passes.
- No pause/throttle/stop mechanisms. Git history plus revert is the safety
  model.
- Behavior parity is absolute: the application does exactly the same thing
  before and after every merged step. Any visible behavior change inside a
  migration pass is a defect. Pre-existing bugs are preserved and filed as
  separate R2 issues for the normal flow.

## Current Defect

The Hex aggregate is not the defect. `HexMap` owns map validation, terrain
painting, marker saving, radius checks, and coordinate membership
(`src/domain/hex/model/map/HexMap.java:34`, `src/domain/hex/model/map/HexMap.java:79`,
`src/domain/hex/model/map/HexMap.java:83`, `src/domain/hex/model/map/HexMap.java:95`).

The defect is the role stack around that aggregate: user actions currently run
through `HexMapIntentHandler`, forwarding application services, per-verb use
cases, and then the aggregate or repository. The baseline measured dominant
Hex-owned chains at 5 meaningful hops and identified six product/published
forwarding candidates plus one data candidate
(`docs/project/architecture/architecture-migration-hex-baseline.md:73`,
`docs/project/architecture/architecture-migration-hex-baseline.md:98`).

## Target Class List

| Class | Target responsibility |
| --- | --- |
| `src.domain.hex.HexServiceContribution` | Keep the byte-compatible domain service-registry entrypoint and register the same four published Hex services/models. |
| `src.domain.hex.HexServiceAssembly` | Be the single Hex composition root for repository, Party services, stateful models, application services, and Party travel subscription wiring. |
| `src.domain.hex.HexEditorApplicationService` | Keep all current public command method descriptors while directly owning editor load/create/select/update/rename/paint/marker/tool behavior, the editor workspace, and the shared publish tail. |
| `src.domain.hex.HexTravelApplicationService` | Keep `movePartyToken(MoveHexPartyTokenCommand)` while directly owning map/radius validation, Party stable-tile conversion, Party move calls, Party readback projection, and travel publication. |
| `src.domain.hex.HexEditorSnapshotProjection` | Replace the old assembly-named projector and convert `HexEditorState` to the byte-compatible `HexEditorSnapshot`. |
| `src.domain.hex.published.HexEditorModel` | Become a stateful published editor model that owns current snapshot/listeners while keeping `current()`, `subscribe(...)`, and the existing compatibility constructor. |
| `src.domain.hex.published.HexTravelModel` | Become a stateful published travel model that owns current snapshot/listeners while keeping `current()`, `subscribe(...)`, and the existing compatibility constructor. |
| `src.domain.hex.model.map.repository.HexMapRepository` | Stay the unchanged data gateway seam for `src/data/hex.repository.SqliteHexMapRepository`. |
| `src.domain.hex.model.map.HexMap` | Stay the aggregate for map invariants, authored terrain, markers, metadata, and coordinate membership. |
| `src.domain.hex.model.map.HexCoordinate` | Stay the coordinate value and stable tile-id codec used across the Party travel seam. |
| `src.domain.hex.model.map.HexEditorState` | Stay the typed editor write/read state held by the editor service. |
| `src.domain.hex.model.map.HexEditorWorkspace` | Stay the small mutable holder for current editor state unless the implementation can inline it without adding another state representation. |
| `src.domain.hex.model.map.HexTravelPositionState` | Stay the typed travel readback state before projection to `HexTravelSnapshot`. |
| `src.domain.hex.model.map.HexMapIdentity`, `HexMapSummary`, `HexMarker`, `HexMarkerIdentity`, `HexMarkerKind`, `HexTerrain`, `HexEditorMode` | Stay as domain value, enum, and summary types because data and Hex services use them directly. |
| `src.view.leftbartabs.hexmap.HexMapContribution` | Keep the shell contribution key, title, group, nav icon, and runtime mode. |
| `src.view.leftbartabs.hexmap.HexMapBinder` | Stay the Hex tab composition point that wires services, shared catalog controls, views, subscriptions, and activation without owning Hex domain mutation. |
| `src.view.leftbartabs.hexmap.HexMapViewModel` | New single typed view model replacing the three content models and contribution model; it projects editor/travel snapshots into controls, canvas, state panel, marker draft, and catalog readback. |
| `src.view.leftbartabs.hexmap.HexMapVocabulary` | New typed view vocabulary for labels and options for `HexEditorMode`, `HexTerrain`, and `HexMarkerKind`; it is the only view-side enum-label map. |
| `src.view.leftbartabs.hexmap.HexMapControlsView` | Keep the JavaFX controls view and emit command callbacks whose internal resolution uses typed vocabulary while published command records stay byte-compatible. |
| `src.view.leftbartabs.hexmap.HexMapMainView` | Keep the JavaFX canvas view and emit select/paint/move command callbacks wired by `HexMapBinder`. |
| `src.view.leftbartabs.hexmap.HexMapStateView` | Keep the JavaFX state view and emit update-map/save-marker command callbacks plus local marker-draft updates wired by `HexMapBinder`. |

## Target Call Chains

Counting rule: count named production class boundaries from user action source
to the first Hex-owned domain or durable mutation. `HexMapBinder` callback
registration is wiring and MUST NOT become a forwarding controller.

| Interaction | Target chain | Target |
| --- | --- | --- |
| Update map metadata | `HexMapStateView.publishMap` -> `HexEditorApplicationService.updateMap` -> `HexMap.updateMetadata` / `HexMapRepository.save` and `setSelectedMap` | 3 hops to domain/repository mutation. |
| Save marker | `HexMapStateView.publishMarker` -> `HexEditorApplicationService.saveMarker` -> `HexMap.saveMarker` / `HexMapRepository.saveMarker` | 3 hops to domain/repository mutation. |
| Paint terrain | `HexMapMainView.publishTile` -> `HexEditorApplicationService.paintTerrain` -> `HexMap.paintTerrain` / `HexMapRepository.saveTerrain` | 3 hops to domain/repository mutation. |
| Move party token | `HexMapMainView.publishTile` -> `HexTravelApplicationService.movePartyToken` -> `PartyApplicationService.moveCharacters` | 3 hops to the Party API seam after Hex validates map/radius and converts `HexCoordinate.stableTileId()`. |

The shared catalog route remains a foreign-control seam. `CatalogCrudControlsView`
still emits `CatalogCrudControlsViewInputEvent` with String item ids; `HexMapBinder`
may parse that id at the wiring edge and then call `HexEditorApplicationService`.
It MUST NOT reintroduce a named Hex command-forwarding class.

The Party side remains a foreign seam. The Hex target preserves
`PartyApplicationService.moveCharacters`, `MovePartyCharactersCommand`,
`PartyOverworldTravelLocationSnapshot`, the overworld tile id produced by
`HexCoordinate.stableTileId()`, and `attachToPartyToken=true`; it does not claim
or migrate the Party-internal `MovePartyCharactersUseCase` chain
(`src/domain/party/PartyApplicationService.java:107`).

## Frozen Parity Inventory

The selected M2 Hex parity tasks are:

- `./gradlew hexMapEditorBehaviorHarness --console=plain`
- `./gradlew hexTravelStateBehaviorHarness --console=plain`

The frozen scenario and assertion inventory is the union below. M2.4 and M2.5
may port wiring references, but MUST NOT add, remove, rename, split, merge,
weaken, or reinterpret these scenarios or their pass/fail oracles.

| Harness evidence | Frozen IDs | Frozen oracle families |
| --- | --- | --- |
| `docs/hex/verification/verification-hex-editor.md:47`; `test/src/view/leftbartabs/hexmap/HexMapEditorBehaviorHarness.java:274` | `HEX-EDITOR-001` through `HEX-EDITOR-013` | Map creation/readback, metadata/radius/shrink warning, tile selection, terrain painting, marker save/validation, persistence reload, map-save versus marker-save routing, shell layout and shell-bound route, catalog rename radius preservation, visible save failure, and SQLite persistence row checks. |
| `docs/hex/verification/verification-hex-travel.md:40`; `test/src/view/leftbartabs/hexmap/HexMapEditorBehaviorHarness.java:286` | `HEX-TRAVEL-001` through `HEX-TRAVEL-008` | Stable tile-id round-trip, Hex travel readback, visible party token, Party-token movement through the Party API seam, invalid-move rejection, overlay-only redraw, user-facing `Reisegruppe` label, marker-draft preservation, and render-cap safety. |
| `docs/hex/verification/verification-hex-travel.md:52`; `test/src/view/statetabs/travel/TravelStateHexHarness.java:45` | `HEX-TRAVEL-STATE-001`, `HEX-TRAVEL-STATE-002` | Empty compact `Reise` state and active compact Hex travel state, including location, status, context, unavailable weather/time values, pace, and hint text. |

Harness output from M2.1 remains the current old-structure baseline recorded in
the ledger: `hexMapEditorBehaviorHarness hexTravelStateBehaviorHarness` passed
on 2026-07-09 with 21 editor/travel proof items plus 2 travel-state proof
items (`docs/project/architecture/migration-ledger.md:63`,
`docs/project/architecture/migration-ledger.md:87`). The harness source above is
the binding assertion-label inventory for the wiring-port and implementation
reviews.

## Deletion List

The implementation step is incomplete until these classes no longer exist:

- `src/domain/hex/model/map/usecase/CreateHexMapUseCase.java`
- `src/domain/hex/model/map/usecase/LoadHexEditorStateUseCase.java`
- `src/domain/hex/model/map/usecase/LoadHexEditorUseCase.java`
- `src/domain/hex/model/map/usecase/MoveHexPartyTokenUseCase.java`
- `src/domain/hex/model/map/usecase/PaintHexTerrainUseCase.java`
- `src/domain/hex/model/map/usecase/RenameHexMapUseCase.java`
- `src/domain/hex/model/map/usecase/SaveHexMarkerUseCase.java`
- `src/domain/hex/model/map/usecase/SelectHexMapUseCase.java`
- `src/domain/hex/model/map/usecase/SelectHexTileUseCase.java`
- `src/domain/hex/model/map/usecase/SetHexEditorToolUseCase.java`
- `src/domain/hex/model/map/usecase/UpdateHexMapUseCase.java`
- `src/domain/hex/model/map/usecase/UpdateHexTravelPositionUseCase.java`
- `src/domain/hex/model/map/port/HexTravelPositionPort.java`
- `src/domain/hex/model/map/repository/HexEditorPublishedStateRepository.java`
- `src/domain/hex/model/map/repository/HexTravelPublishedStateRepository.java`
- `src/domain/hex/model/map/repository/HexTravelPartyPositionRepository.java`
- `src/domain/hex/model/map/repository/HexTravelPartyPositionWriterRepository.java`
- `src/domain/hex/model/map/repository/HexTravelPartyPositionApplicationRepository.java`
- `src/domain/hex/HexTravelPublishedStateServiceAssembly.java`
- `src/domain/hex/HexTravelPartyBoundaryServiceAssembly.java`
- `src/domain/hex/HexEditorSnapshotProjectionServiceAssembly.java`
- `src/domain/hex/model/map/HexPartyTravelPositionFact.java`
- `src/view/leftbartabs/hexmap/HexMapIntentHandler.java`
- `src/view/leftbartabs/hexmap/HexMapContributionModel.java`
- `src/view/leftbartabs/hexmap/HexMapControlsContentModel.java`
- `src/view/leftbartabs/hexmap/HexMapMainContentModel.java`
- `src/view/leftbartabs/hexmap/HexMapStateContentModel.java`
- `src/view/leftbartabs/hexmap/HexMapControlsViewInputEvent.java`
- `src/view/leftbartabs/hexmap/HexMapMainViewInputEvent.java`
- `src/view/leftbartabs/hexmap/HexMapStateViewInputEvent.java`
- `src/view/leftbartabs/hexmap/HexMapToolContentPartModel.java`
- `src/view/leftbartabs/hexmap/HexMapVocabularyContentPartModel.java`

`src/domain/hex/model/map/usecase/` and `src/domain/hex/model/map/port/` must
be empty or gone after implementation. Deleting comments or compressing code
without executing this list is not migration.

## Seam Statement

These surfaces stay byte-compatible in M2 until their consumer sides migrate:

- `src.domain.hex.HexEditorApplicationService`: class name, package, public
  method names, and published command parameter types.
- `src.domain.hex.HexTravelApplicationService`: class name, package, and
  `movePartyToken(MoveHexPartyTokenCommand)`.
- `src.domain.hex.HexServiceContribution`: service-registry registration of
  `HexEditorApplicationService`, `HexEditorModel`, `HexTravelApplicationService`,
  and `HexTravelModel`.
- Every record and value type in `src/domain/hex/published/**`: record
  component order, component types, accessor names, static factories, and id
  wrappers.
- `src.domain.hex.model.map.repository.HexMapRepository` and the domain value
  types it exposes to `src/data/hex`.
- `HexCoordinate.stableTileId()` and `HexCoordinate.fromStableTileId(...)`
  because Party travel readback depends on that encoding.
- `src.view.leftbartabs.hexmap.HexMapContribution`: contribution id `hex-map`,
  group `world`, title `Hex-Karte`, nav icon path, runtime mode, and returned
  shell slots.
- `src/view/statetabs/travel/**`, Party APIs, shared catalog controls, shell
  APIs, and SQLite schema/persistence semantics.

M2.4 may port same-area harness and Hex view wiring references away from the
deleted input-event/content-model classes. It must not change a harness
scenario, assertion, fixture value, or pass/fail oracle.

## Wiring-Port Boundary

`HexMapEditorBehaviorHarness` currently imports and asserts through the same
content-model and handler classes that this design deletes
(`test/src/view/leftbartabs/hexmap/HexMapEditorBehaviorHarness.java:167`,
`test/src/view/leftbartabs/hexmap/HexMapEditorBehaviorHarness.java:431`,
`test/src/view/leftbartabs/hexmap/HexMapEditorBehaviorHarness.java:444`).
Therefore M2.4 MUST port those harness references before implementation.

The allowed M2.4 shape is narrow: introduce `HexMapViewModel` as a compatibility
facade over the existing content models and port harness/view wiring references
to that facade and command callbacks while keeping old behavior underneath.
M2.4 MUST NOT delete the old content models, `HexMapIntentHandler`, or input
event records. M2.5 then replaces the facade internals with the target typed
model and executes the deletion list.

## Metric Targets And Exceptions

| Metric | Target for implementation | Design exception |
| --- | --- | --- |
| LOC | Product subset falls from 4,560 physical LOC to 2,736 or less. The full 87-file count will not be forced to a 40% reduction because `src/data/hex` is ledger-excluded. | Full-set LOC reduction is a data-layer exception unless a gateway signature adaptation becomes necessary. |
| Forwarding-only classes | Zero product forwarding-only classes: the application services and published models own state/logic, and the per-verb/usecase/port/adaptor stack is deleted. | `src/data/hex/HexServiceContribution` remains a data-layer service-registration seam outside the product migration surface. |
| Intent-to-mutation chain | All Hex-owned editor and travel actions use at most 3 meaningful class-boundary hops. | Shared catalog events retain the foreign catalog event shape; `HexMapBinder` may parse catalog String ids at the wiring edge until the shared catalog is migrated. |
| String round-trips | Zero non-seam Hex-owned String round-trips: view vocabulary, service internals, domain state, and repository-facing code use `HexEditorMode`, `HexTerrain`, and `HexMarkerKind` directly. | Byte-compatible published record components and shared catalog item ids remain String seams. Production Hex code must centralize their conversion in `HexMapVocabulary` or service-edge normalizers. |

The exceptions are individually justified by existing consumer seams, not by
preference. The conformance review must reject any additional unexplained
metric miss.

## Untouched Surfaces

- `src/data/hex/**` persistence, schema, mapper, gateway, and repository
  semantics stay unchanged.
- Party APIs, Party travel location semantics, and `attachToPartyToken=true`
  stay unchanged.
- `src/view/statetabs/travel/**` stays unchanged and continues consuming
  `HexTravelModel` if present.
- Shared catalog controls stay unchanged; Hex only adapts to their current
  String id event surface at the wiring edge.
- Shell contribution behavior stays unchanged: same id, title, group, nav
  icon, runtime mode, and cockpit slots.
- Harness scenarios and assertions stay frozen. Any behavior anomaly found
  during implementation is an R2 issue or area revert, not an in-pass fix.

## Required Reviews

Phase 1 and Phase 2 must approve this artifact before M2.4 starts. Reviewers
must check that the design names target classes, representative call chains,
the full deletion list, seam compatibility, untouched surfaces, and each metric
exception above. A vague implementation-only answer is rework.
