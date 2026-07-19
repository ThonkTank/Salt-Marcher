Status: Draft
Owner: SaltMarcher Team
Last Reviewed: 2026-07-19
Source of Truth: Hex SQLite persistence contract for authored maps, tiles,
terrain overrides, and markers.

# Hex Persistence Contract

## Purpose

This contract defines the stored SQLite truth required for authored Hex maps.
It exists so Hex implementation can add persistence without borrowing Dungeon
schema meaning or making adapter row shape the domain owner.

## Owners And Consumers

- Owner: Hex feature.
- Producer: Hex editor write path.
- Consumers: Hex editor readback, future Hex runtime map loading, and Hex editor
  behavior tests.

## Scope Boundary

This contract owns only authored Hex map persistence. It does not own Dungeon
tables, generic map-canvas contracts, party roster persistence, compact
`Reise` travel-state persistence, or migration from external map sources.

## Stored Truth

Hex persistence MUST store:

- maps, including stable id, display name, and radius
- tiles, including owning map id and axial coordinate
- terrain overrides keyed by map and tile coordinate
- markers keyed by map and marker id, with exactly one owning tile coordinate

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

### Markers

Marker rows MUST include:

- stable marker id inside the map
- owning map id
- owning tile coordinate `q,r`
- nonblank name
- marker type
- optional note

Marker type MUST be one of:

- `SETTLEMENT`
- `LANDMARK`
- `DANGER`
- `RESOURCE`

Each marker row MUST belong to exactly one owning tile. A marker note MAY be
stored as absent, null, or blank according to the chosen adapter convention, but
that absence MUST round-trip as "no note" and MUST NOT change marker identity.

## Validation And Error Behavior

Owner startup readiness validates the feature-declared target schema signature; semantic row validation remains on typed provider read/write paths and fails closed through the feature contract.

- Loading malformed marker type, blank marker name, invalid map radius, or
  out-of-radius tile coordinates MUST fail visibly to the caller instead of
  silently repairing stored truth.
- Saving a map MUST preserve marker ownership and terrain overrides for tiles
  that remain inside the map radius.
- Shrinking a map radius MAY delete out-of-radius tile-owned data only after
  the editor behavior has surfaced the destructive warning owned by
  requirements.

## Compatibility And Migration

V1 has no compatibility promise with Dungeon feature-marker tables and no Hex
runtime travel-state payload. A released V1 installation can contain a hybrid
schema in which legacy `hex_maps` and `hex_tiles` tables coexist with the V1
current-map, terrain-override, and marker tables. The V2 migration owns the
only automatic conversion of that hybrid form.

V2 MUST accept only the declared V1 target signature or the known hybrid V1
signature. An unknown table signature MUST fail without advancing the Hex
schema ledger. For the hybrid form, V2 preserves stable map ids, nonblank map
names, bounded radii, axial coordinates, current-map selection, compatible
terrain overrides, and markers. Legacy terrain values normalize as follows:

- `grassland` becomes the implicit `GRASSLAND` default and is not stored as an
  override
- `forest`, `water`, `desert`, and `swamp` become their uppercase Hex terrain
  values
- `mountain` and `mountains` become `MOUNTAINS`

The hybrid migration MUST fail atomically when a map is unbounded, a name or
radius is invalid, tile coordinates do not completely cover the bounded map,
terrain sources conflict, a terrain or marker value is unknown, or legacy
elevation, biome, exploration, faction, or note truth cannot be represented by
the V2 schema. Failure MUST preserve the V1 schema, rows, and owner-ledger
version. Because released cross-owner tables can still reference the V1
surrogate `tile_id`, a successful hybrid migration MUST retain the legacy map
and tile rows under the immutable `sm_hex_v1_maps_archive` and
`sm_hex_v1_tiles_archive` names. SQLite foreign keys from those legacy
consumers MUST be rewritten to the archives by the same transaction; the
canonical `hex_maps` and `hex_tiles` names then belong only to V2. The archives
MUST NOT be treated as current Hex provider truth or mutated through Hex APIs.
Before creating staging tables, V2 MUST inventory every inbound foreign key to
all five V1 Hex tables. Only the released, code-ownerless
`world_locations`, `tile_faction_influence`, and `campaign_state` table
signatures may reference the archived map and tile tables; an external reference
to a Hex child table that V2 drops is never supported. Their complete columns, primary keys,
defaults, indexes, foreign-key columns, targets, and update/delete semantics
MUST match the released signatures. An unknown inbound table, an additional
foreign key, or any signature deviation MUST fail without staging, archive
rename, or owner-ledger advancement. Because SQLite also rewrites dependent
schema SQL during table rename, every view and trigger definition MUST be
inventoried before staging. V2 supports none that reference a V1 Hex table; any
such view or trigger fails closed without changing its definition.
Future migrations that rename tables, marker types, or the stable Hex tile-id
convention MUST likewise preserve domain meaning or document an incompatible
migration here before implementation relies on it.

## Verification Notes

Hex editor tests MUST verify persisted map, terrain, and marker rows through a
production persistence route. Migration proof MUST include the released hybrid
V1 signature with authored rows, typed repository readback after conversion,
idempotent V2 reopen, and rollback of non-representable V1 truth.

## References

- [Hex Domain](../domain/domain-hex-map.md)
- [Hex Editor Requirements](../requirements/requirements-hex-editor.md)
