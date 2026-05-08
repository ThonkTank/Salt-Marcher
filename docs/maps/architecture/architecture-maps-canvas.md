Status: Draft
Owner: SaltMarcher Team
Last Reviewed: 2026-04-26
Source of Truth: Current implementation architecture boundaries and capability
paths for the shared map canvas while the view layer migrates to the reusable
three-role slotcontent model.

# Maps Canvas Architecture

## Purpose

This specification records the current implementation architecture between the
passive map canvas and adopting map features.

It owns:

- the shared role model
- the shared capability paths
- the rule that adopters translate canvas coordinates to their own native
  coordinate systems and back through one adapter
- the rule that exactly one domain-to-canvas path and exactly one
  pointer-to-domain path exist for each adopter surface

It does not own adopter-native payload fields or adopter gameplay behavior.

This document is not the canonical target model for reusable `slotcontent/**`.
The project-wide target is the uniform reusable unit
`View + ViewInputEvent + ContentModel`, including under
`slotcontent/primitives/**`. The canvas-specific `CanvasPointerEvent` and
`MapRenderScene` seams described here are current implementation debt that must
eventually collapse into that reusable unit model.

## Roles

- current implementation `MapCanvasView`
- adopter-owned canvas-facing map-slot `ContentModel`
- adopter-facing Binder
- adopter feature boundary
- adopter-native `published/**` surface payload
- current implementation `MapRenderScene`

Current code may still use adopter-local class names ending in `*ViewModel`
while the repo migrates to the canonical `ContributionModel` / `ContentModel`
role language. That naming is migration debt, not a second architecture.

## Boundary Rules

- the passive map view speaks canvas-space only
- each adopter owns exactly one canvas-facing map-slot `ContentModel`
  that projects adopter-native published content into `MapRenderScene`
- dungeon converts `canvas <-> dungeon grid`
- hex converts `canvas <-> internal hex coordinates`
- the passive map view never reconstructs adopter-native coordinates itself
- current implementation still uses one render scene for draw order, hit
  order, and hit identity
- current implementation still emits pointer output through one technical
  `CanvasPointerEvent` seam
- only the adopter-facing Binder may know the adopter boundary and
  adopter-published carriers
- the adopter-facing map-slot `ContentModel` owns scene projection state,
  but not adopter-boundary access
- active-root `ContributionModel`s must not mirror adopter surface payloads or
  own a second render-state path to canvas
- no new work may treat `CanvasPointerEvent` or `MapRenderScene` as canonical
  reusable role types beyond this legacy implementation seam

## Capability Paths

### Surface Read

`surface Binder -> adopter boundary -> published surface payload -> canvas-facing map-slot ContentModel -> current implementation MapRenderScene -> current implementation MapCanvasView`

### Preview And Apply

`current implementation MapCanvasView -> current implementation CanvasPointerEvent -> surface Binder wiring -> same-root IntentHandler -> co-located ContentModel or ContributionModel state -> surface Binder -> adopter boundary -> published surface payload -> canvas-facing map-slot ContentModel -> current implementation MapRenderScene -> current implementation MapCanvasView`

### Action

`current implementation MapCanvasView or surface controls -> surface Binder wiring -> same-root IntentHandler -> co-located ContentModel or ContributionModel state -> surface Binder -> adopter boundary -> published surface payload -> canvas-facing map-slot ContentModel -> current implementation MapRenderScene -> current implementation MapCanvasView`

### Draw And Hit

`published surface payload -> canvas-facing map-slot ContentModel -> current implementation MapRenderScene -> current implementation MapCanvasView -> CanvasHit`

The passive canvas consumes prepared scene hit areas directly from
`MapRenderScene`; it does not rebuild cross-family hit precedence on its own.

## Current Implementation

- `src/view/slotcontent/main/mapcanvas/MapCanvasView.java` is the shared passive
  canvas root in the current implementation.
- `MapRenderScene` and `CanvasPointerEvent` under the same package are current
  implementation carriers, not reusable target-role types.
- `MapCanvasView` now exposes one technical pointer seam that emits
  `CanvasPointerEvent`; adopter views may wrap that seam into their own
  same-stem `*ViewInputEvent` families during the migration, but the shared
  canvas does not expose separate phase-specific callback APIs.
- Active-root Binders own adopter-specific pointer translation wiring and bind
  the adopter boundary to the one canvas-facing map-slot `ContentModel`.
- Some adopter classes still carry `*ViewModel` names; those classes must be
  interpreted against the canonical view-layer standard, not against the old
  monolithic `ViewModel` target.

## Forbidden Shortcuts

- no passive-view direct calls into adopter application services
- no second hit model beside the drawn scene
- no second domain-to-canvas projection owner beside the canvas-facing
  map-slot `ContentModel`
- no direct rendering of adopter-native payloads in `MapCanvasView`
- no shared frontend root language that uses dungeon-grid or hex-native
  coordinates
- no adopter-boundary imports in `MapCanvasView`
- no pointer-to-domain path that skips `CanvasPointerEvent`, the same-root
  `IntentHandler`, the canvas-facing `ContentModel`, or the Binder

## Verification Notes

- This architecture is currently `Review-Owned`.
- Review must treat `CanvasPointerEvent` and `MapRenderScene` as legacy
  implementation seams, not as new canonical reusable role families.
- Review must reject a second canvas-facing projection seam for the same
  adopter surface.

## References

- [Maps Canvas Requirements](/home/aaron/Schreibtisch/projects/SaltMarcher/docs/maps/requirements/requirements-maps-canvas.md:1)
- [Maps Canvas Contract](/home/aaron/Schreibtisch/projects/SaltMarcher/docs/maps/contract/contract-maps-canvas.md:1)
- [Dungeon Map Adoption Architecture](/home/aaron/Schreibtisch/projects/SaltMarcher/docs/maps/architecture/architecture-maps-dungeon-adoption.md:1)
- [Hex Map Adoption Architecture](/home/aaron/Schreibtisch/projects/SaltMarcher/docs/maps/architecture/architecture-maps-hex-adoption.md:1)
