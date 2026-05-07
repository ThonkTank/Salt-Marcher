Status: Active
Owner: SaltMarcher Team
Last Reviewed: 2026-05-07
Source of Truth: Public refresh-and-read contract for reading saved
encounter-plan budget summaries.

# Encounter Plan Budget Contract

## Purpose

This contract defines the public encounter budget surface used by downstream
planning surfaces to read one saved encounter plan as a budget summary.

## Read Surface

- `EncounterPlanBudgetModel`
  exposes `current()` plus passive subscription for the last requested saved
  encounter-plan budget result

## Refresh Surface

- `RefreshEncounterPlanBudgetCommand`
  requests one saved encounter plan by plan id through the command-only
  `EncounterApplicationService`

## Payload

- `EncounterPlanBudgetResult`
  returns one status, an optional `EncounterPlanBudgetSummary`, and a message
- `EncounterPlanBudgetSummary`
  returns the saved plan identity and label, party threshold context, creature
  count, total base XP, adjusted XP, multiplier, and difficulty label

## Status Semantics

- `SUCCESS`
  the saved plan and active party were available and a budget summary was
  produced
- `NOT_FOUND`
  no saved encounter plan exists for the requested id
- `NO_ACTIVE_PARTY`
  the budget read could not be resolved because no active party is available
- `INVALID_REQUEST`
  the query does not identify a valid plan
- `STORAGE_ERROR`
  the saved plan, party data, or required creature detail could not be loaded

## Boundary Rules

- the refresh command does not mutate the saved encounter plan
- the budget payload is read-only
- the model does not expose encounter persistence rows directly
- creature XP stays creature-owned and is reloaded through creature detail
  reads instead of being duplicated into encounter-plan persistence
- consumers read the refreshed payload through the model handle rather than a
  direct root return value

## References

- [Encounter Domain Model](/home/aaron/Schreibtisch/projects/SaltMarcher/docs/encounter/domain/domain-encounter.md:1)
- [Session Planner Requirements](/home/aaron/Schreibtisch/projects/SaltMarcher/docs/sessionplanner/requirements/requirements-session-planner.md:1)
