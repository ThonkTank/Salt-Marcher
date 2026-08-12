# Hex Travel Console Requirements

## Goal

Define the Hex-owned interactive travel console shown in the Session `Reise`
scenario pane beside the shared map canvas.

## Non-Goals

- hex editor behavior
- Dungeon-specific travel controls
- shared map-canvas contract design
- a second copy of route or Party-position truth

## Visible Structure

- one Hex-map selector
- current named location or explicit coordinate/empty fallback
- route-planning toggle, route clearing, and accessible Party placement
- icon controls for start, pause/resume, stop, slower, and faster
- a three-column route evaluation for duration, expanded Hex count, and cost
- one concise selected-Hex row with coordinates, biome, and travel cost
- `Karte öffnen` while another Session center tab is active

## Required Behavior

- the console and center map MUST consume one Scene-scoped Hex renderer state
- selecting another map MUST reset selection, route waypoints, and evaluation
- route planning MUST remain explicit and each activated authored Hex MUST add
  one ordered waypoint
- `Löschen` MUST clear the complete transient route and evaluation
- only travelling, paused, or blocked journeys MUST project a visible route;
  completed and aborted journeys retain their history without leaving a route
  on the map
- start MUST remain disabled until the route evaluation is startable
- pause/resume and stop MUST remain disabled without travelling, paused, or
  blocked state
- presentation speed MUST use the ordered values `1 | 2 | 5 | 10`; an edge
  control is disabled and pre-start selection is passed into route start
- Scene change events MUST refresh travel and Session state without accepting a
  stale route evaluation or stale map read
- selecting the `Reise` scenario MUST NOT automatically switch the center tab
- Hex remains the owner of route validation and mutations; shell-level Travel
  composition may delegate to Hex but MUST NOT duplicate that truth

## Visible States

- loading or no Hex map
- unpositioned Party
- ready with a current Hex or named location
- route planning with pending, invalid, or startable evaluation
- travelling, paused, blocked, completed, or aborted

## Acceptance Criteria

- The map canvas has no toolbar or status strip and fills its center-pane row.
- All map selection, route, placement, and transport actions are reachable from
  the `Reise` console or direct token drag.
- Reaching or aborting a journey removes its route while the Party token,
  current location, and final status remain visible.
- A keyboard user can place the Party, add waypoints, and operate every travel
  command.
- The route facts agree with the utility-owned evaluation.
- No-context and unavailable-map states remain explicit and non-destructive.

## References

- [Hex Feature Requirements](./requirements-hex.md)
- [Hex Travel Requirements](./requirements-hex-travel.md)
- [Travel Scenario UI](../../project/requirements/requirements-travel-state-tab.md)
- [Travel Context Domain](../../travel/domain/domain-travel.md)
