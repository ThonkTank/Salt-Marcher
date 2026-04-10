# Items Feature

## Purpose

`features.items` owns item data, the canonical item catalog root, the current public item compatibility surface, and reusable item-catalog UI building blocks.

## Canonical Types and APIs

- `features.items.catalog.CatalogObject` — canonical item catalog root for filter options, search/list reads, short name lookup, and single-item detail loads.
- `features.items.api` — current public item compatibility surface for reads and reusable item UI. Preserve compatibility here, but do not treat `api/` as placement precedent for new owner-local code.
- `ItemBrowserPane`, `ItemFilterPane`, `ItemViewerPane` — reusable item-owned UI building blocks.
- `ItemBrowserPageLoader`, `ItemBrowserRowAction` — supported host extension points for paging and row actions.

## Where New Code Goes

- Put canonical item catalog reads in `features.items.catalog`.
- Change item search, filter, and detail behavior in `features.items`.
- Change host-specific row actions, selection rules, and exclusions in the consuming feature.
- Keep concrete JavaFX catalog implementation behind the item-owned public seam.

## Forbidden Drift

- Do not import `features.items.model` or `features.items.ui.shared.*` directly from consuming features.
- Do not treat `features.items.api.ItemCatalogService` as the canonical item catalog root again.
- Do not hard-code feature-specific actions into the neutral shared item browser.
- Do not wire item-widget internals directly from shell bootstrap.
