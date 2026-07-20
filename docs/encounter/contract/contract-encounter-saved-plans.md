Status: Active Target
Owner: SaltMarcher Team
Last Reviewed: 2026-07-19
Source of Truth: API contract for the encounter-owned saved-plan chooser
facts consumed by SessionPlanner.

# Encounter Saved Plans Contract

## Purpose

This contract defines the encounter-owned saved-plan chooser surface consumed
by SessionPlanner.

## Search Surface

- `EncounterApi.searchSavedPlans(SearchSavedEncounterPlansQuery)` is the typed,
  demand-driven chooser operation
- queries are trimmed and case-normalized; fewer than two characters are an
  invalid request and perform no persistence read
- a successful result exposes at most eight ordered
  `SavedEncounterPlanSearchHit` values plus `hasMore`
- each hit contains only the stable plan id, name, and one Encounter-owned
  `summaryText` display line
- matching covers the saved name and generated label, treats `%` and `_` as
  literal characters, and uses deterministic newest-first ordering with plan
  identity as the tie-breaker
- the SQLite adapter reads at most nine roots in one parameterized statement;
  the ninth root establishes `hasMore` and is never published as a hit

## Boundary Rules

- search is read-only and does not publish or transport the global saved-plan
  catalog
- encounter owns the summary-text formatting and supplies it as a thin chooser
  display form
- results are returned through `EncounterApi`; there is no second reply channel
- search does not expose encounter persistence rows directly
- creature detail remains creature-owned and does not appear in the summary
- generated-origin plans appear through the same chooser surface as manual
  plans; origin metadata is not a chooser label or a second plan kind
- concrete roster and XP hydration remains a separate bounded summary read for
  the selected result identities; search hits are not copied Encounter detail

## References

- [Encounter Domain Model](../domain/domain-encounter.md) (line 1)
- [Session Planner Requirements](../../sessionplanner/requirements/requirements-session-planner.md) (line 1)
- [Generated Import Contract](contract-encounter-generated-import.md)
