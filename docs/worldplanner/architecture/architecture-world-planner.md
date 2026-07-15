Status: Draft
Owner: SaltMarcher Team
Last Reviewed: 2026-06-26
Source of Truth: World Planner v1 architecture boundaries, topology, public
seams, and dependency direction.

# World Planner Architecture

## Entity Of Interest

This specification defines the target v1 architecture for the World Planner
feature.

Primary consumers are agents implementing World Planner backend, data, UI,
Encounter integration, Combat lifecycle integration, and public location-choice
integration.

## Current State

World Planner owns a backend domain, SQLite persistence adapter, published
readback model, minimal left-bar contribution, backend behavior harness, and
left-bar UI harness for NPCs, factions, and campaign-planning locations.
Encounter, Combat lifecycle, and Session Planner location-choice integration
remain later waves.

## Target Topology

World Planner v1 uses the current legacy-discovered feature route:

```text
src/domain/worldplanner/**
src/data/worldplanner/**
src/view/leftbartabs/worldplanner/**
```

The current target does not use `src/features/worldplanner/**`. That route
would require an explicit shell-discovery and feature-runtime integration
decision before it could become the left-bar target.

## Boundaries

`src/domain/worldplanner/**` owns:

- World Planner application services
- published command carriers and read-only models
- NPC, faction, and location authored models
- use cases for lifecycle, membership, inventory limits, source constraints,
  loss confirmation, and reactivation
- repositories and ports for foreign reads and persistence access

`src/data/worldplanner/**` owns:

- SQLite schema and migrations for World Planner-owned stored truth
- repository adapters that satisfy World Planner domain ports
- source-local records and mappers
- data service contribution for source-backed adapters

`src/view/leftbartabs/worldplanner/**` owns:

- the World Planner left-bar contribution
- view binding through `ShellRuntimeContext.services()`
- passive views and same-stem content models for NPCs, factions, and locations
- view input events and intent handling that call the World Planner public
  application service

## Allowed Seams

- World Planner reads creature statblock display facts through the Creatures
  public boundary.
- World Planner reads encounter-table summaries through the EncounterTable
  public boundary.
- Encounter may consume World Planner source-availability readbacks through a
  World Planner public boundary.
- Encounter may publish candidate loss facts to World Planner only as an
  explicit post-combat confirmation workflow.
- Session Planner may read World Planner location choices through a public
  boundary. The Session Planner owner decides whether and how those references
  are stored.
- Dungeon, Hex, Party, and Travel integration is future work unless a later
  owner document defines a specific seam.

## Dependency Direction

- Views depend on shell APIs, World Planner public application services, and
  same-context published read models.
- Domain code must not depend on `src/view/**`, `src/data/**`, JavaFX, SQL,
  filesystem, or shell runtime lookup outside the normal domain service
  contribution exception.
- Data code adapts source mechanics to domain-owned ports and must not invent
  a second World Planner business model.
- Cross-feature access goes through public application-service or published
  model boundaries, not foreign private domain or data packages.

## Architecture Decisions

- World Planner is the single owner for NPC, faction, and campaign-planning
  location authored truth.
- Creature, EncounterTable, Encounter, Session Planner, Party, Dungeon, and
  Hex remain owners of their existing truth.
- View-local state is presentation state only; NPC status, faction inventory,
  source constraints, and combat-confirmed lifecycle changes are domain
  readback.
- New public boundaries should use typed command and readback carriers. Current
  positional or stringly Encounter command paths are not World Planner target
  architecture.
- Explicit source constraints intersect. Unset constraints are not filters.

## Verification And Review

World Planner architecture conformance is review-owned outside the implemented
backend and minimal left-bar routes. Later implementation waves must add
behavior harness proof for Encounter, Combat lifecycle, and public
location-choice production routes and use the repository's normal staged
verification route for production-code changes.

## References

- [World Planner Requirements](../requirements/requirements-world-planner.md)
- [World Planner Domain Model](../domain/domain-world-planner.md)
- [World Planner Persistence Contract](../contract/contract-world-planner-persistence.md)
- [Data Layer Standard](../../project/architecture/patterns/data-layer.md)
