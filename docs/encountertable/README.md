# Encounter Table

Status: Active migration summary
Owner: Encounter Table
Last Reviewed: 2026-07-28
Source of Truth: The linked owner documents

Encounter Table is the Campaign-owned source capability for named, weighted
Monster pools. Godot currently provides bounded Catalog browsing, full detail,
create/edit with provider-selected Creature membership, World Planner
references, recoverable delete/restore with atomic dependent-reference cleanup,
and weighted candidate evaluation against current Creature facts.

Encounter generation now consumes selected tables through a pure source read
that exposes only membership IDs, effective weights, and linked Loot IDs. It
shows provenance and a non-blocking conflict when several Loot IDs are present.
Group entries, visible Loot Table authoring/selection, and resolved Loot
assignment remain migration work. The legacy Java/SQLite implementation is not
target architecture.

## Documentation Set

- [Requirements](requirements/requirements-encountertable.md)
- [Domain Model](domain/domain-encountertable.md)
- [Persistence Contract](contract/contract-encountertable-persistence.md)
- [Encounter Requirements](../encounter/requirements/requirements-encounter.md)
- [Catalog Requirements](../catalog/requirements/requirements-catalog.md)
