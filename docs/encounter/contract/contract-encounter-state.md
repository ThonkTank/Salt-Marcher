Status: Active
Owner: SaltMarcher Team
Last Reviewed: 2026-05-07
Source of Truth: Public workflow state contract for the encounter state tab.

# Encounter State Contract

## Purpose

This contract defines the public runtime workflow surface used by the encounter
state tab.

## Read Surface

- `EncounterStateModel`
  is the direct same-context read-side runtime service for encounter workflow
  state and exposes `current()` plus passive subscription
- `EncounterStateSnapshot`
  publishes builder-pane, initiative-pane, combat-pane, and resolution-pane
  projections plus one status line

## Write Surface

- `ApplyEncounterStateCommand`
  submits workflow actions such as generate, save current plan, open saved
  plan, roster edits, initiative confirmation, combat mutations, XP award, and
  refresh through the command-only `EncounterApplicationService`

## Boundary Rules

- the contract is view-facing workflow language, not a transport mirror of
  `EncounterSession`
- readback arrives through the model handle directly; it is not loaded through
  a root query method
- builder filters live in the separate builder-input contract
- planner-facing saved-plan list and plan-budget reads stay separate from this
  state-tab workflow contract
- commands mutate the encounter runtime session only; they do not expose data
  storage rows or foreign feature internals

## References

- [Encounter Domain Model](/home/aaron/Schreibtisch/projects/SaltMarcher/docs/encounter/domain/domain-encounter.md:1)
- [Encounter UI](/home/aaron/Schreibtisch/projects/SaltMarcher/docs/encounter/requirements/requirements-encounter-state-tab.md:1)
