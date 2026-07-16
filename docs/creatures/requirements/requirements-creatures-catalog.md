Status: Active
Owner: SaltMarcher Team
Last Reviewed: 2026-07-16
Source of Truth: Catalog left-bar tab composition, content selection, list
management, and main-list routing.

# Catalog Tab UI

## Component Purpose

The Catalog tab is the single left-bar entrypoint for reusable game-reference
and authored-world lists. It hosts content-specific presentations without
claiming the global state pane. Encounter runtime state therefore remains
available while any catalog content is open.

## Visible Surfaces

- The shell title is `Katalog`. The left navigation entry is icon-only and uses
  the catalog graphic from
  `resources/view/leftbartabs/catalog/navigation-icon.svg`.
- A persistent content strip selects, in this order: `Monster`, `Items`,
  `Encounter`, `NPCs`, `Fraktionen`, `Orte`, and `Encounter-Tabellen`.
- `Monster` is the default content and retains creature filters, encounter
  difficulty, generator tuning, result sorting, paging, detail opening, and
  add-to-encounter behavior.
- `Items` is a searchable, filterable, sortable read-only equipment and magic
  item list. Item details open in the Inspector. The UI has no item create,
  edit, delete, loot-generation, or assignment action.
- `Encounter` lists saved encounter plans. Opening one replaces the current
  encounter creation roster after explicit confirmation when unsaved roster
  changes would be discarded.
- `NPCs`, `Fraktionen`, and `Orte` show the existing World Planner lists.
  Selection opens their details and existing editing actions in the Inspector.
- `Encounter-Tabellen` lists authored encounter tables and provides the source
  selection used by encounter generation.
- Because the Catalog tab does not publish active-tab state content, the shell
  shows the global state-tab strip with `Encounter` and `Reise`.
- Creature Inspector content is defined separately in
  [Creature Details UI](requirements-creatures-details.md).

## Interactions

- The tab opens directly to `Monster`.
- Changing content preserves the global Encounter state and selects only the
  catalog controls and list belonging to the chosen content.
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
- Encounter-table source selection is owned by the
  `Encounter-Tabellen` content. An empty selection means normal monster
  catalog generation.
- Selecting encounter tables shows active chips. Multiple selected tables with
  different linked loot-table IDs mark the table trigger with `Loot-Konflikt`.
- Active chips remove their corresponding filter when clicked.
- `Leeren` clears all creature filters and reloads the first page.
- Sort changes reset to page one.
- Previous and next page controls move in fixed 50-row pages.
- Clicking a creature name or pressing Enter on a selected row opens that
  creature in the shell Inspector.
- Clicking a creature row's `+Add` action publishes an add-creature request to
  the Encounter state tab.
- Opening a saved encounter plan is initiated from the Catalog; saving and all
  combat/runtime actions remain in the Encounter state tab.

## Visible States

- Loading: the list placeholder shows that monsters are loading.
- Empty: the list reports that no monsters match the current filters.
- Invalid filter: the list reports invalid filters.
- Storage error: the list reports a catalog load failure.
- Items unavailable: the Items list explains that a public-source import must
  be run; other catalog contents remain usable.

## Acceptance Criteria

- the left bar exposes one Catalog entry and no separate World Planner entry
- the Catalog opens on `Monster` and exposes the seven content selectors in the
  fixed order defined above
- changing Catalog content never replaces the global Encounter state tab
- active filter chips reflect the currently applied filter state and remove only
  their own filter when clicked
- clearing filters resets the creature query to the unfiltered first page
- changing sort order resets pagination to the first page
- clicking a creature name or confirming the selected row opens the creature in
  the shell Inspector
- clicking a row `+Add` action publishes an add-creature request without
  mutating creature catalog truth
- an empty encounter-table selection keeps the normal creature-catalog source,
  while a non-empty selection publishes selected table ids for the Encounter
  state tab
- NPC, faction, and location selection opens detail and existing edit actions
  in the Inspector instead of a Catalog-owned state pane
- Items remain read-only from import through presentation

## References

- [Creature Details UI](requirements-creatures-details.md)
- [Encounter Runtime State UI](../../encounter/requirements/requirements-encounter-state-tab.md)
- [Items Catalog](../../items/requirements/requirements-items-catalog.md)
