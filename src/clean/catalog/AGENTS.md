# Clean Catalog

## Purpose

`src/clean/catalog` owns the top-level `Catalog` workspace surface. It hosts reusable content slices, because the workspace owner should decide how content is mounted without absorbing the content's domain logic.

## Canonical Types And APIs

- `CatalogObject.composeCatalog(ComposeCatalogInput)` - returns the top-level shell surface for the clean catalog workspace.

## Where New Code Goes

- Keep workspace-level surface composition here, because `Catalog` owns the top-level shell surface.
- Mount concrete content products here through passive content packets, because creatures, items, or spells should keep their own domain owners.

## Forbidden Drift

- Keep creature-specific browser, statblock, and data-loading logic in `clean.creatures`, because `Catalog` is a host surface, not a creature owner.
- Keep shell registry mechanics in `clean.shell`, because this owner should describe one workspace surface only.
