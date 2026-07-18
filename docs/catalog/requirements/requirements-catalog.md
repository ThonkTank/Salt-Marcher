Status: Active
Owner: Catalog Feature
Last Reviewed: 2026-07-19
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
- Search text and filter edits MUST update the selected section automatically
  after 200 ms without another edit. Enter MUST submit the current valid input
  immediately. All seven sections use this behavior when they expose search or
  filters.
- Only the selected section may load or observe provider results. Switching
  sections MUST stop invisible work without discarding that section's input,
  accepted result, selection, sort, or page.
- Every section MUST use the same compact control hierarchy: one wrapping row
  for search and section actions, wrapping inside-labeled filters, removable
  active-filter chips, and one feedback area when those capabilities exist.
  Empty regions MUST not render placeholders or consume space.
- Equivalent section, search, filter, sort, paging, and action controls MUST
  render at 28 pixels high with the same 12-pixel regular-weight type style.
  Removable filter chips use the shared compact information style.
- Search and filter meaning MUST appear inside the interactive element through
  its prompt or displayed value. Redundant field-side labels, `FILTER`, and
  `AKTIONEN` headings MUST not appear.
- Switching sections MUST preserve each section's filters, selection, paging,
  and unfinished input for the lifetime of the Catalog workspace.
- Sections MUST use consistent table, status, paging, keyboard, and selection
  behavior while retaining section-specific columns, filters, and actions.
- Every section MUST distinguish loading, empty, unavailable, invalid-input,
  and failed outcomes whenever the underlying operation can produce them.
- Refreshing an already successful section MUST keep its accepted rows visible
  while communicating that they are being refreshed. A failed refresh MUST not
  present stale rows as current success.
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
- At 1150×700 and 900×650, the selected section retains the persistent selector,
  compact controls, and a visible result workspace without horizontal scrolling.
- Equivalent controls satisfy the shared 28-pixel and 12-pixel visual contract,
  use inside labels, and do not render redundant group headings.
- Typing several characters inside 200 ms publishes only the final query;
  Enter publishes the current valid query immediately.
- Inactive sections issue no provider query and retain their last state.
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
