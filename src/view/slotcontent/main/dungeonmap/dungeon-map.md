Status: Active
Owner: SaltMarcher Team
Last Reviewed: 2026-04-21
Source of Truth: Reusable dungeon map presentation structure and central style
selector roles.

# Dungeon Map View

## Component Purpose

`DungeonMapMainView` is the reusable passive map surface used by dungeon editor
and dungeon travel contributions. It renders the domain-backed dungeon map
projection and can show runtime party-token state supplied by travel.

## Visible Structure

- The map scene uses central `dungeon-map-*` selectors for the workspace frame,
  header, canvas host, HUD, and overlay messages.
- The canvas draws grid tiers, axis lines, rooms, corridors, walls, doors,
  door markers, stairs, transitions, labels, graph mode, and the runtime party
  token from `DungeonMapDisplayModel`.
- The View owns camera state, viewport transforms, canvas drawing, label
  placement, technical pan/zoom/reset events, one-step WASD panning, and
  passive primary-pointer events expressed as grid hits.
- `DungeonMapDisplayModel` is view-owned projection state translated from
  domain snapshots and runtime travel session state. It owns reusable
  level-overlay settings for disabled, nearby range, selected levels, and
  opacity presentation, plus editor selection, drag-preview render state, and
  room paint/delete preview render state.
- Visual values such as colors, fills, strokes, font sizes, borders, and text
  emphasis live in `resources/salt-marcher.css`.

## Visible States

- No loaded map shows a centered placeholder overlay.
- Loaded maps can show a softer note overlay while still displaying the map.
- Editor mode shows tool/status text, selectable tool highlighting, configurable
  level overlays, grid/graph mode, selected room clusters, drag previews, and
  room paint/delete rectangle previews supplied by the active editor ViewModel.
- Runtime mode shows a party token from the active travel session, numbered
  door markers when supplied by the display model, current location state, and
  resettable camera controls.
- WASD camera panning moves one fixed step per key-press event. There is no
  timer-driven or held-key camera motion. Pointer panning uses scene-stable
  deltas so the camera does not jump when child hit targets change.
