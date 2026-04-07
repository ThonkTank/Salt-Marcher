# AGENTS.md

This file covers `src/features/world/dungeonmap/repository/`. Use it together with the parent `dungeonmap/AGENTS.md` and the repository root `AGENTS.md`.

## Purpose

This package is the current storage home for dungeonmap persistence seams. Shared owner placement already lives in the parent file; this file only records repository-local rules.

## Canonical Types and APIs

- `DungeonLayoutRepository` — map id plus connection — rehydrates one authoritative `DungeonLayout`.
- `DungeonRoomRepository` — room rows plus shared structure references — persists room metadata and cluster references while delegating concrete structure snapshots to the sibling structure repository.
- `DungeonCorridorRepository` — corridor rows plus corridor path traces — persists corridor-local topology metadata and delegates realized physical structure snapshots to the sibling structure repository.
- `DungeonStairRepository`, `DungeonTransitionRepository` — owner-local rows — persist stair and transition metadata for their respective slices.

## Where New Code Goes

- Put SQL, row mapping, and schema ordering here.
- When persistence touches shared physical structure truth, route it through `structure/repository` and the canonical `Structure` snapshot instead of persisting duplicate structure rows here.
- When persistence touches owner-local metadata, keep it in that owner repository rather than inventing shared helper mirrors.

## Forbidden Drift

- Do not add runtime compatibility normalization for stale rows.
- Do not move selection, fallback, or reload policy into repositories.
- Do not duplicate canonical room, door, stair, or transition semantics in storage helper types.
