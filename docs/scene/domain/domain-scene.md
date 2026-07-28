# Runtime Scene Domain Model

Status: Active Godot domain owner
Owner: Scene
Last Reviewed: 2026-07-28
Source of Truth: This document

## Context Role

Scene owns running-scene composition and focus. It does not own Party
characters, World Planner records, Session Planner timeline entries, Creature
definitions, saved Encounter plans, or Encounter workflow state.

## Write Model

The versioned `saltmarcher.scene.v2` payload is the Scene aggregate. It owns a
monotonic revision, primary-scene identity, focused-scene identity, and a map
of running scenes.

Each running scene owns its stable identity, notes, optional World Planner
location reference, ordered PC and NPC references, Creature-backed mob
assignments, and participant quick state. A mob assignment has a stable
identity, Creature reference, and positive group count. Participant state is
keyed by kind plus stable reference and owns only defeated state and live notes.

## Invariants

- Exactly one primary Scene always exists and focus always names an existing Scene.
- Every active Party PC belongs to exactly one Scene.
- Every populated split Scene has at least one PC; empty split Scenes are removed.
- Without active PCs, exactly one empty primary Scene remains.
- PC and NPC references are each globally unique across running scenes.
- A scene has zero or one location; locations may be shared across scenes.
- Mob assignment identities are unique and counts are positive.
- Participant state can refer only to a participant currently assigned to that scene.

## Published Language

`SceneKnowledge` validates and transforms pure payloads. The read controller
publishes immutable scene cards, derived group labels, resolved foreign
choices, the focused Encounter snapshot, and source revision. The command
controller translates visible intents into complete owner mutations.

Resolved names, levels, lifecycle, disposition, places, and
Creature combat facts are derived from their current owners. They never become
Scene-owned entities.

## Consistency

One Scene mutation plus synchronization of every Scene-keyed Encounter context
is one cross-partition Campaign commit. The Scene revision is the Encounter
source revision. Compatible existing Encounter state is reconciled rather than
reset: surviving initiative, combat HP, round, active turn, mode, and result
remain owned by Encounter. Removed scenes remove their contexts; the independent
manual Encounter context remains intact.

## References

- [Scene Requirements](../requirements/requirements-scene.md)
- [Scene Architecture](../architecture/architecture-scene.md)
- [Scene Persistence Contract](../contract/contract-scene-persistence.md)
