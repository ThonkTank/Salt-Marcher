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

## Adopters

- Dungeon adopts the passive canvas through its feature-owned translation and
  documents its behavior, contracts, and domain under `docs/dungeon/`.
- Hex adopts the passive canvas through its feature-owned translation and
  documents its behavior and domain under `docs/hex/`.

## References

- [Dungeon Feature Overview](../dungeon/README.md) (line 1)
- [Hex Feature Overview](../hex/README.md) (line 1)
