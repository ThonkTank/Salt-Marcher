Status: Draft
Owner: SaltMarcher Team
Last Reviewed: 2026-07-20
Source of Truth: Confirmed solution-neutral Dungeon exploration and travel
behavior.

# Dungeon Travel Requirements

## Goal

Let one GM run spatial Dungeon exploration over committed authored truth and
party-owned runtime state. Travel maintains cell-precise position, time, routes,
events, and a factual log while leaving free actions and fictional outcomes to
the table.

## Runtime Actors And Groups

- the active party and selected relevant NPCs, groups, or movable
  campaign objects may have cell-precise Dungeon positions
- characters may be split from one party token, moved alone, placed into
  separate groups, and later regrouped
- a grouped token travels at the slowest included member's effective speed by
  default and arrives together
- GM group-speed, individual-speed, and member-exclusion overrides apply from
  the `Reisen` state tab
- the GM is the only interface operator; actors do not represent player-owned
  VTT clients

Rooms, derived corridor sections, junctions, stair landings, and comparable
decision points may organize choices and presentation, but do not replace
cell-precise runtime position.
Every bounded standable interior Volume uses the same travel semantics,
including chambers, corridors, and stair spaces. A Room supplies stable authored
content associated with such a Volume. Navigation areas partition the Volume
at meaningful choices such as branches, junctions, and landings, but do not
create incompatible movement semantics or replace cell-precise runtime
position.

## Passive Travel Map

The runtime raster map:

- shows relevant authored geometry and runtime actors
- lets the GM select rooms, areas, objects, actors, and destinations
- opens the selected target's description in a detail pane
- does not edit authored geometry
- does not need to contain the travel controls, which live in the independent
  `Reisen` state tab

## Valid Travel Options

Travel options arise from both authored semantics and actual geometry.

Authored doors, unified generated connection Paths, and transitions provide explicit meaning.
Geometry may additionally expose long-room and corridor travel, junctions,
complex path forks, open vertical relationships, and potential climb, jump, or
similar special routes.

SaltMarcher may detect a potential geometric special route without consulting
character ability or equipment. The GM decides whether the attempted route is
possible and succeeds. The Dungeon feature then records only a confirmed
journey or a deliberate position override.

## Passability Boundary

A door or passage has one explicit travel fact: passable or not passable.
Passages occur at Volume boundaries and are distinct from the Paths that own
route and travel properties. Their authored identities and descriptions may
remain preserved even while no Passage geometry is assigned.

Descriptions such as locked, blocked, heavy, hidden, cold, or difficult do not
create additional passability logic. They affect generated description text and
may expose a GM-authored prompt, but SaltMarcher does not infer what actors are
allowed to attempt.

A lock may behave like a trap prompt, for example “Lock, lockpicking DC 16”.
The GM resolves it freely at the table and then continues or aborts travel.
SaltMarcher does not roll, adjudicate, or encode the result.

Difficult terrain, climbing, and comparable movement factors may change
calculated travel time without creating another passability condition or
requiring a separate GM prompt.

## Local Travel And Long Routes

- ordinary point-to-point navigation proceeds to the next relevant decision
  point
- the GM may plan a complete route between two points in the overview
- an autoroute executes as consecutive segments ending at decision points
- position and time commit atomically for each completed segment
- an event, newly invalid route, lost pursuit track, reached destination, or
  GM abort stops or completes automatic travel as applicable
- completed segments remain committed when a later segment stops
- travel does not require confirmation in every ordinary exploration round

## Dynamic Pursuit

The GM may route one actor or group toward another movable actor or group.

- pursuit recalculates toward the target's current position as travel advances
- pursuit ends when the target is caught
- a lost track interrupts pursuit
- catching a target does not automatically merge tokens; the GM decides whether
  to regroup them

## Movement Rules And Time

- distance, terrain, climbing, jumping, movement modes, and effective movement
  rates use an explicitly versioned D&D 5e 2014 rule profile
- diagonal and free path length use geometrically accurate distance rather than
  the simplified five-foot or alternating five/ten-foot grid methods
- movement modifiers apply to that precise distance
- the resulting travel-time calculation runs without an additional GM decision
- terrain and movement-cost calculation remains unobtrusive during travel
- the GM chooses an exploration-round duration of 1, 5, 10, 15, or 30 minutes,
  or enters a custom duration
- when movement lasts longer than one round, subsequent actor rounds remain
  occupied by that journey until destination or interruption
- non-movement actions receive no programmed action categories or durations

## Position Override

`Travel` and `Set position` are distinct GM actions.

- travel follows current valid routes and advances time and event context
- set position places the selected actor at a chosen cell without reachability
  validation, automatic time advancement, or event activation

## Events, Prompts, And GM Authority

Confirmed travel advances calendar time automatically and activates applicable
events.

Event sources include:

- GM-planned events
- GM-configured location-, time-, or actor-dependent event pools
- GM-authored traps
- random encounters
- deferred track and pursuit notifications

A triggered event opens the relevant GM context and interrupts travel when
resolution is required. SaltMarcher may open, repeat, or dismiss a prompt, but
does not decide or log its fictional outcome.

A trap is an authored Dungeon feature whose trigger opens a description. The GM
resolves it at the table and dismisses the prompt to continue or aborts travel.
More interaction may be added later, but comprehensive trap simulation is not a
requirement.

Position and time commit together or not at all for one travel segment. Opening
the following event may fail and be retried without corrupting the committed
travel state.

## Factual Travel Log

SaltMarcher records confirmed:

- cell or area changes
- elapsed calendar time
- used transitions
- opened events and prompts

The log records what the system confirmed, not GM-decided event outcomes.

## Deferred Monster, Perception, And Track Behavior

The long-term design permits later addition of:

- monster groups moving through simple daily schedules
- automated perception contests between relevant groups
- a GM-entered rolled result replacing party passive perception when a
  character actively keeps watch
- room-associated tracks
- party or NPC groups searching for tracks with stored GM-entered results
- automated NPC pursuit of unknown tracks as part of a simple routine
- background NPC survival or perception checks and GM-entered party checks
- GM notifications when a track is found, lost, or automatically followed

This capability has low delivery priority and is not required for the next
implementation milestone.

## Non-Goals

Dungeon travel does not own or automate:

- attacks, spells, combat actions, hit points, damage, or conditions
- tactical initiative or six-second combat rounds
- encounter, trap, lock, or unrestricted exploration-action outcomes
- direct player controls
- full tactical Battlemap behavior

An encounter or another open situation interrupts travel and is resolved at the
table or by another owning feature.

## Acceptance Outcomes

- travel reads committed authored Dungeon truth plus runtime actor state
- every confirmed segment updates position and time atomically
- route failure never leaves partially committed position or time for the
  failed segment
- a dynamic pursuit follows current target position and stops on catch or lost
  track
- explicit passability, not descriptive text, determines whether pathfinding may
  use a door or passage
- precise geometric distance and the versioned movement profile determine
  unobtrusive travel time
- a position override never silently behaves like rule-based travel
- triggered content pauses for GM resolution without SaltMarcher deciding the
  outcome
- runtime travel state does not become authored Dungeon-package truth

## References

- [Dungeon Feature Requirements](./requirements-dungeon.md)
- [Dungeon Travel State Requirements](./requirements-dungeon-travel-state.md)
- [Dungeon Editor Requirements](./requirements-dungeon-editor.md)
- [Dungeon Needs Interview](../../project/interviews/2026-07-20-dungeon-needs-interview.md)
