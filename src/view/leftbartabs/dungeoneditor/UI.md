Status: Active
Owner: SaltMarcher Team
Last Reviewed: 2026-04-20
Source of Truth: Dungeon editor left-bar tab UI structure and mock interaction
state.

# Dungeon Editor UI

## Component Purpose

The Dungeon Editor tab is the editor-facing cockpit root for the local dungeon
map mock. It mirrors the legacy dungeon editor shell enough to validate layout,
visual representation, and future wiring seams before real edit operations are
connected.

## Visible Structure

- Controls show a dungeon selector, create/edit actions, grid/graph toggles,
  level buttons, overlay trigger, and the editor tool families.
- Main content is the shared `DungeonMapMainView` canvas surface in editor
  mode.
- State content shows the active tool, view mode, projection level, overlay
  mode, and the fact that this pass mutates presentation state only.

## Visible States

- Tool selection updates highlighted controls and the mock map selection
  emphasis.
- Grid/graph toggles switch the central map representation.
- Level and overlay controls update only the view projection.
