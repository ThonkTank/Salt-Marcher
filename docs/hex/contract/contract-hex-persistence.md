# Hex Persistence Contract

## Purpose

This contract defines the stored SQLite truth required for authored Hex maps.
It exists so Hex implementation can add persistence without borrowing Dungeon
schema meaning or making adapter row shape the domain owner.

## Owners And Consumers

- Owner: Hex feature.
- Producer: Hex editor write path.
- Consumers: Hex editor readback and future Hex runtime map loading.

## Scope Boundary

This contract owns only authored Hex map persistence. It does not own Dungeon
tables, generic map-canvas contracts, party roster persistence, compact
`Reise` travel-state persistence, or migration from external map sources.

## Stored Truth

Hex persistence MUST store:

- maps, including stable id and display name
- tiles, including owning map id and axial coordinate
- terrain overrides keyed by map and tile coordinate
- World Planner location placements keyed by foreign logical location ID, with
  exactly one owning tile coordinate
- Scene-scoped runtime journeys with route, checkpoint, status, participants,
  presentation multiplier, and restart state

## Schema Semantics

### Maps

The map table MUST store one row per authored Hex map. A map row MUST include:

- stable map id
- nonblank name
- no stored boundary or eagerly materialized default-tile extent

### Tiles

Tile rows MUST be scoped to one map. A tile coordinate is the single-layer
axial coordinate `q,r`. Stored tile records MUST NOT introduce a Dungeon level,
room, or topology reference.

Hex runtime travel uses a derived stable tile id for party-owned overworld
travel positions. That id is not stored in Hex tables; it is computed from the
Hex axial coordinate and decoded by the Hex runtime readback. Hex persistence
remains keyed by `map_id`, `q`, and `r`.

### Authored Tiles And Terrain Overrides

Sparse tile rows record which axial coordinates exist on a map. Terrain
override rows MUST reference an authored tile and use the Hex terrain
vocabulary exposed by the editor requirements. An authored tile without an
override resolves to Grassland; an absent row is not a generated tile.

### Location Placements

Placement rows store only World Planner location ID, owning map ID, and axial
coordinate. Unique constraints enforce one placement per location and at most
one placed location per tile. Cross-owner database foreign keys are forbidden;
the application command coordinates deletion while each owner retains its SQL.

### Runtime Journeys

Journey rows are keyed by Scene ID and store map ID, current checkpoint,
participant IDs, status, presentation multiplier, and segment start. Expanded
adjacent path coordinates live in an ordered relational child table so tile
impact checks and referential cleanup remain set-based. Compact `Reise` context
remains derived and is not stored again.

## Validation And Error Behavior

Startup validates the one campaign-database development schema version.
Semantic row validation remains on typed provider read/write paths and fails
closed through the feature contract.

- Loading an unknown terrain ID, malformed route, or malformed tile coordinate
  MUST fail visibly to the caller instead of
  silently repairing stored truth.
- Viewport reads MUST query only sparse authored rows intersecting the requested
  chunks. Any visible empty guide grid is renderer-only presentation state.

## Compatibility And Migration

Compatibility obligations begin with the first released format.
Before the first released format, Hex supports exactly the current development
schema. A fresh owner namespace is initialized directly to that complete target.
There is no predecessor import, hybrid-schema repair, copy/drop conversion,
archive table, or cross-owner foreign-key rewrite.

An unsupported whole-database development version causes the isolated
development-data root to be recreated according to the project persistence
lifecycle. Hex does not maintain a feature ledger or independent schema
signature. Current Hex tables use foreign keys only inside the Hex owner;
other features retain Hex identifiers as logical references.

Hex stores a bounded persistent per-map edit history and idempotent command
receipts. History contains only Hex-owned tile, terrain, and placement truth;
it never snapshots Party or Journey aggregates.


## References

- [Hex Domain](../domain/domain-hex-map.md)
- [Hex Editor Requirements](../requirements/requirements-hex-editor.md)
