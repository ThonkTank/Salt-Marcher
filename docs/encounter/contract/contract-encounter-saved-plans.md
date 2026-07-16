Status: Active Target
Owner: SaltMarcher Team
Last Reviewed: 2026-07-16
Source of Truth: API contract for the encounter-owned saved-plan chooser
facts consumed by SessionPlanner.

# Encounter Saved Plans Contract

## Purpose

This contract defines the encounter-owned saved-plan chooser surface consumed
by SessionPlanner.

## Read Surface

- `EncounterApi` provides a typed saved-plan list operation returning one
  `EncounterPlanListFact`
- `EncounterPlanListFact`
  returns availability, a list of `SavedEncounterPlanFact`, and a status text
- `SavedEncounterPlanFact`
  returns the saved plan id, name, and one encounter-owned `summaryText`
  display line

## Boundary Rules

- the list is read-only
- encounter owns the summary-text formatting and supplies it as a thin chooser
  display form
- the list is loaded through `EncounterApi`; there is no second reply channel
- the list does not expose encounter persistence rows directly
- creature detail remains creature-owned and does not appear in the summary
- generated-origin plans appear through the same chooser surface as manual
  plans; origin metadata is not a chooser label or a second plan kind

## References

- [Encounter Domain Model](../domain/domain-encounter.md) (line 1)
- [Session Planner Requirements](../../sessionplanner/requirements/requirements-session-planner.md) (line 1)
- [Generated Import Contract](contract-encounter-generated-import.md)
