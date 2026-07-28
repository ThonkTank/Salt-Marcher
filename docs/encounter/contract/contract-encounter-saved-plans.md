# Encounter Saved Plans Contract

Status: Active target contract with partial Godot implementation
Owner: Encounter
Last Reviewed: 2026-07-28
Source of Truth: This document

## Purpose

This contract defines the encounter-owned saved-plan chooser surface consumed
by Session Planner and the native Katalog.

The current Godot implementation provides the owner model, bounded Katalog
query, detail hydration, and create/edit/trash/restore route. The dedicated
Session Planner chooser controller and handoff remain G3 work.

## Search Surface

- the Encounter owner exposes one typed, demand-driven chooser operation;
  the current pure Godot operation is `search_chooser`, while the target
  Session Planner-facing application boundary remains to be composed
- queries are trimmed and case-normalized; fewer than two characters are an
  invalid request and perform no persistence read
- a successful result exposes at most eight ordered
  `SavedEncounterPlanSearchHit` values plus `hasMore`
- each hit contains only the stable plan id, name, and one Encounter-owned
  `summaryText` display line
- matching covers the saved name and generated label, treats `%` and `_` as
  literal characters, and uses deterministic newest-first ordering with plan
  identity as the tie-breaker
- the file-backed operation evaluates the validated owner partition off the
  scene-tree thread and publishes no more than eight hits; a ninth match only
  establishes `hasMore`

## Boundary Rules

- search is read-only and does not publish or transport the global saved-plan
  catalog
- encounter owns the summary-text formatting and supplies it as a thin chooser
  display form
- results are returned through the Encounter application boundary; there is no
  second reply channel
- search does not expose owner-partition documents directly
- creature detail remains creature-owned and does not appear in the summary
- generated-origin plans appear through the same chooser surface as manual
  plans; origin metadata is not a chooser label or a second plan kind
- concrete roster and XP hydration remains a separate bounded summary read for
  the selected result identities; search hits are not copied Encounter detail

## References

- [Encounter Domain Model](../domain/domain-encounter.md) (line 1)
- [Session Planner Requirements](../../sessionplanner/requirements/requirements-session-planner.md) (line 1)
- [Generated Import Contract](contract-encounter-generated-import.md)
