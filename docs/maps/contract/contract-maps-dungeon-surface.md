Status: Active
Owner: SaltMarcher Team
Last Reviewed: 2026-07-07
Source of Truth: Current review-owned Dungeon map surface compatibility
contract between authored dungeon map boundaries and downstream
runtime-workspace contexts; target feature-runtime ownership remains in the
project-wide owner standards.

# Dungeon Map Surface Contract

## Purpose

This contract records the current dungeon-native request and response families
for committed map reads, authored edit preview and apply, selection
inspection, travel action, and catalog behavior as the dungeon adoption of the
generic maps feature.

It is not target feature-runtime conformance for the live Dungeon Editor
view/shell/UI seam. Target raw-input UI, shell binding, runtime render frame,
and typed raw-input ownership remains in
[Architecture Migration Roadmap](docs/project/architecture/architecture-migration-roadmap.md:1).

Owners:

- provider: `DungeonEditorFeatureRuntimeRoot`, which owns the dungeon editor
  feature-runtime authored operations provider, and
  `DungeonTravelRuntimeApplicationService`
- consumers: dungeon editor and travel view roots,
  and any future runtime-workspace context that needs authored dungeon map
  facts

## Rules

- committed dungeon map read and selection inspection MUST enter through the
  owning editor or travel runtime boundary for that workspace
- preview and apply MUST reuse the authored map operation vocabulary owned by
  the dungeon domain and applied through the authored dungeon mutation use case
- map catalog work MUST use one catalog request and response family
- runtime travel surface reads and travel moves MUST use one travel session
  command and snapshot family
- `DungeonSnapshot` remains the committed authored map read payload root
- `DungeonOperationResult` remains the authored preview and apply payload root
- catalog behavior remains separate from authored read, authored mutation, and
  travel families

## Inbound Request Families

### Editor Authored Read

- feature-runtime map selection input
- feature-runtime pointer input

Required context:

- map id for map selection
- pointer sample for selection inspection

Optional context:

- topology ref, handle ref, and boundary target data carried by the pointer
  sample

### Editor Authored Mutation

- feature-runtime pointer and handle inputs for pointer-driven editor
  operations
- feature-runtime operation methods for map selection, projection, overlay,
  tool, narration, label, stair, and transition work

Editor preview and apply share the same authored map operation vocabulary in
`DungeonEditorAuthoredOperation`. Public published command carriers no longer
reconstruct a second authored edit body.

### Map Catalog

- feature-runtime catalog search, create, rename, and delete operations

### Travel

- `ApplyTravelDungeonSessionCommand` with action `REFRESH`
- `ApplyTravelDungeonSessionCommand` with action `ACTION`
- `ApplyTravelDungeonSessionCommand` with action `SET_PROJECTION_LEVEL`
- `ApplyTravelDungeonSessionCommand` with action `SHIFT_PROJECTION_LEVEL`
- `ApplyTravelDungeonSessionCommand` with action `SET_OVERLAY`

Required fields:

- chosen action id for `ACTION`
- projection level for `SET_PROJECTION_LEVEL`
- projection-level delta for `SHIFT_PROJECTION_LEVEL`
- overlay settings for `SET_OVERLAY`

Optional fields:

- action id for `REFRESH`
- projection level and overlay settings for `REFRESH` or `ACTION`

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

- `TravelDungeonSnapshot`

Payload roots:

- `TravelDungeonSnapshot`

## Validation And Error Behavior

- invalid edit attempts MUST return a non-committing result represented
  through `DungeonOperationResult` messages and unchanged committed truth
- invalid travel attempts MUST publish a non-committing
  `TravelDungeonSnapshot` backed by runtime travel session move facts and
  unchanged authored dungeon truth
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

The live Dungeon Editor still reaches this surface through the legacy
`src/view/**` ShellContribution, Binder, and IntentHandler before dispatching
into feature-runtime operations. That path is current compatibility, not target
feature-runtime conformance.

Removal condition: Dungeon Editor shell registration and raw input UI are owned
by the feature-runtime shell/UI seam, with runtime render frames and typed
raw-input APIs consumed directly by that seam.

## Verification Notes

- This contract is currently `Review-Owned`.
- Review must treat the live Dungeon Editor legacy view/shell/UI route as
  current compatibility, not target feature-runtime conformance.
- Review must reject reintroduction of standalone one-off dungeon boundary
  carriers that bypass the four canonical families.
- Review must reject a second public authored dungeon edit body beside
  `DungeonEditorAuthoredOperation`.

## References

- [Maps Canvas Architecture](docs/maps/architecture/architecture-maps-canvas.md:1)
- [Dungeon Map Adoption Architecture](docs/maps/architecture/architecture-maps-dungeon-adoption.md:1)
- [Dungeon Persistence Contract](docs/dungeon/contract/contract-dungeon-persistence.md:1)
