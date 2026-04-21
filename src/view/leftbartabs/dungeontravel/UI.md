Status: Active
Owner: SaltMarcher Team
Last Reviewed: 2026-04-21
Source of Truth: Dungeon travel left-bar tab UI structure and character-owned
runtime travel state.

# Dungeon Travel UI

## Component Purpose

The Dungeon Travel tab is the runtime-facing cockpit root for the local dungeon
map. It mirrors the legacy dungeon runtime map surface for party movement
through currently loaded traversal and transition actions.

## Visible Structure

- Controls show zoom, map name, level buttons, overlay trigger, refresh, and
  reset-view actions.
- Main content is the shared `DungeonMapMainView` canvas surface in runtime
  mode.
- State content shows the current party travel location, tile, heading,
  movement status, overlay mode, and available travel actions.

## Visible States

- Runtime mode renders a party token at the party-owned active character travel
  position.
- Level and overlay controls update the presentation projection only.
- Reset view restores the canvas camera without changing dungeon state.
- Traversal actions move the party token across the selected local traversible
  link. Door-sourced traversal faces the target tile; stair-sourced traversal
  keeps the current heading while updating the projection level when needed.
- Dungeon transition actions move active attached characters to the placed
  target transition when the target map and transition are available.
- Overworld transition actions move active attached characters to the published
  overworld target.
