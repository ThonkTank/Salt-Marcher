Status: Active Target
Owner: SaltMarcher Team
Last Reviewed: 2026-04-24
Source of Truth: Routing entrypoint for the generic passive map-canvas bundle.

# Map Canvas Docs

## Purpose

`platform.ui.mapcanvas` owns feature-neutral camera, viewport, layered-canvas,
cache, and technical pointer mechanisms that multiple map surfaces can use.
This bundle defines those passive mechanisms and adopter translation.

It is not a product feature, has no application lifecycle or feature API, and
does not own adopter domain, persistence, or gameplay semantics.

## Document Set

### Requirements

- [Maps Canvas Requirements](./requirements/requirements-maps-canvas.md)

### Architecture

- [Maps Canvas Architecture](./architecture/architecture-maps-canvas.md)
- [Dungeon Map Adoption Architecture](./architecture/architecture-maps-dungeon-adoption.md)
- [Hex Map Adoption Architecture](./architecture/architecture-maps-hex-adoption.md)

### Contracts

- [Maps Canvas Contract](./contract/contract-maps-canvas.md)
- [Dungeon Map Surface Contract](./contract/contract-maps-dungeon-surface.md)

## Current And Planned Adopters

- dungeon: current SaltMarcher adopter with active requirement, contract, and
  domain documentation under `docs/dungeon/`
- hex: target SaltMarcher adopter with feature-level requirements under
  `docs/hex/`

## References

- [Dungeon Feature Overview](../dungeon/README.md) (line 1)
- [Hex Feature Overview](../hex/README.md) (line 1)
