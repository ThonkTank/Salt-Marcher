Status: Active
Owner: SaltMarcher Team
Last Reviewed: 2026-07-07
Source of Truth: Current Dungeon map adoption compatibility record for the
legacy view/shell/UI seam; target feature-runtime and view ownership remains in
the project-wide owner standards.

# Dungeon Map Adoption Architecture

## Purpose

This specification records the current compatibility binding of map-canvas
constraints onto the dungeon feature.

It does not define target feature-runtime conformance. Target ownership for
feature runtime and view roles remains in [Source Architecture](../../project/architecture/source-architecture.md).

It owns:

- dungeon-side current compatibility role adoption
- dungeon-side current capability paths
- the rule that dungeon converts `canvas <-> dungeon grid` through one adapter

It does not own dungeon behavior requirements, payload field detail, or domain
invariants.

## Dungeon Owners

- `DungeonEditorMainView` and `DungeonTravelMainView` are thin root-local
  wrappers around the dungeon-local map slotcontent surface
- `DungeonMapView` is the dungeon-local map slotcontent View that renders only
  the render scene exposed by the dungeon map slotcontent `ContentModel`
- the dungeon map slotcontent `DungeonMapContentModel` is the only allowed
  dungeon-side owner of map render state and the only allowed
  canvas-facing render-state owner; raw map normalization and preview
  projection publication stay upstream in the owning editor feature-runtime
  and travel runtime boundaries
- `DungeonEditorBinder` and `DungeonTravelBinder` currently load dungeon
  `published/*Model` handles for editor and travel model families; both
  subscribe to emitted snapshots and deliver those snapshots into the dungeon
  map slotcontent `ContentModel`
- `DungeonEditorBinder` currently wires `DungeonMapViewInputEvent` into the
  same-root `DungeonEditorIntentHandler`, which owns pointer-event
  interpretation and feature-runtime input translation as a compatibility seam,
  not as target feature-runtime UI ownership
- the active-root dungeon `ContributionModel` owns aggregate controls,
  inspector, status, and other non-canvas projection state, but must not
  mirror dungeon map render projection as a second render path
- the optional active-root dungeon `IntentHandler` owns input interpretation
- the dungeon editor feature-runtime authored operations provider is the
  callable editor backend boundary and owns editor read, catalog change,
  projection, narration, preview, and apply orchestration over authored dungeon
  truth
- `DungeonTravelRuntimeApplicationService` is the only callable runtime dungeon-travel
  backend boundary for travel-session publication over authored dungeon truth
- dungeon `published/**` owns the authored map, editor-session, and
  travel-session readback carriers consumed by the dungeon workspaces
- `PartyApplicationService` owns persisted party travel position outside
  authored dungeon persistence and is consumed through dungeon travel runtime

## Compatibility Boundary

The live Dungeon Editor path still uses the legacy `src/view/**`
ShellContribution, Binder, and IntentHandler to register the UI, bind the map
surface, and translate raw map input into feature-runtime operation ports. This
is current compatibility, not target conformance.

Removal condition: Dungeon Editor shell registration and raw input UI are owned
by the feature-runtime shell/UI seam, with runtime render frames and typed
raw-input APIs consumed directly by that seam.

## Capability Paths

### Surface Read

`Dungeon*Binder -> dungeon published/*Model -> Dungeon*Snapshot or TravelDungeonSnapshot -> DungeonMapContentModel -> DungeonMapContentModel.RenderScene -> DungeonMapView -> Dungeon*MainView`

For the editor workspace, the feature-runtime authored operations provider
composes that runtime snapshot from dungeon editor model use cases over
authored dungeon truth. Catalog changes enter through that provider.

### Preview And Apply

`Dungeon*MainView -> DungeonMapViewInputEvent -> DungeonEditorBinder wiring -> same-root Dungeon*IntentHandler -> feature-runtime pointer input -> DungeonEditorRuntimeOperations -> editor runtime publication -> DungeonMapContentModel -> DungeonMapContentModel.RenderScene -> DungeonMapView -> Dungeon*MainView`

Preview and apply reuse the same authored dungeon edit body and differ only in
the boundary wrapper and commit semantics.

### Travel Action

`Dungeon*MainView or travel controls -> DungeonTravelBinder wiring -> same-root DungeonTravelIntentHandler -> DungeonTravelStatePublishedEvent -> DungeonTravelBinder -> DungeonTravelRuntimeApplicationService -> TravelDungeonSnapshot -> DungeonMapContentModel -> DungeonMapContentModel.RenderScene -> DungeonMapView -> Dungeon*MainView`

Direct token drag is adapter-side travel action resolution, not a second
backend movement path.

These canvas-specific seams are current compatibility seams, not new canonical
reusable role families or target feature-runtime precedent. The canonical
reusable-slotcontent target lives only in [Source Architecture](../../project/architecture/source-architecture.md).

### Map Catalog

`editor controls -> DungeonEditorBinder -> DungeonEditorRuntimeOperations -> catalog result`

Catalog behavior remains separate from the shared canvas scene path while
sharing the editor backend boundary.

## Decisions And Rationale

- Dungeon keeps one adapter seam into the generic canvas.
- Dungeon-grid coordinates stay inside the dungeon adopter boundary.
- The dungeon map slotcontent surface follows the same canonical Binder plus
  `ContentModel` split as the rest of the view layer, but it is also the only
  legal render-state owner toward canvas.
- Shared dungeon-map geometry, preview diffs, labels, markers, graph nodes,
  graph links, and party token anchors are assembled for rendering by
  `DungeonMapContentModel` from dungeon read-side facts before the canvas seam.
- The editor workspace and interactive travel workspace are dungeon model
  families, not separate domain contexts.
- Travel must not publish a render-ready map projection carrier; its published
  snapshot exposes travel surface facts and overlay settings.

## Verification Notes

- This architecture is currently `Review-Owned`.
- Review must treat the Dungeon Editor legacy view/shell/UI path as current
  compatibility, not target feature-runtime conformance.
- Review must treat `CanvasPointerEvent`, `MapRenderScene`, and `MapCanvasView`
  as removed legacy seams, not as target reusable-slotcontent truth.
- Review must reject any second dungeon-to-canvas adapter for the same seam.

## References

- [Maps Canvas Architecture](architecture-maps-canvas.md)
- [Maps Canvas Contract](../contract/contract-maps-canvas.md)
- [Dungeon Map Surface Contract](../contract/contract-maps-dungeon-surface.md)
- [Dungeon Feature Overview](../../dungeon/README.md)
