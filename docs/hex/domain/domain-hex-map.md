# Hex Map Domain

## Purpose

This document owns the domain truth for authored Hex maps. Requirements own
visible editor behavior, the persistence contract owns SQLite storage
semantics, and architecture owns system boundaries.

## Bounded Context

The Hex context owns authored overworld-style hex maps used by Hex editor and
Hex runtime surfaces. A Hex map is an authored map root with metadata,
hex tiles with biome IDs, and logical placements of World Planner locations.

The Hex context does not own Dungeon topology, party roster truth, encounter
simulation, campaign clocks, weather rules, or generic map-canvas rendering
contracts. It does own the Hex-specific interpretation of party-owned
overworld travel readback when the party location points at a Hex map.

## Write Model

- `HexMap` is the aggregate root for one authored map.
- `HexTile` is the authored coordinate inside one map and stores exactly one
  shared biome ID.
- `HexLocationPlacement` links one foreign World Planner location identity to
  exactly one tile without copying its name or notes.
- `HexJourney` owns one Scene-scoped runtime route, checkpoint, status, and
  presentation multiplier. Party continues to own character positions and
  Scene owns in-world time.
- `HexEditHistory` owns the latest twenty applied or undone content commands
  per map. It restores only Hex tiles, biome IDs, and location placements.

## Domain Vocabulary

### Map

A Hex map has a stable identity and a required display name. Its axial
coordinate space is intentionally unbounded. Reads request a bounded viewport;
the map persists only sparse authored tiles and markers. Empty
coordinates remain outside the authored map even when the renderer draws an
unbounded guide grid over them.

### Tile

A Hex tile belongs to exactly one Hex map. Tile identity is the map identity
plus axial coordinate `q,r`. V1 Hex maps are single-layer maps; no level or
Dungeon room coordinate participates in Hex tile identity.

Party-owned overworld travel state carries only `mapId` plus a stable
`tileId`. Hex translates that `tileId` to and from axial `q,r` through the
Hex-owned stable tile-id convention. Any safely representable integer axial
coordinate is valid; malformed tile IDs do not become active travel positions.

### Biome

Every authored tile stores exactly one shared biome ID; an absent tile has no
implicit biome. New paint operations start with Grassland as the UI default,
but persistence does not encode Grassland as a missing override. The installation-owned
catalog resolves label, color, passability, travel cost, legacy creature
aliases, and global Encounter Table links without copying those definitions
into map rows.

### World Planner Location Placement

A placement stores one World Planner location ID plus one map-owned axial
coordinate. The referenced name and notes are resolved through the World
Planner boundary. One location may occur globally at most once and one tile may
own at most one placement.

## Invariants

- A Hex map name MUST be nonblank.
- A Hex tile MUST reference an existing Hex map.
- A viewport read MUST be bounded even though map coordinates are not.
- An authored tile MUST carry exactly one existing built-in, custom, or
  protected replacement-placeholder biome ID.
- Party placement, World Planner location placement, and journey routes MUST
  reference authored tiles rather than empty axial coordinates.
- A placement MUST reference exactly one valid Hex tile and one World Planner
  location identity.
- map rows MUST NOT copy World Planner location display facts.
- a journey route remains on one map and advances only through adjacent,
  currently passable Hexes.
- Hex runtime readback MAY interpret party-owned overworld travel positions as
  Hex coordinates only through the Hex stable tile-id convention.
- undoing an erase MUST NOT reopen an aborted Journey or restore a Party
  position cleared by the original command.

## References

- [Hex Editor Requirements](../requirements/requirements-hex-editor.md)
- [Hex Persistence Contract](../contract/contract-hex-persistence.md)
