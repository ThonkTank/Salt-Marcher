Status: Active
Owner: SaltMarcher Team
Last Reviewed: 2026-06-07
Source of Truth: Routing entrypoint for the dungeon gameplay and domain
documentation bundle.

# Dungeon Feature Docs

## Purpose

The dungeon feature owns authored dungeon truth, dungeon travel runtime
behavior, dungeon editor behavior, and dungeon persistence truth.

Generic map-canvas behavior and dungeon map-surface adoption now live in
`docs/maps/`.

## Document Set

### Agent Reading Order

1. Start here to find the owning document family.
2. Read [Dungeon Domain Architecture](./architecture/architecture-dungeon-domain.md)
   for `src/domain/dungeon/**` structure, model families, and dependency
   direction.
3. Read [Dungeon Domain Model](./domain/domain-dungeon.md) for domain truth,
   write-model ownership, published language, and invariants.
4. Read the relevant requirements document for user-visible behavior, then the
   matching verification catalog for proof rows.

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

### Verification

Shared proof routing:

- [Dungeon Core Model Invariants](./verification/verification-dungeon-core-model-invariants.md)
- [Dungeon Editor-Wide Invariants](./verification/verification-dungeon-editor-wide-invariants.md)
- [Dungeon Editor Fixture Catalog](./verification/verification-dungeon-editor-fixtures.md)

Model family invariant catalogs:

- [Dungeon Cluster Invariants](./verification/verification-dungeon-cluster-invariants.md)
- [Dungeon Corridor Invariants](./verification/verification-dungeon-corridor-invariants.md)
- [Dungeon Door Invariants](./verification/verification-dungeon-door-invariants.md)
- [Dungeon Floor Invariants](./verification/verification-dungeon-floor-invariants.md)
- [Dungeon Path Invariants](./verification/verification-dungeon-path-invariants.md)
- [Dungeon Room Invariants](./verification/verification-dungeon-room-invariants.md)
- [Dungeon Stair Invariants](./verification/verification-dungeon-stair-invariants.md)
- [Dungeon Transition Invariants](./verification/verification-dungeon-transition-invariants.md)
- [Dungeon Wall Invariants](./verification/verification-dungeon-wall-invariants.md)

Editor tool matrices:

- [Dungeon Editor Map, Projection, And Controls Matrix](./verification/verification-dungeon-editor-map-controls.md)
- [Dungeon Editor Selection Matrix](./verification/verification-dungeon-editor-selection.md)
- [Dungeon Editor Room Matrix](./verification/verification-dungeon-editor-rooms.md)
- [Dungeon Editor Cluster Matrix](./verification/verification-dungeon-editor-clusters.md)
- [Dungeon Editor Wall Matrix](./verification/verification-dungeon-editor-walls.md)
- [Dungeon Editor Door Matrix](./verification/verification-dungeon-editor-doors.md)
- [Dungeon Editor Corridor Matrix](./verification/verification-dungeon-editor-corridors.md)
- [Dungeon Editor Stair Matrix](./verification/verification-dungeon-editor-stairs.md)
- [Dungeon Editor Transition Matrix](./verification/verification-dungeon-editor-transitions.md)
- [Dungeon Editor Handle Matrix](./verification/verification-dungeon-editor-handles.md)
- [Dungeon Editor Label Matrix](./verification/verification-dungeon-editor-labels.md)

Travel matrices:

- [Dungeon Travel Map And Projection Controls Matrix](./verification/verification-dungeon-travel-map-controls.md)

### Delivery

- [Dungeon Delivery Notes](./delivery/delivery-dungeon.md)

### Related Maps Docs

- [Maps Feature Overview](docs/maps/README.md:1)
- [Dungeon Map Adoption Architecture](docs/maps/architecture/architecture-maps-dungeon-adoption.md:1)
- [Dungeon Map Surface Contract](docs/maps/contract/contract-maps-dungeon-surface.md:1)
- [Maps Canvas Requirements](docs/maps/requirements/requirements-maps-canvas.md:1)
