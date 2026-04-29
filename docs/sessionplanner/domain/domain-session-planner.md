Status: Draft
Owner: SaltMarcher Team
Last Reviewed: 2026-04-28
Source of Truth: Session planner context role, runtime state ownership, and
domain invariants.

# Session Planner Domain Model

## Context Role

Context Role: Generation Policy Context
Context Name: SessionPlanner

- `sessionplanner` owns transient session-planning state for the active party
- its public backend boundary is
  `src/domain/sessionplanner/SessionPlannerApplicationService.java`
- it does not own persisted write-model truth in the first iteration

## Published Language

`published/` owns planner queries, planner commands, rest-kind vocabulary, the
read-only planner snapshot, and the planner session observation model.

The feature does not publish encounter persistence carriers, creature-detail
carriers, or party mutation carriers. Those stay owned by their original
contexts.

## Application Boundary

The root application service coordinates:

- active-party composition reads
- party-based adventuring-day calculations
- saved encounter-plan budget reads through the encounter public boundary
- transient planner-session mutations and readback

The root boundary remains runtime orchestration only. Party and encounter
rules stay in their owning contexts.

## Write Model And Derived State

Write Model: none persisted

Current state:

- the planner owns transient imported-encounter order
- the planner owns transient rest placement between encounters
- the planner owns transient loot placeholders

It derives:

- total planned encounter XP
- remaining and exceeded XP budget
- recommended rest counts
- importable saved encounter-plan budget summaries

Target state:

- later iterations may add persistent planner truth only if a new canonical
  write-model owner is introduced explicitly

## Commands And Invariants

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

## References

- [Session Planner Requirements](/home/aaron/Schreibtisch/projects/SaltMarcher/docs/sessionplanner/requirements/requirements-session-planner.md:1)
- [Session Planner Architecture](/home/aaron/Schreibtisch/projects/SaltMarcher/docs/sessionplanner/architecture/architecture-session-planner.md:1)
- [Party Domain Model](/home/aaron/Schreibtisch/projects/SaltMarcher/docs/party/domain/domain-party.md:1)
- [Encounter Domain Model](/home/aaron/Schreibtisch/projects/SaltMarcher/docs/encounter/domain/domain-encounter.md:1)
