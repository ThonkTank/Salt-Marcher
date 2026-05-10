Status: Active
Owner: SaltMarcher Team
Last Reviewed: 2026-05-10
Source of Truth: Service contract for the encounter-owned saved-plan chooser
facts consumed by SessionPlanner.

# Encounter Saved Plans Contract

## Purpose

This contract defines the encounter-owned saved-plan chooser surface consumed
by SessionPlanner.

## Read Surface

- `SessionEncounterFactsRepository.listEncounterPlans()`
  returns one `EncounterPlanListFact`
- `EncounterPlanListFact`
  returns availability, a list of `SavedEncounterPlanFact`, and a status text
- `SavedEncounterPlanFact`
  returns the saved plan id, name, and one encounter-owned `summaryText`
  display line

## Boundary Rules

- the list is read-only
- encounter owns the summary-text formatting and supplies it as a thin chooser
  display form
- there is no separate encounter `published/*Model` reply channel for loading
  the list
- the list does not expose encounter persistence rows directly
- creature detail remains creature-owned and does not appear in the summary

## References

- [Encounter Domain Model](/home/aaron/Schreibtisch/projects/SaltMarcher/docs/encounter/domain/domain-encounter.md:1)
- [Session Planner Requirements](/home/aaron/Schreibtisch/projects/SaltMarcher/docs/sessionplanner/requirements/requirements-session-planner.md:1)
