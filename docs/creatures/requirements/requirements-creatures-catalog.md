Status: Active
Owner: SaltMarcher Team
Last Reviewed: 2026-04-26
Source of Truth: Creature browsing behavior inside the consolidated Catalog.

# Catalog Tab UI

## Component Purpose

The Monster section is the creature provider's read-only browsing experience
inside the consolidated `Katalog` workspace. Catalog owns section composition;
Creatures owns query, reference-index, detail, and encounter-candidate reads.

## Visible Surfaces

- The shell title is `Katalog`. The left navigation entry is icon-only and uses
  the crossed-blades reference graphic from
  `resources/view/leftbartabs/catalog/navigation-icon.svg`.
- The common Catalog section rail and active Monster controls in
  `COCKPIT_CONTROLS` contain creature filters, active
  filter chips, encounter difficulty selection, Auto tuning controls, and
  encounter-table selection.
- `COCKPIT_MAIN` contains the Monster list, result count, sort
  selection, and page controls.
- Because the Catalog tab does not publish active-tab state content, the shell
  shows the global state-tab strip with `Encounter` and `Reise`.
- Creature Inspector content is defined separately in
  [Creature Details UI](requirements-creatures-details.md).

## Interactions

- The tab opens directly to the creature catalog.
- Name search debounces before applying filters.
- CR min/max clamps to a valid range and omits default full-range bounds from
  the query.
- Size, type, subtype, biome, and alignment filters use searchable multi-select
  popups.
- Creature type, subtype, biome, encounter difficulty, amount, balance, and
  diversity selections publish runtime encounter-generation inputs for the
  Encounter state tab.
- Encounter difficulty defaults to Auto. The amount, balance, and diversity
  controls each expose an Auto toggle; while Auto is selected, the slider is
  disabled and the published value is the Auto sentinel for that tuning field.
- When a tuning slider is manually enabled, its value label mirrors the
  original encounter builder: difficulty shows the active party's adjusted XP
  range, balance shows `Extreme++` through `Durchschnitt++`, amount shows
  `Boss++` through `Minions++`, and diversity shows `1 Typ` through
  `4 Typen`.
- Encounter-table multi-selection publishes selected table IDs for the
  Encounter state tab; an empty selection means normal monster catalog
  generation.
- Selecting encounter tables shows active chips. Multiple selected tables with
  different linked loot-table IDs mark the table trigger with `Loot-Konflikt`.
- Active chips remove their corresponding filter when clicked.
- `Leeren` clears all creature filters and reloads the first page.
- Sort changes reset to page one.
- Previous and next page controls move in fixed 50-row pages.
- A late completion from an older Monster query does not replace a newer query.
- Scene and World Planner reference refreshes do not replace Monster rows.
- Row refreshes retain table columns and preserve selection when the same
  creature id remains visible.
- Clicking a creature name or pressing Enter on a selected row opens that
  creature in the shell Inspector.
- Clicking a creature row's `+Add` action publishes an add-creature request to
  the Encounter state tab.

## Visible States

- Loading: the list placeholder shows that monsters are loading.
- Empty: the list reports that no monsters match the current filters.
- Invalid filter: the list reports invalid filters.
- Storage error: the list reports a catalog load failure.

## Acceptance Criteria

- the catalog tab opens directly to the creature catalog without requiring a
  second navigation step inside the tab
- active filter chips reflect the currently applied filter state and remove only
  their own filter when clicked
- clearing filters resets the creature query to the unfiltered first page
- changing sort order resets pagination to the first page
- clicking a creature name or confirming the selected row opens the creature in
  the shell Inspector
- clicking a row `+Add` action publishes an add-creature request without
  mutating creature catalog truth
- an empty encounter-table selection keeps the normal creature-catalog source,
  while a non-empty encounter-table selection publishes selected table ids for
  the Encounter state tab
- Scene activation leaves the current Monster query and visible rows unchanged

## References

- [Creature Details UI](requirements-creatures-details.md)
- [Encounter Runtime State UI](../../encounter/requirements/requirements-encounter-state-tab.md)
