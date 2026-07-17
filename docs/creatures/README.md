Status: Active Target
Owner: SaltMarcher Team
Last Reviewed: 2026-04-20
Source of Truth: Entry point and document map for the creatures feature.

# Creatures Feature README

## Purpose

The creatures feature owns read-only creature catalog access for reference and
encounter-generation workflows.

Its public backend surfaces are `CreaturesApi`, `CreatureCatalogQueryApi`, the
revisioned `CreatureReferenceIndexModel`, and the synchronous single-detail
`CreatureReferenceApi`; implementation packages remain feature-private.

## Documentation Set

- [Creatures Domain Model](domain/domain-creatures.md)
- [Creatures Persistence](contract/contract-creatures-persistence.md)
- [Catalog Tab UI](requirements/requirements-creatures-catalog.md)
- [Creature Details UI](requirements/requirements-creatures-details.md)

## Scope

In scope:

- catalog browsing and filtering
- creature detail lookup
- encounter-ready candidate lookup for downstream runtime features
- shared creature filter controls consumed by encounter-facing tabs
- one full immutable reference index for foreign selectors and projections

Out of scope:

- authored encounter generation policy
- party balancing rules
- shell-wide interaction policy
