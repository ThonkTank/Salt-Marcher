# Encounter Feature

Status: Active Godot migration owner
Owner: Encounter
Last Reviewed: 2026-07-28
Source of Truth: This document routes to the files below

Encounter owns persistent saved-plan rosters and the derived/runtime policies
for encounter creation and play. Its current Godot slice stores manual saved
plans in the active Campaign's immutable `encounter` partition. The Katalog can
search, inspect, create, edit, move to recoverable trash, restore, and reopen
those records after a complete scene reconstruction. Creature definitions stay
installation-owned; saved plans retain only stable IDs, positive quantities,
ordered roster position, and a last-known display-name fallback.

The runtime Encounter state tab, Party-balanced generation, generated batch
commit, Session Planner chooser/planning composition, initiative, combat, and
result modes remain target work. Their JavaFX/SQLite implementations are
migration evidence only and are not called by the Godot product.

## Documentation Set

- [Feature Requirements](requirements/requirements-encounter.md)
- [Runtime State UI](requirements/requirements-encounter-state-tab.md)
- [Domain Model](domain/domain-encounter.md)
- [Architecture](architecture/architecture-encounter.md)
- [Persistence](contract/contract-encounter-persistence.md)
- [Saved Plans Contract](contract/contract-encounter-saved-plans.md)
- [Plan Budget Contract](contract/contract-encounter-plan-budget.md)
- [Builder Inputs Contract](contract/contract-encounter-builder-inputs.md)
- [Encounter State Contract](contract/contract-encounter-state.md)
- [Generated Preparation Contract](contract/contract-encounter-generated-import.md)
- [Runtime Context Contract](contract/contract-encounter-runtime-contexts.md)
- [Encounter Table Feature](../encountertable/README.md)

## Current Production Evidence

- pure payload validation rejects empty, duplicate, malformed, and damaged
  rosters;
- one serial generation-bound writer refreshes exact Creature identities and
  last-known names before create/update publication;
- bounded Catalog queries and a separate latest-wins detail lane release all
  worker state and reject stale Campaign/definition generations;
- the editor materializes at most 50 roster rows while retaining the complete
  ordered authored set;
- create, edit, trash, restore, search, current-label hydration, rejected
  missing references, and restart readback run through the production shell.
