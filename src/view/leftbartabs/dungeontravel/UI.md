Status: Active
Owner: SaltMarcher Team
Last Reviewed: 2026-04-20
Source of Truth: Dungeon travel left-bar tab UI structure and runtime mock
state.

# Dungeon Travel UI

## Component Purpose

The Dungeon Travel tab is the runtime-facing cockpit root for the local dungeon
map mock. It mirrors the legacy dungeon runtime map surface before real party
movement and route actions are connected.

## Visible Structure

- Controls show zoom, map name, level buttons, overlay trigger, refresh, and
  reset-view actions.
- Main content is the shared `DungeonMapMainView` canvas surface in runtime
  mode.
- State content shows the mock party location, tile, heading, movement status,
  and overlay mode.

## Visible States

- Runtime mode renders a party token and numbered door markers on the grid.
- Level and overlay controls update the presentation projection only.
- Reset view restores the canvas camera without changing dungeon state.
