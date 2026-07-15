Status: Active
Owner: SaltMarcher Team
Last Reviewed: 2026-04-21
Source of Truth: Entry point and document map for the encounter table feature.

# Encounter Table Feature README

## Purpose

The encounter table feature owns read-only access to authored encounter-table
membership. It lets runtime encounter generation use curated creature pools
without making the encounter generator own catalog persistence.

## Documentation Set

- [Encounter Table Spec](requirements/requirements-encountertable.md)
- [Encounter Table Domain Model](domain/domain-encountertable.md)
- [Encounter Table Persistence](contract/contract-encountertable-persistence.md)
- [Encounter Feature Spec](../encounter/requirements/requirements-encounter.md)
- [Catalog Tab UI](../creatures/requirements/requirements-creatures-catalog.md)

## Scope

In scope:

- list encounter table summaries
- expose linked loot-table identifiers as read-only warning context
- load weighted encounter-generation candidates for selected table IDs

Out of scope:

- table editor and CRUD flows
- loot-table assignment UI
- persisted generated encounters
