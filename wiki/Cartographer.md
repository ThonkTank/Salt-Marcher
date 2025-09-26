# Cartographer Workspace

The Cartographer workspace combines the map shell, map header, and presenter-driven mode lifecycle to manage every aspect of your hex maps. The presenter constructs the shell, wires callbacks to the header, and coordinates the map manager so every action remains in sync with the loaded file.【F:salt-marcher/src/apps/cartographer/presenter.ts†L59-L136】

## Map header actions
The header shown above the map is powered by `createMapHeader` and `createMapManager`. Together they provide:
- **Open map** – prompts you to pick an existing hex map file and broadcasts the selection to all active components.【F:salt-marcher/src/ui/map-header.ts†L88-L112】【F:salt-marcher/src/ui/map-manager.ts†L47-L68】
- **Create map** – launches the create workflow and automatically loads the new file into the presenter.【F:salt-marcher/src/ui/map-header.ts†L114-L134】【F:salt-marcher/src/ui/map-manager.ts†L69-L87】
- **Delete map** – (when enabled) triggers the confirmation modal and, on success, clears the current state so the UI stays consistent.【F:salt-marcher/src/ui/map-header.ts†L136-L159】【F:salt-marcher/src/ui/map-manager.ts†L88-L117】
- **Save / Save As** – exposes a dropdown plus trigger button so you can persist the current map directly or via "Save As", falling back to presenter-provided hooks when available.【F:salt-marcher/src/ui/map-header.ts†L161-L218】

## Mode switcher
The dropdown on the right side of the header delegates to the presenter, which maintains the active mode and ensures lifecycle methods (`onEnter`, `onExit`, `onFileChange`) run serially. Switching modes always cleans up the previous mode before mounting the next, preventing leaked listeners or lingering DOM state.【F:salt-marcher/src/apps/cartographer/presenter.ts†L101-L214】 See the sections below for details on each mode.

## Travel mode
Travel mode focuses on route playback and encounter hand-offs.
- **Terrain bootstrapping** – on entry the mode reloads the shared terrain palette and subscribes to `salt:terrains-updated`, keeping the travel palette synchronized with the Library view.【F:salt-marcher/src/apps/cartographer/modes/travel-guide.ts†L19-L88】
- **Route and token layers** – `createRouteLayer` and `createTokenLayer` draw current routes, highlights, and the traveling token. Map interactions (drag, context menus, suppression) are coordinated through the interaction controller so the presenter can stay stateless.【F:salt-marcher/src/apps/cartographer/modes/travel-guide.ts†L89-L173】
- **Playback controls** – the sidebar mounts the playback controller with play, pause, reset, and tempo actions that mutate the travel logic state.【F:salt-marcher/src/apps/cartographer/modes/travel-guide.ts†L41-L83】【F:salt-marcher/src/apps/cartographer/modes/travel-guide/playback-controller.ts†L1-L120】
- **Encounter hand-off** – whenever `onEncounter` fires, travel mode pauses the logic and calls `openEncounter`, prompting Obsidian to show the encounter view. Travel automatically re-opens the encounter pane if the module is available.【F:salt-marcher/src/apps/cartographer/modes/travel-guide.ts†L174-L222】

## Editor mode
Editor mode equips you with the terrain brush and any future tools.
- **Tool lifecycle** – the sidebar renders a tool selector and panel body. Changing tools deactivates the previous tool, mounts the new panel, and calls `onActivate`/`onMapRendered` hooks as soon as render handles are ready.【F:salt-marcher/src/apps/cartographer/modes/editor.ts†L9-L120】
- **Terrain brush** – the default tool lets you paint terrain/region assignments with search-enabled dropdowns. It receives map handles from the presenter and updates both the rendered hexes and underlying markdown data; see [Library](./Library.md) for how terrains and regions feed this tool.【F:salt-marcher/src/apps/cartographer/modes/editor.ts†L121-L182】【F:salt-marcher/src/apps/cartographer/editor/tools/terrain-brush/brush-options.ts†L1-L167】
- **Hex interactions** – `onHexClick` forwards coordinates to the active tool, allowing contextual editing per selection.【F:salt-marcher/src/apps/cartographer/modes/editor.ts†L183-L199】

## Inspector mode
Inspector mode surfaces per-hex metadata for quick adjustments.
- **Selection workflow** – clicking a hex loads its terrain and note via `loadTile` and keeps the sidebar message in sync with the active selection.【F:salt-marcher/src/apps/cartographer/modes/inspector.ts†L1-L120】
- **Buffered saves** – edits queue a 250 ms timeout before calling `saveTile`, preventing excessive disk writes while still keeping the renderer colourised through `setFill`.【F:salt-marcher/src/apps/cartographer/modes/inspector.ts†L121-L204】
- **Terrain palette** – inspector uses the global `TERRAIN_COLORS` map, so any change propagated by the Library or travel mode applies immediately when the watcher signals an update.【F:salt-marcher/src/apps/cartographer/modes/inspector.ts†L13-L24】【F:salt-marcher/src/core/terrain-store.ts†L65-L86】

## Related articles
- [Getting Started](./Getting-Started.md) – opening the Cartographer view for the first time.
- [Library](./Library.md) – how terrain and region data stay in sync with editor and inspector modes.
- [Encounter](./Encounter.md) – what happens after travel mode triggers `openEncounter`.
- [Data Management](./Data-Management.md) – file formats and watcher behaviour referenced in the modes above.
