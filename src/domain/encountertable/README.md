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

- [Encounter Table Spec](/home/aaron/Schreibtisch/projects/SaltMarcher/src/domain/encountertable/SPEC.md:1)
- [Encounter Table Domain Model](/home/aaron/Schreibtisch/projects/SaltMarcher/src/domain/encountertable/DOMAIN.md:1)
- [Encounter Table Persistence](/home/aaron/Schreibtisch/projects/SaltMarcher/src/data/encountertable/PERSISTENCE.md:1)
- [Encounter Feature Spec](/home/aaron/Schreibtisch/projects/SaltMarcher/src/domain/encounter/SPEC.md:1)
- [Catalog Tab UI](/home/aaron/Schreibtisch/projects/SaltMarcher/src/view/leftbartabs/catalog/UI.md:1)

## Scope

In scope:

- list encounter table summaries
- expose linked loot-table identifiers as read-only warning context
- load weighted encounter-generation candidates for selected table IDs

Out of scope:

- table editor and CRUD flows
- loot-table assignment UI
- persisted generated encounters
