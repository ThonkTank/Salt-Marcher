# Spells Feature

## Purpose

`features.spells` owns spell data, the canonical spell catalog root, the current public spell compatibility surface, and reusable spell-catalog UI building blocks.

## Canonical Types and APIs

- `features.spells.catalog.CatalogObject` — canonical spell catalog root for filter options, search/list reads, and single-spell detail loads.
- `features.spells.api` — current public spell compatibility surface for reads, reusable spell UI, and offense-profile lookup seams. Preserve compatibility here, but do not treat `api/` as placement precedent for new owner-local code.
- `SpellBrowserPane`, `SpellFilterPane` — reusable spell-owned UI building blocks.
- `SpellReadApi`, `SpellOffenseProfileLookup` — spell-owned offense-profile lookup seam consumed by party-analysis code.

## Where New Code Goes

- Put canonical spell catalog reads in `features.spells.catalog`.
- Keep spell search, filter, and detail UI in `features.spells`.
- Keep importer and parser behavior in `features.spells.importer`.
- Do not use legacy `api/` or `service/` naming here as placement precedent for new touched architecture work.

## Forbidden Drift

- Do not treat `features.spells.api.SpellCatalogService` as the canonical spell catalog root again.
- Do not move spell-owned lookup semantics into unrelated consuming features.
- Do not recreate spell catalog reads under shell bootstrap or inspector code.
