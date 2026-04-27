Status: Draft
Owner: SaltMarcher Team
Last Reviewed: 2026-04-24
Source of Truth: Travel-facing hex-map behavior, visible states, and acceptance
criteria.

# Hex Travel Requirements

## Goal

Define the interactive runtime travel workflow over a committed hex map plus
party-owned runtime position.

## Non-Goals

- compact `Reise` state-surface behavior
- hex editor behavior
- shared map-canvas contract design
- persistence schema detail

## Current State

- SaltMarcher does not yet ship a dedicated hex travel surface.
- The sibling `salt-marcher` repo shows the visible target-state surface:
  overworld hex map display, party token on the map, and token drag as the
  primary travel gesture.
- The same repo also shows that the visible travel context should include
  location, status, weather, time of day, pace, and a concise interaction
  hint.

## Visible Structure

- controls or context content that identify current overworld travel state
- main content as the shared hex map surface in runtime mode
- one visible party token on the active hex
- compact travel context such as location, weather, time of day, pace, and
  status

## Visible States

- no current location selected
- active travel state with visible party token
- updated location after token movement
- blocked or invalid travel outcome without stale success text

## Required Behavior

- the travel surface MUST load a visible hex map and current party position
- the surface MUST show the party token on the current tile when one exists
- travel MUST support direct token movement across the hex map
- the surface MUST communicate current location or context plus visible travel
  status
- the surface MUST communicate visible overworld travel context such as
  weather, time of day, and pace when that information is available to the
  surface
- invalid or blocked movement MUST leave committed map truth unchanged and
  surface a meaningful outcome
- when no active location is available, the surface MUST show an explicit empty
  state rather than implied valid travel context

## Acceptance Criteria

- A user can identify the current party tile on the map.
- Dragging the token updates visible travel context when the move resolves.
- The travel surface stays focused on interactive map travel rather than
  turning into the full editor.
- Missing location context is shown explicitly.

## References

- [Hex Feature Requirements](./requirements-hex.md)
- [Hex Reise Requirements](./requirements-hex-reise.md)
- [Maps Canvas Requirements](/home/aaron/Schreibtisch/projects/SaltMarcher/docs/maps/requirements/requirements-maps-canvas.md:1)
