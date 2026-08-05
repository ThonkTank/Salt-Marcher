# Hex Editor Requirements

## Goal

Define the required editor workflow over committed hex-map truth so the user
can manage maps, inspect tiles, paint terrain, and place existing World Planner
locations without inventing a second place or map source of truth.

## Non-Goals

- interactive hex travel behavior
- compact runtime `Reise` travel-state behavior
- shared map-canvas contract design
- persistence schema detail
- hidden simulation or campaign rules that are not visible in the editor

## Visible Structure

- a shared shell catalog CRUD surface for selecting, creating, renaming, and
  reloading Hex maps
- compact tool controls for `Auswahl` and terrain painting
- main content as the shared hex map surface in editor mode
- state content for selected map metadata, active status,
  selected tile details, and marker editing
- terrain palette for the active paint tool
- World Planner location placement launched from `Katalog → Orte`

## Visible States

- no map loaded
- loaded editable hex map
- selected tile with visible details
- active terrain-paint mode
- selected placed World Planner location with its resolved name
- save or validation failure during map edits

## Required Behavior

- the editor MUST let the user create and edit hex maps
- new map creation MUST use the shared catalog `Neu` flow and create a named,
  initially empty sparse map
- map editing MUST support visible name changes from the state pane
- the Hex control panel MUST use the shared shell map layout pattern:
  `CatalogCrudControlsView` as fixed catalog, compact Hex controls as the
  flexible controls child, Hex rendering in `COCKPIT_MAIN`, and edit details in
  `COCKPIT_STATE`
- maps MUST grow without a coordinate boundary; panning loads bounded viewport
  windows while only authored tiles, terrain overrides, and markers are persisted
- the empty axial guide grid MUST remain a renderer affordance; a new map has no
  authored tiles and MUST NOT appear as a pre-filled terrain diamond
- the editor MUST support a selection tool for tile inspection
- the editor MUST support a terrain-paint tool
- terrain painting MUST support continuous pointer strokes and a hexagonal
  brush radius from `0` through `10`
- stroke path and radius MUST be validated and expanded by one shared canonical
  axial-geometry implementation used by preview and committed commands
- the editor MUST provide an eraser with the same stroke and radius mechanics
- painting or erasing MUST patch affected chunks without recreating the canvas
  or resetting its camera
- the active terrain type MUST be visible while painting
- `Katalog → Orte → Platzieren` MUST open a map chooser and Hex placement view
- the Hex editor MUST also provide a location-placement tool that selects one
  existing World Planner location and confirms its target authored tile
- one World Planner location MUST be placed globally at most once and one Hex
  MUST carry at most one World Planner location
- moving a placement MUST retain the World Planner location identity
- deleting the World Planner location MUST remove its placement atomically
- erasing tiles that carry locations, Party positions, or stored routes MUST
  show those references and require confirmation; confirmation removes the
  placements, aborts affected routes, and clears erased Party positions without
  deleting World Planner locations or Party members
- placement feedback MUST be visible on the owning tile
- tile inspection MUST surface visible details for at least position, terrain,
  elevation, biome, exploration state, and notes when those values are
  available
- tile inspection MUST expose markers owned by the selected tile when markers
  are present
- paint feedback MUST be visible on the map surface
- middle-pointer panning, zoom, resize, chunk reads, and content patches MUST
  preserve camera state; only map changes or explicit reset may recenter it
- the map canvas MUST NOT cover the map with visible coordinate inputs or a
  paged facts window
- failed save operations MUST surface a visible failure outcome instead of
  silently discarding the edit
- the editor MUST expose persistent per-map Undo and Redo for the latest twenty
  terrain, erase, and location-placement changes; Undo restores map truth only
  and does not restore cleaned Party positions or aborted Journeys
- external Hex change notices MUST invalidate only the changed chunks without
  treating every cached chunk as current at the new map revision

## Supported Terrain Palette

The editor terrain palette exposes these visible labels:

- `Grasland`
- `Wald`
- `Gebirge`
- `Wasser`
- `Wüste`
- `Sumpf`

The static V1 terrain catalog also publishes display color, passability, and
travel cost. Maps store stable terrain IDs. Editing terrain definitions through
Catalog CRUD is deliberately deferred without making those values hard-coded
map truth.

## Acceptance Criteria

- The user can create a new map through the shared catalog `Neu` flow and
  immediately see it as an editable sparse map centered on axial `0,0`.
- The user can select a tile and inspect visible tile details.
- The user can paint terrain and see the changed terrain on the map.
- The user can drag continuous paint and erase strokes at radius `0..10` while
  the camera stays in place.
- The user can place, move, reveal, and remove an existing World Planner
  location from its Catalog detail or directly in the Hex editor.
- Save failure produces a visible error outcome.
- The visible Hex map surface remains available below the controls because the
  map catalog and compact controls share the shell stack layout used by Dungeon
  map screens.

## References

- [Hex Feature Requirements](./requirements-hex.md)
- [Hex Domain](../domain/domain-hex-map.md)
- [Hex Persistence Contract](../contract/contract-hex-persistence.md)
- [Maps Canvas Requirements](../../maps/requirements/requirements-maps-canvas.md) (line 1)
