Status: Draft
Owner: SaltMarcher Team
Last Reviewed: 2026-06-18
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

### Verification

- [Hex Editor Verification](./verification/verification-hex-editor.md)

### Related Maps Docs

- [Maps Feature Overview](/home/aaron/Schreibtisch/projects/SaltMarcher/docs/maps/README.md:1)
- [Maps Canvas Requirements](/home/aaron/Schreibtisch/projects/SaltMarcher/docs/maps/requirements/requirements-maps-canvas.md:1)
- [Hex Map Adoption Architecture](/home/aaron/Schreibtisch/projects/SaltMarcher/docs/maps/architecture/architecture-maps-hex-adoption.md:1)

## Current State

- SaltMarcher now ships a first-class navigable Hex Map editor root under
  `src/view/leftbartabs/hexmap`. The `Hex-Karte` surface can create maps,
  edit map metadata, inspect tiles, paint terrain, and place simple tile-owned
  markers through Hex domain and SQLite persistence routes.
- SaltMarcher does not yet ship interactive hex travel or a compact hex
  travel-state readout.
- Local editor behavior is owned by this SaltMarcher Hex documentation bundle;
  interactive hex travel and compact travel-state context remain unimplemented
  future scopes.

## References

- [Maps Feature Overview](/home/aaron/Schreibtisch/projects/SaltMarcher/docs/maps/README.md:1)
