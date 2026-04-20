Status: Active
Owner: SaltMarcher Team
Last Reviewed: 2026-04-20
Source of Truth: Reusable dungeon map presentation structure and central style
selector roles.

# Dungeon Map View

## Component Purpose

`DungeonMapMainView` is the reusable passive map surface used by dungeon editor
and dungeon travel contributions. It renders a canvas-based UI mock of the
legacy dungeon map views so the local cockpit has a representation-equivalent
surface before real editing and travel behavior is wired in.

## Visible Structure

- The map scene uses central `dungeon-map-*` selectors for the workspace frame,
  header, canvas host, HUD, and overlay messages.
- The canvas draws grid tiers, axis lines, rooms, corridors, walls, doors,
  door markers, stairs, transitions, labels, graph mode, and the runtime party
  token from `DungeonMapDisplayModel`.
- The View owns camera state, viewport transforms, canvas drawing, label
  placement, and technical pan/zoom/reset events.
- `DungeonMapDisplayModel` is view-owned mock projection state. It is the
  intended attachment point for later real domain-backed geometry.
- Visual values such as colors, fills, strokes, font sizes, borders, and text
  emphasis live in `resources/salt-marcher.css`.

## Visible States

- No loaded map shows a centered placeholder overlay.
- Loaded maps can show a softer note overlay while still displaying the map.
- Editor mode shows tool/status text, selectable tool highlighting, level
  overlays, and grid/graph mode.
- Runtime mode shows a party token, numbered door markers, current location
  state, and resettable camera controls.
