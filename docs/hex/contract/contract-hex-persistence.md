Status: Draft
Owner: SaltMarcher Team
Last Reviewed: 2026-06-18
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
- Consumers: Hex editor readback, future Hex runtime map loading, and
  focused Hex editor verification harnesses.

## Scope Boundary

This contract owns only authored Hex map persistence. It does not own Dungeon
tables, generic map-canvas contracts, runtime travel state, compact `Reise`
travel-state persistence, or migration from external map sources.

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

- Loading malformed marker type, blank marker name, invalid map radius, or
  out-of-radius tile coordinates MUST fail visibly to the caller instead of
  silently repairing stored truth.
- Saving a map MUST preserve marker ownership and terrain overrides for tiles
  that remain inside the map radius.
- Shrinking a map radius MAY delete out-of-radius tile-owned data only after
  the editor behavior has surfaced the destructive warning owned by
  requirements.

## Compatibility And Migration

V1 has no compatibility promise with Dungeon feature-marker tables and no
runtime travel-state payload. Future migrations that rename tables or marker
types MUST preserve domain meaning or document the incompatible migration in
this contract before implementation relies on it.

## Verification Notes

Focused Hex editor harness proof MUST verify persisted map, terrain, and marker
rows through a production persistence route.

## References

- [Hex Domain](../domain/domain-hex-map.md)
- [Hex Editor Requirements](../requirements/requirements-hex-editor.md)
- [Hex Editor Verification](../verification/verification-hex-editor.md)
