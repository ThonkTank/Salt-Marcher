Status: Draft
Owner: SaltMarcher Team
Last Reviewed: 2026-05-06
Source of Truth: Authored dungeon map boundary language between
`DungeonApplicationService` and downstream runtime-workspace contexts for map
read, preview, apply, inspector, travel, and catalog work.

# Dungeon Map Surface Contract

## Purpose

This contract defines the canonical dungeon-native request and response
families for committed map reads, authored edit preview and apply, selection
inspection, travel action, and catalog behavior as the dungeon adoption of
the generic maps feature.

Owners:

- provider: `DungeonApplicationService`
- consumers: `DungeonEditorApplicationService`, `TravelApplicationService`,
  and any future runtime-workspace context that needs authored dungeon map
  facts

## Rules

- committed dungeon map read and selection inspection MUST use the authored
  read family
- preview and apply MUST reuse one authored dungeon mutation family and one
  shared `DungeonEditorOperation` body
- map catalog work MUST use one catalog request and response family
- travel surface reads and travel moves MUST use one travel request and
  response family
- `DungeonSnapshot` remains the committed authored map read payload root
- `DungeonOperationResult` remains the authored preview and apply payload root
- catalog behavior remains separate from authored read, authored mutation, and
  travel families

## Inbound Request Families

### Authored Read

- `DungeonAuthoredReadQuery.LoadSnapshot`
- `DungeonAuthoredReadQuery.DescribeSelection`

Required context:

- `mapId`

Optional context:

- topology ref, cluster id, and cluster-selection flag for selection reads

### Authored Mutation

- `DungeonAuthoredMutationCommand.PreviewOperation`
- `DungeonAuthoredMutationCommand.ApplyOperation`

`DungeonEditorOperation` is the one canonical authored dungeon edit body.
Preview and apply wrap the same body through their dedicated mutation-family
variants.

### Map Catalog

- `DungeonMapCatalogCommand.Search`
- `DungeonMapCatalogCommand.CreateMap`
- `DungeonMapCatalogCommand.RenameMap`
- `DungeonMapCatalogCommand.DeleteMap`

### Travel

- `DungeonTravelCommand.LoadSurface`
- `DungeonTravelCommand.MoveAction`

Required fields:

- chosen action id for move

Optional fields:

- current travel position context for raw travel reads and travel moves

## Outbound Payload Families

### Authored Read Result

- `DungeonAuthoredReadResult.CommittedSnapshot`
- `DungeonAuthoredReadResult.SelectionInspector`

Payload roots:

- `DungeonSnapshot`
- `DungeonInspectorSnapshot`

### Authored Mutation Result

- `DungeonAuthoredMutationResult.Operation`

Payload root:

- `DungeonOperationResult`

### Catalog Response

- `DungeonMapCatalogResponse.MapList`
- `DungeonMapCatalogResponse.MapMutation`

Payload roots:

- `List<DungeonMapSummary>`
- mutation kind plus `DungeonMapId`

### Travel Response

- `DungeonTravelResponse.Surface`
- `DungeonTravelResponse.Move`

Payload roots:

- `DungeonTravelSurfaceSnapshot`
- `DungeonTravelMoveResult`

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

The former one-off command, query, and result carrier set is superseded by the
family-based authored-read, authored-mutation, catalog, and travel families.
Runtime-workspace contexts now compose their own workspace surfaces from the
authored family results they actually consume.

## Verification Notes

- This contract is currently `Review-Owned`.
- Review must reject reintroduction of standalone one-off dungeon boundary
  carriers that bypass the four canonical families.
- Review must reject a second canonical authored dungeon edit body beside
  `DungeonEditorOperation`.

## References

- [Maps Canvas Architecture](/home/aaron/Schreibtisch/projects/SaltMarcher/docs/maps/architecture/architecture-maps-canvas.md:1)
- [Dungeon Map Adoption Architecture](/home/aaron/Schreibtisch/projects/SaltMarcher/docs/maps/architecture/architecture-maps-dungeon-adoption.md:1)
- [Dungeon Persistence Contract](/home/aaron/Schreibtisch/projects/SaltMarcher/docs/dungeon/contract/contract-dungeon-persistence.md:1)
