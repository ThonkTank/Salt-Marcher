# Items Feature

## Purpose

`features.items` owns item data, item search and detail reads, and reusable item-catalog UI building blocks.

## Canonical Types and APIs

- `ItemCatalogService` — current public read facade for item search, filters, and details. Keep host access on this seam, but do not treat `api` or `service` naming as placement precedent for new owner-local code.
- `ItemBrowserPane`, `ItemFilterPane`, `ItemViewerPane` — reusable item-owned UI building blocks.
- `ItemBrowserPageLoader`, `ItemBrowserRowAction` — supported host extension points for paging and row actions.

## Where New Code Goes

- Change item search, filter, and detail behavior in `features.items`.
- Change host-specific row actions, selection rules, and exclusions in the consuming feature.
- Keep concrete JavaFX catalog implementation behind the item-owned public seam.

## Forbidden Drift

- Do not import `features.items.model` or `features.items.ui.shared.*` directly from consuming features.
- Do not hard-code feature-specific actions into the neutral shared item browser.
- Do not wire item-widget internals directly from shell bootstrap.
