# Loot Tables Feature

## Purpose

`features.loottable` owns loot-table state, loot-table mutations, and the loot-table composition of item-catalog UI.

## Canonical Types and APIs

- `LoottableObject` — canonical root seam for loot-table reads, mutations, and weighted-item loading.
- `LootTableEditorView` — loot-table editor surface.
- `LootTableApi` — compatibility facade for older cross-feature loot-table readers.
- `LootTableModule.start(...)` — module startup seam that wires inspector handling and item-filter loading.
- `features.items.catalog.CatalogObject` — canonical external item catalog seam consumed by the loot-table feature.
- `features.items.api` — item-owned compatibility UI surface still reused by the loot-table feature.

## Where New Code Goes

- Put loot-table creation, rename, delete, entry weights, duplicate rules, weighted-item reads, and exclusion rules here.
- Keep loot-table-specific browser actions and exclusion behavior in the loot-table feature.
- Keep item search, filter, and item detail semantics in `features.items.catalog`.

## Forbidden Drift

- Do not reintroduce `service` as the factual loot-table root.
- Do not move loot-table-specific browser policy into the items feature.
- Do not let bootstrap bypass the module startup seam for loot-table wiring.
