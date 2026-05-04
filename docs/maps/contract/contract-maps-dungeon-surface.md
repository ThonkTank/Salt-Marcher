Status: Draft
Owner: SaltMarcher Team
Last Reviewed: 2026-04-26
Source of Truth: Authored dungeon map boundary language between
`DungeonApplicationService` and downstream runtime-workspace contexts for map
read, preview, apply, inspector, travel, and catalog work.

# Dungeon Map Surface Contract

## Purpose

This contract defines the canonical dungeon-native request and response
language for committed map reads, authored edit preview and apply, selection
inspection, travel action, and catalog behavior as the dungeon adoption of
the generic maps feature.

Owners:

- provider: `DungeonApplicationService`
- consumers: `DungeonEditorApplicationService`, `TravelApplicationService`,
  and any future runtime-workspace context that needs authored dungeon map
  facts

## Rules

- committed dungeon map read MUST use one snapshot read family
- preview and apply MUST reuse one authored dungeon operation vocabulary
- selection inspection MUST use one authored selection-describe family
- travel action execution MUST use one travel-action request family
- map catalog requests and results remain separate from the authored read and
  mutation result families
- `DungeonSnapshot` is the committed authored map read root for dungeon map
  work
- `DungeonOperationResult` is the authored preview and apply result root for
  dungeon map work

## Inbound Request Family

### Committed Map Read

- `LoadDungeonSnapshotQuery`

Required context:

- `mapId`

### Authored Edit Preview And Apply

- `PreviewDungeonEditorOperationQuery`
- `ApplyDungeonEditorOperationCommand`

`DungeonEditorOperation` is the one canonical authored dungeon edit body.
Preview and apply wrap the same body through their dedicated boundary
carriers.

### Selection Inspection

- `DescribeDungeonSelectionQuery`

### Surface Travel Action

- `LoadDungeonTravelSurfaceQuery`
- `MoveDungeonTravelActionCommand`

Required fields:

- chosen action id for move

Optional fields:

- current travel position context for raw travel reads and travel moves

### Map Catalog

- `SearchMapsQuery`
- `CreateDungeonMapCommand`
- `RenameDungeonMapCommand`
- `DeleteDungeonMapCommand`

## Outbound Payload Family

### Authored Map Reads

Required sections:

- map identity or name context
- committed map projection
- aggregate and relation summaries
- revision

- `DungeonSnapshot`

### Authored Preview Or Apply Result

- `DungeonOperationResult`

Optional sections:

- validation messages
- reaction messages

### Selection Inspection

- `DungeonInspectorSnapshot`

### Travel Read Or Action Result

- `DungeonTravelSurfaceSnapshot`
- `DungeonTravelMoveResult`

### Catalog Results

- `SearchMapsResult`
- `CreateDungeonMapResult`
- `RenameDungeonMapResult`
- `DeleteDungeonMapResult`

## Validation And Error Behavior

- invalid edit attempts MUST return a non-committing result represented
  through `DungeonOperationResult` messages and unchanged committed truth
- invalid travel attempts MUST return a non-committing `DungeonTravelMoveResult`
- preview MUST NOT persist authored truth
- committed snapshot, inspector, preview result, and travel result reads MUST
  remain representable without inventing a second editor-colored top-level
  surface family
- adapters and Binders MUST treat omitted optional result sections as absence,
  not as implicit synthetic defaults
- runtime-workspace contexts MAY translate `DungeonSnapshot`,
  `DungeonOperationResult`, `DungeonInspectorSnapshot`, and
  `DungeonTravelSurfaceSnapshot` into their own owner-pure published carriers,
  but they MUST NOT mutate or replace the authored dungeon meaning carried by
  those authored results

## Compatibility Notes

The former editor-colored `DungeonSurface*` carrier family is removed.
Runtime-workspace contexts now compose their own workspace surfaces from
authored snapshot, operation-result, inspector, and travel-result carriers.

## Verification Notes

- This contract is currently `Review-Owned`.
- Review must reject reintroduction of an editor-colored `DungeonSurface*`
  compatibility family under `dungeon`.
- Review must reject a second canonical authored dungeon edit body beside
  `DungeonEditorOperation`.

## References

- [Maps Canvas Architecture](/home/aaron/Schreibtisch/projects/SaltMarcher/docs/maps/architecture/architecture-maps-canvas.md:1)
- [Dungeon Map Adoption Architecture](/home/aaron/Schreibtisch/projects/SaltMarcher/docs/maps/architecture/architecture-maps-dungeon-adoption.md:1)
- [Dungeon Persistence Contract](/home/aaron/Schreibtisch/projects/SaltMarcher/docs/dungeon/contract/contract-dungeon-persistence.md:1)
