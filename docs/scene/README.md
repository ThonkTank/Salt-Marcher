Status: Active
Owner: SaltMarcher Team
Last Reviewed: 2026-07-16
Source of Truth: Entry point and document map for runtime scenes.

# Runtime Scene Feature

## Purpose

`scene` owns the GM's running-scene workspace: which scene is focused, which
active PCs are in each scene, and which World Planner NPC and location
references are currently present. Encounter remains the owner of builder,
initiative, combat, and result state.

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
