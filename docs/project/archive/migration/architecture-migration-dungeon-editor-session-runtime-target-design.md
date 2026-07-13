Status: Draft
Owner: SaltMarcher Team
Last Reviewed: 2026-07-10
Source of Truth: M4.2 target design for the Dungeon editor session/runtime
architecture migration sub-slice before any wiring-port or implementation
commit.

# Dungeon Editor Session Runtime Migration Target Design

## Scope

This design covers M4.2 `dungeon-editor-session-runtime`:

- primary runtime root: `src/features/dungeon/runtime`
- primary domain runtime root: `src/domain/dungeon/model/runtime`, excluding
  `src/domain/dungeon/model/runtime/travel`
- adjacent editor published-state composition in top-level
  `src/domain/dungeon/*.java`
- adjacent editor published models in `src/domain/dungeon/published`

The baseline primary reproducible M4.2 root is 211 Java files and 21,377
physical LOC. It includes ten `*Travel*.java` bridge files under
`src/domain/dungeon/model/runtime` that are M4.3-owned by behavior. The clean
editor/session subset excluding those bridge files is 201 Java files and
20,488 physical LOC. The M4.2 root plus non-travel adjacent service/published
seams is 269 Java files and 26,235 physical LOC
(`docs/project/architecture/architecture-migration-dungeon-editor-session-runtime-baseline.md`).

This design keeps M4.2 as one revertable implementation step because it
deletes the shared session/publication/port ceremony while retaining the real
interaction-family operation classes. It does not redesign room/wall,
corridor, stair, transition, feature-marker, or selected-handle behavior. If
implementation requires deleting or rewriting those family owners to meet the
targets, the area must be reverted and this design amended into the roadmap's
interaction-family split before retry.

This artifact is the step-3 design required by the roadmap. It does not permit
implementation or harness scenario/assertion changes. The M4.2 wiring-port
step may only introduce compatibility seams and port direct references needed
to run the frozen harness inventory against old behavior before the deletion
list is executed.

## Non-Negotiable Constraints

- Behavior parity is absolute. Any visible behavior change in a migration pass is a defect. Pre-existing bugs are preserved and filed as separate R2 issues.
- No questions to the owner. Never wait on the owner; the acceptance window never blocks the pipeline. Decide yourself, journal the reasoning.
- No security analysis. No pause/throttle/stop mechanisms. Git history plus revert is the safety model.
- Harness scenarios and assertions are frozen; only wiring may be ported, in a separate prior commit.

## Current Defect

The current defect is not the dungeon editor interaction-family logic.
`DungeonEditorRoomPaintRuntimeOperation`, the boundary draft operations,
`DungeonEditorCorridorDraftRuntimeOperation`,
`DungeonEditorStairDraftRuntimeOperation`,
`DungeonEditorTransitionRuntimeOperation`,
`DungeonEditorFeatureMarkerRuntimeOperation`, and
`DungeonEditorSelectedHandleRuntimeOperation` own real pointer interpretation,
preview, validation, and authored-service calls. They survive M4.2 as named
runtime owners.

The defect is the extra session and publication stack wrapped around those
owners. A pointer or control command currently crosses feature-runtime ports,
controllers, store actions, operation result translators,
`DungeonEditorAuthoredRuntimeOperations`, map/projection/detail runtime
wrappers, domain runtime usecases, the M4.1 `RuntimeCommands` bridge inside
`DungeonAuthoredApplicationService`, a published-state repository interface,
and finally the editor published models. The baseline measured 11 meaningful
hops from pointer intent to domain publication, 21 forwarding/proxy
candidates, and 7 finite-domain String boundary families.

M4.2 collapses that ceremony into a single editor runtime application boundary
and a direct feature-runtime facade while preserving published models,
visible text, frame shapes, and authored-core behavior.

## Target Class List

