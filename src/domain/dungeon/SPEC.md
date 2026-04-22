Status: Draft
Owner: SaltMarcher Team
Last Reviewed: 2026-04-22
Source of Truth: User-facing behavior, capabilities, and acceptance criteria for
the dungeon feature.

# Dungeon Feature Spec

## Goal

Provide a dungeon workflow that lets a GM:

- load and inspect dungeon maps
- travel through the currently traversable dungeon space
- edit spatial topology and authored dungeon semantics
- inspect rooms, connections, and features without duplicating business truth

## Non-Goals

- shell-wide navigation policy
- project-wide persistence rules
- low-level algorithm design for routing, topology repair, or geometry
  regeneration

## Primary Surfaces

### Basic Map Surface

The basic map surface shows the loaded dungeon map on an unbounded grid canvas.
If no map is loaded, it shows a clear placeholder state. If a loaded map has no
authored geometry yet, it shows an empty grid rather than generated example
rooms.

Expected capabilities:

- pan and zoom the map
- switch the active floor
- show onion-slice overlays for adjacent floors
- inspect doors, stairs, and other selectable map objects
- filter and select map objects from a list

Pan and zoom are local view interactions. They redraw the current workspace but
do not reload dungeon data on every camera change.

### Travel Surface

The travel surface is a runtime-oriented tab for moving the party through a
dungeon.

Expected capabilities:

- load and open a map for travel
- present party position and facing on the rendered map
- show a room-oriented inspector with exits and features
- allow travel by selecting available room connections

### Editor Surface

The editor surface is an authoring-oriented tab for changing dungeon truth.

Expected capabilities:

- create, rename, and delete maps
- create maps as empty authored maps without generated seed rooms
- select editing tools
- preview edits before commit
- commit authored spatial and semantic changes
- select rooms, room labels, stairs, and transitions through stable topology
  refs
- edit room visual and exit narration from the Auswahl tool state pane
- cancel in-progress edits
- undo and redo committed edits

## Primary User Flows

### Load And Inspect A Map

1. The user searches for a dungeon map.
2. The user selects and loads one valid result.
3. The map opens on a default floor.
4. The user pans, zooms, changes floors, and inspects map objects.

### Travel Through The Dungeon

1. The user opens the travel surface on a loaded map.
2. The party token and current room are shown.
3. The user selects a connection or room jump target.
4. The travel state updates and the inspector reflects the new room.

### Edit The Dungeon

1. The user opens the editor surface on a map.
2. The user selects a tool.
3. The editor shows a live preview while the gesture is in progress.
4. With Auswahl active, the user selects a topology element or editor handle,
   optionally drags it across grid cells or floors, and commits on release.
5. With a room or cluster selected, the user edits room narration and saves it
   into authored dungeon truth.
6. The user commits, cancels, or replays the change through history controls.

## Acceptance Criteria

- Travel and editor surfaces operate on the same canonical dungeon truth.
- Travel and editor keep independent local camera state for pan and zoom.
- Loading and floor selection are available before advanced editing tools.
- Selections and inspections are visible and understandable to the user.
- Editor gestures identify selected map topology elements by stable topology
  ref. The domain map resolves room, cluster, corridor, door, stair, and
  transition bindings internally.
- In-progress edits provide visible preview feedback.
- Auswahl supports persisted q/r/z movement for selected editor handles:
  cluster labels, doors, corridor waypoints, and stair anchors move through
  map-owned topology ownership without making clusters a public topology kind.
- Room visual descriptions and room-exit descriptions are authored room
  semantics and persist through the dungeon write model.
- Undo and redo apply to committed editor operations.
- Runtime travel state is not treated as authored dungeon truth.

## Open Product Questions

- How aggressively should map creation and deletion be exposed in the editor UI?
- What room-inspector details are always shown versus expandable on demand?
- Which editing tools belong in the first shippable editor milestone?
