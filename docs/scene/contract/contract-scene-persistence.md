# Runtime Scene Persistence Contract

Status: Active Godot persistence contract
Owner: Scene
Last Reviewed: 2026-07-28
Source of Truth: This document

## Purpose And Boundary

Scene truth is one immutable, checksummed `scene` owner partition inside the
active Campaign file store. Its payload format is `saltmarcher.scene.v1`.
SQLite tables, JDBC, Java repositories, and post-save synchronization markers
are deleted legacy shapes and are not current compatibility surfaces.

Before the first released Godot format, incompatible development payloads fail
closed and are disposable rather than receiving an implicit translator.

## Stored Truth

The payload stores:

- workspace revision, next identity counter, Standardszene ID, and focused Scene ID;
- running Scene ID, title, notes, and optional Session/Scene provenance;
- optional initial saved Encounter-plan and World Planner location references;
- ordered Party character and World Planner NPC references;
- stable mob assignment IDs, Creature references, and positive counts;
- assigned-participant defeated state and quick notes.

It does not store foreign profiles, names, disposition, lifecycle, statblocks,
saved-plan rosters, or Encounter workflow state.

## Validation

Validation rejects malformed formats, missing or extra owner structure, empty
titles, invalid identities, missing focus/standard references, duplicate PC or
NPC membership, duplicate mob identities, non-positive mob counts, and
participant state that does not match an assigned participant. Read failure is
isolated to Scene and never fabricates fallback truth.

## Atomic Publication

Every command loads one expected Campaign generation, validates supporting
Party, World Planner, Session Planner, saved Encounter, and Shared-Definition
facts, and builds:

1. the complete replacement Scene payload; and
2. the complete replacement Encounter runtime-context collection.

Both partitions publish through one admitted serial Campaign commit. A stale
activation, changed Campaign or definition generation, missing reference,
damaged payload, validation error, or storage failure advances neither owner.
There is no second synchronization write and no recoverable half-success.

## Restart And Reference Semantics

Focus, composition, provenance, mobs, and participant state restore from the
Scene partition. Encounter restores each independent runtime context from its
own partition. On refresh, inactive PCs are removed and newly active PCs remain
unassigned. Missing foreign references remain explicit repairable identities
until a valid command removes or replaces them; no storage-level foreign key or
cross-owner repair is created.

## References

- [Scene Domain](../domain/domain-scene.md)
- [Scene Requirements](../requirements/requirements-scene.md)
- [Persistence Lifecycle](../../project/contract/persistence-lifecycle.md)
