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
- state content for selected map metadata, radius changes, active status,
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
- destructive radius-change warning before data loss

## Required Behavior

- the editor MUST let the user create and edit hex maps
- new map creation MUST use the shared catalog `Neu` flow and create a named
  map with default radius `2`
- map editing MUST support visible name and radius changes from the state pane
- the Hex control panel MUST use the shared shell map layout pattern:
  `CatalogCrudControlsView` as fixed catalog, compact Hex controls as the
  flexible controls child, Hex rendering in `COCKPIT_MAIN`, and edit details in
  `COCKPIT_STATE`
- map radius MUST stay inside the supported `0` through `99` range
- shrinking a map radius in a way that removes authored terrain or markers MUST
  surface an explicit destructive warning before commit
- the editor MUST support a selection tool for tile inspection
- the editor MUST support a terrain-paint tool
- the active terrain type MUST be visible while painting
- `Katalog → Orte → Platzieren` MUST open a map chooser and Hex placement view
- one World Planner location MUST be placed globally at most once and one Hex
  MUST carry at most one World Planner location
- moving a placement MUST retain the World Planner location identity
- deleting the World Planner location MUST remove its placement atomically
- placement feedback MUST be visible on the owning tile
- tile inspection MUST surface visible details for at least position, terrain,
  elevation, biome, exploration state, and notes when those values are
  available
- tile inspection MUST expose markers owned by the selected tile when markers
  are present
- paint feedback MUST be visible on the map surface
- failed save operations MUST surface a visible failure outcome instead of
  silently discarding the edit

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
  immediately see it as an editable radius-2 map.
- The user can select a tile and inspect visible tile details.
- The user can paint terrain and see the changed terrain on the map.
- The user can place, move, reveal, and remove an existing World Planner
  location from its Catalog detail.
- Destructive radius shrink requires an explicit warning before commit.
- Save failure produces a visible error outcome.
- The visible Hex map surface remains available below the controls because the
  map catalog and compact controls share the shell stack layout used by Dungeon
  map screens.

## References

- [Hex Feature Requirements](./requirements-hex.md)
- [Hex Domain](../domain/domain-hex-map.md)
- [Hex Persistence Contract](../contract/contract-hex-persistence.md)
- [Maps Canvas Requirements](../../maps/requirements/requirements-maps-canvas.md) (line 1)
