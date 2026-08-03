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

- maps, including stable id, display name, and radius
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
- radius from `0` through `99`

### Tiles

Tile rows MUST be scoped to one map. A tile coordinate is the single-layer
axial coordinate `q,r`. Stored tile records MUST NOT introduce a Dungeon level,
room, or topology reference.

Hex runtime travel uses a derived stable tile id for party-owned overworld
travel positions. That id is not stored in Hex tables; it is computed from the
Hex axial coordinate and decoded by the Hex runtime readback. Hex persistence
remains keyed by `map_id`, `q`, and `r`.

### Terrain Overrides

Terrain override rows MUST be scoped to one map and one tile coordinate. The
terrain value MUST use the Hex terrain vocabulary exposed by the Hex editor
requirements.

### Location Placements

Placement rows store only World Planner location ID, owning map ID, and axial
coordinate. Unique constraints enforce one placement per location and at most
one placed location per tile. Cross-owner database foreign keys are forbidden;
the application command coordinates deletion while each owner retains its SQL.

### Runtime Journeys

Journey rows are keyed by Scene ID and store map ID, expanded adjacent path,
current checkpoint, participant IDs, status, presentation multiplier, and
segment start. Compact `Reise` context remains derived and is not stored again.

## Validation And Error Behavior

Owner startup readiness validates the feature-declared target schema signature; semantic row validation remains on typed provider read/write paths and fails closed through the feature contract.

- Loading an unknown terrain ID, invalid map radius, malformed route, or
  out-of-radius tile coordinate MUST fail visibly to the caller instead of
  silently repairing stored truth.
- Saving a map MUST preserve location ownership and terrain overrides for tiles
  that remain inside the map radius.
- Shrinking a map radius MAY delete out-of-radius tile-owned data only after
  the editor behavior has surfaced the destructive warning owned by
  requirements.

## Compatibility And Migration

Compatibility obligations begin with the first released format.
Before the first released format, Hex supports exactly the current schema at owner version
1. A fresh owner namespace is initialized directly to that complete target.
There is no predecessor import, hybrid-schema repair, copy/drop conversion,
archive table, or cross-owner foreign-key rewrite.

An unversioned partial namespace, a recorded version-1 shape that differs from
the exact current DDL, an adjacent retired Hex object, or a newer owner version
MUST fail closed. Failure MUST leave the schema, rows, and owner ledger
unchanged; initialization failure MUST NOT fabricate a ledger entry. Until
activation, unsupported development databases are reinitialized rather than
migrated.

The exact owner inventory covers every table, index, view, and trigger named
with `hex_`, `idx_hex_`, or `sm_hex_`. Current Hex tables use foreign keys only
inside the Hex owner. Other features retain Hex map or tile identifiers as
logical references and MUST NOT cause Hex startup to inspect, repair, rename,
or rewrite their schemas.


## References

- [Hex Domain](../domain/domain-hex-map.md)
- [Hex Editor Requirements](../requirements/requirements-hex-editor.md)