| Class | Target responsibility |
| --- | --- |
| `src.domain.dungeon.DungeonServiceContribution` | Keep the byte-compatible service-registry entrypoint. |
| `src.domain.dungeon.DungeonServiceAssembly` | Stay the Dungeon composition root. Register `DungeonAuthoredApplicationService`, `DungeonEditorRuntimeApplicationService`, the three editor published models, authored published models, and travel services/models without changing public registry keys. |
| `src.domain.dungeon.DungeonEditorRuntimeApplicationService` | New public editor runtime application boundary. Owns `DungeonEditorSessionWorkflow`, `DungeonEditorDungeonState`, runtime catalog/control/detail commands, preview lifecycle, snapshot/session-frame publication, map lifecycle, authored preview/readback calls, status propagation, and conversion from editor-edge strings to typed session/core values. It replaces the domain runtime usecase wrappers and the M4.1 `DungeonAuthoredApplicationService.RuntimeCommands` bridge. |
| `src.domain.dungeon.DungeonEditorPublishedState` | New package-private editor published-state owner backed by `src.domain.shared.published.PublishedState`. It owns current/listener state for `DungeonEditorControlsModel`, `DungeonEditorMapSurfaceModel`, and `DungeonEditorStateModel` and replaces `DungeonEditorPublishedStateServiceAssembly` plus `DungeonEditorSnapshotPublishedStateRepository`. |
| `src.domain.dungeon.published.DungeonEditorControlsModel` | Become a stateful model using shared `PublishedState` while keeping class name, package, `current()`, `subscribe(...)`, null/default behavior, and the existing supplier/subscribe constructor. |
| `src.domain.dungeon.published.DungeonEditorMapSurfaceModel` | Become a stateful model using shared `PublishedState` while keeping class name, package, `current()`, `subscribe(...)`, null/default behavior, and the existing supplier/subscribe constructor. |
| `src.domain.dungeon.published.DungeonEditorStateModel` | Become a stateful model using shared `PublishedState` while keeping class name, package, `current()`, `subscribe(...)`, null/default behavior, and the existing supplier/subscribe constructor. |
| `src.domain.dungeon.DungeonEditorControlsProjectionServiceAssembly`, `DungeonEditorMapSurfaceProjectionServiceAssembly`, `DungeonEditorStateProjectionServiceAssembly`, and `DungeonEditorSurfaceContextServiceAssembly` | Stay as byte-compatible mappers from `DungeonEditorSessionSnapshot` data to existing published snapshots. They may be renamed only by a later design; M4.2 uses them as mapping helpers, not as publication owners. |
| `src.domain.dungeon.DungeonAuthoredApplicationService` | Keep the M4.1 authored-core application boundary and public mutation/readback behavior. Remove its nested `RuntimeCommandDelegate`, `RuntimeCommands`, and `Session.runtimeCommands(...)` M4.2 bridge after the new runtime service owns those commands. |
| `src.domain.dungeon.model.runtime.editor.session.DungeonEditorSession`, `DungeonEditorSessionWorkflow`, `DungeonEditorSessionEffect`, `DungeonEditorSessionSnapshot`, `DungeonEditorSessionValues`, and `DungeonEditorDungeonState` | Stay as typed editor-session state, workflow, effect, snapshot, value, and authored-facts owners. They are real runtime model logic, not wrappers. |
| `src.features.dungeon.runtime.DungeonEditorFeatureRuntimeRoot` | Stay the feature runtime entrypoint and implement `DungeonEditorRuntimeOperations`, `DungeonEditorMapCatalogOperations`, `DungeonEditorControlOperations`, `DungeonEditorPointerInteractionOperations`, `DungeonEditorStatePanelDraftOperations`, `DungeonEditorInlineLabelOperations`, and `DungeonEditorTransitionStairOperations` directly. It replaces the current port/controller/store facade while preserving the same public operation interfaces for M4.5. |
| `src.features.dungeon.runtime.DungeonEditorRuntimeCommands` | New package-private command coordinator used by `DungeonEditorFeatureRuntimeRoot`. Owns draft cleanup, interaction-state cleanup, frame-publish decisions, catalog/control/detail command dispatch, and calls into `DungeonEditorRuntimeApplicationService`. It replaces `DungeonEditorRuntimeControlController`, `DungeonEditorRuntimeMapCatalogController`, state-panel/transition/inline-label ports, `DungeonEditorRuntimeOperationPublisher`, and action/result translators. |
| `src.features.dungeon.runtime.DungeonEditorPointerWorkflow` | New package-private pointer workflow owner replacing the dispatcher-only `DungeonEditorAuthoredRuntimeOperations` facade. It accepts typed pointer intent, invokes the retained family operation classes, and calls `DungeonEditorRuntimeApplicationService` for preview/effect publication. |
| `src.features.dungeon.runtime.DungeonEditorRuntimeContext` | New package-private context for retained family operation classes. It carries `DungeonEditorRuntimeApplicationService`, the authored session, main-view interpreter, draft session, runtime commands, and shared policies without exposing the old domain usecase graph. It absorbs the old `DungeonEditorDraftRuntimeContext` accessors and `DungeonEditorDraftAuthoredCommitter` authored-service callbacks. |
| `src.features.dungeon.runtime.DungeonEditorRuntimeDraftSession` and state-panel draft classes | Stay as draft owners for room narration, label names, corridor point drafts, transition descriptions/destinations, stair geometry, and inline label edit state. Their calls move under `DungeonEditorRuntimeCommands`; no port class owns draft behavior after implementation. |
| `src.features.dungeon.runtime.DungeonEditorRuntimeFramePublisher` | Stay the runtime-frame fanout owner. It reads the byte-compatible editor published models and draft session, assembles `DungeonEditorRenderFrame`, and delivers subscribers in the current order. |
| `src.features.dungeon.runtime.DungeonEditorRuntimeReadbackFrameInputs`, `DungeonEditorRuntimeFrameFactsAssembler`, `DungeonEditorPreparedFrameFacts`, and `DungeonEditorRenderFrame` | Stay byte-compatible frame/readback surfaces for M4.4 rendering. M4.2 may only change constructor inputs needed to remove the old store/action layer. |
| Retained interaction-family operation classes under `src/features/dungeon/runtime/**` | Stay as the concrete room/wall/door/corridor/stair/transition/feature/selected-handle behavior owners. Their constructor dependencies change from `DungeonEditorAuthoredRuntimeAssembly.RuntimeUseCases` to `DungeonEditorRuntimeContext`. |
| `src.features.dungeon.shell.DungeonEditorFeatureShellBinding` | Keep its public binding behavior, `operations()`, subscription, and JavaFX delivery semantics. It resolves `DungeonEditorRuntimeApplicationService` and the three published models from the registry instead of resolving the deleted editor snapshot repository. |

