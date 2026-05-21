Status: Draft
Owner: SaltMarcher Team
Last Reviewed: 2026-04-24
Source of Truth: Legacy shared canvas-side contract record. The former
`MapCanvasView` / `CanvasPointerEvent` seam has been removed; current dungeon
rendering is adopter-local while the view layer migrates to the reusable
three-role slotcontent model.

# Maps Canvas Contract

## Purpose

This contract records the removed shared-canvas boundary language below any
adopter-native map surface. It remains a Review-Owned debt record and must not
be read as proof that `MapCanvasView` still exists in production sources.

Owners:

- producers: canvas-facing adopter `ContentModel`s
- consumers: adopter-local map Views, adopter-facing Binders, and
  adopter-facing `IntentHandler` wiring

It does not own adopter-native requests, adopter-native payloads, or adopter
domain truth.

This is not the canonical target reusable-slotcontent contract. The canonical
reusable-slotcontent target lives only in the
[View Layer Standard](/home/aaron/Schreibtisch/projects/SaltMarcher/docs/project/architecture/patterns/view-layer.md:1).
The `MapRenderScene` and `CanvasPointerEvent` seams below describe removed
implementation boundary debt relative to that owner.

## Rules

- shared renderer input coordinates MUST be canvas-native
- shared pointer output coordinates MUST be canvas-native
- shared hit identity MUST come from the same rendered scene that the passive
  map view draws
- shared hit ordering MUST come from the same rendered scene that the passive
  map view draws
- removed `MapRenderScene` was the shared renderer input root
- removed `CanvasPointerEvent` was the shared pointer-output root
- all geometry in an adopter-local render scene MUST be canvas-native
- the shared canvas boundary MUST NOT expose adopter-native commands, queries,
  or coordinates directly

## Contract Surface

### `CanvasPoint`

Required fields:

- `x`
- `y`

### `CanvasHit`

Required fields:

- `hitRef`
- `primitive`

Optional fields:

- `selectionRef`

`hitRef` and `selectionRef` MUST identify content from the same render-scene
instance that was drawn for the hit test.

### Removed Legacy `CanvasPointerEvent`

Required fields:

- `phase`
- `buttons`
- `modifiers`
- `canvasPoint`

Optional fields:

- `hit`

The removed `MapCanvasView` emitted `CanvasPointerEvent` through one technical
outbound seam. Current adopter-local map Views must keep the same constraint by
emitting one same-stem `ViewInputEvent` family instead of several phase-specific
callback families.

### Removed Legacy `MapRenderScene`

Required families:

- `surfaces`
- `boundaries`
- `glyphs`
- `texts`
- `relations`
- `actors`
- `hitAreas`
- `overlays`

`hitAreas` is the prepared technical hit-evidence list for the same rendered
scene. The passive map surface consumes that order directly instead of
reconstructing cross-family hit priority locally.

## Validation And Error Behavior

- a pointer event with no hit MUST still carry a valid `canvasPoint`
- stale or unknown scene refs MUST be treated as no-hit
- omitted optional fields mean absence, not implicit adopter defaults
- the passive map surface MUST remain renderable with an empty render scene
- a consumer MUST treat same-stem map `ViewInputEvent` snapshots as technical
  input only; adopter meaning is resolved outside the passive map surface

## Compatibility Notes

Any earlier shared map contract that used adopter-native coordinates as the
shared frontend root is superseded by this contract.

## Verification Notes

- This contract is currently `Review-Owned`.
- Review must treat `MapRenderScene`, `CanvasPointerEvent`, and `MapCanvasView`
  as removed implementation carriers, not as new canonical reusable role
  families.
- Review must reject any shared map contract that exposes dungeon-grid or
  hex-native coordinates as the canonical canvas boundary.
- Review must reject any second shared pointer-output family beside the
  adopter-local same-stem `ViewInputEvent`.

## References

- [Maps Canvas Requirements](./requirements-maps-canvas.md)
- [Maps Canvas Architecture](./architecture-maps-canvas.md)
