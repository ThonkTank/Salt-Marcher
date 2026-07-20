Status: Draft
Owner: SaltMarcher Team
Last Reviewed: 2026-07-19
Source of Truth: Travel-facing hex-map behavior, visible states, and acceptance
criteria.

# Hex Travel Requirements

## Goal

Define the interactive runtime travel workflow over a committed hex map plus
party-owned runtime position.

## Non-Goals

- compact travel-state surface behavior shown in the runtime `Reise` tab
- hex editor behavior
- shared map-canvas contract design
- persistence schema detail

## Visible Structure

- controls that include the `Reisegruppe` movement tool
- main content as the shared `Hex-Karte` map surface
- one visible party token on the active hex
- compact travel context in the runtime `Reise` state tab, including location,
  weather, time of day, pace, and status

## Visible States

- no current location selected
- active travel state with visible party token
- updated location after token movement
- blocked or invalid travel outcome without stale success text

## Required Behavior

- the travel surface MUST load a visible hex map and current party position
- the surface MUST show the party token on the current tile when one exists
- travel MUST support direct party-token movement across the hex map
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
- Using the `Reisegruppe` tool to choose a destination tile updates visible
  travel context when the move resolves.
- The travel surface stays focused on interactive map travel rather than
  adding movement commands to the compact runtime `Reise` state tab.
- Missing location context is shown explicitly.

## References

- [Hex Feature Requirements](./requirements-hex.md)
- [Hex Travel State Requirements](./requirements-hex-travel-state.md)
- [Maps Canvas Requirements](../../maps/requirements/requirements-maps-canvas.md) (line 1)
