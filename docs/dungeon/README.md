# Dungeon Feature Docs

## Purpose

The dungeon feature owns authored dungeon truth, dungeon travel runtime
behavior, dungeon editor behavior, and dungeon persistence truth.

Generic passive map-canvas mechanisms live in `platform.ui.mapcanvas`; the
Dungeon architecture owns how its API facts adopt those mechanisms.

## Document Set

### Reading Order

1. Start here to find the owning document family.
2. Read [Dungeon Domain Model](./domain/domain-dungeon.md) for domain truth,
   write-model ownership, API language, and invariants.
4. Read the relevant requirements document for user-visible behavior.

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
- [Maps Canvas Requirements](../maps/requirements/requirements-maps-canvas.md) (line 1)

### Related Actor Autonomy Docs

- [Actor Autonomy Overview](../autonomy/README.md)
- [Actor Autonomy Requirements](../autonomy/requirements/requirements-actor-autonomy.md)
