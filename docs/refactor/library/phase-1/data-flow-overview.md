# Data Flow Overview

## Library Shell Lifecycle
- When the view opens it ensures all sources, renders the shell, then activates the current mode renderer. 【F:src/apps/library/view.ts†L50-L123】
- Each mode renderer inherits `BaseModeRenderer`, which lowercases queries, triggers `render()` on search changes and clears registered cleanups on `destroy()`. 【F:src/apps/library/view/mode.ts†L17-L53】

## Creatures
1. **Initial load** – `CreaturesRenderer.init()` lists creature files via the pipeline and registers a directory watcher to refresh the list. 【F:src/apps/library/view/creatures.ts†L112-L120】
2. **Rendering** – On each render it reads metadata (metadata cache fallback to manual YAML parsing) for every file before drawing filter/sort controls and rows. 【F:src/apps/library/view/creatures.ts†L122-L205】
3. **Create/Edit** – The modal persists data with `createCreatureFile()` (pipeline) and reopens the created file; editing reuses presets via `loadCreaturePreset()` to populate the modal. 【F:src/apps/library/view/creatures.ts†L210-L237】
4. **Pipeline** – Creature files rely on the shared vault pipeline for `ensure/list/watch/create`, with `statblockToMarkdown()` handling markdown serialization and JSON frontmatter fields. 【F:src/apps/library/core/creature-files.ts†L96-L142】

## Spells
1. **Load & watch** – Lists spell files and re-renders when the watcher fires. 【F:src/apps/library/view/spells.ts†L13-L20】
2. **Render** – Applies name-based scoring and opens Obsidian links on click. 【F:src/apps/library/view/spells.ts†L21-L38】
3. **Create** – Modal uses `createSpellFile()` to persist before reopening the saved markdown. 【F:src/apps/library/view/spells.ts†L39-L46】
4. **Serialization** – Spell pipeline handles YAML arrays, boolean flags and markdown body composition. 【F:src/apps/library/core/spell-files.ts†L18-L41】

## Items
1. **Load & watch** – Same pipeline pattern; watcher refreshes files. 【F:src/apps/library/view/items.ts†L13-L22】
2. **Import flow** – Reads metadataCache/frontmatter, parses JSON strings, and reserializes via `itemToMarkdown()` during modal save. 【F:src/apps/library/view/items.ts†L45-L111】
3. **Persistence** – Item schema encodes arrays (YAML) plus multiple `*_json` blobs for structured data. 【F:src/apps/library/core/item-files.ts†L9-L75】

## Equipment
1. **Load/watch** – Mirrors items with its own pipeline. 【F:src/apps/library/view/equipment.ts†L13-L22】
2. **Import** – Reads frontmatter and updates file via `equipmentToMarkdown()` on modal submit. 【F:src/apps/library/view/equipment.ts†L44-L104】
3. **Schema** – Equipment serializer outputs per-type fields with YAML lists. 【F:src/apps/library/core/equipment-files.ts†L17-L89】

## Terrains
1. **Ensure & load** – Renderer ensures the terrain file, loads map from code block and inserts a blank key. 【F:src/apps/library/view/terrains.ts†L15-L44】
2. **User edits** – Inputs update in-memory map, schedule debounced saves and allow deletion; every change marks renderer dirty. 【F:src/apps/library/view/terrains.ts†L45-L129】
3. **Persistence** – Save flush writes via `saveTerrains()` and reloads from disk; watcher keeps UI synced with vault changes and also updates global terrain store. 【F:src/apps/library/view/terrains.ts†L130-L161】【F:src/core/terrain-store.ts†L32-L82】

## Regions
1. **Initialisation** – Ensures regions file, loads regions and terrain names in parallel. 【F:src/apps/library/view/regions.ts†L16-L28】
2. **Watchers** – Registers watchers for both regions and terrains to keep dropdown options fresh. 【F:src/apps/library/view/regions.ts†L29-L36】
3. **Editing** – Inputs mutate region objects, scheduling saves; deletions update arrays and trigger save. 【F:src/apps/library/view/regions.ts†L46-L112】
4. **Persistence** – Debounced `flushSave()` writes to vault and reloads the list; underlying store serializes code block and auto-recreates missing files with notices. 【F:src/apps/library/view/regions.ts†L113-L164】【F:src/core/regions-store.ts†L1-L86】

## Presets & Imports
- Creature presets use a dedicated pipeline to list files and parse frontmatter into `StatblockData`, applying alignment and spellcasting migrations. 【F:src/apps/library/core/creature-presets.ts†L9-L118】
- Item/equipment importers parse metadataCache frontmatter and JSON strings manually before reserializing through the respective serializer. 【F:src/apps/library/view/items.ts†L52-L111】【F:src/apps/library/view/equipment.ts†L52-L104】

## Test Harness
- Vitest suite stubs all renderers to validate shell copy and mode switching, ensuring source descriptions align with `describeLibrarySource()`. 【F:tests/library/view.test.ts†L1-L67】
