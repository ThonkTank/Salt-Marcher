Status: Active Target
Owner: SaltMarcher Team
Last Reviewed: 2026-07-17
Source of Truth: Dungeon feature API contract for authored map, editor, catalog,
and travel capabilities consumed by presentation and other features.

# Dungeon Map Surface Contract

## Purpose, Owners, And Consumers

This feature-boundary contract defines the dungeon-native request and response
families exposed from `features/dungeon/api` for committed map reads, editor
preview and apply, selection inspection, catalog behavior, and travel sessions.

- provider: Dungeon feature APIs
- consumers: Dungeon JavaFX adapter and foreign features that need a documented
  Dungeon capability
- composition owner: `app`, which passes typed APIs explicitly

Consumers depend only on `features.dungeon.api`; they do not import Dungeon
domain, application, SQLite adapter, JavaFX adapter, or composition packages.
The contract owns boundary semantics, not authored invariants or persistence
schema.

## Rules

- Committed map reads and selection inspection use the owning Authored, Editor,
  or Travel API for that workspace.
- Preview and apply reuse one authored operation vocabulary. Preview never
  persists authored truth.
- Editor controls, map, selection, preview, inspector, and command outcome come
  from one immutable `DungeonEditorState` revision.
- Catalog work uses one catalog request and response family.
- Runtime travel reads and moves use one travel-session command and immutable
  state family.
- Authored read, authored mutation, catalog, and travel remain distinct API
  capabilities even when one Dungeon entry point provides them.
- Public state is immutable and revisioned; a late result cannot replace newer
  state.

## Inbound Request Families

### Authored Read And Selection

Operations:

- select or read a map
- inspect a pointer-selected authored target

Required context:

- map id for map selection
- typed pointer or selection sample for inspection

Optional context:

- topology ref, handle ref, and boundary target carried by the selection sample

### Authored Mutation

`DungeonEditorIntent` covers map selection, projection, overlay, tool family and
options, narration, labels, stairs, transitions, markers, and pointer-driven
authored work. Pointer intents carry `ToolFamily`, `ToolOptions`, and
`PointerGesture` meaning translated from the displayed canvas revision.

Preview and apply use the same typed command plan. Apply adds commit intent; it
does not reconstruct a second edit vocabulary.

### Catalog

Operations:

- search and list maps
- create a map
- rename a map
- delete a map

### Travel

Actions:

- `REFRESH`
- `ACTION`
- `MOVE_TO_CELL`
- `SET_PROJECTION_LEVEL`
- `SHIFT_PROJECTION_LEVEL`
- `SET_OVERLAY`

Required fields:

- chosen action id for `ACTION`
- target Dungeon cell for `MOVE_TO_CELL`
- projection level for `SET_PROJECTION_LEVEL`
- projection-level delta for `SHIFT_PROJECTION_LEVEL`
- overlay settings for `SET_OVERLAY`

Optional fields:

- action id for `REFRESH`
- projection level and overlay settings for `REFRESH` or `ACTION`

## Outbound State And Result Families

### Authored Read

- committed `DungeonViewportSnapshot`
- stable inspector facts carried by `DungeonEditorState` when selected
- map revision and stable authored identities

### Authored Mutation

- immutable `DungeonEditorState`
- accepted result with resulting revision and changed stable identities, or a
  typed rejection reason with unchanged committed revision

### Catalog

- `List<DungeonMapSummary>`
- mutation kind plus `DungeonMapId`

### Travel

- immutable `DungeonTravelState`
- travel-session revision, available actions, projection level, overlays, and
  party position needed by the workspace

These names describe Dungeon API semantics. They require no model suffix or
presentation projection class.

## Maps Integration

The Dungeon JavaFX adapter translates Dungeon API state into
`platform.ui.mapcanvas` scene values and map-canvas pointer samples into
Dungeon API requests.

- Dungeon-grid coordinates and topology identity never enter Maps as domain
  types.
- Canvas geometry and hit areas never enter Dungeon authored or travel state.
- Render primitives, labels, overlays, markers, relations, and token anchors are
  derived presentation state and never persistence input.
- One scene revision corresponds to one consumed Dungeon state revision.
- Catalog requests bypass the canvas capability.

## Validation And Error Behavior

- Invalid authored edits publish a rejected `DungeonEditorCommandOutcome` with
  unchanged committed truth and a stable typed rejection reason.
- Invalid travel actions return unchanged authored truth and an immutable travel
  result that reports rejection without inventing a move.
- Preview must not persist authored truth.
- Unknown map, topology, handle, selection, or action identities are rejected or
  represented as absence according to the owning operation; adapters must not
  synthesize replacements.
- A travel action is addressed by stable action id, never by presentation-row
  position. Direct movement and listed actions share one validation and outcome
  path.
- Missing optional result sections mean absence, not defaults invented by a
  consumer.
- A stale asynchronous result must not overwrite a newer Dungeon API revision.
- Translation into canvas-native values must preserve Dungeon meaning but must not
  mutate Dungeon state.

## Compatibility, Migration, And Versioning

Persisted dungeon truth and observable behavior retain their domain,
persistence, and requirements owners. Internal Java API types may change with
all consumers in one atomic green migration slice.

Changing authored operation meaning, stable identities, commit semantics,
catalog mutation semantics, or travel action meaning requires an explicit
contract migration. Adding optional read fields is compatible when old consumers
continue to distinguish absence from defaults.

## Verification

- Production-route JUnit tests cover committed read, selection, preview/apply,
  invalid non-commit, catalog mutations, travel actions, revision ordering, and
  Dungeon-to-Maps translation.
- `architectureTest` checks cross-feature API imports, feature-role dependency
  direction, and placement of JavaFX, JDBC, and file-I/O mechanisms.
- Review rejects a second authored edit body or a second Dungeon-to-Maps
  translation owner.

## References

- [Maps Canvas Architecture](../architecture/architecture-maps-canvas.md)
- [Dungeon Map Adoption Architecture](../architecture/architecture-maps-dungeon-adoption.md)
- [Maps Canvas Contract](contract-maps-canvas.md)
- [Dungeon Persistence Contract](../../dungeon/contract/contract-dungeon-persistence.md)
- [Dungeon Domain Model](../../dungeon/domain/domain-dungeon.md)
- [Feature Boundary Standard](../../project/architecture/patterns/feature-boundaries.md)
