# AGENTS.md

This file covers `src/features/world/dungeonmap/repository/`.

## Purpose

`repository` owns owner-local dungeon persistence seams beneath `dungeonmap/`.

## Canonical Types and APIs

- `DungeonLayoutRepository` — map id plus connection — rehydrates one authoritative `DungeonLayout`.
- `DungeonRoomRepository` — persists room metadata and cluster references.
- `DungeonCorridorRepository` — persists corridor-local topology metadata and corridor path traces.
- `DungeonStairRepository`, `DungeonTransitionRepository` — persist owner-local stair and transition metadata.

## Where New Code Goes

- Put SQL, row mapping, and schema ordering here.
- Route shared physical structure persistence through `structure/repository` and the canonical `Structure` snapshot.
- Mirror the runtime structure shape as closely as practical when persisting shared structure truth: map level-local surface rows into `StructureSurface.PersistenceSnapshot` and level-local boundary rows into `StructureBoundary.PersistenceSnapshot` instead of rebuilding a second flattened structure DTO.
- Keep owner-local metadata in the owner repository rather than inventing shared helper mirrors.

## Forbidden Drift

- Do not add runtime compatibility normalization for stale rows.
- Do not move selection, fallback, or reload policy into repositories.
- Do not duplicate canonical room, door, stair, or transition semantics in storage helper types.
