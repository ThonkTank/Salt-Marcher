Status: Active Target
Owner: SaltMarcher Team
Last Reviewed: 2026-07-26
Source of Truth: Persistence path and schema ownership rules for the `party`
feature.

# Party Persistence

This document is normative for the `party` feature's persistence path.

## Adapter Boundary

- The party SQLite adapter satisfies party-owned application ports and remains
  private to the party composition entry point.
- The application composition supplies `PartyApi` explicitly to consumers; no
  registry, discovery convention, published mutable model, or adapter type is
  a public boundary.
- SQL rows, mappers, gateways, and schema helpers MUST NOT cross `PartyApi`.

## Mandatory Schema

- The feature-owned persistence schema declaration is the canonical in-code
  schema owner.
- The schema currently owns:
  - `player_characters`
  - `party_roster_metadata`
- `player_characters` stores character-owned travel columns for dungeon and
  overworld locations plus the party-token attachment flag. These columns are
  part of character state, not a campaign-level travel table and not dungeon
  authored truth.
- owner startup creates the complete current schema directly as owner version
  `1`, and only when the Party object namespace is empty
- startup validates the exact table definitions and complete Party-owned object
  inventory before the store becomes ready

## Current Mapping

Party persistence stores the character roster, membership, progression, combat
profile, and character-specific runtime travel context in the party write
model. That travel context is represented as scalar references to the owning
space:

- `name` is required; `player_name`, `level`, `passive_perception`, and `ac`
  are nullable and preserve authored absence without sentinel values
- a newly inserted Roster character defaults to inactive membership and no
  party-token attachment; activation and attachment require later explicit
  mutations

- dungeon travel location stores map id, local owner id, local tile coordinate,
  level, location kind, and heading
- overworld travel location stores overworld map id and tile id
- party-token attachment stores whether a character currently follows the
  shared party token position

The Party SQLite adapter maps those columns through private records into Party
domain values. Dungeon persistence remains responsible for authored map
truth only; it does not persist character positions.

## Validation And Error Behavior

Owner startup readiness validates the feature-declared target schema signature; semantic row validation remains on typed provider read/write paths and fails closed through the feature contract.

- party writes MUST reject malformed character identity, roster, progression,
  or travel-location payloads instead of silently persisting partial character
  truth
- a present level requires at least its rules-profile XP floor; XP since the
  short rest cannot exceed XP since the long rest, and neither rest-progress
  counter can exceed current XP
- nullable optional facts MUST round-trip as SQL `NULL`; readers and writers
  MUST NOT replace absence with level `1`, passive perception `10`, AC `10`, or
  another compatibility/default value
- dungeon and overworld travel references MUST be validated as party-owned
  scalar location references rather than expanded into authored map truth
- storage and schema failures MUST surface through Party API result statuses
  rather than leaking SQLite exceptions to consumers
- the required singleton metadata row MUST be present; reads do not reconstruct
  it from character rows

## Current Schema Lifecycle

Compatibility obligations begin only after activation of the
[Product Process Compatibility Covenant](../../project/delivery/aletheia/product-process.md#compatibility-covenant).
Until that activation, only the current direct version-`1` schema is accepted.
Unversioned partial, superseded, structurally damaged, adjacent-owner-object,
and newer shapes fail closed without `ALTER`, repair, backfill, copy, drop,
normalization, or a version claim. They must be discarded and recreated from
the current product.

## Stability Rules

- The party roster write port remains an internal collaborator injected by the
  party composition entry point.
- Character-specific runtime state belongs in party persistence unless another
  bounded context owns the character information itself.
- Foreign features MUST use `PartyApi` for party commands and readback.

## Verification Notes

- This contract is currently `Review-Owned`.
- Review must reject persistence types or internal collaborators crossing
  `PartyApi`.
- Review must reject authored dungeon truth leaking into party-owned
  character-travel persistence.
- Production-route tests cover direct version-`1` creation, current-format
  save/restart/read, atomic save rollback, exact owner inventory,
  missing-metadata failure, and unchanged rejection of unsupported shapes.

## References

- [Party Domain Model](../domain/domain-party.md) (line 1)
- [Party Dropdown UI](../requirements/requirements-party-dropdown.md) (line 1)
- [Feature Boundary Standard](../../project/architecture/patterns/feature-boundaries.md)
- [Product Process Compatibility Covenant](../../project/delivery/aletheia/product-process.md#compatibility-covenant)
