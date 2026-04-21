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
family selection. The Auswahl tool now owns the first committed editor gesture:
room-cluster selection, drag preview, and persisted grid movement.

## Visible Structure

- Controls show a dungeon selector, create/edit/delete actions,
  grid/graph toggles, level buttons, full level-overlay settings, and the
  editor tool families.
- Main content is the shared `DungeonMapMainView` canvas surface in editor
  mode.
- State content shows the active tool, view mode, projection level, overlay
  mode, selected cluster, drag delta, and the active mutation status.

## Visible States

- The dungeon selector loads the selected map; create, rename, and delete call
  the dungeon application service.
- Tool selection updates highlighted controls and presentation state. The
  Auswahl tool commits room-cluster movement on the active map; the remaining
  editor tool families are still pending authored operations.
- In grid mode, clicking a room selects its cluster, dragging shows a preview,
  and releasing commits the cluster move. Empty grid clicks clear selection.
- Grid/graph toggles switch the central map representation.
- Level controls update the active map projection.
- Overlay controls support off, nearby-level range, selected levels, and
  opacity settings.
