Status: Draft
Owner: SaltMarcher Team
Last Reviewed: 2026-06-04
Source of Truth: Routing entrypoint for the dungeon gameplay and domain
documentation bundle.

# Dungeon Feature Docs

## Purpose

The dungeon feature owns authored dungeon truth, dungeon travel runtime
behavior, dungeon editor behavior, and dungeon persistence truth.

Generic map-canvas behavior and dungeon map-surface adoption now live in
`docs/maps/`.

## Document Set

### Requirements

- [Dungeon Feature Requirements](./requirements/requirements-dungeon.md)
- [Dungeon Editor Requirements](./requirements/requirements-dungeon-editor.md)
- [Dungeon Travel State Requirements](./requirements/requirements-dungeon-travel-state.md)
- [Dungeon Travel Requirements](./requirements/requirements-dungeon-travel.md)

### Contracts

- [Dungeon Persistence Contract](./contract/contract-dungeon-persistence.md)

### Domain

- [Dungeon Domain Model](./domain/domain-dungeon.md)

### Verification

- [Dungeon Core Model Invariants](./verification/verification-dungeon-core-model-invariants.md)

### Delivery

- [Dungeon Delivery Notes](./delivery/delivery-dungeon.md)

### Related Maps Docs

- [Maps Feature Overview](/home/aaron/Schreibtisch/projects/SaltMarcher/docs/maps/README.md:1)
- [Dungeon Map Adoption Architecture](/home/aaron/Schreibtisch/projects/SaltMarcher/docs/maps/architecture/architecture-maps-dungeon-adoption.md:1)
- [Dungeon Map Surface Contract](/home/aaron/Schreibtisch/projects/SaltMarcher/docs/maps/contract/contract-maps-dungeon-surface.md:1)
- [Maps Canvas Requirements](/home/aaron/Schreibtisch/projects/SaltMarcher/docs/maps/requirements/requirements-maps-canvas.md:1)