## Target Call Chains

Counting rule: count named production class boundaries from editor intent or
runtime operation entry to the first editor published-state update. View
wiring remains M4.5. Family operation classes count when they own real
interaction behavior.

| Interaction | Target chain | Target |
| --- | --- | --- |
| Pointer room paint/delete | `DungeonEditorIntentHandler.consumePointerToolInput` -> `DungeonEditorFeatureRuntimeRoot.applyPointerInteraction` -> `DungeonEditorPointerWorkflow.apply` -> `DungeonEditorRoomPaintRuntimeOperation.apply` -> `DungeonEditorRuntimeApplicationService.applyEffect` -> `DungeonAuthoredApplicationService.applyRoomRectangle` -> `DungeonEditorPublishedState.publishSnapshot` -> `DungeonEditorRuntimeFramePublisher.publishCurrent` | At most 7 hops to editor publication, 8 including frame fanout. |
| Selection or handle preview and commit | `DungeonEditorFeatureRuntimeRoot.applyPointerInteraction` -> `DungeonEditorPointerWorkflow.apply` -> `DungeonEditorSelectedHandleRuntimeOperation.apply` -> `DungeonEditorRuntimeApplicationService.applyEffect` -> the relevant `DungeonAuthoredApplicationService.move*Handle` method -> `DungeonEditorPublishedState.publishSnapshot` | At most 6 hops to editor publication; retained handle family logic is not collapsed. |
| Corridor create/delete draft | `DungeonEditorFeatureRuntimeRoot.applyPointerInteraction` -> `DungeonEditorPointerWorkflow.apply` -> `DungeonEditorCorridorDraftRuntimeOperation.apply` -> `DungeonEditorRuntimeApplicationService.applyEffect` -> `DungeonAuthoredApplicationService.createCorridor` or `deleteCorridor` -> `DungeonEditorPublishedState.publishSnapshot` | At most 6 hops to editor publication. |
| Stair create/delete or transition/feature pointer route | `DungeonEditorFeatureRuntimeRoot.applyPointerInteraction` -> `DungeonEditorPointerWorkflow.apply` -> the matching retained family operation -> `DungeonEditorRuntimeApplicationService.applyEffect` -> `DungeonAuthoredApplicationService.createStair`, `deleteStair`, `createTransition`, `deleteTransition`, `createFeatureMarker`, or `deleteFeatureMarker` -> `DungeonEditorPublishedState.publishSnapshot` | At most 6 hops to editor publication. |
| Tool/control switch | `DungeonEditorIntentHandler` -> `DungeonEditorFeatureRuntimeRoot.setTool` / `setViewMode` / `setOverlay` / `shiftProjectionLevel` -> `DungeonEditorRuntimeCommands` -> `DungeonEditorRuntimeApplicationService` -> `DungeonEditorSessionWorkflow` -> `DungeonEditorPublishedState.publishControls` or `publishSessionFrame` -> frame publisher | At most 5 hops to editor publication, 6 including frame fanout. |
| Map catalog select/create/rename/delete | `DungeonEditorFeatureRuntimeRoot.catalog*` -> `DungeonEditorRuntimeCommands` -> `DungeonEditorRuntimeApplicationService` -> `DungeonAuthoredApplicationService.Session` catalog/load methods -> `DungeonEditorPublishedState.publishSnapshot` -> frame publisher | At most 5 hops to editor publication. |
| State-panel transition/stair/detail save | `DungeonEditorFeatureRuntimeRoot.saveTransitionLink` / `saveStairGeometry` / narration/label/description methods -> `DungeonEditorRuntimeCommands` -> `DungeonEditorRuntimeApplicationService` -> `DungeonAuthoredApplicationService.Session` detail mutation -> `DungeonEditorPublishedState.publishSnapshot` -> frame publisher | At most 5 hops to editor publication; draft clear/retain rules stay in `DungeonEditorRuntimeCommands` plus `DungeonEditorRuntimeDraftSession`. |
| Runtime frame readback | editor published model update or explicit command publish -> `DungeonEditorRuntimeFramePublisher.currentFrame` -> `DungeonEditorRuntimeReadbackFrameInputs.from` -> `DungeonEditorRuntimeDraftSession.draftFrame` -> `DungeonEditorRuntimeFrameFactsAssembler.preparedFacts` -> `DungeonEditorRenderFrame` | At most 5 readback/fanout hops; `PreparedFrameFacts` and `RenderFrame` shape stays byte-compatible for M4.4. |

