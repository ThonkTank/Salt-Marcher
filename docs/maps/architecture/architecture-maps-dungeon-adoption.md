Status: Draft
Owner: SaltMarcher Team
Last Reviewed: 2026-04-26
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
  `PresentationModel`
- the dungeon map slotcontent `PresentationModel` is the only allowed
  dungeon-side owner of map render state and the only allowed
  domain-to-canvas projection owner
- `DungeonEditorBinder` and `DungeonTravelBinder` bind dungeon published
  surface payloads into the dungeon map slotcontent `PresentationModel`;
  `DungeonEditorBinder` also owns reverse pointer-event translation from
  `CanvasPointerEvent` into dungeon-editor input wiring
- the active-root dungeon `PresentationModel` owns aggregate controls,
  inspector, status, and other non-canvas projection state, but must not
  mirror dungeon map surface payloads as a second render path
- the optional active-root dungeon `IntentHandler` owns input interpretation
- `DungeonApplicationService` is the only callable dungeon backend boundary
- dungeon `published/**` owns dungeon-native map surface carriers
- `PartyApplicationService` owns party runtime position outside authored
  dungeon persistence

Current code may still use class names such as `DungeonEditorViewModel`,
`DungeonTravelViewModel`, or `DungeonMapViewModel`. Those names are migration
debt relative to the canonical `PresentationModel` role language.

## Capability Paths

### Surface Read

`Dungeon*Binder -> DungeonApplicationService -> DungeonSurfacePayload -> dungeon map slotcontent PresentationModel -> MapRenderScene -> DungeonMapMainView -> Dungeon*MainView`

### Preview And Apply

`Dungeon*MainView -> CanvasPointerEvent -> DungeonEditorBinder wiring -> optional Dungeon*IntentHandler -> active-root PresentationModel request/state -> DungeonEditorBinder -> DungeonApplicationService -> DungeonSurfacePayload -> dungeon map slotcontent PresentationModel -> MapRenderScene -> DungeonMapMainView -> Dungeon*MainView`

Preview and apply reuse the same dungeon edit body and differ only in the
boundary wrapper.

### Travel Action

`Dungeon*MainView or travel controls -> DungeonTravelBinder wiring -> optional DungeonTravelIntentHandler -> active-root PresentationModel request/state -> DungeonTravelBinder -> DungeonApplicationService -> DungeonSurfacePayload -> dungeon map slotcontent PresentationModel -> MapRenderScene -> DungeonMapMainView -> Dungeon*MainView`

Direct token drag is adapter-side travel action resolution, not a second
backend movement path.

### Map Catalog

`editor controls -> DungeonEditorBinder -> DungeonApplicationService -> catalog result`

Catalog behavior remains separate from the shared canvas scene path.

## Decisions And Rationale

- Dungeon keeps one adapter seam into the generic canvas.
- Dungeon-grid coordinates stay inside the dungeon adopter boundary.
- The dungeon map slotcontent surface follows the same canonical Binder plus
  `PresentationModel` split as the rest of the view layer, but it is also the
  only legal render-state owner toward canvas.
- Public surface-family unification in `DungeonApplicationService` is still
  open compatibility debt outside the canvas-seam implementation.

## Verification Notes

- This architecture is currently `Review-Owned`.
- Review must reject any second dungeon-to-canvas adapter for the same seam.

## References

- [Maps Canvas Architecture](/home/aaron/Schreibtisch/projects/SaltMarcher/docs/maps/architecture/architecture-maps-canvas.md:1)
- [Maps Canvas Contract](/home/aaron/Schreibtisch/projects/SaltMarcher/docs/maps/contract/contract-maps-canvas.md:1)
- [Dungeon Map Surface Contract](/home/aaron/Schreibtisch/projects/SaltMarcher/docs/maps/contract/contract-maps-dungeon-surface.md:1)
- [Dungeon Feature Overview](/home/aaron/Schreibtisch/projects/SaltMarcher/docs/dungeon/README.md:1)
