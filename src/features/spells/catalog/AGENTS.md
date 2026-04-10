# Spell Catalog Root

## Purpose

`features.spells.catalog` owns the canonical spell catalog read seam: filter options, browser searches, and single-spell detail loads.

## Canonical Types and APIs

- `CatalogObject` - canonical spell catalog root for filter options, search/list reads, and single-spell loads.
- `input/LoadFilterOptionsInput` - request and result carrier for spell browser filter options.
- `input/SearchSpellsInput` - request and result carriers for browser criteria, paging, and search results.
- `input/LoadSpellInput` - request and result carrier for single-spell detail loads.

## Where New Code Goes

- Put new spell catalog read requests under this owner.
- Keep catalog-only request/result carriers in `input/`.
- Keep legacy `features.spells.api.SpellCatalogService` as compatibility only when older consumers still need it.

## Forbidden Drift

- Do not make `features.spells.api.SpellCatalogService` the canonical spell catalog root again.
- Do not move spell catalog reads into consuming shell or bootstrap features.
- Do not treat `features.spells.repository.SpellRepository` as the public product seam.
