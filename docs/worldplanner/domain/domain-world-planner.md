Status: Draft
Owner: SaltMarcher Team
Last Reviewed: 2026-06-26
Source of Truth: World Planner bounded-context ownership, write model,
invariants, lifecycle state, and foreign-reference boundaries.

# World Planner Domain Model

## Context Role

Context Role: Roster Truth Context
Context Name: WorldPlanner

- `worldplanner` owns authored NPC, faction, and location planning truth.
- Its public backend boundary is
  `src/domain/worldplanner/WorldPlannerApplicationService.java`.
- It reads creature, encounter-table, and Encounter-owned combat/result facts
  through public boundaries, and exposes location choices for later
  Session Planner-owned integration.
- It does not own creature statblocks, encounter-table membership, saved
  encounter rosters, party membership, combat runtime state, dungeon map truth,
  or hex map truth.

## Published Language

`published/` owns command carriers, read-only models, and passive carriers
for:

- NPC catalog and detail readback
- faction catalog, membership, inventory, and encounter-source readback
- location catalog, faction links, and encounter-table links
- NPC lifecycle readback and reactivation

Published carriers remain thinner than the internal authored model. They carry
stable IDs and display data, not copied foreign statblocks or encounter
rosters.

## Write Model

World Planner has three authored aggregate centers.

`WorldNpc` owns:

- stable NPC identity
- display name
- creature statblock reference
- appearance, behavior, history, and notes
- lifecycle status: active or defeated
- optional last known faction/location references

`WorldFaction` owns:

- stable faction identity
- display name and notes
- one primary encounter-table reference
- NPC memberships
- optional finite statblock inventory limits

`WorldLocation` owns:

- stable location identity
- display name and notes
- linked faction references
- location-owned encounter-table references

## Derived State

World Planner derives:

- available NPCs by faction, location, and lifecycle status
- effective authored encounter-table sources for a faction or location
- finite and unlimited statblock availability for encounter generation

Derived state is recalculated from World Planner authored state and foreign
public reads. It is not stored as copied creature, encounter, party, dungeon,
or hex truth.

Encounter result integration derives confirmed named-NPC losses from
Encounter-owned combat/result state and writes only durable World Planner NPC
lifecycle. Later integration waves may derive additional stock-only loss
candidates and Session Planner-facing location choices from this authored
state.

## Commands And Invariants

Commands entering the model include:

- create, rename, edit, and delete NPC
- set NPC statblock reference
- update NPC notes
- mark NPC defeated
- reactivate NPC
- create, rename, edit, and delete faction
- set faction primary encounter table
- add or remove faction NPC membership
- set or clear faction statblock inventory limit
- create, rename, edit, and delete location
- add or remove location faction link
- add or remove location encounter-table link
- confirm post-combat losses

Core invariants:

- NPC statblock references point to creature-owned statblocks and do not copy
  creature truth.
- A named NPC can be active or defeated. Reactivation returns it to active
  availability.
- A defeated named NPC is excluded from available NPC and faction stock views.
- Missing statblock inventory limits mean unlimited.
- A finite statblock inventory limit is a cap for generated encounter counts.
- Explicit source constraints intersect candidate sources; unset constraints
  are unconstrained.
- Combat runtime may propose losses, but only World Planner confirmation
  changes durable NPC lifecycle or faction stock state.
- Session Planner-owned integrations may reference World Planner locations
  through stable IDs. World Planner does not define Session Planner records.

## Consistency Boundaries

- Creatures owns statblock data. World Planner stores only creature IDs and
  re-reads creature display facts through the Creatures public boundary.
- EncounterTable owns authored table membership. World Planner stores only
  encounter-table IDs and uses table readbacks as source constraints.
- Encounter owns generation policy, saved encounter-plan roster truth, and
  combat runtime state. World Planner owns only durable NPC lifecycle and
  inventory effects confirmed from combat results.
- Session Planner owns its session-planning records and selected session
  state. Future location use in those records belongs to the Session Planner
  owner and may reference World Planner locations through stable IDs.
- Party, Dungeon, and Hex own their own travel or map concepts. World Planner
  locations are campaign planning locations unless a later owner document
  defines an explicit integration.

## References

- [World Planner Requirements](../requirements/requirements-world-planner.md) (line 1)
- [World Planner Architecture](../architecture/architecture-world-planner.md) (line 1)
- [World Planner Persistence Contract](../contract/contract-world-planner-persistence.md) (line 1)
- [Creatures Domain Model](../../creatures/domain/domain-creatures.md) (line 1)
- [Encounter Domain Model](../../encounter/domain/domain-encounter.md) (line 1)
