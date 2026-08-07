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

- controls for administrative Party placement and explicit route planning
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
- route planning MUST accept ordered manual waypoints and expand every segment
  into deterministic adjacent Hex steps
- route start MUST be explicit and MUST reject out-of-map or impassable steps
- the travelling group MUST be the focused Scene's assigned active PCs and use
  the slowest movement speed; missing speed assumes 30 ft with a visible warning
- every reached Hex checkpoint MUST commit Party position and Scene time
  together
- the default 3-mile rule uses `mph = Speed / 10`, current biome cost, and
  one real second per in-game hour at 1x presentation speed
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
- Starting a waypoint route advances the token through its visible path.
- Pause, resume, abort, 1x/2x/5x/10x presentation speed, and paused restart
  preserve in-world duration and the last committed Hex.
- The travel surface stays focused on interactive map travel rather than
  adding movement commands to the compact runtime `Reise` state tab.
- Missing location context is shown explicitly.

## References

- [Hex Feature Requirements](./requirements-hex.md)
- [Hex Travel State Requirements](./requirements-hex-travel-state.md)
- [Maps Canvas Requirements](../../maps/requirements/requirements-maps-canvas.md) (line 1)
