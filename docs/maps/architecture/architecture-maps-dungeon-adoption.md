Status: Draft
Owner: SaltMarcher Team
Last Reviewed: 2026-05-04
Source of Truth: Dungeon-specific current implementation adoption of the
generic maps canvas while the view layer migrates to the reusable three-role
slotcontent model.

# Dungeon Map Adoption Architecture

## Purpose

This specification records the current implementation binding of the generic
maps canvas onto the dungeon feature.

It owns:

- dungeon-side role adoption
- dungeon-side capability paths
- the rule that dungeon converts `canvas <-> dungeon grid` through one adapter

It does not own dungeon behavior requirements, payload field detail, or domain
invariants.

## Dungeon Owners

- `DungeonEditorMainView` and `DungeonTravelMainView` are thin root-local
  wrappers over `MapCanvasView`
- `DungeonMapMainView` remains the shared map slotcontent View wrapper that
  renders only the `MapRenderScene` exposed by the dungeon map slotcontent
  `ContentModel`
- the dungeon map slotcontent `DungeonMapContentModel` is the only allowed
  dungeon-side owner of map render state and the only allowed
  canvas-facing render-state owner; raw map normalization and preview
  projection publication stay upstream in the owning runtime application
  services
- `DungeonEditorBinder` and `DungeonTravelBinder` load dungeon
  `published/*Model` handles for editor and travel model families; both
  subscribe to emitted snapshots and deliver those snapshots into the dungeon
  map slotcontent `ContentModel`
- `DungeonEditorBinder` also owns reverse pointer-event translation from
  `CanvasPointerEvent` into dungeon-editor input wiring
- the active-root dungeon `ContributionModel` owns aggregate controls,
  inspector, status, and other non-canvas projection state, but must not
  mirror dungeon map render projection as a second render path
- the optional active-root dungeon `IntentHandler` owns input interpretation
- `DungeonAuthoredApplicationService`,
  `DungeonCatalogApplicationService`, and
  `DungeonTravelApplicationService` are the callable authored-dungeon backend
  boundaries
- `DungeonEditorApplicationService` is the only callable runtime
  dungeon-editor backend boundary
- `DungeonTravelRuntimeApplicationService` is the only callable runtime dungeon-travel
  backend boundary
- dungeon `published/**` owns dungeon-native authored carriers and raw travel
  surface carriers
- dungeon `published/**` owns the authored map, editor-session, and
  travel-session readback carriers consumed by the dungeon workspaces
- `PartyApplicationService` owns persisted party travel position outside
  authored dungeon persistence and is consumed through dungeon travel runtime

## Capability Paths

### Surface Read

`Dungeon*Binder -> DungeonEditorApplicationService or DungeonTravelRuntimeApplicationService -> dungeon published/*Model -> Dungeon*Snapshot or TravelDungeonSnapshot -> DungeonMapContentModel -> MapRenderScene -> DungeonMapMainView -> Dungeon*MainView`

For the editor workspace, `DungeonEditorApplicationService` composes that
runtime snapshot from authored dungeon family seams such as
`DungeonAuthoredApplicationService.refreshAuthored(...)`,
`DungeonAuthoredApplicationService.mutateAuthored(...)`, and
`DungeonCatalogApplicationService.catalog(...)`.

### Preview And Apply

`Dungeon*MainView -> CanvasPointerEvent -> DungeonEditorBinder wiring -> same-root Dungeon*IntentHandler -> DungeonEditorPublishedEvent -> DungeonEditorBinder -> DungeonEditorApplicationService -> DungeonEditorModel -> DungeonEditorSnapshot -> DungeonEditorMapProjectionSnapshot -> DungeonMapContentModel -> MapRenderScene -> DungeonMapMainView -> Dungeon*MainView`

Preview and apply reuse the same authored dungeon edit body and differ only in
the boundary wrapper and commit semantics.

### Travel Action

`Dungeon*MainView or travel controls -> DungeonTravelBinder wiring -> same-root DungeonTravelIntentHandler -> DungeonTravelStatePublishedEvent -> DungeonTravelBinder -> DungeonTravelRuntimeApplicationService -> TravelDungeonSnapshot -> DungeonMapContentModel -> MapRenderScene -> DungeonMapMainView -> Dungeon*MainView`

Direct token drag is adapter-side travel action resolution, not a second
backend movement path.

These canvas-specific seams are current implementation seams, not new
canonical reusable role families. The canonical reusable-slotcontent target
lives only in the
[View Layer Standard](/home/aaron/Schreibtisch/projects/SaltMarcher/docs/project/architecture/patterns/view-layer.md:1).

### Map Catalog

`editor controls -> DungeonEditorBinder -> DungeonCatalogApplicationService.catalog(...) -> catalog result`

Catalog behavior remains separate from the shared canvas scene path.

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
- Review must treat `CanvasPointerEvent` and `MapRenderScene` as legacy
  current-state seams, not as target reusable-slotcontent truth.
- Review must reject any second dungeon-to-canvas adapter for the same seam.

## References

- [Maps Canvas Architecture](/home/aaron/Schreibtisch/projects/SaltMarcher/docs/maps/architecture/architecture-maps-canvas.md:1)
- [Maps Canvas Contract](/home/aaron/Schreibtisch/projects/SaltMarcher/docs/maps/contract/contract-maps-canvas.md:1)
- [Dungeon Map Surface Contract](/home/aaron/Schreibtisch/projects/SaltMarcher/docs/maps/contract/contract-maps-dungeon-surface.md:1)
- [Dungeon Feature Overview](/home/aaron/Schreibtisch/projects/SaltMarcher/docs/dungeon/README.md:1)
