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
independent contexts, the non-deletable Standardszene prevents an empty
workspace, and every Scene mutation publishes the complete matching Encounter
context set in the same immutable Campaign generation. A prepared Session
Planner scene is copied with provenance and can diverge safely during play.

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
