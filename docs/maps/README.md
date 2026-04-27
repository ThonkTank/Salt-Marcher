Status: Draft
Owner: SaltMarcher Team
Last Reviewed: 2026-04-24
Source of Truth: Routing entrypoint for the generic maps feature bundle.

# Maps Feature Docs

## Purpose

The `maps` feature owns the generic map canvas that multiple adopting features
can use. It defines the passive canvas surface, the shared canvas contract, and
the adopter architecture for translating between canvas coordinates and each
adopter's internal coordinate system.

It does not own adopter domain truth, adopter persistence truth, or adopter
gameplay semantics.

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

- [Dungeon Feature Overview](/home/aaron/Schreibtisch/projects/SaltMarcher/docs/dungeon/README.md:1)
- [Hex Feature Overview](/home/aaron/Schreibtisch/projects/SaltMarcher/docs/hex/README.md:1)
