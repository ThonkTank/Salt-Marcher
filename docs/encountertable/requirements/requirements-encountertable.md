# Encounter Table Requirements

Status: Confirmed product requirements
Owner: Encounter Table
Last Reviewed: 2026-07-28
Source of Truth: This document

## Goal

The GM MUST be able to author named Encounter Tables as reusable Campaign
sources whose weighted Monster entries constrain later Encounter generation
without deciding a narrative result.

## Target Behavior

- Encounter Tables are Campaign-owned records with stable identities, names,
  optional descriptions, and weighted Monster or group entries.
- The GM can create, inspect, edit, recoverably delete, and restore a table.
- Monster membership is selected through the Creature provider. The interface
  never asks the GM to type a foreign stable ID.
- One Monster occurs at most once in one table and has an integer weight from
  `1` through `10`.
- An empty table is valid and supplies no candidates.
- Catalog exposes searchable, stably sorted, bounded table summaries and opens
  full provider-owned details in the Inspector.
- Factions may select one primary table; places may select multiple tables.
  Selecting or opening either endpoint alone changes no relationship.
- A candidate evaluation over no selected tables returns no table candidates.
- A candidate evaluation over selected tables resolves current Creature facts
  through the Creature provider, applies the supplied XP ceiling, and retains
  every selected table's authored weight as source context.
- When the same Monster occurs in several selected tables, its current
  effective legacy-compatible ranking weight is the greatest authored weight;
  every per-table weight remains present for the later Encounter policy owner.
- Missing, malformed, or damaged table or Creature truth produces an owned
  failure. The feature never invents candidate facts.
- An optional linked Loot Table is warning context. Different linked Loot
  Tables in one selection produce a non-blocking `Loot-Konflikt` signal.
- Encounter may read a selected table set as immutable generation-source
  context containing unique Creature IDs, maximum effective weights, linked
  Loot IDs, and conflict state; this read does not resolve or own a final
  roster.

## Non-Goals

- choosing or randomizing the final Encounter
- balancing Encounter composition
- owning Creature statblocks or Loot Tables
- persisting a generated Encounter
- distributing loot or Quest rewards

## Acceptance Criteria

- complete create and edit journeys survive restart with stable table identity
  and exact weights;
- duplicate Monster membership and weights outside `1..10` fail without a
  Campaign commit;
- Catalog paging, search, sorting, selection, and detail reads remain bounded
  and off the Godot scene-tree thread;
- repeated or replaced candidate reads publish only the latest result and
  release all worker and pending state;
- a fixed selected-table/Creature fixture returns the exact eligible
  identities, XP facts, effective weights, and per-table authored weights;
- selected table sources constrain production Encounter generation, survive
  Catalog restart, publish source diagnostics, and never copy table records
  into Encounter persistence;
- World Planner references are chosen through the Encounter Table provider and
  persist only when the enclosing owner edit is confirmed;
- recoverable table deletion removes dependent current references atomically
  and restore reattaches only still-safe relationships;
- final visible interaction and layout acceptance remains owner manual testing.

## References

- [Encounter Table Domain Model](../domain/domain-encountertable.md)
- [Encounter Table Persistence](../contract/contract-encountertable-persistence.md)
- [Program Capabilities](../../project/requirements/requirements-program-capabilities.md)
- [Program Technical Needs](../../project/architecture/program-technical-needs.md)
