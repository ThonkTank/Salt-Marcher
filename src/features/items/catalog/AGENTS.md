# Item Catalog Root

## Purpose

`features.items.catalog` owns the canonical item catalog read seam: filter options, browser searches, name lookups, and single-item detail loads.

## Canonical Types and APIs

- `CatalogObject` - canonical item catalog root for filter options, search/list reads, name-search reads, and single-item loads.
- `input/LoadFilterOptionsInput` - request and result carrier for item browser filter options.
- `input/SearchItemsInput` - request and result carriers for browser criteria, paging, exclusions, and search results.
- `input/SearchItemsByNameInput` - request and result carrier for short name lookup reads.
- `input/LoadItemInput` - request and result carrier for single-item detail loads.

## Where New Code Goes

- Put new item catalog read requests under this owner.
- Keep catalog-only request/result carriers in `input/`.
- Keep legacy `features.items.api.ItemCatalogService` as compatibility only when older consumers still need it.

## Forbidden Drift

- Do not make `features.items.api.ItemCatalogService` the canonical item catalog root again.
- Do not move item catalog reads into consuming features such as `loottable` or `ui.shell`.
- Do not treat `features.items.repository.ItemRepository` as the public product seam.
