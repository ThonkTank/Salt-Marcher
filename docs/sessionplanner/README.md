# Session Planner Feature

Status: Active migration entry point
Owner: Session Planner
Last Reviewed: 2026-07-28
Source of Truth: This document routes to the canonical Session Planner owners below

## Current Migration State

The production Godot shell now contains the native manual-planning foundation:
versioned file-partition truth, revisions, multiple Sessions, an independent
planning Party, exact day and scene budgets, ordered scenes and rest gaps,
places, saved Encounter links, manual loot notes, and one latest-wins workspace
projection. Dirty scene drafts survive coherent refreshes and save atomically
with scene or Session switches. Session Generation, generated rewards, and
owner-visible cutover acceptance remain open. The Java/JavaFX/
SQLite implementation is legacy-only until those remaining outcomes are done.

## Reading Order

1. Read [Requirements](requirements/requirements-session-planner.md) for the
   observable preparation flow and compact workspace.
2. Read [Domain](domain/domain-session-planner.md) for authored truth and
   invariants.
3. Read [Persistence Contract](contract/contract-session-planner-persistence.md)
   for stored references and write behavior.
4. Read [Architecture](architecture/architecture-session-planner.md) for the
   preparation workflow, workspace snapshot, concurrency, and performance
   decisions.

## Document Set

- [Requirements](requirements/requirements-session-planner.md)
- [Domain](domain/domain-session-planner.md)
- [Persistence Contract](contract/contract-session-planner-persistence.md)
- [Architecture](architecture/architecture-session-planner.md)

## Neighboring Owners

- [Session Generation](../sessiongeneration/README.md)
- [Encounter](../encounter/README.md)
- [Party](../party/README.md)
