# Items Feature

`features.items` owns item data, item search/read use cases, and the reusable item-catalog UI building blocks that other features can compose.

| Public API | Internal | Allowed consumers |
| --- | --- | --- |
| `features.items.api` | `model`, `repository`, `importer`, `service`, `ui` | `ui.bootstrap`, feature modules that need item data or reusable item widgets |

## Public surface

- `ItemCatalogService` is the supported read boundary for item search, filter options, and item details.
- `ItemBrowserPane`, `ItemFilterPane`, and `ItemViewerPane` are reusable item-owned UI building blocks.
- `ItemBrowserPageLoader` and `ItemBrowserRowAction` are the supported extension points when a host feature needs custom paging behavior or a feature-specific row action.

## Boundary notes

- `features.items.api` is the only public cross-feature surface for item reads and reusable item widgets.
- Concrete JavaFX implementations live under `features.items.ui.shared.catalog`; `features.items.api` exposes the supported entry points to those item-owned widgets.
- The shared browser is intentionally item-catalog-neutral. Feature-specific actions such as "add to loot table" must be supplied by the host feature, not hard-coded inside `features.items`.
- Other features must not import `features.items.model` or `features.items.ui.shared.*` directly.

## Where changes belong

- Change item search/filter/detail behavior in `features.items`.
- Change host-specific actions, selection rules, or exclusion policies in the consuming feature.
- Keep shell/bootstrap wiring at the module boundary; avoid wiring item-widget internals directly from `ui.bootstrap`.
