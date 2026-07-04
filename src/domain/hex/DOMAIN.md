Status: Deprecated
Owner: SaltMarcher Team
Last Reviewed: 2026-06-18
Source of Truth: Compatibility mirror for canonical Hex domain documentation at
`docs/hex/domain/domain-hex-map.md`.

# Hex Domain Context Mirror

This path remains build-visible for domain-context enforcement. It is not the
canonical long-form Hex documentation.

Canonical documents:

- [Hex Feature Docs](docs/hex/README.md:1)
- [Hex Domain Model](docs/hex/domain/domain-hex-map.md:1)
- [Hex Persistence Contract](docs/hex/contract/contract-hex-persistence.md:1)
- [Hex Editor Verification](docs/hex/verification/verification-hex-editor.md:1)
- [Hex Travel Verification](docs/hex/verification/verification-hex-travel.md:1)

## Context Role

Context Role: Authored Hex Map Context
Context Name: Hex

- `hex` owns authored overworld-style hex map truth for the Hex editor and
  the Hex-specific interpretation of party-owned overworld travel positions.
- `HexMap` is the aggregate root.
- Detailed write-model ownership and invariants live in the Hex domain model
  document.
- Persistence semantics live in the Hex persistence contract.

## Published Language

`published/` owns public Hex editor commands, identifiers, terrain and marker
vocabulary, editor snapshots, the read-only Hex editor observation model,
party-token movement commands, and the Hex travel readback model.

Published Hex carriers must not own render layers, display styling, SQL rows,
Dungeon topology refs, party roster truth, campaign clocks, or weather rules.

## Application Boundary

Application Service: HexEditorApplicationService
Application Service: HexTravelApplicationService

The editor root application service coordinates map creation, map selection,
metadata edits, tile selection, terrain painting, marker persistence, and
editor-tool state through the Hex domain and repository ownership. The travel
root application service interprets Hex party-token movement commands and
delegates the foreign party-position update through a Hex-owned repository
boundary. Public readback is published separately through exported Hex models.

## Aggregate Model

Aggregate Root: HexMap

`HexMap` owns one authored map's display name, radius, valid axial tiles,
terrain overrides, and simple tile-owned markers.

## Commands And Invariants

Commands entering the model are:

- create map
- load editor state
- select map
- edit map metadata
- select tile
- paint terrain
- save marker
- set active editor tool
- move the existing party token to a Hex tile

Core invariants:

- a Hex map name is nonblank
- a Hex map radius is nonnegative
- every tile coordinate is inside the owning map radius
- every terrain override belongs to exactly one valid Hex tile
- every marker belongs to exactly one valid Hex tile
- marker name and marker type are required
- marker note is optional
- Hex markers do not reuse Dungeon feature-marker semantics
- party-owned overworld travel tile ids are interpreted through the Hex stable
  tile-id convention

## Cross-Context Boundary

- `hex` owns authored Hex editor state independently of Dungeon authored map
  truth.
- `hex` owns the Hex-specific projection of party-owned overworld travel
  positions when they reference a valid Hex map and tile id.
- `hex` does not own party roster truth, Dungeon travel semantics, encounter
  simulation, campaign time, or weather.
- The compact runtime `Reise` state tab owns its shared shell; Hex owns only
  the feature-specific readback consumed there.

## Consistency Model

Only authored map metadata, tile coordinates, terrain overrides, and marker
state may persist as Hex map truth. Editor readback, visible tool state, and
Hex travel projections are recomputed from Hex-owned map state plus approved
party-owned travel readback rather than persisted as Hex map truth.

## Ubiquitous Language

- `HexMap`: authored Hex aggregate for one overworld-style map.
- `HexMapId`: stable authored map identity.
- `HexTile`: map-scoped axial coordinate.
- `HexTerrainOverride`: authored terrain choice for one tile.
- `HexMarker`: simple named place marker owned by one tile.
- `HexTravelModel`: published readback of an active party-owned overworld
  travel position when it resolves to a valid Hex tile.

## References

- [Hex Feature Docs](docs/hex/README.md:1)
- [Hex Domain Model](docs/hex/domain/domain-hex-map.md:1)
- [Hex Persistence Contract](docs/hex/contract/contract-hex-persistence.md:1)
- [Hex Editor Verification](docs/hex/verification/verification-hex-editor.md:1)
- [Hex Travel Verification](docs/hex/verification/verification-hex-travel.md:1)
