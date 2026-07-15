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

## References

- [Creatures Feature Overview](../creatures/README.md) (line 1)
- [Encounter Feature Overview](../encounter/README.md) (line 1)
- [Encounter Table Feature Overview](../encountertable/README.md) (line 1)
- [Session Planner Feature Overview](../sessionplanner/README.md) (line 1)
