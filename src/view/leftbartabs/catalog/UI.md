Status: Active
Owner: SaltMarcher Team
Last Reviewed: 2026-04-21
Source of Truth: Catalog left-bar tab composition, content selection, filter
controls, list management, and main list behavior.

# Catalog Tab UI

## Component Purpose

The catalog tab is the shared reference browser for read-only game catalogs.
It owns the left-bar tab shell entrypoint and hosts content-specific catalog
presentations through one generic tab ViewModel.

Current state:

- Creatures is the only functional catalog content.
- Items and Spells are visible disabled placeholders until their local
  application services exist.
- Creature detail display is published to the shell Inspector through the
  creature detail entry.

## Visible Surfaces

- `COCKPIT_CONTROLS` contains content selection, creature filters, active
  filter chips, encounter difficulty selection, encounter-table selection,
  sort selection, result count, and page controls.
- `COCKPIT_MAIN` contains the active catalog list.
- Creature Inspector content is defined separately in
  [Creature Details UI](/home/aaron/Schreibtisch/projects/SaltMarcher/src/view/slotcontent/details/creature/UI.md:1).

## Interactions

- Selecting `Creatures` keeps the creature catalog active.
- `Items` and `Spells` remain disabled and do not trigger backend calls.
- Name search debounces before applying filters.
- CR min/max clamps to a valid range and omits default full-range bounds from
  the query.
- Size, type, subtype, biome, and alignment filters use searchable multi-select
  popups.
- Creature type, subtype, biome, encounter difficulty, amount, balance, and
  diversity selections publish runtime encounter-generation inputs for the
  Encounter state tab.
- Encounter-table multi-selection publishes selected table IDs for the
  Encounter state tab; an empty selection means normal monster catalog
  generation.
- Selecting encounter tables shows active chips. Multiple selected tables with
  different linked loot-table IDs show a non-blocking `Loot-Konflikt` warning.
- Active chips remove their corresponding filter when clicked.
- `Leeren` clears all creature filters and reloads the first page.
- Sort changes reset to page one.
- Previous and next page controls move in fixed 50-row pages.
- Clicking a creature name or pressing Enter on a selected row opens that
  creature in the shell Inspector.
- Clicking a creature row's `+Add` action publishes an add-creature request to
  the Encounter state tab.

## Visible States

- Loading: the list placeholder shows that monsters are loading.
- Empty: the list reports that no monsters match the current filters.
- Invalid filter: the list reports invalid filters.
- Storage error: the list reports a catalog load failure.
- Disabled content: unavailable catalog kinds are visible but not selectable.
