Status: Active
Owner: SaltMarcher Team
Last Reviewed: 2026-07-19
Source of Truth: Routing entrypoint for the dungeon gameplay and domain
documentation bundle.

# Dungeon Feature Docs

## Purpose

The dungeon feature owns authored dungeon truth, dungeon travel runtime
behavior, dungeon editor behavior, and dungeon persistence truth.

Generic passive map-canvas mechanisms live in `platform.ui.mapcanvas`; the
Dungeon architecture owns how its API facts adopt those mechanisms.

## Document Set

### Agent Reading Order

1. Start here to find the owning document family.
2. Read [Dungeon Architecture](./architecture/architecture-dungeon-domain.md)
   for feature ownership, authored-core boundaries, runtime capabilities, and
   dependency direction.
3. Read [Dungeon Domain Model](./domain/domain-dungeon.md) for domain truth,
   write-model ownership, API language, and invariants.
4. Read the relevant requirements document for user-visible behavior. Executable
   evidence lives in the matching JUnit tests.

### Architecture

- [Dungeon Domain Architecture](./architecture/architecture-dungeon-domain.md)

### Requirements

- [Dungeon Feature Requirements](./requirements/requirements-dungeon.md)
- [Dungeon Editor Requirements](./requirements/requirements-dungeon-editor.md)
- [Dungeon Travel State Requirements](./requirements/requirements-dungeon-travel-state.md)
- [Dungeon Travel Requirements](./requirements/requirements-dungeon-travel.md)

### Contracts

- [Dungeon Persistence Contract](./contract/contract-dungeon-persistence.md)

### Domain

- [Dungeon Domain Model](./domain/domain-dungeon.md)

### Related Map Canvas Docs

- [Map Canvas Overview](../maps/README.md) (line 1)
- [Dungeon Map Adoption Architecture](../maps/architecture/architecture-maps-dungeon-adoption.md) (line 1)
- [Dungeon Map Surface Contract](../maps/contract/contract-maps-dungeon-surface.md) (line 1)
- [Maps Canvas Requirements](../maps/requirements/requirements-maps-canvas.md) (line 1)
