# Encounter Table Domain Model

Status: Active target domain
Owner: Encounter Table
Last Reviewed: 2026-07-28
Source of Truth: This document

## Context Role

Context Role: Campaign Authored Source Context
Context Name: Encounter Table

Encounter Table owns the identity, name, description, weighted membership,
optional Loot Table reference, and recoverable lifecycle of authored Campaign
sources. It does not own Creature facts, Loot truth, Encounter balancing, or
narrative selection.

## Published Language

- `Encounter Table`: one named Campaign source.
- `Weighted Entry`: one Creature identity and an authored integer weight.
- `Table Summary`: stable identity, name, entry count, and optional linked-Loot
  context for Catalog and pickers.
- `Candidate Evaluation`: an immutable join of selected owned memberships with
  current Creature-provider facts under one XP ceiling.
- `Table Weight Context`: every selected table's authored weight for one
  Creature plus the effective legacy-compatible maximum.

## Invariants

- table identity is stable and independent of display name;
- names are non-empty after trimming;
- one Creature identity occurs at most once per table;
- weights are mathematical integers in `1..10`;
- empty selection and empty tables produce no candidates;
- selected table identities are unique and must exist;
- candidate facts come from the registry-selected Creature generation;
- candidate order is stable by XP, case-insensitive name, then Creature ID;
- an XP ceiling greater than zero excludes more expensive candidates;
- table editing never mutates Creature or Loot truth;
- evaluation never chooses an Encounter.

## Application Boundary

The capability publishes bounded summary queries, latest-wins detail reads,
serial create/update commands, reference choices, and latest-wins candidate
evaluations. The candidate application path reads the Encounter Table snapshot
and Creature snapshot independently, combines immutable results, then confirms
the active Campaign and Shared-Definition generation before publication.

Catalog and World Planner consume these contracts. They do not open the owner
partition or Shared-Definition files themselves.

## Current Migration State

Godot currently owns create, edit, bounded Catalog summaries, full detail,
weighted Creature membership, World Planner reference choices, cross-owner
candidate resolution, restart persistence, and worker cleanup. Recoverable
table deletion/restore, group entries, Loot Table choice/conflict presentation,
and Encounter destination handoff remain pending. The Java implementation is
migration evidence only.

## References

- [Encounter Table Requirements](../requirements/requirements-encountertable.md)
- [Encounter Table Persistence](../contract/contract-encountertable-persistence.md)
- [Source Architecture](../../project/architecture/source-architecture.md)
