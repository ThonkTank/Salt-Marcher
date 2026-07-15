Status: Draft
Owner: SaltMarcher Team
Last Reviewed: 2026-06-19
Source of Truth: Hex authored-map domain vocabulary, write model ownership,
and invariants.

# Hex Map Domain

## Purpose

This document owns the domain truth for authored Hex maps. Requirements own
visible editor behavior, the persistence contract owns SQLite storage
semantics, and verification owns proof traceability.

## Bounded Context

The Hex context owns authored overworld-style hex maps used by Hex editor and
future Hex runtime surfaces. A Hex map is an authored map root with metadata,
hex tiles, terrain overrides, and simple tile-owned markers.

The Hex context does not own Dungeon topology, party roster truth, encounter
simulation, campaign clocks, weather rules, or generic map-canvas rendering
contracts. It does own the Hex-specific interpretation of party-owned
overworld travel readback when the party location points at a Hex map.

## Write Model

- `HexMap` is the aggregate root for one authored map.
- `HexTile` is the authored coordinate inside one map.
- `HexTerrainOverride` records the authored terrain chosen for one tile when
  the tile differs from default generation or empty-map state.
- `HexMarker` is a simple authored marker owned by one tile.

## Domain Vocabulary

### Map

A Hex map has a stable identity, a required display name, and a radius. Radius
defines the set of valid tile coordinates for the authored map. V1 Hex maps
support radius `0` through `99`; larger stored values are malformed domain
truth and must fail visibly instead of being projected.

### Tile

A Hex tile belongs to exactly one Hex map. Tile identity is the map identity
plus axial coordinate `q,r`. V1 Hex maps are single-layer maps; no level or
Dungeon room coordinate participates in Hex tile identity.

Party-owned overworld travel state carries only `mapId` plus a stable
`tileId`. Hex translates that `tileId` to and from axial `q,r` through the
Hex-owned stable tile-id convention. The convention is valid only for the V1
maximum Hex radius `99`; invalid or out-of-radius ids do not become active Hex
travel positions.

### Terrain

Terrain is authored per tile only when the editor stores an override. The V1
terrain vocabulary is the editor palette from
`docs/hex/requirements/requirements-hex-editor.md`.

### Marker

A Hex marker is a simple place marker. It has:

- required stable marker identity inside its map
- required nonblank name
- required marker type
- optional note
- exactly one owning Hex tile

The V1 marker types are:

- `SETTLEMENT`
- `LANDMARK`
- `DANGER`
- `RESOURCE`

## Invariants

- A Hex map name MUST be nonblank.
- A Hex map radius MUST be nonnegative.
- A Hex map radius MUST NOT exceed `99`.
- A Hex tile MUST reference an existing Hex map.
- A Hex tile coordinate MUST be inside the owning map radius.
- A terrain override MUST reference exactly one valid Hex tile.
- A marker MUST reference exactly one valid Hex tile.
- A marker name MUST be nonblank after editor validation.
- A marker type MUST be one of `SETTLEMENT`, `LANDMARK`, `DANGER`, or
  `RESOURCE`.
- A marker note MAY be absent or blank without changing marker identity or tile
  ownership.
- Hex markers MUST NOT reuse Dungeon feature-marker kinds, topology refs, or
  runtime travel state.
- Hex runtime readback MAY interpret party-owned overworld travel positions as
  Hex coordinates only through the Hex stable tile-id convention.

## Current State And Target State

Current state: SaltMarcher has a navigable Hex Map editor backed by the Hex
domain write model. It also projects party-owned overworld travel readback into
a Hex-specific runtime snapshot when the party token points at a valid Hex
tile id on an existing Hex map.

Target state: Hex editor implementation creates and mutates the Hex domain
write model described here, and adapters translate it to persistence without
making SQLite the source of domain meaning.

## References

- [Hex Editor Requirements](../requirements/requirements-hex-editor.md)
- [Hex Persistence Contract](../contract/contract-hex-persistence.md)
