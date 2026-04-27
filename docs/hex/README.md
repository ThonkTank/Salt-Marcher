Status: Draft
Owner: SaltMarcher Team
Last Reviewed: 2026-04-24
Source of Truth: Routing entrypoint for the hex gameplay and presentation
documentation bundle.

# Hex Feature Docs

## Purpose

The `hex` feature owns hex-map-specific user-facing behavior such as overworld
travel, compact `Reise` state, tile inspection, and hex editor behavior.

Generic shared map-canvas behavior remains canonical in `docs/maps/`.

## Document Set

### Requirements

- [Hex Feature Requirements](./requirements/requirements-hex.md)
- [Hex Travel Requirements](./requirements/requirements-hex-travel.md)
- [Hex Reise Requirements](./requirements/requirements-hex-reise.md)
- [Hex Editor Requirements](./requirements/requirements-hex-editor.md)

### Related Maps Docs

- [Maps Feature Overview](/home/aaron/Schreibtisch/projects/SaltMarcher/docs/maps/README.md:1)
- [Maps Canvas Requirements](/home/aaron/Schreibtisch/projects/SaltMarcher/docs/maps/requirements/requirements-maps-canvas.md:1)
- [Hex Map Adoption Architecture](/home/aaron/Schreibtisch/projects/SaltMarcher/docs/maps/architecture/architecture-maps-hex-adoption.md:1)

## Current State

- SaltMarcher does not yet ship a first-class hex feature bundle in `src/`.
- The sibling `salt-marcher` repo provides the current user-facing evidence for
  hex travel, compact travel context, tile inspection, and terrain editing.

## References

- [Maps Feature Overview](/home/aaron/Schreibtisch/projects/SaltMarcher/docs/maps/README.md:1)