## Frozen Parity Inventory

The selected M4.2 parity inventory is the ledger inventory closed in step 1:

- `dungeonEditorCoreBehaviorHarness`
- `dungeonEditorBehaviorHarness`
- `dungeonEditorRouteBehaviorHarness`
- `dungeonEditorDoorBehaviorHarness`
- `dungeonEditorWallBehaviorHarness`
- `dungeonEditorRoomBehaviorHarness`
- `dungeonEditorClusterBehaviorHarness`
- `dungeonEditorCorridorBehaviorHarness`
- `dungeonEditorStairBehaviorHarness`
- `dungeonEditorTransitionBehaviorHarness`
- `dungeonEditorFeatureBehaviorHarness`
- `dungeonTravelProjectionLevelHarness`
- `dungeonMapRenderParityHarness`
- `checkBehaviorHarnessTopology`
- `checkHarnessMapConsistency`
- `tools/gradle/run-staged-verification.sh focused-handoff --path src/domain/dungeon --area dungeon-editor-session-runtime`

Recorded proof counts are: core 72, editor aggregate 206, route 187, door 58,
wall 33, room 64, cluster 84, corridor 68, stair 63, transition 62, feature
59, travel projection 3, and render parity 3.

M4.2 wiring and implementation may port imports, constructors, callbacks, and
direct fixture construction. They MUST NOT add, remove, rename, split, merge,
weaken, or reinterpret harness scenarios, assertion labels, fixture values,
visible text, image parity, or pass/fail oracles.

