# Loot Tables Feature

`features.loottable` owns loot-table state, mutations, and the item-catalog composition used to edit a table.

## Ownership

- Loot-table creation, rename, delete, entry weights, and duplicate/exclusion rules belong here.
- `LootTableEditorView` composes the neutral item browser from `features.items.api` with loot-table-specific add/exclusion behavior.
- Item search, filter options, and item detail rendering remain item-owned and are consumed through `features.items.api`.
- Bootstrap should activate the module via `LootTableModule.start(...)`, which wires the inspector handler and kicks off item filter loading.

## Where changes belong

- Change how loot tables add/remove/update entries in `features.loottable`.
- Change loot-table-specific browser actions or exclusion behavior in `features.loottable.ui`.
- Change item search/filter/detail semantics in `features.items`.
