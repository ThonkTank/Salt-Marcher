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
family selection. The Auswahl tool owns presentation selection, drag preview,
and persisted grid movement for the selected topology ref. The room tool family
owns the next committed editor gesture: active-level rectangle preview plus
room paint/delete.

## Visible Structure

- Controls are compressed into three rows: dungeon selector plus
  create/edit/delete actions, level plus overlay and grid/graph controls, and
  the editor tool families.
- Main content is the shared `DungeonMapMainView` canvas surface in editor
  mode.
- State content shows the active tool, view mode, projection level, overlay
  mode, selected topology element, drag delta, and the active mutation status.

## Visible States

- The dungeon selector loads the selected map; create, rename, and delete call
  the dungeon application service. Successful map loading is represented by
  the selected dropdown value rather than a duplicate status message.
- Tool selection updates highlighted controls and presentation state. The
  Auswahl tool commits movement for the selected map-owned topology ref on the
  active map. `Raum malen` and `Raum loeschen` commit active-level rectangle
  mutations. The remaining non-room editor tool families are still pending
  authored operations.
- In grid mode, clicking a room selects its topology ref, dragging shows a
  preview for the view-local cluster grouping, and releasing commits movement
  through the domain map. Empty grid clicks clear selection.
- In room paint/delete mode, pressing the grid starts a rectangle at the
  pointed cell, dragging grows the preview rectangle, and release commits the
  room topology mutation for the active map and level.
- Grid/graph toggles switch the central map representation.
- Level controls update the active map projection.
- Overlay controls support off, nearby-level range, selected levels, and
  opacity settings.
