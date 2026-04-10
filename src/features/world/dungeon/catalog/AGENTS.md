# Dungeon Catalog

## Purpose

`catalog` owns dungeon-map list loading, selection policy, and catalog writes such as create, rename, and delete.

## Canonical Types and APIs

- `CatalogObject` — public catalog root seam — accepts typed map-list, selection-policy, and catalog-write requests.
- `input/LoadMapListInput` — map-list read request carrier — provides the JDBC connection and returns the ordered dungeon-map catalog entries.
- `input/ResolveSelectionInput` — map-selection policy request carrier — provides the current catalog list plus requested/preferred/excluded map ids and returns the requested map plus ordered fallback candidates.
- `input/CreateMapInput` — create-map request carrier — provides the authored dungeon name.
- `input/RenameMapInput` — rename-map request carrier — provides the target map id plus the authored name.
- `input/DeleteMapInput` — delete-map request carrier — provides the target map id for destructive catalog writes.

## Where New Code Goes

- Put new public catalog list, selection, and write requests under `input/`.
- Put cross-owner catalog entrypoints on `CatalogObject`.
- Keep workflow and persistence collaborators internal to `catalog`.

## Forbidden Drift

- Do not leave map-list ordering or active-map candidate selection as implicit policy under dungeonmap loading helpers.
- Do not expose catalog writes directly from shell views or dropdown controllers.
- Do not add a second public catalog list/write/selection seam beside `CatalogObject`.
