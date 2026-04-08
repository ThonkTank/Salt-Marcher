# Dungeon Catalog

## Purpose

`catalog` owns dungeon-map catalog writes such as create, rename, and delete.

## Canonical Types and APIs

- `CatalogObject` — public catalog root seam — accepts typed catalog write requests and delegates the write workflow to the current internal collaborators.
- `input/CreateMapInput` — create-map request carrier — provides the authored dungeon name.
- `input/RenameMapInput` — rename-map request carrier — provides the target map id plus the authored name.
- `input/DeleteMapInput` — delete-map request carrier — provides the target map id for destructive catalog writes.

## Where New Code Goes

- Put new public catalog write requests under `input/`.
- Put cross-owner catalog entrypoints on `CatalogObject`.
- Keep legacy workflow and persistence collaborators internal to `catalog` until their own owner-local migration happens.

## Forbidden Drift

- Do not expose catalog writes directly from shell views or dropdown controllers.
- Do not add a second public catalog write seam beside `CatalogObject`.
