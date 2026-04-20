Status: Active
Owner: SaltMarcher Team
Last Reviewed: 2026-04-20
Source of Truth: Reusable dungeon map presentation structure and central style
selector roles.

# Dungeon Map View

## Component Purpose

`DungeonMapMainView` is the reusable passive map surface used by dungeon editor
and dungeon travel contributions. It renders the map scene graph, camera
controls, grid, cells, edges, door markers, labels, HUD, and overlay messages.

## Visible Structure

- The map scene uses central `dungeon-map-*` selectors for the canvas-like
  scene background, grid tiers, axis lines, cell states, current-cell outline,
  walls, doors, door markers, group labels, HUD, and overlay messages.
- The View owns geometry, viewport transforms, label placement, and interaction
  event wiring.
- Visual values such as colors, fills, strokes, font sizes, borders, and text
  emphasis live in `resources/salt-marcher.css`.

## Visible States

- No loaded map shows a centered placeholder overlay.
- Loaded maps can show a softer note overlay while still displaying the map.
- Current cells and labels use the current-state selector hooks.
- Non-interactive walls use the non-interactive wall hook while retaining the
  same wall color vocabulary.
