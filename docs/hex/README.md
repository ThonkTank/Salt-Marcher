Status: Draft
Owner: SaltMarcher Team
Last Reviewed: 2026-04-24
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

### Related Maps Docs

- [Maps Feature Overview](/home/aaron/Schreibtisch/projects/SaltMarcher/docs/maps/README.md:1)
- [Maps Canvas Requirements](/home/aaron/Schreibtisch/projects/SaltMarcher/docs/maps/requirements/requirements-maps-canvas.md:1)
- [Hex Map Adoption Architecture](/home/aaron/Schreibtisch/projects/SaltMarcher/docs/maps/architecture/architecture-maps-hex-adoption.md:1)

## Current State

- SaltMarcher now ships a first-class navigable Hex Map root under
  `src/view/leftbartabs/hexmap`. The current `Hex-Karte` surface is an
  unloaded placeholder that makes the feature reachable from the left sidebar.
- SaltMarcher does not yet ship loaded hex-map data, interactive hex travel,
  tile inspection, terrain editing, or a compact hex travel-state readout.
- The sibling `salt-marcher` repo provides the current user-facing evidence for
  hex travel, compact travel context, tile inspection, and terrain editing.

## References

- [Maps Feature Overview](/home/aaron/Schreibtisch/projects/SaltMarcher/docs/maps/README.md:1)
