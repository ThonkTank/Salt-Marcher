Status: Draft
Owner: SaltMarcher Team
Last Reviewed: 2026-07-19
Source of Truth: User-facing behavior, capabilities, and acceptance criteria for
the dungeon feature.

# Dungeon Feature Requirements

## Goal

Provide one dungeon workflow that lets a GM:

- load and inspect dungeon maps
- travel through the current traversable dungeon space
- monitor compact dungeon travel state through the global travel-state surface
  shown in the runtime `Reise` tab
- edit authored dungeon topology and semantics
- inspect rooms, connections, and features without duplicating domain truth

## Non-Goals

- shell-wide navigation policy
- project-wide persistence rules
- low-level geometry or routing algorithm design

## Primary Surfaces

- basic dungeon map surface
- dungeon travel surface
- dungeon travel-state surface shown in the runtime `Reise` tab
- dungeon editor surface

## Primary User Flows

### Load And Inspect A Map

1. The user searches for a dungeon map.
2. The user loads one valid result.
3. The map opens on a default floor.
4. The user pans, zooms, changes floors, and inspects map content.

### Travel Through The Dungeon

1. The user opens the travel surface on a loaded map.
2. The current party location is shown on the map.
3. The user selects a travel action or drags the token to a reachable local
   tile.
4. The runtime state updates and the inspector reflects the result.

### Read Compact Dungeon Travel State

1. The user opens the global travel-state surface shown in the runtime
   `Reise` tab while the party is in a dungeon.
2. The surface shows compact dungeon context such as map, area, tile, heading,
   and movement status.
3. The user can understand current travel context without opening the full
   interactive travel workspace.

### Edit The Dungeon

1. The user opens the editor surface on a map.
2. The user selects a tool.
3. The editor shows a live preview while the gesture is in progress.
4. The user commits or cancels the change.

## Visible Capabilities

- map discovery, load, reload, create, rename, and delete
- map pan, zoom, level switching, and overlay presentation
- room, connection, feature, and handle inspection
- room narration editing with saved visual and exit descriptions
- runtime movement by explicit travel actions and target-state direct token drag
- dungeon-to-dungeon and dungeon-to-overworld transition outcomes
- a compact travel-state summary surface shown in the runtime `Reise` tab,
  distinct from the interactive travel view
- editor tool families for selection, rooms, walls, doors, corridors, stairs,
  and transitions

## Acceptance Criteria

- Travel, the runtime `Reise` travel-state surface, and the editor operate on
  the same canonical dungeon truth plus party-owned runtime position where
  applicable.
- Travel and editor keep independent local camera state.
- Empty authored maps stay empty until the editor paints geometry.
- Selections and inspections are visible and understandable to the user.
- In-progress edits provide visible preview feedback.
- The compact travel-state surface shown in the runtime `Reise` tab never has
  to own the interactive dungeon workspace to communicate current travel
  context.
- Runtime travel state is not treated as authored dungeon truth.
- Dungeon publishes compact typed travel readback, while the feature-neutral
  Travel capability owns selection and display in the global `Reise` tab.

## Open Product Questions

- How aggressively should map creation and deletion be exposed in the editor UI?
- What room-inspector details are always shown versus expandable on demand?
- Which advanced editor families must be fully shippable in the first dungeon
  milestone versus remaining visible target-state obligations?

## References

- [Dungeon Editor Requirements](./requirements-dungeon-editor.md)
- [Dungeon Travel State Requirements](./requirements-dungeon-travel-state.md)
- [Dungeon Travel Requirements](./requirements-dungeon-travel.md)
- [Maps Canvas Requirements](../../maps/requirements/requirements-maps-canvas.md) (line 1)
- [Dungeon Domain Model](../domain/domain-dungeon.md) (line 1)
- [Travel Context Domain](../../travel/domain/domain-travel.md)
