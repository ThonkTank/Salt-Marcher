# AGENTS.md

This file covers `src/features/world/dungeonmap/repository/`. Use it together with the parent `dungeonmap/AGENTS.md` and the repository root `AGENTS.md`.

## Purpose

This package is the current storage home for dungeonmap persistence seams. Shared owner placement already lives in the parent file; this file only records repository-local rules.

## Canonical Types and APIs

- `DungeonLayoutRepository` — map id plus connection — rehydrates one authoritative `DungeonLayout`.
- `DungeonStructureRepository` — shared `StructureObject` rows — persists canonical physical structure snapshots used by clusters and corridors.
- `DungeonRoomRepository`, `DungeonCorridorRepository`, `DungeonStairRepository`, `DungeonTransitionRepository` — owner-local rows plus `StructureObject` references — persist owner metadata for their respective slices.
- `DungeonWallKindRepository` — wall-kind catalog read seam — resolves app-global wall semantics on load.

## Where New Code Goes

- Put SQL, row mapping, and schema ordering here.
- When persistence touches physical structure truth, route it through `DungeonStructureRepository` and the canonical `StructureObject` snapshot.
- When persistence touches owner-local metadata, keep it in that owner repository rather than inventing shared helper mirrors.

## Forbidden Drift

- Do not add runtime compatibility normalization for stale rows.
- Do not move selection, fallback, or reload policy into repositories.
- Do not duplicate canonical room, door, stair, or transition semantics in storage helper types.
