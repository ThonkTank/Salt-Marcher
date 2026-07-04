Status: Draft
Owner: SaltMarcher Team
Last Reviewed: 2026-06-26
Source of Truth: Entry point and document map for the World Planner feature.

# World Planner Feature Docs

## Purpose

The `worldplanner` feature owns authored campaign-world planning records for
NPCs, factions, and locations.

It stores World Planner-owned notes, lifecycle state, relationships, and source
constraints. It references creature statblocks and encounter tables through
their owning public boundaries, and exposes location choices for later
Session Planner-owned integration. It does not own creature statblocks,
encounter rosters, party truth, combat runtime state, session records, dungeon
maps, or hex maps.

## Document Set

### Requirements

- [World Planner Requirements](./requirements/requirements-world-planner.md)

### Architecture

- [World Planner Architecture](./architecture/architecture-world-planner.md)

### Contract

- [World Planner Persistence Contract](./contract/contract-world-planner-persistence.md)

### Domain

- [World Planner Domain Model](./domain/domain-world-planner.md)

### Verification

- [World Planner Verification](./verification/verification-world-planner.md)

## References

- [Creatures Feature Overview](docs/creatures/README.md:1)
- [Encounter Feature Overview](docs/encounter/README.md:1)
- [Encounter Table Feature Overview](docs/encountertable/README.md:1)
- [Session Planner Feature Overview](docs/sessionplanner/README.md:1)
