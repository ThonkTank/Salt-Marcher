Status: Active
Owner: Catalog Feature
Last Reviewed: 2026-07-18
Source of Truth: User-visible consolidated catalog behavior.

# Catalog Requirements

## Goal

The GM MUST be able to find, evaluate, and explicitly hand reference content
to an active Encounter or Scene from one `Katalog` navigation entry. The
workspace serves both game preparation and running-session lookup.

## Primary Flows

1. The GM opens `Katalog`, chooses one of the seven visible sections, and uses
   that section's search or filters.
2. The GM opens a selected record in the Inspector without changing Encounter
   or Scene state.
3. The GM uses an explicit action when a Monster, NPC, faction, location, or
   Encounter Table should affect the active Encounter or focused Scene.
4. The GM switches sections and later returns without losing unfinished input
   or the previous result position.

## Target Behavior

- The workspace MUST expose Monster, Items, Encounter, NPCs, Fraktionen, Orte,
  and Encounter-Tabellen as distinct visible sections.
- One persistent section selector MUST remain at the top of the Catalog
  controls area. The selected section's controls MUST always appear below it,
  and its results MUST appear in the main area.
- Every section MUST use the same compact control hierarchy: a full-width
  primary search row when search is available, wrapping filters, removable
  active-filter chips, compact actions, and one feedback area when those
  capabilities exist. Sections without filters MUST retain the same hierarchy
  without rendering empty placeholder controls.
- The controls area MUST remain bounded to the compact Monster-panel height so
  switching sections does not consume the result workspace. Overflowing
  controls scroll vertically without hiding the persistent section selector or
  introducing horizontal scrolling.
- Switching sections MUST preserve each section's filters, selection, paging,
  and unfinished input for the lifetime of the Catalog workspace.
- Sections MUST use consistent table, status, paging, keyboard, and selection
  behavior while retaining section-specific columns, filters, and actions.
- Every section MUST distinguish loading, empty, unavailable, invalid-input,
  and failed outcomes whenever the underlying operation can produce them.
- Monster search and encounter-builder controls MUST preserve their accepted
  behavior, including creature details and explicit add-to-Encounter and
  add-to-focused-Scene actions.
- Items MUST be read-only, searched asynchronously, distinguish loading,
  unavailable, empty, invalid, and storage-failure outcomes, and open details
  without blocking the JavaFX thread.
- Saved encounters MUST open in the global Encounter state tab. If the focused
  Encounter has unsaved roster changes, opening another plan MUST require an
  explicit discard confirmation.
- NPC, faction, and location details and edit actions MUST remain available in
  the Inspector.
- NPCs MUST support explicit Encounter and focused-Scene actions. Factions,
  locations, and Encounter tables MUST support explicit Encounter-source
  actions; locations MUST support assigning the focused Scene location.
- Selecting or opening a row alone MUST NOT mutate Encounter or Scene state.
- Changes to the visible Monster filters MUST also constrain Encounter
  generation. Difficulty, balance, amount, and diversity controls MUST remain
  in a collapsible section in the global Encounter state tab.
- The separate World Planner navigation entry and local state-panel slot MUST
  not be registered. World data and edit capabilities remain available through
  Catalog and Inspector.
- Activating or refreshing Scene MUST NOT change the visible Monster query,
  rows, sort, page, selection, or loading state.

## Non-Goals

Catalog does not edit creature statblocks, import external items, replace the
Encounter or Scene workspaces, or expose a second World Planner workspace.

## Acceptance Criteria

- One `Katalog` contribution shows all seven sections in the common controls
  and main workspace.
- At 1150×700 and 900×650, every section retains the persistent selector,
  the shared compact control hierarchy, and a visible result workspace; filter
  controls wrap without horizontal scrolling.
- Equivalent search, filter, clear, sort, action, chip, and feedback controls
  have the same visual treatment and placement across sections.
- Switching through every section and returning preserves each section's
  current query, filter draft, selected record, page, and unfinished input.
- Refreshing provider results preserves a still-present selected record by its
  stable identity.
- Each reachable result state renders a distinct visible outcome and leaves the
  JavaFX event thread responsive.
- Opening details changes only Inspector content.
- Each explicit Encounter or Scene action changes only its named destination.
- Opening a saved Encounter with unsaved roster changes requires confirmation
  before replacement.
- Encounter tuning controls are absent from Catalog and remain available in the
  global Encounter state tab.
- Activating or refreshing Scene does not change the visible Monster query,
  rows, sort, page, selection, or loading state.
- Final visual and interaction acceptance remains owner manual testing.

## References

- [Catalog Architecture](../architecture/architecture-catalog.md)
- [Items Requirements](../../items/requirements/requirements-items-catalog.md)
- [Encounter State Requirements](../../encounter/requirements/requirements-encounter-state-tab.md)
- [World Planner Requirements](../../worldplanner/requirements/requirements-world-planner.md)
