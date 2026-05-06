Status: Draft
Owner: SaltMarcher Team
Last Reviewed: 2026-05-04
Source of Truth: Dungeon-specific adoption of the generic maps canvas.

# Dungeon Map Adoption Architecture

## Purpose

This specification binds the generic maps canvas onto the dungeon feature.

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
- `DungeonEditorBinder` loads `dungeoneditor` `published/*Model` handles,
  while `DungeonTravelBinder` loads travel `published/*Model` handles from the
  separate `travel` context; both subscribe to emitted snapshots and deliver
  those snapshots into the dungeon map slotcontent `ContentModel`
- `DungeonEditorBinder` also owns reverse pointer-event translation from
  `CanvasPointerEvent` into dungeon-editor input wiring
- the active-root dungeon `ContributionModel` owns aggregate controls,
  inspector, status, and other non-canvas projection state, but must not
  mirror dungeon map render projection as a second render path
- the optional active-root dungeon `IntentHandler` owns input interpretation
- `DungeonApplicationService` is the only callable authored-dungeon backend
  boundary
- `DungeonEditorApplicationService` is the only callable runtime
  dungeon-editor backend boundary
- `TravelApplicationService` is the only callable runtime dungeon-travel
  backend boundary
- dungeon `published/**` owns dungeon-native authored carriers and raw travel
  surface carriers
- dungeoneditor `published/**` owns the interactive runtime editor-session
  model and snapshot carriers consumed by the editor workspace
- travel `published/**` owns the interactive runtime travel-session model and
  snapshot carriers consumed by the travel workspace
- `PartyApplicationService` owns persisted party travel position outside
  authored dungeon persistence and is consumed through `travel`

## Capability Paths

### Surface Read

`Dungeon*Binder -> DungeonEditorApplicationService or TravelApplicationService -> dungeoneditor or travel published/*Model -> Dungeon*Snapshot -> DungeonEditorMapProjectionSnapshot or TravelDungeonMapProjectionSnapshot -> DungeonMapContentModel -> MapRenderScene -> DungeonMapMainView -> Dungeon*MainView`

For the editor workspace, `DungeonEditorApplicationService` composes that
runtime snapshot from authored `DungeonApplicationService` family seams such
as `loadAuthored(...)`, `mutateAuthored(...)`, and `catalog(...)`.

### Preview And Apply

`Dungeon*MainView -> CanvasPointerEvent -> DungeonEditorBinder wiring -> optional Dungeon*IntentHandler -> DungeonEditorPublishedEvent -> DungeonEditorBinder -> DungeonEditorApplicationService -> DungeonEditorModel -> DungeonEditorSnapshot -> DungeonEditorMapProjectionSnapshot -> DungeonMapContentModel -> MapRenderScene -> DungeonMapMainView -> Dungeon*MainView`

Preview and apply reuse the same authored dungeon edit body and differ only in
the boundary wrapper and commit semantics.

### Travel Action

`Dungeon*MainView or travel controls -> DungeonTravelBinder wiring -> optional DungeonTravelIntentHandler -> DungeonTravelStatePublishedEvent -> DungeonTravelBinder -> TravelApplicationService -> TravelDungeonModel -> TravelDungeonSnapshot -> TravelDungeonMapProjectionSnapshot -> DungeonMapContentModel -> MapRenderScene -> DungeonMapMainView -> Dungeon*MainView`

Direct token drag is adapter-side travel action resolution, not a second
backend movement path.

### Map Catalog

`editor controls -> DungeonEditorBinder -> DungeonApplicationService.catalog(...) -> catalog result`

Catalog behavior remains separate from the shared canvas scene path.

## Decisions And Rationale

- Dungeon keeps one adapter seam into the generic canvas.
- Dungeon-grid coordinates stay inside the dungeon adopter boundary.
- The dungeon map slotcontent surface follows the same canonical Binder plus
  `ContentModel` split as the rest of the view layer, but it is also the only
  legal render-state owner toward canvas.
- Shared dungeon-map geometry, preview diffs, labels, markers, graph nodes,
  graph links, and party token anchors are published upstream as
  runtime-context map projection carriers
  (`DungeonEditorMapProjectionSnapshot` and
  `TravelDungeonMapProjectionSnapshot`) before the canvas seam instead of
  being reconstructed from raw runtime snapshots inside the view layer.
- The editor workspace is not dungeon-owned session state; it is projected
  through the separate `dungeoneditor` context before the canvas seam.
- The interactive travel workspace is not dungeon-owned session state; it is
  projected through the separate `travel` context before the canvas seam.
- `dungeon` no longer exports an editor-colored raw surface family; editor
  workspace composition happens in `dungeoneditor` from authored snapshot,
  authored operation result, and authored inspector reads.

## Verification Notes

- This architecture is currently `Review-Owned`.
- Review must reject any second dungeon-to-canvas adapter for the same seam.

## References

- [Maps Canvas Architecture](/home/aaron/Schreibtisch/projects/SaltMarcher/docs/maps/architecture/architecture-maps-canvas.md:1)
- [Maps Canvas Contract](/home/aaron/Schreibtisch/projects/SaltMarcher/docs/maps/contract/contract-maps-canvas.md:1)
- [Dungeon Map Surface Contract](/home/aaron/Schreibtisch/projects/SaltMarcher/docs/maps/contract/contract-maps-dungeon-surface.md:1)
- [Dungeon Feature Overview](/home/aaron/Schreibtisch/projects/SaltMarcher/docs/dungeon/README.md:1)
