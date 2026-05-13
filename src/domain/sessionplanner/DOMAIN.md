Status: Active
Owner: SaltMarcher Team
Last Reviewed: 2026-05-10
Source of Truth: Compatibility-visible domain contract for the session planner
context.

# Session Planner Domain Contract

## Context Role

Context Role: Roster Truth Context
Context Name: SessionPlanner

- `sessionplanner` is the roster-truth context for one authored session plan.
- Its public backend boundaries are the session, participant, encounter, rest,
  and loot `*ApplicationService` roots under `src/domain/sessionplanner/`.
- It owns session-local participant references, encounter allocations, rest
  placement, placeholder state, and selection truth.
- It does not own party truth, encounter-plan roster truth, creature truth, or
  loot truth.

## Published Language

`published/` owns planner commands, rest-kind vocabulary, session snapshots,
and the read-only planner session observation model.

Current state:

- the current published API already exposes focused planner workflow commands
  plus four directly exported read-only planner models

Target state:

- the published surface narrows toward focused session workflows and read-only
  models while remaining planner-owned public language only

## Application Boundary

Application Service: SessionPlannerApplicationService
Application Service: SessionPlannerParticipantApplicationService
Application Service: SessionPlannerEncounterApplicationService
Application Service: SessionPlannerRestApplicationService
Application Service: SessionPlannerLootApplicationService

The root application services coordinate active-party composition reads,
party-based adventuring-day calculations, saved encounter-plan budget reads
through the encounter public boundary, planner-owned repository access, and
session-local mutations by decision family. Readback is published separately
through the exported planner read models.

Current state:

- the current code already delegates planner mutations to dedicated
  `model/session/usecase/*UseCase` owners over `SessionPlan`
- it now keeps exactly one repository-backed current session through
  planner-owned session repositories and canonical load/save session use cases
- the read-only planner state model is exported directly instead of being
  loaded through a root query method

Target state:

- the root boundary remains orchestration only while `SessionPlan` owns the
  authored planning record

## Aggregate Model

Aggregate Root: SessionPlan

`SessionPlan` owns the persisted planning record for one session. It stores:

- stable session identity
- session-local participant references
- exact `encounterDays`
- ordered encounter-plan references
- per-encounter budget allocations
- selected encounter context
- rests, placeholders, and planner-owned status state

It does not embed foreign party membership truth, encounter rosters, creature
detail, or loot-object internals.

## Commands And Invariants

Commands entering the runtime model are:

- create session plan
- add or remove session participant reference
- attach or detach encounter-plan reference
- reorder attached encounter reference
- change encounter allocation
- set or clear a rest in one encounter gap
- add or remove a loot placeholder
- select the current session encounter context

Core invariants:

- planner XP math is based on public party and encounter reads only
- session participant count equals the number of session participant references
- the current persistence model holds exactly one current session record
- attached encounters keep the session-local order chosen by the planner
- rests can exist only between adjacent encounters
- each attached encounter refers to exactly one encounter-owned saved plan
- sessionplanner persists only references and planner-owned metadata, not
  foreign party or encounter internals
- loot placeholders do not contribute fake XP or fake gold values

## Consistency Model

Current state:

- the current implementation now keeps one current persisted session through a
  planner-owned repository port plus canonical load/save session use cases
- reopening the planner after reload or application restart preserves
  participant refs, encounter order, allocations, selection, rests, and
  placeholders for that current session only

Target state:

- reopening a session restores session-owned participant refs, encounter order,
  allocations, selection, rests, and placeholders
- party, encounter, creature, and later loot truth are reloaded through their
  owning boundaries instead of being shadow-copied into session persistence

## Ubiquitous Language

- `SessionPlan`: authored planning record for one adventure session
- `Session Encounter`: one encounter-owned saved plan attached to the session
  with planner-owned metadata
- `Rest Gap`: a place between two adjacent session encounters where a rest can
  be placed
- `Loot Placeholder`: unresolved reward marker owned by the session plan

## References

- [Session Planner Domain Model](/home/aaron/Schreibtisch/projects/SaltMarcher/docs/sessionplanner/domain/domain-session-planner.md:1)
- [Session Planner Persistence Contract](/home/aaron/Schreibtisch/projects/SaltMarcher/docs/sessionplanner/contract/contract-session-planner-persistence.md:1)
- [Party Domain Model](/home/aaron/Schreibtisch/projects/SaltMarcher/docs/party/domain/domain-party.md:1)
- [Encounter Domain Model](/home/aaron/Schreibtisch/projects/SaltMarcher/docs/encounter/domain/domain-encounter.md:1)
