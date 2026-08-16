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

- The feature-owned persistence declaration owns Party DDL and SQL, not an
  independent schema version or migration ledger.
- The schema currently owns:
  - `player_characters`
  - `player_character_language`
  - `party_roster_metadata`
- `player_characters` stores optional species, class, passive Investigation,
  and passive Insight beside the existing identity and combat profile.
- `player_character_language` stores canonical case-insensitive unique
  languages in authored order for each character.
- `player_characters` stores character-owned travel columns for dungeon and
  overworld locations plus the party-token attachment flag. These columns are
  part of character state, not a campaign-level travel table and not dungeon
  authored truth.
- shared startup creates and validates the complete current whole-database
  development schema before the store becomes ready

## Current Mapping

Party persistence stores the character roster, membership, progression, combat
profile, and character-specific runtime travel context in the party write
model. That travel context is represented as scalar references to the owning
space:

- `name` is required; `player_name`, `species`, `character_class`, `level`,
  all passive scores, `armor_class`, and `movement_speed_feet`
  are nullable and preserve authored absence without sentinel values
- a newly inserted Roster character defaults to inactive membership and no
  party-token attachment; activation and attachment require later explicit
  mutations

- dungeon travel location stores map id, local owner id, local tile coordinate,
  level, location kind, and heading
- overworld travel location stores overworld map id and tile id
- explicit travel state distinguishes detached, attached-but-unpositioned, and
  positioned characters; positioned rows alone carry map and tile references

The Party SQLite adapter maps those columns through private records into Party
domain values. Dungeon persistence remains responsible for authored map
truth only; it does not persist character positions.

## Validation And Error Behavior

Startup validates the one whole-database development schema version; semantic
row validation remains on typed provider read/write paths and fails closed
through the feature contract.

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

Compatibility obligations begin with the first released format.
Campaign schema 29 owns the registered 28-to-29 forward migration that adds
the nullable profile columns and normalized language table without changing
existing Party rows, membership, progression, or travel facts. Unsupported
older or newer formats remain rejected by the shared persistence lifecycle.

## Stability Rules

- The party roster write port remains an internal collaborator injected by the
  party composition entry point.
- Character-specific runtime state belongs in party persistence unless another
  bounded context owns the character information itself.
- Foreign features MUST use `PartyApi` for party commands and readback.


## References

- [Party Domain Model](../domain/domain-party.md) (line 1)
- [Party Dropdown UI](../requirements/requirements-party-dropdown.md) (line 1)
