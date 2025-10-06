# Renderer Contract Audit

`ModeRenderer` promises synchronous `render()` plus explicit `init`, `handleCreate` and `destroy` hooks with cleanup helpers. 【F:src/apps/library/view/mode.ts†L9-L53】

## Contract Alignment
| Renderer | Contract Deviations | Lifecycle Notes |
| --- | --- | --- |
| CreaturesRenderer | Declares `async render()` although interface expects `void`, leading to ignored promises when shell calls `render()`. 【F:src/apps/library/view/creatures.ts†L122-L144】 | Registers watcher cleanup, but repeated `render()` re-parses all files and reattaches DOM listeners without disposing prior controls. Manual metadata reads happen inside render, so slow IO can overlap successive renders. 【F:src/apps/library/view/creatures.ts†L128-L205】 |
| SpellsRenderer | Follows contract (`render()` sync) and watcher cleanup via `registerCleanup`. 【F:src/apps/library/view/spells.ts†L13-L39】 | Renders simple button list; no additional listeners beyond per-row click. |
| ItemsRenderer | `render()` synchronous, but `handleImport()` spawns async modal operations without cancellation on `destroy()`. 【F:src/apps/library/view/items.ts†L23-L101】 | Watcher cleanup registered; however regex body extraction occurs per import and JSON parse failures are swallowed. |
| EquipmentRenderer | Same pattern as items; modal promises continue after `destroy()`. 【F:src/apps/library/view/equipment.ts†L23-L101】 | Watcher cleanup registered. |
| TerrainsRenderer | `render()` synchronous but attaches multiple DOM listeners per row; on re-render, old inputs are GC’d but pending debounced saves survive until `flushSave()` during `destroy()`. 【F:src/apps/library/view/terrains.ts†L45-L162】 | Calls `flushSave()` in `destroy()` before clearing container, ensuring pending writes run. 【F:src/apps/library/view/terrains.ts†L134-L150】 |
| RegionsRenderer | Sync `render()` with inline listeners; `handleCreate` mutates array then renders. 【F:src/apps/library/view/regions.ts†L46-L148】 | `destroy()` flushes pending save before delegating to base cleanup. 【F:src/apps/library/view/regions.ts†L101-L123】 |

## Lifecycle Risks
- `BaseModeRenderer.destroy()` clears cleanups and empties container, but renderers that spawn modals (`new Create*Modal`) don’t register their modal lifecycle, so closing the view leaves orphaned modals if still open. 【F:src/apps/library/view/creatures.ts†L210-L237】【F:src/apps/library/view/items.ts†L64-L101】
- Debounced save timers for terrains/regions persist even if mode switches rapidly; `flushSave()` mitigates on destroy but concurrent renders may schedule overlapping timers that reload data mid-edit. 【F:src/apps/library/view/terrains.ts†L130-L161】【F:src/apps/library/view/regions.ts†L101-L164】
- Search query propagation relies on renderers implementing `setQuery`; `BaseModeRenderer.setQuery()` re-invokes `render()` immediately, so asynchronous renders (creatures) can race with `activateMode()`’s manual `render()` call. 【F:src/apps/library/view/mode.ts†L25-L33】【F:src/apps/library/view.ts†L118-L123】
