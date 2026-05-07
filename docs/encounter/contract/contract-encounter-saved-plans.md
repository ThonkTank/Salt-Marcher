Status: Active
Owner: SaltMarcher Team
Last Reviewed: 2026-05-07
Source of Truth: Public read-side contract for the saved encounter-plan list.

# Encounter Saved Plans Contract

## Purpose

This contract defines the public saved-plan list surface consumed by planner
and encounter UI read paths.

## Read Surface

- `SavedEncounterPlanListModel`
  is the direct same-context read-side runtime service for the saved
  encounter-plan list and exposes `current()` plus passive subscription
- `SavedEncounterPlanListResult`
  returns one status, a list of `SavedEncounterPlanSummary`, and a message
- `SavedEncounterPlanSummary`
  returns the saved plan id, name, generated label, and creature count

## Boundary Rules

- the list is read-only
- the model is maintained by encounter-owned publication; there is no separate
  root query method for loading the list
- the list does not expose encounter persistence rows directly
- creature detail remains creature-owned and does not appear in the summary

## References

- [Encounter Domain Model](/home/aaron/Schreibtisch/projects/SaltMarcher/docs/encounter/domain/domain-encounter.md:1)
- [Session Planner Requirements](/home/aaron/Schreibtisch/projects/SaltMarcher/docs/sessionplanner/requirements/requirements-session-planner.md:1)
