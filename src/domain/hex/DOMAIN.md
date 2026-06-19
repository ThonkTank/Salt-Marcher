Status: Deprecated
Owner: SaltMarcher Team
Last Reviewed: 2026-06-18
Source of Truth: Compatibility mirror for canonical Hex domain documentation at
`docs/hex/domain/domain-hex-map.md`.

# Hex Domain Context Mirror

This path remains build-visible for domain-context enforcement. It is not the
canonical long-form Hex documentation.

Canonical documents:

- [Hex Feature Docs](/home/aaron/Schreibtisch/projects/SaltMarcher/docs/hex/README.md:1)
- [Hex Domain Model](/home/aaron/Schreibtisch/projects/SaltMarcher/docs/hex/domain/domain-hex-map.md:1)
- [Hex Persistence Contract](/home/aaron/Schreibtisch/projects/SaltMarcher/docs/hex/contract/contract-hex-persistence.md:1)
- [Hex Editor Verification](/home/aaron/Schreibtisch/projects/SaltMarcher/docs/hex/verification/verification-hex-editor.md:1)

## Context Role

Context Role: Authored Hex Map Context
Context Name: Hex

- `hex` owns authored overworld-style hex map truth for the Hex editor.
- `HexMap` is the aggregate root.
- Detailed write-model ownership and invariants live in the Hex domain model
  document.
- Persistence semantics live in the Hex persistence contract.

## Published Language

`published/` owns public Hex editor commands, identifiers, terrain and marker
vocabulary, editor snapshots, and the read-only Hex editor observation model.

Published Hex carriers must not own render layers, display styling, SQL rows,
Dungeon topology refs, or runtime travel state.

## Application Boundary

Application Service: HexEditorApplicationService

The root application service coordinates map creation, map selection, metadata
edits, tile selection, terrain painting, marker persistence, and editor-tool
state through the Hex domain and repository ownership. Public readback is
published separately through the exported Hex editor model.

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

Core invariants:

- a Hex map name is nonblank
- a Hex map radius is nonnegative
- every tile coordinate is inside the owning map radius
- every terrain override belongs to exactly one valid Hex tile
- every marker belongs to exactly one valid Hex tile
- marker name and marker type are required
- marker note is optional
- Hex markers do not reuse Dungeon feature-marker semantics

## Cross-Context Boundary

- `hex` owns authored Hex editor state independently of Dungeon authored map
  truth and party travel state.
- `hex` does not own runtime travel, compact `Reise` tab state, encounter
  simulation, campaign time, or weather.

## Consistency Model

Only authored map metadata, tile coordinates, terrain overrides, and marker
state may persist as Hex map truth. Editor readback, visible tool state, and
future runtime projections must be recomputed from Hex-owned domain state or
routed through their own canonical owners.

## Ubiquitous Language

- `HexMap`: authored Hex aggregate for one overworld-style map.
- `HexMapId`: stable authored map identity.
- `HexTile`: map-scoped axial coordinate.
- `HexTerrainOverride`: authored terrain choice for one tile.
- `HexMarker`: simple named place marker owned by one tile.

## References

- [Hex Feature Docs](/home/aaron/Schreibtisch/projects/SaltMarcher/docs/hex/README.md:1)
- [Hex Domain Model](/home/aaron/Schreibtisch/projects/SaltMarcher/docs/hex/domain/domain-hex-map.md:1)
- [Hex Persistence Contract](/home/aaron/Schreibtisch/projects/SaltMarcher/docs/hex/contract/contract-hex-persistence.md:1)
- [Hex Editor Verification](/home/aaron/Schreibtisch/projects/SaltMarcher/docs/hex/verification/verification-hex-editor.md:1)
