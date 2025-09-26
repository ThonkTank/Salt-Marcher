# Library Workspace

The Library workspace centralises data sources for creatures, spells, terrains, and regions. It ensures every repository exists before rendering, attaches dedicated watchers per mode, and cleans up resources whenever you switch contexts.【F:salt-marcher/src/apps/library/view.ts†L1-L120】

## Layout primer
1. **Mode buttons** switch between Creatures, Spells, Terrains, and Regions. Only the active renderer stays mounted; previous renderers are destroyed, taking their watchers with them.【F:salt-marcher/src/apps/library/view.ts†L66-L118】
2. **Search & create bar** filters the visible list and passes the search text to `handleCreate` so you can prefill new entries. The search string persists across mode changes.【F:salt-marcher/src/apps/library/view.ts†L90-L118】
3. **Source description** displays the backing file or folder for the active mode, helping you verify watcher targets at a glance.【F:salt-marcher/src/apps/library/view.ts†L119-L145】

## Creatures
- Files live under `SaltMarcher/Creatures/`. The renderer loads the directory, lists entries with fuzzy scoring, and opens files with Obsidian’s native file opener.【F:salt-marcher/src/apps/library/view/creatures.ts†L1-L45】
- Watcher behaviour: `watchCreatureDir` keeps the list in sync; switching away disposes the watcher via `registerCleanup`. No debounced saves are required because edits happen in Markdown files opened externally.【F:salt-marcher/src/apps/library/view/creatures.ts†L10-L33】
- Creating entries invokes `CreateCreatureModal`, saves a new file, and reopens it in source mode for immediate editing.【F:salt-marcher/src/apps/library/view/creatures.ts†L35-L45】

## Spells
- Mirrors the creature workflow with `SaltMarcher/Spells/` as its backing directory.【F:salt-marcher/src/apps/library/view/spells.ts†L1-L45】
- Watcher behaviour matches creatures via `watchSpellDir`, ensuring the UI refreshes whenever new spells are added externally.【F:salt-marcher/src/apps/library/view/spells.ts†L10-L33】
- Creation uses `CreateSpellModal` and reopens the newly minted note just like creatures.【F:salt-marcher/src/apps/library/view/spells.ts†L35-L45】

## Terrains
- Data source: `SaltMarcher/Terrains.md`, maintained as a fenced `terrain` code block. The renderer guarantees an empty entry exists so the map always has a default terrain option.【F:salt-marcher/src/apps/library/view/terrains.ts†L1-L66】
- Editing workflow: table rows let you rename, recolour, tweak speed, or delete terrains. Every change writes to an in-memory copy before re-rendering the list for immediate feedback.【F:salt-marcher/src/apps/library/view/terrains.ts†L67-L147】
- **Debounced saves:** Terrain mutations call `scheduleSave`, bundling edits for 500 ms before persisting. After saving, the renderer reloads from disk to respect external updates.【F:salt-marcher/src/apps/library/view/terrains.ts†L148-L204】
- **Watchers:** `watchTerrains` reloads the palette whenever the file changes elsewhere (including travel mode). The renderer registers the disposer so the watcher stops as soon as the mode is deactivated.【F:salt-marcher/src/apps/library/view/terrains.ts†L15-L36】

## Regions
- Data source: `SaltMarcher/Regions.md`, stored in a fenced `regions` code block that lists name, terrain link, and optional `encounter: 1/n` odds.【F:salt-marcher/src/apps/library/view/regions.ts†L1-L58】【F:salt-marcher/src/core/regions-store.ts†L5-L58】
- Editing workflow: each row contains name, terrain dropdown (search-enhanced), encounter odds, and delete controls. Terrain names are re-populated dynamically whenever the shared palette changes.【F:salt-marcher/src/apps/library/view/regions.ts†L59-L129】
- **Debounced saves:** Like terrains, region changes buffer for 500 ms before `saveRegions` writes the block back to disk and reloads it to avoid drift.【F:salt-marcher/src/apps/library/view/regions.ts†L130-L182】
- **Watchers:** The renderer subscribes to both `watchRegions` and `watchTerrains`. Regions reload on direct edits, while terrain updates refresh the dropdown contents without losing unsaved changes.【F:salt-marcher/src/apps/library/view/regions.ts†L16-L41】

## Cross-links
- [Cartographer](./Cartographer.md) – the editor and inspector modes consume these terrain and region definitions.
- [Data Management](./Data-Management.md) – explains the fenced block formats that Library persists and how watchers signal updates.
