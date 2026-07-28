# Party Persistence

Status: Active Godot persistence contract
Owner: Party
Last Reviewed: 2026-07-28
Source of Truth: This document

This document is normative for the `party` feature's persistence path.

## Owner Partition Boundary

- Party owns exactly one versioned Campaign partition named `party`.
- The current format identifier is `saltmarcher.party-roster.v1`.
- The payload contains complete `characters` and recoverable `trash`
  dictionaries keyed by stable character identity.
- Party publishes complete candidate payloads through the admitted active
  Campaign's serial generation-bound writer. It does not write files directly.
- Registry state, commit manifests, immutable partition revisions, recovery,
  backups, compaction, and switch authority remain platform-owned concerns.
- No SQL row, JDBC adapter, SQLite schema, mutable presentation model, or
  Session Planner record is part of the Godot Party boundary.

## Current Mapping

The Party partition stores the character roster, membership, progression,
combat profile, and character-specific runtime travel context in one candidate
write model. Each live character record contains:

- `name` is required; `player_name`, `level`, `passive_perception`, and `ac`
  are nullable and preserve authored absence without sentinel values
- a newly inserted Roster character defaults to inactive membership and no
  party-token attachment; activation and attachment require later explicit
  mutations

- current XP, XP since long and short rest, and short-rest count
- explicit `active` or `reserve` current-Party membership
- dungeon travel references containing map id, local owner id, local tile
  coordinate, level, location kind, and heading; or overworld map/tile refs
- party-token attachment independently from the concrete location, including a
  valid attached-without-location state
- stable created/updated timestamps

Trash retains the complete character record and deletion timestamp. Restore
keeps the same identity but always returns the character as reserve and without
a location or token attachment; it never silently rejoins current Party,
travel, or Scene participation. Dungeon and overworld owners retain authored
map truth and are referenced only by scalar stable identities.

## Validation And Error Behavior

Every read validates the complete versioned payload before publishing a Party
snapshot. Every mutation validates both its request and the complete candidate
payload before handing it to the Campaign writer.

- party writes MUST reject malformed character identity, roster, progression,
  or travel-location payloads instead of silently persisting partial character
  truth
- a present level requires at least its rules-profile XP floor; XP since the
  short rest cannot exceed XP since the long rest, and neither rest-progress
  counter can exceed current XP
- nullable optional facts MUST round-trip as JSON `null`; readers and writers
  MUST NOT replace absence with level `1`, passive perception `10`, AC `10`, or
  another compatibility/default value
- dungeon and overworld travel references MUST be validated as party-owned
  scalar location references rather than expanded into authored map truth
- malformed format, identity, optional-value, timestamp, or travel shapes fail
  closed rather than being normalized or partially accepted
- storage, stale-generation, switch, cancellation, and damage failures MUST
  surface as Party result statuses rather than leaking platform internals
- bounded queries report total matches separately from returned rows and
  latest-wins read orchestration suppresses stale publication

## Current Schema Lifecycle

Compatibility obligations begin with the first released format. Before that
release, only the complete current `saltmarcher.party-roster.v1` document is
accepted. Unversioned, partial, superseded, damaged, adjacent-owner, and newer
shapes fail closed without conversion, repair, backfill, normalization, or a
false version claim. Pre-completion product data is disposable.

## Stability Rules

- The Campaign partition command lane remains an internal collaborator injected
  by Party composition.
- Character-specific runtime state belongs in party persistence unless another
  bounded context owns the character information itself.
- Foreign features MUST use the Party read/command boundary and, after the
  carrier cutover, `PartyApi`; they never read the partition directly.
- Planning Party selections remain Session Planner-owned stable references and
  MUST NOT be copied into this partition.


## References

- [Party Domain Model](../domain/domain-party.md)
- [Party Architecture](../architecture/architecture-party.md)
- [Party Dropdown UI](../requirements/requirements-party-dropdown.md)
- [Feature Boundary Standard](../../project/architecture/patterns/feature-boundaries.md)