## Deletion List

The implementation step is incomplete until these files no longer exist:

- `src/domain/dungeon/model/runtime/repository/DungeonEditorSnapshotPublishedStateRepository.java`
- `src/domain/dungeon/model/runtime/usecase/ApplyDungeonEditorSessionEffectUseCase.java`
- `src/domain/dungeon/model/runtime/usecase/BuildDungeonEditorSnapshotUseCase.java`
- `src/domain/dungeon/model/runtime/usecase/DungeonEditorPreviewLifecycleUseCase.java`
- `src/domain/dungeon/model/runtime/usecase/PublishDungeonEditorSnapshotUseCase.java`
- `src/domain/dungeon/model/runtime/usecase/SetDungeonEditorViewModeUseCase.java`
- `src/domain/dungeon/model/runtime/usecase/SetDungeonEditorToolUseCase.java`
- `src/domain/dungeon/model/runtime/usecase/SetDungeonEditorOverlayUseCase.java`
- `src/domain/dungeon/model/runtime/usecase/ShiftDungeonEditorProjectionLevelUseCase.java`
- `src/domain/dungeon/DungeonEditorPublishedStateServiceAssembly.java`
- `src/features/dungeon/runtime/DungeonEditorAuthoredRuntimeAssembly.java`
- `src/features/dungeon/runtime/DungeonEditorAuthoredRuntimeOperationUseCases.java`
- `src/features/dungeon/runtime/DungeonEditorAuthoredRuntimeOperations.java`
- `src/features/dungeon/runtime/DungeonEditorMapCatalogRuntimeOperations.java`
- `src/features/dungeon/runtime/DungeonEditorProjectionRuntimeOperations.java`
- `src/features/dungeon/runtime/DungeonEditorDetailSaveRuntimeOperations.java`
- `src/features/dungeon/runtime/DungeonEditorDraftRuntimeContext.java`
- `src/features/dungeon/runtime/DungeonEditorDraftAuthoredCommitter.java`
- `src/features/dungeon/runtime/DungeonEditorRuntimeControlController.java`
- `src/features/dungeon/runtime/DungeonEditorRuntimeControlPort.java`
- `src/features/dungeon/runtime/DungeonEditorRuntimeMapCatalogController.java`
- `src/features/dungeon/runtime/DungeonEditorRuntimeMapCatalogPort.java`
- `src/features/dungeon/runtime/DungeonEditorRuntimePointerPort.java`
- `src/features/dungeon/runtime/DungeonEditorRuntimeStatePanelDraftPort.java`
- `src/features/dungeon/runtime/DungeonEditorRuntimeTransitionStairPort.java`
- `src/features/dungeon/runtime/DungeonEditorRuntimeInlineLabelPort.java`
- `src/features/dungeon/runtime/DungeonEditorRuntimeOperationPublisher.java`
- `src/features/dungeon/runtime/DungeonEditorRuntimeOperationResult.java`
- `src/features/dungeon/runtime/DungeonEditorRuntimeResultTranslator.java`
- `src/features/dungeon/runtime/DungeonEditorRuntimeControlActions.java`
- `src/features/dungeon/runtime/DungeonEditorRuntimeSnapshotActions.java`
- `src/features/dungeon/runtime/DungeonEditorStore.java`
- `src/features/dungeon/runtime/DungeonEditorStoreState.java`
- `src/features/dungeon/runtime/DungeonEditorStoreVersion.java`
- `src/features/dungeon/runtime/DungeonEditorAction.java`
- `src/features/dungeon/runtime/DungeonEditorSelector.java`
- `src/features/dungeon/runtime/DungeonEditorSelectorResult.java`

In-file removal requirement:

- `DungeonAuthoredApplicationService.RuntimeCommandDelegate`
- `DungeonAuthoredApplicationService.RuntimeCommands`
- `DungeonAuthoredApplicationService.Session.runtimeCommands(...)`

These nested owners are the M4.1-to-M4.2 compatibility bridge. Keeping them
after M4.2 implementation would preserve the deleted domain runtime usecase
ceremony under a different surface and is Rework.

