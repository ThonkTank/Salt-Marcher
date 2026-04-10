# Creature Catalog Root

## Purpose

`features.creatures.catalog` owns the canonical creature catalog read seam: filter options, browser searches, single-creature loads, and encounter-facing candidate reads.

## Canonical Types and APIs

- `CatalogObject` - canonical creature catalog root for counts, filter options, search/list loads, single-creature loads, and encounter candidate reads.
- `input/CountAllInput` - request for total creature count.
- `input/LoadFilterOptionsInput` - request and result carrier for browser filter options.
- `input/SearchCreaturesInput` - request and result carriers for browser criteria, paging, exclusions, and search results.
- `input/LoadCreatureInput` - request and result carrier for single-creature reads.
- `input/LoadCreaturesByIdsInput` - request and result carrier for bulk creature-id loads, including encounter-generation projection mode.
- `input/LoadEncounterCandidatesInput` - request and result carrier for encounter candidate reads by filters.

## Where New Code Goes

- Put new creature catalog read requests under this owner.
- Keep catalog-only request/result carriers in `input/`.
- Keep legacy `features.creatures.api.CreatureCatalogService` as compatibility only when older consumers still need it.

## Forbidden Drift

- Do not make `features.creatures.api.CreatureCatalogService` the canonical catalog root again.
- Do not move creature catalog reads into consuming features such as `encounter`, `tables`, or `ui.bootstrap`.
- Do not treat legacy `repository/` at the feature root as the public product seam.
