Status: Draft
Owner: SaltMarcher Team
Last Reviewed: 2026-04-24
Source of Truth: Current implementation shared canvas-side contract for the
generic map canvas while the view layer migrates to the reusable three-role
slotcontent model.

# Maps Canvas Contract

## Purpose

This contract defines the current implementation boundary language below any
adopter-native map surface.

Owners:

- producers: canvas-facing adopter `ContentModel`s
- consumers: `MapCanvasView`, adopter-facing Binders, and adopter-facing
  `IntentHandler` wiring

It does not own adopter-native requests, adopter-native payloads, or adopter
domain truth.

This is not the canonical target reusable-slotcontent contract. The project-
wide target remains `View + ViewInputEvent + ContentModel`; the `MapRenderScene`
and `CanvasPointerEvent` seams below describe the current implementation
boundary that still exists during migration.

## Rules

- shared renderer input coordinates MUST be canvas-native
- shared pointer output coordinates MUST be canvas-native
- shared hit identity MUST come from the same rendered scene that the passive
  map view draws
- shared hit ordering MUST come from the same rendered scene that the passive
  map view draws
- in the current implementation, `MapRenderScene` is the shared renderer input
  root
- in the current implementation, `CanvasPointerEvent` is the shared
  pointer-output root
- all geometry in `MapRenderScene` MUST be canvas-native
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

`hitRef` and `selectionRef` MUST identify content from the same
`MapRenderScene` instance that was drawn for the hit test.

### `CanvasPointerEvent`

Required fields:

- `phase`
- `buttons`
- `modifiers`
- `canvasPoint`

Optional fields:

- `hit`

`MapCanvasView` emits `CanvasPointerEvent` through one technical outbound seam.
Consumers must not require several phase-specific callback families from the
shared passive canvas.

### `MapRenderScene`

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
scene. The passive canvas consumes that order directly instead of reconstructing
cross-family hit priority locally.

## Validation And Error Behavior

- a pointer event with no hit MUST still carry a valid `canvasPoint`
- stale or unknown scene refs MUST be treated as no-hit
- omitted optional fields mean absence, not implicit adopter defaults
- the passive canvas MUST remain renderable with an empty `MapRenderScene`
- a consumer MUST treat `CanvasPointerEvent` as technical input only; adopter
  meaning is resolved outside the passive canvas

## Compatibility Notes

Any earlier shared map contract that used adopter-native coordinates as the
shared frontend root is superseded by this contract.

## Verification Notes

- This contract is currently `Review-Owned`.
- Review must treat `MapRenderScene` and `CanvasPointerEvent` as current
  implementation carriers, not as new canonical reusable role families.
- Review must reject any shared map contract that exposes dungeon-grid or
  hex-native coordinates as the canonical canvas boundary.
- Review must reject any second shared pointer-output family beside
  `CanvasPointerEvent`.

## References

- [Maps Canvas Requirements](./requirements-maps-canvas.md)
- [Maps Canvas Architecture](./architecture-maps-canvas.md)
