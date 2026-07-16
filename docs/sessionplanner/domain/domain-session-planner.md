Status: Draft
Owner: SaltMarcher Team
Last Reviewed: 2026-07-15
Source of Truth: Session planner context role, session-record ownership, and
domain invariants.

# Session Planner Domain Model

## Context Role

Context Role: Roster Truth Context
Context Name: SessionPlanner

- `sessionplanner` owns the authored planning record for one adventure session
- its public boundary is `SessionPlannerApi`
- it does not own party truth, encounter-plan roster truth, creature truth, or
  loot truth
- generated Loot remains a foreign `(generationId, treasureId)` reference; its
  label is only a last-known display cache

## Published Language

`SessionPlannerApi` owns planner commands, rest-kind vocabulary, and immutable
revisioned planner state.

- the feature publishes planner-owned workflows and one immutable state surface
- it does not publish encounter persistence carriers, creature-detail carriers,
  or party mutation carriers; those stay owned by their original contexts

## Application Boundary

The Session Planner application coordinates:

- session-plan reads and writes through a planner-owned repository port
- active-party composition reads needed to resolve participant references
- party-based adventuring-day calculations
- saved encounter-plan budget reads through the encounter public boundary
- session-local workflow mutations
- generation preview orchestration and explicit timeline replacement through
  Session Generation and Encounter public boundaries
- publication of immutable, revisioned planner API state

- planner state is exposed only through `SessionPlannerApi`
- the application boundary remains orchestration only while `SessionPlan` owns the
  authored planning truth
- party and encounter rules stay in their owning contexts

## Aggregate Model

Aggregate Root: SessionPlan

`SessionPlan` owns the persisted planning record for one session. It stores:

- stable session identity
- user-visible session display name
- session-local participant references
- exact `encounterDays` planning input
- ordered session-owned scenes
- optional encounter-plan reference for each scene
- session-owned scene title, notes, and optional World Planner location
  reference for each scene
- per-scene budget allocations when an encounter plan is linked
- selected scene context
- placed rests and loot placeholders
- session-local status and selection truth

It derives:

- total planned encounter XP from linked encounter-owned summaries
- remaining and exceeded XP budget
- recommended rest counts
- importable saved encounter-plan budget summaries

The aggregate does not embed party membership, encounter rosters, creature
detail, or loot-object internals.

## Commands And Invariants

Commands entering the runtime model are:

- create session plan
- add or remove session participant reference
- add or remove a session scene
- attach or detach saved encounter-plan reference on a scene
- update scene title, scene notes, and optional World Planner location
  reference for a scene
- reorder scenes
- change scene allocation when an encounter plan is linked
- set or clear a rest in one scene gap
- add or remove a loot placeholder
- select the current session scene context

Core invariants:

- planner XP math is based on public party and encounter reads only
- session participant count is the number of session participant references
- the persistence model holds multiple session records and one current
  session pointer
- scenes keep the session-local order chosen by the planner
- rests can exist only between adjacent scenes
- each scene may refer to one encounter-owned saved plan, but scenes may also
  have no linked encounter
- each scene may reference one World Planner location by stable ID
  without copying location detail
- sessionplanner persists only references and planner-owned metadata, never
  foreign encounter or party internals
- loot placeholders do not contribute fake XP or fake gold values

## Consistency Model

- reopening a session restores session-owned participant refs, scene order,
  allocations, selection, rests, and placeholders
- party, encounter, creature, and later loot truth are re-read through their
  owning boundaries instead of being copied into session persistence

## References

- [Session Planner Requirements](../requirements/requirements-session-planner.md) (line 1)
- [Session Planner Architecture](../architecture/architecture-session-planner.md) (line 1)
- [Session Planner Persistence Contract](../contract/contract-session-planner-persistence.md) (line 1)
- [Party Domain Model](../../party/domain/domain-party.md) (line 1)
- [Encounter Domain Model](../../encounter/domain/domain-encounter.md) (line 1)
