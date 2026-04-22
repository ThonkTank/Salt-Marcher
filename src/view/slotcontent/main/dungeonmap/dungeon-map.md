Status: Active
Owner: SaltMarcher Team
Last Reviewed: 2026-04-22
Source of Truth: Reusable dungeon map presentation structure and central style
selector roles.

# Dungeon Map View

## Component Purpose

`DungeonMapMainView` is the reusable passive map surface used by dungeon editor
and dungeon travel contributions. It renders the domain-backed dungeon map
projection and can show runtime party-token state supplied by travel.

## Visible Structure

- The map scene uses central `dungeon-map-*` selectors for the workspace frame,
  canvas host, and overlay messages.
- The canvas draws grid tiers, axis lines, rooms, corridors, walls, doors,
  door markers, stairs, transitions, labels, graph mode, and the runtime party
  token from `DungeonMapDisplayModel`.
- Wall and door render edges are domain-projected gridline segments around
  tiles. The view draws the supplied endpoints directly and must not compensate
  for tile-side offsets.
- The View owns camera state, viewport transforms, canvas drawing, label
  placement, technical pan/zoom/reset events, and passive primary-pointer
  events expressed as grid hits.
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
  Loaded empty maps show the grid and an empty-geometry note; the view does
  not synthesize representative rooms or handles.
- Editor mode shows tool/status text, selectable tool highlighting, configurable
  level overlays, grid/graph mode, selected room clusters, drag previews, and
  room paint/delete rectangle previews supplied by the active editor ViewModel.
  Drag previews keep the committed source geometry visible and draw a visually
  distinct moved copy of selected cells, wall or door edges, labels, and editor
  handles.
- Runtime mode shows a party token from the active travel session, numbered
  door markers when supplied by the display model, and current location state.
- Resize and layout redraw the same camera state against a top-left anchored
  canvas layer; startup shell layout changes do not pan or recenter the
  viewport.
- Camera panning is available through middle-pointer drag. There is no
  timer-driven, held-key, raw keyboard, or duplicated in-map toolbar camera
  motion. Pointer panning uses scene-stable deltas so the camera does not jump
  when child hit targets change.
