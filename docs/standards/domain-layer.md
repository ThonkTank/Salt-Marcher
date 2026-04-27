Status: Deprecated
Owner: SaltMarcher Team
Last Reviewed: 2026-04-26
Source of Truth: Compatibility mirror for canonical documentation at `docs/project/architecture/domain-layer.md`.

# Domain Layer Compatibility Mirror

This legacy path remains build-visible during the documentation-taxonomy
migration. Canonical project-owned documentation lives at:

- [Domain Layer Standard](/home/aaron/Schreibtisch/projects/SaltMarcher/docs/project/architecture/domain-layer.md:1)
- [Domain Layer Role Catalog](/home/aaron/Schreibtisch/projects/SaltMarcher/docs/project/architecture/domain-layer-role-catalog.md:1)

## Context Roles

- `party`: `Context Role: Party Character State Context`. Owns roster truth,
  membership, XP progression, rest cadence, adventuring-day policy, and
  character-specific runtime travel state.
- `creatures`: `Context Role: Reference Catalog Context`. Exports imported
  creature catalog lookup language and reference profiles. It does not own
  encounter ranking, choice, or creature lifecycle truth.
- `encounter`: `Context Role: Roster Truth Context`. Owns saved
  encounter-plan roster truth, while also consuming party, creatures, and
  encounter-table reference data through their application services and
  published language for runtime encounter-generation policy.
- `encountertable`: `Context Role: Reference Catalog Context`. Publishes
  authored encounter-table membership as read-only generator input without
  owning creature truth, table mutation policy, or encounter-generation
  policy.
- `dungeon`: `Context Role: Authored World-Space Context`. Owns authored
  dungeon world-space truth, map topology, rooms or spaces, connections,
  stable identity, and map mutation rules.

## Context Relationships

- `party`: `Party Character State Context`. Publishes roster, membership, XP,
  rest cadence, adventuring-day facts, and character travel position facts to
  downstream contexts.
- `creatures`: `Reference Catalog Context`. Publishes imported creature
  catalog lookup facts and encounter-candidate reference profiles to
  downstream policy contexts.
- `encounter`: `Roster Truth Context`. Consumes `party`, `creatures`, and
  `encountertable` through their root application services and `published/`
  carriers for generation, and owns saved encounter-plan roster truth.
- `encountertable`: `Reference Catalog Context`. Consumes creature
  persistence snapshots through its data source adapter, then publishes table
  summaries and weighted candidate rows through its root application service.
- `dungeon`: `Authored World-Space Context`. Owns authored world-space truth
  independently of party, creatures, and encounter. Views may combine dungeon
  facts with presentation state, but that composition is not a domain
  relationship.

## References

- [Domain Layer Standard](/home/aaron/Schreibtisch/projects/SaltMarcher/docs/project/architecture/domain-layer.md:1)
- [Domain Layer Role Catalog](/home/aaron/Schreibtisch/projects/SaltMarcher/docs/project/architecture/domain-layer-role-catalog.md:1)
