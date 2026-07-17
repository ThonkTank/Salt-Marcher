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
- One persistent section selector MUST remain at the top of the Catalog
  controls area. The selected section's controls MUST always appear below it,
  and its results MUST appear in the main area.
- Switching sections MUST preserve each section's filters, selection, paging,
  and unfinished input for the lifetime of the Catalog workspace.
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
- Activating or refreshing Scene MUST NOT change the visible Monster query,
  rows, sort, page, selection, or loading state.

## Non-Goals

Catalog does not persist reference data, define dispositions, import external
items, own encounter runtime state, or duplicate provider command logic.

## Acceptance Criteria

Automated UI tests MUST prove one Catalog contribution contains all seven
sections in the common controls/main structure, preserves section state,
retains stable Monster columns and selection across result refreshes, routes
saved-plan confirmation, renders explicit Items states, and remains unchanged
when Scene initializes.
Architecture proof MUST reject Catalog imports from foreign adapters. Final
visual and interaction acceptance remains owner manual testing.

## References

- [Catalog Architecture](../architecture/architecture-catalog.md)
- [Items Requirements](../../items/requirements/requirements-items-catalog.md)
- [Encounter State Requirements](../../encounter/requirements/requirements-encounter-state-tab.md)
- [World Planner Requirements](../../worldplanner/requirements/requirements-world-planner.md)
