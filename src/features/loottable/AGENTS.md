# Loot Tables Feature

## Purpose

`features.loottable` owns loot-table state, loot-table mutations, and the loot-table composition of item-catalog UI.

## Canonical Types and APIs

- `LootTableEditorView` — loot-table editor surface.
- `LootTableModule.start(...)` — module startup seam that wires inspector handling and item-filter loading.
- `features.items.catalog.CatalogObject` — canonical external item catalog seam consumed by the loot-table feature.
- `features.items.api` — item-owned compatibility UI surface still reused by the loot-table feature.

## Where New Code Goes

- Put loot-table creation, rename, delete, entry weights, duplicate rules, and exclusion rules here.
- Keep loot-table-specific browser actions and exclusion behavior in the loot-table feature.
- Keep item search, filter, and item detail semantics in `features.items.catalog`.

## Forbidden Drift

- Do not move loot-table-specific browser policy into the items feature.
- Do not let bootstrap bypass the module startup seam for loot-table wiring.
