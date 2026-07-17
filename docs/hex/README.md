Status: Draft
Owner: SaltMarcher Team
Last Reviewed: 2026-07-15
Source of Truth: Routing entrypoint for the hex gameplay and presentation
documentation bundle.

# Hex Feature Docs

## Purpose

The `hex` feature owns hex-map-specific user-facing behavior such as overworld
travel, the compact travel-state surface shown in the runtime `Reise` tab,
tile inspection, and hex editor behavior.

Generic shared map-canvas behavior remains canonical in `docs/maps/`.

## Document Set

### Requirements

- [Hex Feature Requirements](./requirements/requirements-hex.md)
- [Hex Travel Requirements](./requirements/requirements-hex-travel.md)
- [Hex Travel State Requirements](./requirements/requirements-hex-travel-state.md)
- [Hex Editor Requirements](./requirements/requirements-hex-editor.md)

### Domain

- [Hex Map Domain](./domain/domain-hex-map.md)

### Contract

- [Hex Persistence Contract](./contract/contract-hex-persistence.md)

### Related Maps Docs

- [Map Canvas Overview](../maps/README.md) (line 1)
- [Maps Canvas Requirements](../maps/requirements/requirements-maps-canvas.md) (line 1)
- [Hex Map Adoption Architecture](../maps/architecture/architecture-maps-hex-adoption.md) (line 1)

## Current State

- SaltMarcher ships a first-class navigable Hex Map root. The `Hex-Karte`
  surface can create maps,
  edit map metadata, inspect tiles, paint terrain, place simple tile-owned
  markers, show the party token on the Hex map, and move the existing party
  token through a Hex-owned `Reisegruppe` tool.
- The runtime `Reise` state tab consumes compact Hex travel readback when the
  party token points at a valid Hex tile. Weather and time-of-day values remain
  unavailable until a later travel-context source publishes them.

## References

- [Map Canvas Overview](../maps/README.md) (line 1)
