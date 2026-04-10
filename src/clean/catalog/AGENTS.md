# Clean Catalog

## Purpose

`src/clean/catalog` owns the top-level Clean catalog workspace surfaced in the sidebar. It is the long-lived browser home for reusable content slices such as creatures now and spells/items later.

## Canonical Types and APIs

- `CatalogObject.composeCatalog(ComposeCatalogInput)` — catalog surface request — returns the top-level shell surface for the Clean catalog workspace.

## Where New Code Goes

- Keep top-level catalog surface ownership here instead of pushing catalog-specific surface assembly back into `clean.featuretabs`.
- Keep concrete content products such as creatures, spells, and items in their own owners and mount them here through passive content packets.

## Forbidden Drift

- Do not move reusable creature browser/statblock logic into this owner.
- Do not turn `CatalogObject` into a generic shell registry; it owns one top-level workspace surface only.
