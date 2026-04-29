Status: Active
Owner: SaltMarcher Team
Last Reviewed: 2026-04-28
Source of Truth: Compatibility-visible domain contract for the session planner
context.

# Session Planner Domain Contract

## Context Role

Context Role: Generation Policy Context
Context Name: SessionPlanner

- `sessionplanner` is the generation policy context for one transient session
  planning workspace.
- Its public backend boundary is
  `src/domain/sessionplanner/SessionPlannerApplicationService.java`.
- It owns runtime orchestration derived from public party and encounter reads
  without owning persisted authored truth.

## Published Language

`published/` owns planner queries, planner commands, rest-kind vocabulary, the
read-only planner snapshot, and the planner session observation model.

## Application Boundary

The root application service coordinates active-party composition reads,
saved encounter-plan budget reads through the encounter public boundary, and
transient planner-session mutations and readback.

## Commands And Invariants

Write Model: None

Commands entering the runtime model are:

- refresh planner state
- import saved encounter plan
- remove imported encounter
- reorder imported encounters
- set or clear a rest in one encounter gap
- add or remove a loot placeholder

Core invariants:

- planner XP math is based on public party and encounter reads only
- imported encounters keep the saved-plan order chosen by the planner session
- rests can exist only between adjacent encounters
- loot placeholders do not contribute fake XP or fake gold values
- the planner session is transient and separate from encounter-plan
  persistence

## Consistency Model

The planner session is rebuilt from public party and encounter inputs and keeps
its own transient ordering, rest placement, and placeholder state only for the
current runtime session. It owns no persisted authored truth and therefore does
not publish a durable write model.

## Ephemeral Policy Rationale

The first session planner iteration exists only as transient orchestration over
public party and encounter reads. Its owned decisions are runtime ordering,
rest placement, and placeholder management, not a persisted authored planning
record. A future persistent planner write model would require an explicit new
domain owner instead of being smuggled into this generation-policy context.

## Ubiquitous Language

- `SessionPlanner`: runtime planning workspace for one adventure session
- `Imported Encounter`: one saved encounter plan pulled into the transient
  planner order
- `Rest Gap`: a place between two adjacent imported encounters where a rest can
  be placed
- `Loot Placeholder`: transient unresolved reward marker owned by the planner
  session

## References

- [Session Planner Domain Model](/home/aaron/Schreibtisch/projects/SaltMarcher/docs/sessionplanner/domain/domain-session-planner.md:1)
- [Party Domain Model](/home/aaron/Schreibtisch/projects/SaltMarcher/docs/party/domain/domain-party.md:1)
- [Encounter Domain Model](/home/aaron/Schreibtisch/projects/SaltMarcher/docs/encounter/domain/domain-encounter.md:1)
