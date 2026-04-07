# AGENTS.md

This file covers `src/features/world/dungeon/repository/`.

## Purpose

`repository` owns the remaining legacy owner-local dungeon persistence seams that still live directly beneath `dungeon/`. Map rehydration now lives in the sibling `dungeonmap/repository` slice.

## Canonical Types and APIs

- `DungeonRoomRepository` — persists room metadata and room-to-cluster membership.
- `dungeonmap/cluster/DungeonClusterRepository` — persists top-level cluster rows and cluster-owned structure references.
- `DungeonStairRepository`, `DungeonTransitionRepository` — persist owner-local stair and transition metadata.

## Where New Code Goes

- Put SQL, row mapping, and schema ordering here.
- Put loaded-map rehydration in `dungeonmap/repository/`, not back in this legacy root.
- Route shared physical structure persistence through `dungeonmap/structure/repository` and the canonical `Structure` snapshot.
- Mirror the runtime structure shape as closely as practical when persisting shared structure truth: map level-local anchors, surface rows, and floor rows directly through `StructureSurface.PersistenceSnapshot`, map level-local boundary rows into `StructureBoundary.PersistenceSnapshot`, and compose them through `Structure.LevelStructure.PersistenceSnapshot` instead of rebuilding a second flattened structure DTO.
- Keep owner-local metadata in the owner repository rather than inventing shared helper mirrors.

## Forbidden Drift

- Do not add runtime compatibility normalization for stale rows.
- Do not move selection, fallback, or reload policy into repositories.
- Do not move `DungeonMapRepository` back into this legacy root.
- Do not duplicate canonical room, door, stair, or transition semantics in storage helper types.
