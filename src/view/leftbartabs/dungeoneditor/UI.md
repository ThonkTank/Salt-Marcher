Status: Active
Owner: SaltMarcher Team
Last Reviewed: 2026-04-21
Source of Truth: Dungeon editor left-bar tab UI structure and control-panel
interaction state.

# Dungeon Editor UI

## Component Purpose

The Dungeon Editor tab is the editor-facing cockpit root for the local dungeon
map. It mirrors the legacy dungeon editor shell control panel for map
selection, map lifecycle actions, view projection, overlay settings, and tool
family selection while full authored edit operations are still pending.

## Visible Structure

- Controls show a dungeon selector, create/edit/delete actions,
  grid/graph toggles, level buttons, full level-overlay settings, and the
  editor tool families.
- Main content is the shared `DungeonMapMainView` canvas surface in editor
  mode.
- State content shows the active tool, view mode, projection level, overlay
  mode, and whether the selected tool is still presentation-only.

## Visible States

- The dungeon selector loads the selected map; create, rename, and delete call
  the dungeon application service.
- Tool selection updates highlighted controls and presentation state. Tool
  gestures do not yet commit authored dungeon edit operations.
- Grid/graph toggles switch the central map representation.
- Level controls update the active map projection.
- Overlay controls support off, nearby-level range, selected levels, and
  opacity settings.
