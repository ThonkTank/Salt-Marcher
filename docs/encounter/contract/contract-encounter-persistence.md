Status: Active Target
Owner: SaltMarcher Team
Last Reviewed: 2026-07-15
Source of Truth: Persistence path and schema ownership rules for the
`encounter` feature.

# Encounter Persistence

This document is normative for the `encounter` feature's saved-plan
persistence path.

## Adapter Boundary

- The encounter SQLite adapter satisfies encounter-owned application ports and
  remains private to the encounter composition entry point.
- The application composition supplies `EncounterApi` explicitly; registry,
  discovery, repository, gateway, mapper, and schema types are not public
  boundaries.
- SQL records and adapter failures MUST NOT cross `EncounterApi`.

## Mandatory Schema

- The feature-owned persistence schema declaration is the canonical in-code
  schema owner.
- The schema owns:
  - `saved_encounter_plans`
  - `saved_encounter_plan_creatures`
- `saved_encounter_plans` stores plan identity, display name, generated label,
  and timestamps.
- `saved_encounter_plan_creatures` stores ordered creature identity and
  quantity rows. Creature identity references the creature catalog; the
  encounter feature does not duplicate statblocks.

## Current Mapping

Encounter persistence stores only saved encounter-plan roster truth. It does
not persist:

- generated-alternative lists
- active generator filters
- initiative values
- combat HP or turn order
- defeated-result state
- loot or XP-award resolution

The Encounter SQLite adapter maps private rows into `EncounterPlan` aggregate
values. Creature detail display is reloaded through `CreaturesApi` when a plan
is opened.

## Validation And Error Behavior

- encounter-plan writes MUST reject empty or malformed roster rows instead of
  silently persisting partial encounter truth
- generated alternatives, initiative state, combat HP, result state, and loot
  state MUST be rejected from the persistence payload because they are explicit
  non-persisted runtime state
- schema-readiness and storage failures MUST surface through Encounter API
  result statuses rather than leaking SQLite exceptions to consumers

## Stability Rules

- The saved-plan write port remains an internal collaborator injected by the
  encounter composition entry point.
- Saved-plan storage remains encounter-owned even when generated plans are
  built from party, creatures, or encounter-table source data.

## Verification Notes

- This contract is currently `Review-Owned`.
- Review must reject persisted fields for generated alternatives, initiative,
  combat HP, result state, and loot state.
- Review must reject persistence types or internal collaborators crossing
  `EncounterApi`.

## References

- [Encounter Domain Model](../domain/domain-encounter.md) (line 1)
- [Encounter Feature Spec](../requirements/requirements-encounter.md) (line 1)
- [Feature Boundary Standard](../../project/architecture/patterns/feature-boundaries.md)
