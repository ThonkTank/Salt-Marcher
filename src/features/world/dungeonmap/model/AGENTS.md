# AGENTS.md

This file covers `src/features/world/dungeonmap/model/`. Use it together with the parent `dungeonmap/AGENTS.md` and the repository root `AGENTS.md`.

## Purpose

`model/` owns canonical dungeon truth. Geometry, interaction refs, structure semantics, and layout queries must stay here so upper layers consume one stable interpretation instead of rebuilding it.

## Current Durable Structure

- `geometry/` owns pure grid math and the reusable shape families `TileShape`, `EdgeShape`, and `TilePath`.
- `interaction/` owns semantic selection, hit, and label refs that other layers consume but do not reinterpret.
- `objects/` owns gameplay objects over geometry. `StructureObject` is the only aggregate that combines floor, wall, door, and stair topology.
- `structures/` owns dungeon structures and their structure-specific behavior over canonical objects.
- `DungeonLayout` is the read/query index over current structure owners and shared relationship lookups.

## Rules

- Geometry algebra belongs only in `geometry/`.
- Gameplay semantics belong on object or structure owners, not in repositories, renderers, or tools.
- `Room` owns identity, narration, and anchors only. Room surfaces and boundaries resolve through `RoomCluster` or `DungeonLayout`.
- `Corridor`, `DungeonStair`, and `DungeonTransition` are first-class structure owners with stable ids.
- `DungeonSelectionRef` carries semantic ids plus canonical geometry only. `DoorRef` is pure door identity; current owner semantics for doors resolve through `DungeonLayout`.

## Forbidden Drift

- Do not add a second geometry seam beside `geometry/`.
- Do not add a second topology aggregate beside `StructureObject`.
- Do not persist or cache structure-local mirrors for room, corridor, stair, or transition topology when the canonical owner already exists.
