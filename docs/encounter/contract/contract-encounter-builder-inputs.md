Status: Active
Owner: SaltMarcher Team
Last Reviewed: 2026-05-07
Source of Truth: Public builder-input read/write contract for encounter-facing
catalog controls.

# Encounter Builder Inputs Contract

## Purpose

This contract defines the flat builder-input surface shared between the catalog
controls and the encounter runtime session.

## Read Surface

- `EncounterBuilderInputsModel`
  is the direct same-context read-side runtime service for builder inputs and
  exposes `current()` plus passive subscription
- `EncounterBuilderInputs`
  carries creature-type, subtype, biome, difficulty, tuning, and
  encounter-table selections only

## Write Surface

- `UpdateEncounterBuilderInputsCommand`
  submits a complete replacement snapshot of the builder inputs through the
  command-only `EncounterApplicationService`

## Boundary Rules

- the contract is workflow-oriented, not a mirror of the internal encounter
  session carrier
- readback arrives through the model handle directly; it is not loaded through
  a root query method
- it does not expose saved plans, roster cards, initiative rows, combat
  runtime, or result state
- it does not expose foreign creature, party, or encounter-table internals
- Auto difficulty and Auto tuning stay public request language only

## References

- [Encounter Domain Model](../domain/domain-encounter.md) (line 1)
- [Encounter UI](../requirements/requirements-encounter-state-tab.md) (line 1)
