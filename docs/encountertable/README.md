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

- [Encounter Table Spec](/home/aaron/Schreibtisch/projects/SaltMarcher/docs/encountertable/requirements/requirements-encountertable.md:1)
- [Encounter Table Domain Model](/home/aaron/Schreibtisch/projects/SaltMarcher/docs/encountertable/domain/domain-encountertable.md:1)
- [Encounter Table Persistence](/home/aaron/Schreibtisch/projects/SaltMarcher/docs/encountertable/contract/contract-encountertable-persistence.md:1)
- [Encounter Feature Spec](/home/aaron/Schreibtisch/projects/SaltMarcher/docs/encounter/requirements/requirements-encounter.md:1)
- [Catalog Tab UI](/home/aaron/Schreibtisch/projects/SaltMarcher/docs/creatures/requirements/requirements-creatures-catalog.md:1)

## Scope

In scope:

- list encounter table summaries
- expose linked loot-table identifiers as read-only warning context
- load weighted encounter-generation candidates for selected table IDs

Out of scope:

- table editor and CRUD flows
- loot-table assignment UI
- persisted generated encounters
