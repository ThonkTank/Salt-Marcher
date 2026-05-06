Status: Active
Owner: SaltMarcher Team
Last Reviewed: 2026-05-06
Source of Truth: Public builder-input read/write contract for encounter-facing
catalog controls.

# Encounter Builder Inputs Contract

## Purpose

This contract defines the flat builder-input surface shared between the catalog
controls and the encounter runtime session.

## Read Surface

- `LoadEncounterBuilderInputsQuery`
  requests the current encounter builder-input model
- `EncounterBuilderInputsModel`
  exposes `current()` plus passive subscription
- `EncounterBuilderInputs`
  carries creature-type, subtype, biome, difficulty, tuning, and
  encounter-table selections only

## Write Surface

- `UpdateEncounterBuilderInputsCommand`
  submits a complete replacement snapshot of the builder inputs

## Boundary Rules

- the contract is workflow-oriented, not a mirror of the internal encounter
  session carrier
- it does not expose saved plans, roster cards, initiative rows, combat
  runtime, or result state
- it does not expose foreign creature, party, or encounter-table internals
- Auto difficulty and Auto tuning stay public request language only

## References

- [Encounter Domain Model](/home/aaron/Schreibtisch/projects/SaltMarcher/docs/encounter/domain/domain-encounter.md:1)
- [Encounter UI](/home/aaron/Schreibtisch/projects/SaltMarcher/docs/encounter/requirements/requirements-encounter-state-tab.md:1)
