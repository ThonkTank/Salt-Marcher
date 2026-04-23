Status: Active
Owner: SaltMarcher Team
Last Reviewed: 2026-04-23
Source of Truth: Dungeon editor left-bar tab UI structure and control-panel
interaction state.

# Dungeon Editor UI

## Component Purpose

The Dungeon Editor tab is the editor-facing cockpit root for authored dungeon
maps. It keeps the compact current control layout while carrying the original
Auswahl tool behavior through the map-owned topology model: presentation
selection, unified topology edit preview, persisted grid and level movement for
selected editor handles, room paint/delete, wall and door editing, and room
narration editing.

## Visible Structure

- Controls are compressed into three rows: dungeon selector plus
  create/edit/delete actions, level plus overlay and grid/graph projection
  controls, and tool-family selection.
- Main content is the shared `DungeonMapMainView` canvas surface in editor
  mode.
- State content shows the active tool, view mode, projection level, overlay
  mode, selected topology element, active topology preview, mutation status,
  and room narration cards for selected rooms or room clusters.

## Visible States

- The dungeon selector loads the selected map. Create, rename, and delete call
  the dungeon application service. Created maps start empty until authored room
  geometry is painted. Successful map loading is represented by the selected
  dropdown value rather than a duplicate status message.
- Tool selection updates highlighted controls and presentation state. The
  Auswahl tool stays directly visible. Room, wall, door, corridor, stair, and
  transition families stay directly visible as tool buttons; clicking a family
  selects its primary tool and opens the family's two-option tool popup for the
  primary and delete variants. Auswahl selects map-owned topology refs for
  rooms, visible room labels, stairs, and transitions. The visible room label
  is also the cluster drag handle; separate empty cluster-handle markers are
  not shown. Selected room labels expose editable room narration in the state
  pane. `Raum malen` and `Raum loeschen` commit active-level rectangle
  mutations. `Wand setzen`, `Wand loeschen`, `Tuer setzen`, and `Tuer loeschen`
  commit cluster-boundary mutations through the authored map. Corridor, stair,
  and transition editor tool families are still pending authored operations.
- In grid mode, clicking a room, room label, stair, transition, door handle,
  corridor waypoint, stair anchor, or cluster label selects the owning topology
  ref. Dragging a selectable editor handle keeps the authored source geometry
  visible and emits the same pending topology-edit preview contract used by
  room and boundary tools. The canvas shows a visually distinct local preview
  copy for the selected cells, wall or door edges, label, or handle marker.
  Ctrl-scroll changes the drag target level, and release commits q/r/z
  movement through the domain map. Empty grid clicks clear selection.
- Saving a narration card persists room visual description and exit
  descriptions through the dungeon write model; the state pane refreshes from
  committed authored truth.
- In room paint/delete mode, pressing the grid starts a rectangle at the
  pointed cell, dragging grows the pending topology-edit rectangle preview, and
  release commits the room topology mutation for the active map and level.
- In wall mode, clicking cluster grid vertices starts or extends a boundary
  path. The editor resolves the active cluster from the selected cluster,
  current boundary hit, or nearest editable cluster. A secondary click finishes
  the active draft. Wall create paths stop at the next compatible existing
  boundary; wall delete paths follow existing wall segments. Active boundary
  drafts publish their preview edges through the shared pending topology-edit
  preview contract.
- In door mode, clicking an existing non-door boundary between distinct room
  components creates a door. Clicking an existing door with `Tuer loeschen`
  removes that door boundary.
- Grid/graph toggles switch the central map representation.
- Level controls update the active map projection.
- Overlay controls support off, nearby-level range, selected levels, and
  opacity settings.
