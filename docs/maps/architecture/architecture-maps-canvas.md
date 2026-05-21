Status: Draft
Owner: SaltMarcher Team
Last Reviewed: 2026-04-26
Source of Truth: Legacy shared map-canvas architecture record. The former
`MapCanvasView` implementation seam has been removed; current dungeon rendering
is adopter-local while the view layer migrates to the reusable three-role
slotcontent model.

# Maps Canvas Architecture

## Purpose

This specification records the legacy implementation architecture between the
passive map canvas and adopting map features. It remains a Review-Owned debt
record for map-canvas constraints, not a claim that a shared `MapCanvasView`
still exists in production sources.

It owns:

- the shared role model
- the shared capability paths
- the rule that adopters translate canvas coordinates to their own native
  coordinate systems and back through one adapter
- the rule that exactly one domain-to-canvas path and exactly one
  pointer-to-domain path exist for each adopter surface

It does not own adopter-native payload fields or adopter gameplay behavior.

This document is not the canonical target model for reusable `slotcontent/**`.
The canonical reusable-slotcontent architecture lives only in the
[View Layer Standard](/home/aaron/Schreibtisch/projects/SaltMarcher/docs/project/architecture/patterns/view-layer.md:1).
The canvas-specific `CanvasPointerEvent` and `MapRenderScene` seams described
here are current implementation debt relative to that owner.

## Roles

- removed legacy `MapCanvasView` seam
- adopter-owned canvas-facing map-slot `ContentModel`
- adopter-facing Binder
- adopter feature boundary
- adopter-native `published/**` surface payload
- adopter-local render scene such as the dungeon map render state

Current code may still use adopter-local class names ending in `*ViewModel`
while the repo migrates to the canonical `ContributionModel` / `ContentModel`
role language. That naming is migration debt, not a second architecture.

## Boundary Rules

- the passive map view speaks canvas-space only
- each adopter owns exactly one canvas-facing map-slot `ContentModel`
  that projects adopter-native published content into its local render scene
- dungeon converts `canvas <-> dungeon grid`
- hex converts `canvas <-> internal hex coordinates`
- the passive map view never reconstructs adopter-native coordinates itself
- each current adopter surface uses one render scene for draw order, hit
  order, and hit identity
- current dungeon surfaces emit pointer output through their same-stem
  `ViewInputEvent` seam
- only the adopter-facing Binder may know the adopter boundary and
  adopter-published carriers
- the adopter-facing map-slot `ContentModel` owns scene projection state,
  but not adopter-boundary access
- active-root `ContributionModel`s must not mirror adopter surface payloads or
  own a second render-state path to canvas
- no new work may reintroduce `CanvasPointerEvent`, `MapRenderScene`, or
  `MapCanvasView` as canonical reusable role types beyond this removed legacy
  implementation seam

## Capability Paths

### Surface Read

`surface Binder -> adopter boundary -> published surface payload -> canvas-facing map-slot ContentModel -> adopter-local render scene -> adopter-local map View`

### Preview And Apply

`adopter-local map View -> same-stem ViewInputEvent -> surface Binder wiring -> same-root IntentHandler -> co-located ContentModel or ContributionModel state -> surface Binder -> adopter boundary -> published surface payload -> canvas-facing map-slot ContentModel -> adopter-local render scene -> adopter-local map View`

### Action

`adopter-local map View or surface controls -> surface Binder wiring -> same-root IntentHandler -> co-located ContentModel or ContributionModel state -> surface Binder -> adopter boundary -> published surface payload -> canvas-facing map-slot ContentModel -> adopter-local render scene -> adopter-local map View`

### Draw And Hit

`published surface payload -> canvas-facing map-slot ContentModel -> adopter-local render scene -> adopter-local map View -> same-stem hit snapshot`

The passive map surface consumes prepared scene hit areas directly from the
adopter-local render scene; it does not rebuild cross-family hit precedence on
its own.

## Current Implementation

- The former shared `src/view/slotcontent/primitives/mapcanvas/**` canvas root
  has been removed.
- The surviving current dungeon surface is local to
  `src/view/slotcontent/main/dungeonmap/**`.
- Removed `MapRenderScene` and `CanvasPointerEvent` seams must not be treated as
  reusable target-role types.
- The current dungeon map View exposes one same-stem pointer snapshot seam
  through `DungeonMapViewInputEvent`; it does not expose separate
  phase-specific callback APIs.
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
- no direct rendering of adopter-native payloads in the adopter-local map View
- no shared frontend root language that uses dungeon-grid or hex-native
  coordinates
- no adopter-boundary imports in the adopter-local map View
- no pointer-to-domain path that skips the same-stem `ViewInputEvent`, the
  same-root `IntentHandler`, the canvas-facing `ContentModel`, or the Binder

## Verification Notes

- This architecture is currently `Review-Owned`.
- Review must treat `CanvasPointerEvent`, `MapRenderScene`, and `MapCanvasView`
  as removed legacy implementation seams, not as new canonical reusable role
  families.
- Review must reject a second canvas-facing projection seam for the same
  adopter surface.

## References

- [Maps Canvas Requirements](/home/aaron/Schreibtisch/projects/SaltMarcher/docs/maps/requirements/requirements-maps-canvas.md:1)
- [Maps Canvas Contract](/home/aaron/Schreibtisch/projects/SaltMarcher/docs/maps/contract/contract-maps-canvas.md:1)
- [Dungeon Map Adoption Architecture](/home/aaron/Schreibtisch/projects/SaltMarcher/docs/maps/architecture/architecture-maps-dungeon-adoption.md:1)
- [Hex Map Adoption Architecture](/home/aaron/Schreibtisch/projects/SaltMarcher/docs/maps/architecture/architecture-maps-hex-adoption.md:1)
