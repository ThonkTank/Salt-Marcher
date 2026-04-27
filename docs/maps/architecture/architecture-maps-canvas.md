Status: Draft
Owner: SaltMarcher Team
Last Reviewed: 2026-04-26
Source of Truth: Generic architecture boundaries and capability paths for the
shared map canvas.

# Maps Canvas Architecture

## Purpose

This specification defines the reusable architecture between the passive map
canvas and adopting map features.

It owns:

- the shared role model
- the shared capability paths
- the rule that adopters translate canvas coordinates to their own native
  coordinate systems and back through one adapter
- the rule that exactly one domain-to-canvas path and exactly one
  pointer-to-domain path exist for each adopter surface

It does not own adopter-native payload fields or adopter gameplay behavior.

## Roles

- `MapCanvasView`
- adopter-owned canvas-facing map-slot `PresentationModel`
- adopter-facing Binder
- adopter feature boundary
- adopter-native `published/**` surface payload
- `MapRenderScene`

Current code may still use adopter-local class names ending in `*ViewModel`
while the repo migrates to the canonical `PresentationModel` role language.
That naming is migration debt, not a second architecture.

## Boundary Rules

- the passive map view speaks canvas-space only
- each adopter owns exactly one canvas-facing map-slot `PresentationModel`
  that projects adopter-native published content into `MapRenderScene`
- dungeon converts `canvas <-> dungeon grid`
- hex converts `canvas <-> internal hex coordinates`
- the passive map view never reconstructs adopter-native coordinates itself
- one render scene owns both draw and hit identity
- only the adopter-facing Binder may know the adopter boundary and
  adopter-published carriers
- the adopter-facing map-slot `PresentationModel` owns scene projection state,
  but not adopter-boundary access
- active-root `PresentationModel`s must not mirror adopter surface payloads or
  own a second render-state path to canvas

## Capability Paths

### Surface Read

`surface Binder -> adopter boundary -> published surface payload -> canvas-facing map-slot PresentationModel -> MapRenderScene -> MapCanvasView`

### Preview And Apply

`MapCanvasView -> CanvasPointerEvent -> surface Binder wiring -> optional surface IntentHandler -> co-located PresentationModel request/state -> surface Binder -> adopter boundary -> published surface payload -> canvas-facing map-slot PresentationModel -> MapRenderScene -> MapCanvasView`

### Action

`MapCanvasView or surface controls -> surface Binder wiring -> optional surface IntentHandler -> co-located PresentationModel request/state -> surface Binder -> adopter boundary -> published surface payload -> canvas-facing map-slot PresentationModel -> MapRenderScene -> MapCanvasView`

### Draw And Hit

`published surface payload -> canvas-facing map-slot PresentationModel -> MapRenderScene -> MapCanvasView -> CanvasHit`

## Current Implementation

- `src/view/slotcontent/main/mapcanvas/MapCanvasView.java` is the shared passive
  canvas root.
- `MapRenderScene` and `CanvasPointerEvent` under the same package are the
  shared draw and pointer carriers.
- Active-root Binders own adopter-specific pointer translation wiring and bind
  the adopter boundary to the one canvas-facing map-slot `PresentationModel`.
- Some adopter classes still carry `*ViewModel` names; those classes must be
  interpreted against the canonical view-layer standard, not against the old
  monolithic `ViewModel` target.

## Forbidden Shortcuts

- no passive-view direct calls into adopter application services
- no second hit model beside the drawn scene
- no second domain-to-canvas projection owner beside the canvas-facing
  map-slot `PresentationModel`
- no direct rendering of adopter-native payloads in `MapCanvasView`
- no shared frontend root language that uses dungeon-grid or hex-native
  coordinates
- no adopter-boundary imports in `MapCanvasView`
- no pointer-to-domain path that skips `CanvasPointerEvent`,
  `IntentHandler`/`PresentationModel`, or the Binder

## Verification Notes

- This architecture is currently `Review-Owned`.
- Review must reject a second canvas-facing projection seam for the same
  adopter surface.

## References

- [Maps Canvas Requirements](/home/aaron/Schreibtisch/projects/SaltMarcher/docs/maps/requirements/requirements-maps-canvas.md:1)
- [Maps Canvas Contract](/home/aaron/Schreibtisch/projects/SaltMarcher/docs/maps/contract/contract-maps-canvas.md:1)
- [Dungeon Map Adoption Architecture](/home/aaron/Schreibtisch/projects/SaltMarcher/docs/maps/architecture/architecture-maps-dungeon-adoption.md:1)
- [Hex Map Adoption Architecture](/home/aaron/Schreibtisch/projects/SaltMarcher/docs/maps/architecture/architecture-maps-hex-adoption.md:1)
