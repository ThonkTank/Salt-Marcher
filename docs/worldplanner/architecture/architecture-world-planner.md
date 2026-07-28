# World Planner Architecture

Status: Active Godot target architecture
Owner: World Planner
Last Reviewed: 2026-07-28
Source of Truth: This document

## Purpose And Boundary

World Planner owns Campaign-authored NPC, faction, location, lifecycle, note,
source-constraint, membership, inventory-limit, and recoverable-trash truth. It
does not own creature statblocks, encounter tables, encounter runtime, party
truth, session records, or Catalog browsing state.

The product exposes these records inside the single Godot `Katalog` route. That
placement does not transfer ownership to Catalog: Catalog asks the World
Planner provider for bounded rows and sends explicit commands back to the
provider.

## Godot Source Shape

```text
godot/src/features/worldplanner/
  world_planner_knowledge.gd           # pure owner model and invariants
  world_planner_command_controller.gd  # off-thread prepare, serial commit
godot/src/features/catalog/
  catalog_browse_controller.gd         # provider-neutral query lane
godot/src/ui/
  catalog_workspace.gd                 # shared presentation only
```

`WorldPlannerKnowledge` validates one versioned `worldplanner` owner-partition
payload. It creates stable independently identified NPCs, factions, and places;
allows duplicate display names; owns type-specific optional values and internal
relationships; and applies deletion or restoration as one candidate state. It
has no Node, filesystem, Catalog, Java, JavaFX, JDBC, or SQLite dependency.

`WorldPlannerCommandController` snapshots the admitted active Campaign, reads
and prepares one mutation on a worker, and submits the complete candidate
partition to the existing serial asynchronous Campaign writer. Activation and
Campaign generations bind the submission. A switch, newer write, revoked
session, or concurrent accepted write rejects publication instead of writing
detached truth. Terminal feedback returns on the scene-tree thread.

## Read Boundary

The Catalog read lane resolves the active Campaign through the immutable
registry, opens its current commit, reads only the `worldplanner` partition, and
executes a bounded provider query off the scene-tree thread. It verifies that
the active registry pointer did not change before publishing. One active query
and one latest-wins pending query bound memory and worker count; epochs suppress
late readback.

Rows contain provider-neutral stable identity, kind, name, optional notes,
updated time, and trash state. Full typed detail editing remains an owner API
target and must not be implemented by copying owner truth into Catalog.

## Current Migration State

The production Godot route currently supports bounded active/trash search and
name-only create, name/note edit, recoverable delete, and restore for NPCs,
factions, and places. Deleting a faction atomically removes current NPC
membership and place links. Restore keeps the same identity and reattaches only
surviving relationships that are still free.

The owner payload already validates the documented optional NPC, faction, and
place fields. The visible editor currently exposes only name and general notes;
creature/table selection, lifecycle, disposition, inventory, richer note
fields, and destination handoffs remain pending. The legacy Java owner is not
deleted until that parity, acceptance, and deletion gate are complete.

## Permanent Constraints

- one Campaign owner partition named `worldplanner`;
- stable identity is independent of display name;
- name is the only required creation field;
- duplicate display names are valid;
- current and trash queries are distinct bounded views;
- deletion and relationship cleanup publish atomically;
- restore never invents a missing or conflicting relationship;
- provider I/O and mutation preparation never block the scene-tree thread;
- Catalog owns no World Planner record, persistence path, or domain rule;
- no JavaFX, Java, JDBC, SQLite, or service-locator dependency enters the Godot
  owner boundary.

## References

- [World Planner Requirements](../requirements/requirements-world-planner.md)
- [World Planner Domain Model](../domain/domain-world-planner.md)
- [World Planner Persistence Contract](../contract/contract-world-planner-persistence.md)
- [Catalog Architecture](../../catalog/architecture/architecture-catalog.md)
- [Persistence Lifecycle](../../project/contract/persistence-lifecycle.md)
- [Feature Boundary Standard](../../project/architecture/patterns/feature-boundaries.md)