Deleting comments, compressing lines, cosmetically renaming wrappers, or
rephrasing duplicated helper logic without executing this list is not
migration.

## Seam Statement

These surfaces stay byte-compatible in M4.2 until their consumer sides
migrate:

- `DungeonEditorRuntimeOperations`, `DungeonEditorMapCatalogOperations`,
  `DungeonEditorControlOperations`, `DungeonEditorPointerInteractionOperations`,
  `DungeonEditorStatePanelDraftOperations`, `DungeonEditorInlineLabelOperations`,
  and `DungeonEditorTransitionStairOperations`: class/interface names,
  packages, method names, parameters, return types, and null/default behavior.
- `DungeonEditorFeatureShellBinding`: public constructor, `operations()`,
  `subscribe(...)`, `publishCurrent(...)`, JavaFX delivery semantics, and
  `PublicationSink`.
- `DungeonEditorControlsModel`, `DungeonEditorMapSurfaceModel`, and
  `DungeonEditorStateModel`: model classes, service-registry keys,
  `current()`, `subscribe(...)`, existing constructors, empty/default
  snapshots, listener delivery order, and published snapshot semantics.
- Every record, enum, id wrapper, snapshot, and command-like value under
  `src/domain/dungeon/published/**`: record component order, component types,
  accessor names, enum constants, static factories, and defaults.
- M4.1 authored-core seams: `DungeonAuthoredApplicationService`, its public
  authored mutation/readback methods, `DungeonAuthoredApplicationService.Session`
  except for `runtimeCommands(...)`, `DungeonAuthoredReadModel`,
  `DungeonAuthoredMutationModel`, `DungeonMapCatalogModel`, `DungeonMap`,
  `DungeonMapRepository`, and the data-layer semantics they expose.
- M4.3 travel seams: `src/domain/dungeon/model/runtime/travel/**`, the ten
  travel bridge files under non-travel `model/runtime`, top-level travel
  services, `TravelDungeonModel`, travel published snapshots, and
  `dungeonTravelProjectionLevelHarness` behavior. M4.2 may only change
  constructor wiring needed because the editor snapshot repository seam is
  deleted.
- M4.4 rendering seams: `DungeonEditorPreparedFrameFacts`,
  `DungeonEditorRenderFrame`, `DungeonEditorRuntimeReadbackFrameInputs`,
  runtime pointer target records, and `src/view/slotcontent/main/dungeonmap/**`
  consumption.
- M4.5 editor view seams: `src/view/leftbartabs/dungeoneditor/**`,
  `DungeonEditorIntentHandler`, view input records, content models, visible
  strings, and JavaFX layout behavior. M4.2 may port wiring only where a direct
  deleted type is otherwise imported.
- Shell APIs, Party APIs, shared catalog controls, and SQLite schema/persistence
  semantics stay unchanged.

## Wiring-Port Boundary

M4.2 step 4 MUST introduce compatibility seams before any deletion-list file
is removed:

- introduce `DungeonEditorRuntimeApplicationService` and
  `DungeonEditorPublishedState` while the old editor snapshot repository,
  domain runtime usecases, store/action layer, ports, and controllers still
  exist;
- register the new runtime service and stateful editor models from
  `DungeonServiceAssembly`;
- port `DungeonEditorFeatureShellBinding` and `DungeonEditorFeatureRuntimeRoot`
  construction to the new runtime service while preserving the existing
  `DungeonEditorRuntimeOperations` interface surface;
- port `test/src/view/leftbartabs/dungeoneditor/DungeonTransitionInvariantHarness.java`
  away from direct `ApplyDungeonEditorSessionEffectUseCase`,
  `BuildDungeonEditorSnapshotUseCase`, and `PublishDungeonEditorSnapshotUseCase`
  construction without changing its scenario or assertions;
- keep the old `DungeonEditorAuthoredRuntimeAssembly`,
  `DungeonEditorAuthoredRuntimeOperations`, ports, store, action, and domain
  usecase files until implementation executes the deletion list.

Step 4 may change imports, constructors, callbacks, and package-visible
factory methods needed to keep the frozen proof route running. Step 4 MUST NOT
delete the old implementation, alter harness assertions, or move M4.4 render
frame shape or M4.5 view behavior.

