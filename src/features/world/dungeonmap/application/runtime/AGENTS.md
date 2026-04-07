# AGENTS.md

This file covers `src/features/world/dungeonmap/application/runtime/`. Use it together with the parent `dungeonmap/AGENTS.md` and the repository root `AGENTS.md`.

## Purpose

`application/runtime/` owns runtime navigation and runtime-facing projections over canonical dungeon owners.

## Current Durable Structure

- `DungeonRuntimeApplicationService` owns runtime navigation workflows, tile-only campaign-state persistence, and repair of persisted runtime state.
- `DungeonRuntimeLocation` is the shared parsed runtime location used by both action assembly and description writing.
- `DungeonRuntimeActionResolver` owns executable runtime actions.
- `description/` owns read-only runtime description projections.

## Forbidden Drift

- Do not make description builders a second workflow owner.
- Do not reparse layout ownership independently at every runtime UI sink.
- Do not turn runtime projections into alternate model truth or write-capable objects.
