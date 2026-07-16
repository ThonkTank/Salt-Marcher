Status: Active
Owner: Catalog Feature
Last Reviewed: 2026-07-16
Source of Truth: User-visible consolidated catalog behavior.

# Catalog Requirements

## Goal

Reference content MUST be reachable from one `Katalog` navigation entry rather
than separate feature navigation tabs. The workspace serves game preparation
and running-session lookup without taking ownership from provider features.

## Required Behavior

- The workspace MUST expose Monster, Items, Encounter, NPCs, Fraktionen, Orte,
  and Encounter-Tabellen as distinct visible sections.
- Monster search and encounter-builder controls MUST preserve their accepted
  behavior, including creature details and adding creatures to Encounter.
- Items MUST be read-only, searched asynchronously, distinguish loading,
  unavailable, empty, invalid, and storage-failure outcomes, and open details
  without blocking the JavaFX thread.
- Saved encounters MUST open in the global Encounter state tab. If the focused
  Encounter has unsaved roster changes, opening another plan MUST require an
  explicit discard confirmation.
- NPC, faction, and location details and edit actions MUST open through
  World-Planner-owned inspector content.
- The separate World Planner navigation entry and local state-panel slot MUST
  not be registered. World data and edit capabilities remain available through
  Catalog and Inspector.

## Non-Goals

Catalog does not persist reference data, define dispositions, import external
items, own encounter runtime state, or duplicate provider command logic.

## Acceptance Criteria

Automated UI tests MUST prove one Catalog contribution contains all seven
sections, routes saved-plan confirmation, and renders explicit Items states.
Architecture proof MUST reject Catalog imports from foreign adapters. Final
visual and interaction acceptance remains owner manual testing.

## References

- [Catalog Architecture](../architecture/architecture-catalog.md)
- [Items Requirements](../../items/requirements/requirements-items-catalog.md)
- [Encounter State Requirements](../../encounter/requirements/requirements-encounter-state-tab.md)
- [World Planner Requirements](../../worldplanner/requirements/requirements-world-planner.md)
