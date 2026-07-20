Status: Active Target
Owner: SaltMarcher Team
Last Reviewed: 2026-07-19
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
  - `generated_encounter_plan_batches`
  - `generated_encounter_plan_origins`
- `saved_encounter_plans` stores plan identity, display name, generated label,
  and timestamps.
- `saved_encounter_plan_creatures` stores ordered creature identity, quantity,
  and the last-known display name captured when the plan was saved. Creature
  identity references the creature catalog; the encounter feature does not
  duplicate statblocks.
- `generated_encounter_plan_batches` stores the immutable source identity,
  normalized batch fingerprint, and declared encounter cardinality.
- `generated_encounter_plan_origins` stores the stable batch order,
  encounter number, normalized spec fingerprint, and saved-plan reference.

## Current Mapping

Encounter persistence stores only saved encounter-plan roster truth. It does
not persist:

- generated-alternative lists
- active generator filters
- initiative values
- combat HP or turn order
- defeated-result state
- loot or XP-award resolution

Optional generated origin consists only of engine version, preparation and
generation-run identities, normalized batch and roster fingerprints and
cardinality, encounter order and number, normalized-intent fingerprint, and
saved-plan reference. It does not copy a Session Generation result.
Preparation-level uniqueness plus ordered origin uniqueness makes identical
completed commits idempotent and makes subset, superset, reordered, relabeled,
or changed-roster retries distinguishable.

The Encounter SQLite adapter maps private rows into `EncounterPlan` aggregate
values. The stored name remains a last-known fallback; current creature facts
are reloaded through one `CreaturesApi` ID-union snapshot when summaries are
requested. Base XP, adjusted XP, and difficulty are derived for that read from
the current active Party composition and current Creature facts. Those derived
summary values are not persisted as historical truth.

## Validation And Error Behavior

Owner startup readiness validates the feature-declared target schema signature; semantic row validation remains on typed provider read/write paths and fails closed through the feature contract.
The current owner target is v5. V5 idempotently repairs any missing v1-v4 target
tables, indexes, and generated-batch columns before signature validation; it does
not reinterpret or discard persisted Encounter rows.

- encounter-plan writes MUST reject empty or malformed roster rows instead of
  silently persisting partial encounter truth
- generated alternatives, initiative state, combat HP, result state, and loot
  state MUST be rejected from the persistence payload because they are explicit
  non-persisted runtime state
- schema-readiness and storage failures MUST surface through Encounter API
  result statuses rather than leaking SQLite exceptions to consumers
- one generated batch MUST insert all plan roots, roster rows, and origin data
  in one transaction; any failure MUST leave no member of the batch visible
- a partial existing origin set, mismatched cardinality, reordered request, or
  mismatched batch or spec fingerprint MUST fail closed instead of guessing or
  creating duplicate plans

## Stability Rules

- The saved-plan write port remains an internal collaborator injected by the
  encounter composition entry point.
- Saved-plan storage remains encounter-owned even when generated plans are
  built from party, creatures, or encounter-table source data.
- Generated-origin support extends the existing saved-plan schema through a
  contiguous Encounter feature migration; it MUST NOT create a parallel
  generated-plan store or rewrite manual plans.

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
- [Generated Import Contract](contract-encounter-generated-import.md)
