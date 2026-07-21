Status: Draft
Owner: SaltMarcher Team
Last Reviewed: 2026-07-19
Source of Truth: User-facing behavior and visible states of the generic map
canvas.

# Maps Canvas Requirements

## Goal

Provide feature-neutral passive map-canvas mechanisms that Dungeon and Hex
JavaFX surfaces reuse for rendering, hit-testing, camera behavior, viewport
caching, and passive pointer capture.

## Non-Goals

- adopter domain invariants
- adopter persistence rules
- adopter-native payload vocabulary
- adopter-specific gameplay behavior

## Visible Structure

- one workspace frame and canvas host
- one rendered scene that can draw adopter-provided cells or tiles,
  boundaries or edges, labels, markers, actor tokens, relations, and overlays
- one passive camera and viewport owner
- one passive pointer-capture surface
- one adopter-independent empty or placeholder presentation

## Required Behavior

- the canvas MUST draw from one shared scene root
- hit-testing MUST derive from the same scene the canvas draws
- pan, zoom, resize, and reset-view behavior MUST remain passive presentation
  behavior
- empty-state and placeholder rendering MUST be possible without synthesizing
  adopter-native map content
- the canvas MUST support adopter-provided labels, markers, and runtime travel
  tokens without turning them into canvas-owned domain meaning
- the canvas MUST remain reusable for both square-grid and hex-grid adopters
- the canvas MAY host different adopter-facing scene presentations, for
  example tile-first or graph-like scenes, while keeping the same passive
  interaction model
- the canvas MUST NOT emit adopter-native coordinates, refs, commands, or
  queries directly

## Interactions

- middle-pointer drag pans the camera
- zoom and resize redraw against the current camera state
- reset view restores the default camera state without changing adopter truth
- pointer events remain passive and are delivered to the adopting feature
  without acquiring adopter-specific meaning inside the canvas
- pointer press, drag, release, move, and level-scroll capture remain
  adopter-triggered outcomes rather than canvas-owned game actions
- shell layout changes do not implicitly recenter the canvas

## Visible States

- explicit empty state when no map or scene is available
- loaded scene state with adopter-provided geometry and overlays
- camera changes that leave the rendered content stable until the adopter
  changes the scene
- adopter-owned overlay on or off states presented through the shared canvas
- adopter-owned runtime marker states such as current token position

## Acceptance Criteria

- draw and hit reflect the same current scene
- the camera remains scene-stable while pointer hits change
- the passive canvas stays reusable across grid-based and hex-based adopters
- the canvas can show empty, loaded, and overlay-bearing scenes without
  inventing adopter-specific placeholder data
- adopter-native coordinate conversion happens outside the passive canvas

## References

- [Maps Canvas Architecture](../architecture/architecture-maps-canvas.md) (line 1)
- [Maps Canvas Contract](../contract/contract-maps-canvas.md) (line 1)
- [Dungeon Map Adoption Architecture](../architecture/architecture-maps-dungeon-adoption.md) (line 1)
- [Hex Map Adoption Architecture](../architecture/architecture-maps-hex-adoption.md) (line 1)
