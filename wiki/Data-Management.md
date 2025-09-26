# Data Management

This article describes how Salt Marcher stores shared terrain and region data, how watchers broadcast changes, and which components consume those signals. For usage guidance, see [Library](./Library.md) and [Cartographer](./Cartographer.md).

## Terrain palette (`SaltMarcher/Terrains.md`)
- **Bootstrap:** `ensureTerrainFile` creates the Markdown file with YAML frontmatter, a `# Terrains` heading, and a seeded palette if it does not already exist.【F:salt-marcher/src/core/terrain-store.ts†L1-L33】
- **Format:** Terrains live inside a fenced `terrain` code block. Each line follows `Name: #aabbcc, speed: 0.8`. The empty name (`:`) always exists and resolves to `transparent` with speed `1`, ensuring hexes can fall back to a default.【F:salt-marcher/src/core/terrain-store.ts†L34-L63】
- **Persistence:** `saveTerrains` rewrites the fenced block in place (or appends one) and resorts entries so the empty key stays first and remaining names are alphabetical.【F:salt-marcher/src/core/terrain-store.ts†L64-L83】
- **Watcher:** `watchTerrains` listens to Obsidian vault `modify` and `delete` events. On delete it recreates the file, reloads the palette, updates the global renderer state via `setTerrains`, and emits the `salt:terrains-updated` workspace event before invoking any optional callback.【F:salt-marcher/src/core/terrain-store.ts†L84-L122】
- **Consumers:**
  - Library terrains mode refreshes its table when `watchTerrains` fires.【F:salt-marcher/src/apps/library/view/terrains.ts†L15-L36】
  - Regions mode re-queries terrain names to keep dropdowns current.【F:salt-marcher/src/apps/library/view/regions.ts†L16-L41】
  - Cartographer travel mode subscribes to `salt:terrains-updated` to keep playback palettes synchronised.【F:salt-marcher/src/apps/cartographer/modes/travel-guide.ts†L41-L88】
  - Cartographer inspector mode relies on the global `TERRAIN_COLORS` map that the watcher updates.【F:salt-marcher/src/apps/cartographer/modes/inspector.ts†L13-L24】

## Regions list (`SaltMarcher/Regions.md`)
- **Bootstrap:** `ensureRegionsFile` mirrors the terrain bootstrap by creating the Markdown file with YAML frontmatter, heading, and commented usage hints if absent.【F:salt-marcher/src/core/regions-store.ts†L1-L28】
- **Format:** Regions appear in a fenced `regions` code block. Each line follows `Name: Terrain, encounter: 1/n` where the encounter clause is optional. Parsing accepts bare integers (`encounter: 6`) but serialisation always normalises back to `1/n`.【F:salt-marcher/src/core/regions-store.ts†L29-L58】
- **Persistence:** `saveRegions` rewrites or appends the code block like terrains, ensuring external edits are preserved while the block stays canonical.【F:salt-marcher/src/core/regions-store.ts†L59-L83】
- **Watcher:** `watchRegions` subscribes to `modify` and `delete` events for the regions file and triggers the `salt:regions-updated` workspace event before calling the supplied callback. Unlike terrains, it does not recreate the file—Library mode already guards creation on init.【F:salt-marcher/src/core/regions-store.ts†L84-L101】
- **Consumers:**
  - Library regions mode refreshes the list when the watcher fires and reuses the same disposer pattern as terrains.【F:salt-marcher/src/apps/library/view/regions.ts†L16-L41】
  - Cartographer editor tools call `loadRegions` to populate dropdowns and rely on `salt:regions-updated` to stay up to date.【F:salt-marcher/src/apps/cartographer/editor/tools/terrain-brush/brush-options.ts†L1-L120】

## Synchronisation tips
- Watcher callbacks run asynchronously; avoid triggering heavy work directly inside them. Instead, schedule UI updates or reloads the way existing modes do.
- After external edits (e.g. vault sync), re-open the Library modes to confirm watchers picked up changes. The debounced save logic ensures manual edits never flood the disk, but watchers still fire for every persisted batch.

## Cross-links
- [Getting Started](./Getting-Started.md) – explains how the terrain bootstrap is triggered during plugin activation.
- [Library](./Library.md) – documents the editing workflows built on top of these storage formats.
- [Cartographer](./Cartographer.md) – shows how travel, editor, and inspector modes react to watcher events.
