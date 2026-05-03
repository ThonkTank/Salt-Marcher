Status: Draft
Owner: SaltMarcher Team
Last Reviewed: 2026-04-24
Source of Truth: User-facing behavior, capabilities, and acceptance criteria for
the hex feature.

# Hex Feature Requirements

## Goal

Provide one hex-map workflow that lets a GM:

- load and inspect an overworld-style hex map
- track and move party travel on that map
- monitor compact hex travel state through the global travel-state surface
  shown in the runtime `Reise` tab
- edit map metadata and hex terrain without duplicating map truth

## Non-Goals

- dungeon topology or dungeon travel semantics
- shared map-canvas contract design
- faction, location, or campaign simulation rules that are not surfaced in the
  user-facing feature
- persistence schema detail

## Current State

- SaltMarcher does not yet ship a first-class hex feature surface.
- The sibling `salt-marcher` repo provides current user-facing evidence for the
  target state: overworld map display, party-token travel, compact travel
  context, tile inspection, and a terrain-focused hex editor.

## Primary Surfaces

- hex map travel surface
- hex travel-state surface shown in the runtime `Reise` tab
- hex editor surface

## Primary User Flows

### Load And Inspect A Hex Map

1. The user opens the hex map.
2. The current party position or default tile is visible on the map.
3. The user pans, zooms, and selects tiles to inspect visible details.

### Travel Across The Hex Map

1. The user opens the interactive hex travel surface.
2. The party token is shown on the current tile.
3. The user drags the token to a new hex.
4. The visible travel context updates.

### Read Compact Hex Travel State

1. The user opens the global travel-state surface shown in the runtime
   `Reise` tab.
2. The surface shows compact overworld travel context such as location, status,
   weather, time of day, and pace.

### Edit The Hex Map

1. The user opens the hex editor.
2. The user selects a map and a tool.
3. The user inspects a tile or paints terrain.
4. The user edits map metadata such as name or radius when needed.

## Visible Capabilities

- hex map display with party token
- tile selection and tile inspection
- compact travel context for overworld travel
- terrain paint workflow
- map creation and metadata editing
- destructive shrink warning when radius changes remove tiles

## Acceptance Criteria

- Travel, the runtime `Reise` travel-state surface, and the editor refer to
  one visible hex-map feature concept rather than disconnected special cases.
- The current party tile is understandable to the user on the map surface.
- Tile inspection is visible and understandable when a tile is selected.
- Hex travel context can be read both from the interactive surface and the
  compact travel-state surface shown in the runtime `Reise` tab.
- Editing terrain or map metadata never requires the user to infer hidden map
  state from implementation details.

## Open Product Questions

- Which tile details must always be shown versus only on demand?
- How much overworld travel context belongs directly on the interactive travel
  surface versus only in the runtime `Reise` tab?
- Which non-terrain editor capabilities, if any, belong in the first
  SaltMarcher hex milestone?

## References

- [Hex Travel Requirements](./requirements-hex-travel.md)
- [Hex Travel State Requirements](./requirements-hex-travel-state.md)
- [Hex Editor Requirements](./requirements-hex-editor.md)
- [Maps Canvas Requirements](/home/aaron/Schreibtisch/projects/SaltMarcher/docs/maps/requirements/requirements-maps-canvas.md:1)
