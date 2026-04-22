Status: Active
Owner: SaltMarcher Team
Last Reviewed: 2026-04-22
Source of Truth: Dungeon editor left-bar tab UI structure and control-panel
interaction state.

# Dungeon Editor UI

## Component Purpose

The Dungeon Editor tab is the editor-facing cockpit root for authored dungeon
maps. It keeps the compact current control layout while carrying the original
Auswahl tool behavior through the map-owned topology model: presentation
selection, drag preview, persisted grid and level movement for selected
editor handles, and room narration editing.

## Visible Structure

- Controls are compressed into three rows: dungeon selector plus
  create/edit/delete actions, level plus overlay and grid/graph projection
  controls, and tool-family selection.
- Main content is the shared `DungeonMapMainView` canvas surface in editor
  mode.
- State content shows the active tool, view mode, projection level, overlay
  mode, selected topology element, drag delta, active mutation status, and
  room narration cards for selected rooms or room clusters.

## Visible States

- The dungeon selector loads the selected map. Create, rename, and delete call
  the dungeon application service. Created maps start empty until authored room
  geometry is painted. Successful map loading is represented by the selected
  dropdown value rather than a duplicate status message.
- Tool selection updates highlighted controls and presentation state. The
  Auswahl tool selects map-owned topology refs for rooms, labels, stairs, and
  transitions. Selected room and cluster labels expose editable room
  narration in the state pane. `Raum malen` and `Raum loeschen` commit
  active-level rectangle mutations. The remaining non-room editor tool
  families are still pending authored operations.
- In grid mode, clicking a room, room label, stair, transition, door handle,
  corridor waypoint, stair anchor, or cluster label selects the owning topology
  ref. Dragging a selectable editor handle keeps the authored map snapshot
  unchanged and shows a local canvas preview for the selected cells, label, or
  handle marker. Ctrl-scroll changes the drag target level, and release commits
  q/r/z movement through the domain map. Empty grid clicks clear selection.
- Saving a narration card persists room visual description and exit
  descriptions through the dungeon write model; the state pane refreshes from
  committed authored truth.
- In room paint/delete mode, pressing the grid starts a rectangle at the
  pointed cell, dragging grows the preview rectangle, and release commits the
  room topology mutation for the active map and level.
- Grid/graph toggles switch the central map representation.
- Level controls update the active map projection.
- Overlay controls support off, nearby-level range, selected levels, and
  opacity settings.
