Status: Active
Owner: SaltMarcher Team
Last Reviewed: 2026-04-17
Source of Truth: Entry point and document map for the creatures feature.

# Creatures Feature README

## Purpose

The creatures feature owns read-only creature catalog access for reference and
encounter-generation workflows.

## Documentation Set

- [Creatures Persistence](/home/aaron/Schreibtisch/projects/SaltMarcher/src/data/creatures/PERSISTENCE.md:1)
- [Creatures UI](/home/aaron/Schreibtisch/projects/SaltMarcher/src/view/creatures/UI.md:1)

## Scope

In scope:

- catalog browsing and filtering
- creature detail lookup
- encounter-ready candidate lookup for downstream runtime features
- shared creature filter controls consumed by encounter-facing tabs

Out of scope:

- authored encounter generation policy
- party balancing rules
- shell-wide interaction policy
