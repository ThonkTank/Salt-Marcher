# Terrain Store Overview

## Module Purpose
The terrain store encapsulates reading and writing the shared terrain palette that the Salt Marcher plugin keeps in `SaltMarcher/Terrains.md`. It exposes helpers to ensure the file exists with sensible defaults, parse and stringify the fenced code block that stores terrain definitions, and synchronise in-memory state (`setTerrains`) whenever the vault copy changes.

## Structure Diagram
```
+----------------------+      ensure/save/load      +----------------------------+
|  Obsidian Vault API  | <-----------------------> |  terrain-store.ts helpers  |
+----------+-----------+                           +------------+---------------+
           ^                                                          |
           | modify/delete events                                     |
           |                                                          v
           |                                           +-------------------------+
           +-------------------------------------------+ Global terrain registry |
                                                       |   (setTerrains)         |
                                                       +-------------------------+
```

## Key Functions
- `ensureTerrainFile(app)` – Creates the terrain markdown file with default YAML frontmatter, headings, and a starter palette if it does not already exist.
- `parseTerrainBlock(md)` / `stringifyTerrainBlock(map)` – Bidirectional conversion between the fenced code block format and a typed record of terrain metadata.
- `loadTerrains(app)` – Ensures the file, reads the markdown, and parses the fenced block into an in-memory palette.
- `saveTerrains(app, next)` – Persists palette updates by rewriting (or appending) the terrain code block in the markdown file.
- `watchTerrains(app, options)` – Subscribes to Obsidian vault events and keeps the global palette aligned with file changes. `options.onChange` replaces the legacy callback signature; `options.onError` logs or forwards failures without surfacing unhandled promise rejections.

## Watcher Flow
1. The watcher attaches to both `modify` and `delete` vault events through a shared dispatcher that filters for `SaltMarcher/Terrains.md`.
2. On `delete` the handler first calls `ensureTerrainFile` to recreate the file with default content, guaranteeing a valid fenced block exists immediately after removal.
3. Both `modify` and `delete` paths call a shared `update` routine that reloads the file via `loadTerrains`, pushes the palette into the in-memory registry with `setTerrains`, and only then emits the `salt:terrains-updated` workspace event followed by the optional `onChange` callback. Exceptions are caught and rerouted through the configured `onError` handler (or `console.error` by default) so the watcher stays attached even if vault access fails temporarily.
4. The disposer returned by `watchTerrains` tears down every registered `EventRef` exactly once, ensuring no lingering listeners remain if the watcher is disposed repeatedly.

## Data Flow Notes
- The parsing layer always injects an empty-name entry with a transparent colour and speed `1` to provide a default terrain for unpainted hexes.
- Serialisation sorts the transparent default first and all remaining entries alphabetically, keeping diffs predictable when the palette is edited.
- Consumers outside this module should rely on the workspace event or the optional callback from `watchTerrains` instead of re-reading the file manually.
