# Runtime Scene Feature

Status: Active Godot migration owner
Owner: Scene
Last Reviewed: 2026-07-28
Source of Truth: This document routes to the files below

Scene owns the GM's running-table composition: parallel scenes, focus, split
Party membership, World Planner NPC and location references, Creature-backed
mobs, participant quick state, and the exact Encounter context associated with
each scene.

The production Godot route is a native bridge deck. Its focus compass switches
independent contexts. One primary group always exists, every active Party PC is
assigned to exactly one running group, and one character-move action both
splits and reunites groups. Empty split groups disappear automatically. Party
membership, Scene composition, and the complete matching Encounter context set
publish in the same immutable Campaign generation.

Session Planner timeline entries are preparation facts, not stored running
Scenes. Starting play does not copy a prepared Scene or saved Encounter roster
into the Scene aggregate.

The former JavaFX/SQLite Scene owner has been deleted. Encounter remains the
owner of builder, initiative, combat, result, and XP-award truth. Passive
display, masks, independent clocks, live music/search, and final owner-visible
acceptance remain migration work.

## Documents

- [Requirements](requirements/requirements-scene.md)
- [Domain](domain/domain-scene.md)
- [Architecture](architecture/architecture-scene.md)
- [Persistence](contract/contract-scene-persistence.md)

## References

- [Session Planner](../sessionplanner/README.md)
- [Encounter](../encounter/README.md)
- [World Planner](../worldplanner/README.md)
- [Party](../party/README.md)