M4.2 step 5 then replaces the compatibility facade internals with the target
service shape, removes the nested M4.1 runtime bridge from
`DungeonAuthoredApplicationService`, and executes the deletion list.

## Metric Targets And Exceptions

| Metric | Target for implementation | Design exception |
| --- | --- | --- |
| Primary files and LOC | Primary reproducible M4.2 root falls from 211 files / 21,377 physical LOC to 181 files or fewer / 20,000 physical LOC or fewer. The cap counts the ten travel bridge files because they remain in the reproducible root. | The ten travel bridge files are M4.3-owned by behavior and may remain untouched in M4.2. The cap therefore does not require deleting travel bridge files to hit a file count. |
| Design-visible non-travel surface | M4.2 root plus non-travel adjacent service/published seams falls from 269 files / 26,235 physical LOC to 245 files or fewer / 25,400 physical LOC or fewer after adding `DungeonEditorRuntimeApplicationService`, `DungeonEditorPublishedState`, and runtime command/workflow helpers. | Top-level service/published-state additions are allowed only to delete the editor snapshot repository/assembly and keep published seams byte-compatible. |
| Deletion list | All 37 named files are gone, and the three named nested `DungeonAuthoredApplicationService` bridge members are gone. | None. Any retained file or nested bridge member is Rework unless this design is amended and judge-approved before implementation. |
| Forwarding/proxy candidates | The 21 baseline forwarding/proxy candidates fall to 5 or fewer. | Retained service contribution/assembly and operation interfaces are seam/composition surfaces and do not count as forwarding-only classes if they do not add behavior hops. `DungeonEditorRuntimeFramePublisher` may remain because it owns real frame fanout. |
| Intent-to-publication chains | Pointer routes are at most 7 hops to editor publication; control, map-catalog, and state-panel save routes are at most 5 hops to editor publication; frame readback/fanout is at most 5 hops. | Retained interaction-family operation classes count as real behavior and are not collapsed solely to meet a hop target. |
| String round-trips | Product String boundary families fall from 7 to 4 or fewer. Runtime internals normalize tool/view/overlay keys, transition destination type/ids, and stair geometry shape/direction at the runtime edge before service/core mutation. | M4.5 view input strings, M4.4/M4.5 published topology/handle kind strings, byte-compatible state-panel published strings, and user/authored display text may remain as explicit seams. They must not leak deeper into runtime command/service internals. |

The exceptions are individually justified by roadmap slice boundaries and
existing consumer seams. They do not permit retaining the named wrappers,
weakening harnesses, or manufacturing a metric hit through code compression,
comment deletion, cosmetic renaming, or duplicated helper rephrasing.

## Untouched Surfaces

- `src/domain/dungeon/model/runtime/travel/**`, the ten non-travel-root
  `*Travel*.java` bridge files, `DungeonTravelRuntimeApplicationService`,
  `TravelDungeonModel`, and travel projection behavior stay unchanged except
  for constructor/import adaptations required by deleting the editor snapshot
  repository.
- `src/view/slotcontent/main/dungeonmap/**` rendering code, render parity
  expectations, and canvas model behavior stay unchanged.
- `src/view/leftbartabs/dungeoneditor/**` editor view code, visible text,
  JavaFX layout, and input-event behavior stay unchanged except for wiring
  references to the preserved runtime operation interfaces.
- `src/data/dungeon/**` persistence, schema, mapper, gateway, and repository
  semantics stay unchanged.
- M4.1 authored-core code is not structurally reworked. Only the M4.1
  `RuntimeCommands` compatibility bridge is removed because M4.2 replaces it
  with the editor runtime application service.
- Harness scenarios and assertions stay frozen. Any behavior anomaly found
  during implementation is an R2 issue or an area revert, not an in-pass fix.

## Required Reviews

Phase 1 and Phase 2 must approve this artifact before M4.2 step 4 starts.
Reviewers must check that the design names target classes, representative call
chains, the deletion list, the nested bridge removal, seam compatibility,
untouched surfaces, frozen parity inventory, binding metrics, and each
exception. "Details during implementation" is not accepted as design evidence.
