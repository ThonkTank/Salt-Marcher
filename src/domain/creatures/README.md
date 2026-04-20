Status: Active
Owner: SaltMarcher Team
Last Reviewed: 2026-04-20
Source of Truth: Entry point and document map for the creatures feature.

# Creatures Feature README

## Purpose

The creatures feature owns read-only creature catalog access for reference and
encounter-generation workflows.

Its public backend surface is split into:

- `src/domain/creatures/CreaturesApplicationService.java` as the creatures
  application-service root
- `src/domain/creatures/published/` for public query, result, status, and payload
  types consumed by view and domain callers
- `src/domain/creatures/application/` plus the owning domain modules for the
  feature's exported supporting lookup coordination and outbound ports

## Documentation Set

- [Creatures Domain Model](/home/aaron/Schreibtisch/projects/SaltMarcher/src/domain/creatures/DOMAIN.md:1)
- [Creatures Persistence](/home/aaron/Schreibtisch/projects/SaltMarcher/src/data/creatures/PERSISTENCE.md:1)
- [Catalog Tab UI](/home/aaron/Schreibtisch/projects/SaltMarcher/src/view/leftbartabs/catalog/UI.md:1)
- [Creature Details UI](/home/aaron/Schreibtisch/projects/SaltMarcher/src/view/slotcontent/details/creature/UI.md:1)

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
