Status: Draft
Owner: SaltMarcher Team
Last Reviewed: 2026-07-19
Source of Truth: Routing entrypoint for the hex gameplay and presentation
documentation bundle.

# Hex Feature Docs

## Purpose

The `hex` feature owns hex-map-specific user-facing behavior such as overworld
travel, compact Hex travel readback, tile inspection, and hex editor behavior.
The feature-neutral Travel capability selects that readback for the runtime
`Reise` tab when the party occupies a Hex location.

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

## References

- [Map Canvas Overview](../maps/README.md) (line 1)
