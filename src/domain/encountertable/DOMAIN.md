Status: Deprecated
Owner: SaltMarcher Team
Last Reviewed: 2026-05-08
Source of Truth: Compatibility mirror for canonical documentation at `docs/encountertable/domain/domain-encountertable.md`.

# Encounter Table Domain Model Compatibility Mirror

This legacy path remains build-visible during the documentation-taxonomy
migration. Canonical feature-owned documentation lives at:

- [Encounter Table Domain Model](docs/encountertable/domain/domain-encountertable.md:1)

## Context Role

Context Role: Reference Catalog Context
Context Name: EncounterTable

- `encountertable` publishes authored encounter-table membership as a
  read-only reference catalog for generator candidate pools.
- It does not own creature truth or loot truth.
- It exposes encounter-table summaries and weighted candidate rows through its
  own application service.

## Published Language

`published/` owns encounter-table summaries, candidate rows, list results, and
read status vocabulary.

Published candidate rows carry creature snapshot fields needed by encounter
generation plus the selected table weight. They do not expose table-entry
mutation commands.

## Application Boundary

Application Service: EncounterTableApplicationService

`EncounterTableApplicationService` is the only public backend boundary. It
offers summary and generation-candidate lookup over authored encounter-table
membership without leaking adapter exceptions.

## Ubiquitous Language

- Encounter Table: authored grouping of weighted creature entries used as a
  generation source.
- Table Summary: user-facing table identity and linked-loot context.
- Candidate Row: read-only creature snapshot plus encounter-table weight.

## References

- [Encounter Table Domain Model](docs/encountertable/domain/domain-encountertable.md:1)
