# Getting Started

This guide walks you through installing Salt Marcher, activating the plugin inside Obsidian, bootstrapping the shared terrain data, and opening every workspace that ships with the project. For a conceptual overview of features, start at the [Home](./Home.md) page.

## 1. Install the plugin
1. Download the latest release bundle or build it locally (see repository instructions).
2. Copy the compiled plugin folder (containing `manifest.json`, `main.js`, and `styles.css` if present) into your vault under `.obsidian/plugins/salt-marcher`.
3. Restart or reload Obsidian so it discovers the new plugin.

> 💡 **Development build:** Run `npm install` followed by `npm run build` inside `salt-marcher/`. The build outputs `main.js` alongside the existing `manifest.json` for manual deployment.

## 2. Enable Salt Marcher in Obsidian
1. Open **Settings → Community plugins**.
2. Toggle **Salt Marcher** on. The plugin registers the Cartographer, Library, and Encounter views, injects its stylesheet, and starts watching terrain data immediately.【F:salt-marcher/src/app/main.ts†L15-L59】
3. Optional: pin the "Open Cartographer" (compass) and "Open Library" (book) ribbon icons to the sidebar for quicker access.

## 3. Bootstrap shared terrains
Salt Marcher maintains a shared terrain palette in `SaltMarcher/Terrains.md`. On first load the plugin ensures the file exists with default entries, reads it, and pushes the palette into the global renderer state.【F:salt-marcher/src/core/terrain-store.ts†L5-L64】

If you prefer to prepare the vault ahead of time, run the **Command Palette → Salt Marcher: Cartographer öffnen** command once after enabling the plugin; this triggers the same bootstrap path.

## 4. Open each workspace
Salt Marcher exposes three dedicated workspaces. All can be opened via the ribbon buttons or the command palette unless otherwise noted.

### Cartographer
- Use **Command Palette → Salt Marcher: Cartographer öffnen** or click the compass icon.
- The view mounts the map shell, map header, and the default mode. Travel, Editor, and Inspector modes can be switched via the header dropdown; see [Cartographer](./Cartographer.md) for details.

### Library
- Use **Command Palette → Salt Marcher: Library öffnen** or click the book icon.
- When the view loads it ensures creature, spell, terrain, and region sources exist, attaches file watchers, and displays the mode switcher tabs; see [Library](./Library.md).

### Encounter
- The encounter workspace is primarily opened automatically by the travel mode when a route triggers an encounter hand-off. Manual access requires creating a new pane (`Ctrl/Cmd+P → Open view by type`) and selecting `salt-marcher-encounter`.
- The view currently focuses on providing a dedicated layout placeholder; see [Encounter](./Encounter.md) for the present state.

## 5. Next steps
- Review the [Cartographer](./Cartographer.md) guide to learn how each mode behaves.
- Visit the [Library](./Library.md) article for data management workflows and watcher expectations.
- Inspect [Data Management](./Data-Management.md) if you need precise format specifications for terrains and regions.
