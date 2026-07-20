Status: Active
Owner: SaltMarcher Team
Last Reviewed: 2026-07-20
Source of Truth: Confirmed GM-facing Dungeon travel-control and state behavior
for the runtime `Reisen` tab.

# Dungeon Travel State Requirements

## Goal

Provide the GM with one persistent Dungeon travel-control surface that remains
available independently of the currently displayed travel map view. It
communicates current travel state and starts or adjusts travel without turning
the map itself into a player-operated VTT.

## User And Authority

- only the GM operates the `Reisen` state tab
- the GM enters or confirms table decisions on behalf of players and NPCs
- controls issue travel intent; they do not automate unrestricted exploration
  actions or decide fictional outcomes
- the passive travel map may select targets and open details, but it does not
  own these controls

## Required Context

The state tab communicates at least:

- active Dungeon map and current area
- active party or selected actor/group
- cell-precise position and heading
- current movement, route, pursuit, loading, interruption, or failure status
- selected destination, transition, or tracked target when applicable
- current exploration-round duration
- effective movement speed and relevant overrides
- the next GM decision or available continuation

## Exploration Timing Controls

The GM chooses one fixed round duration from:

- 1 minute
- 5 minutes
- 10 minutes
- 15 minutes
- 30 minutes
- a custom duration

Only movement receives a system-calculated duration. Other exploration actions
remain free table actions and do not require programmed action types or
durations.

## Movement-Speed Controls

For a grouped token:

- the default effective speed is the slowest included member
- every included member arrives with the group at the same time
- the GM may override the effective speed of the whole group
- the GM may exclude a member from speed calculation, for example when that
  member is carried
- the GM may override an individual member's effective travel speed

These overrides are visible travel-session state, not authored Dungeon truth.

## Route And Transition Controls

The state tab lets the GM:

- select a transition or destination
- begin a local journey
- plan and start a longer route
- start dynamic pursuit of another movable actor or group
- continue or abort travel after a GM-resolved prompt
- freely set an actor position without route validation, time advancement, or
  event activation
- split characters from a party token, form separate groups, and merge groups

## Checks And Deferred Controls

The long-term surface may accept GM-entered active perception, survival, or
tracking results. It may show automated NPC results and notifications for found
or lost tracks. These controls are low priority and are not required for the
next delivery.

## Visible States

- no active Dungeon context
- ready at a cell-precise location
- route planning
- traveling through the current round or route segment
- pursuing a movable target
- waiting for a GM decision after an event, trap, lock, encounter, or similar
  prompt
- blocked or failed travel with a clear reason
- completed or GM-aborted travel

## Non-Goals

- a compact read-only replacement for the actual travel controls
- direct player control
- tactical combat initiative or six-second action economy
- attacks, spells, damage, conditions, or encounter resolution
- automatic durations for arbitrary table actions
- ownership of authored Dungeon truth or party roster truth

## Acceptance Outcomes

- the GM can inspect and adjust travel state without depending on which map
  presentation is visible
- a grouped token uses the slowest included member unless the GM overrides the
  calculation
- a custom exploration-round duration works without inventing new action types
- route, transition, and pursuit controls address stable authored or runtime
  targets
- a GM can continue or abort after resolving a prompt at the table
- position override remains visibly distinct from rule-based travel
- travel-session controls do not mutate authored Dungeon descriptions or
  geometry

## References

- [Dungeon Feature Requirements](./requirements-dungeon.md)
- [Dungeon Travel Requirements](./requirements-dungeon-travel.md)
- [Dungeon Editor Requirements](./requirements-dungeon-editor.md)
- [Dungeon Needs Interview](../../project/interviews/2026-07-20-dungeon-needs-interview.md)
