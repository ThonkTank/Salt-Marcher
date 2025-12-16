# Cartographer Workmode

**Zweck**: Hex-basierter Karteneditor für D&D-Kampagnen mit Brush-Tools, Layer-Overlays und Terrain-Features.

## Contents

| Element | Beschreibung |
|---------|--------------|
| `index.ts` | Obsidian View Registration und Workmode Entry Point |
| `cartographer-controller.ts` | Haupt-Orchestrator für Lifecycle & Rendering (~482 LOC) |
| `view-builder.ts` | View-Erstellung Factory (Header, Toolbar, Panels) |
| `cartographer-types.ts` | Public Type Definitions und Controller Interfaces |
| `keyboard-handler.ts` | Keyboard Shortcut Management |
| `cartographer-keyboard-shortcuts-help.ts` | Help Modal für Shortcuts |
| `building-management-modal.ts` | UI für Building Production Management |
| `building-modal-persistence.ts` | Persistence Layer für Building Modal |
| `components/` | UI-Komponenten (Toolbar, Layer Panel, Inspector, Tooltips) |
| `editor/` | Tool-System (Brush-Tools, ToolPanelManager, Tool Registry, Form Builder) |
| `domain/` | Domain Types, Controller Interfaces, Type-Safe Events |
| `services/` | Infrastructure Services (Error Boundary, Map Loading, Layer Management) |
| `styles/` | CSS für Cartographer UI |

## Architecture

### Component Hierarchy

```
CartographerController (482 LOC)
    ├── ViewBuilder (204 LOC)
    │       ├── MapHeader (file selector, save)
    │       ├── ToolToolbar (tool switcher)
    │       ├── LayerControlPanel (layer visibility)
    │       └── KeyboardHandler (shortcuts)
    ├── ToolPanelManager → editor/tool-panel-manager.ts
    │       └── Tools (tile-brush, terrain-brush, location-marker, etc.)
    ├── LayerManager (330 LOC) → services/layer-manager.ts
    │       └── Layer Config & Persistence
    └── MapLayer (rendering)
            └── Scene + Overlays
```

### Key Design Decisions (Refactoring 2025-11-26)

1. **Mode-System entfernt**
   - Vorher: `editor-mode.ts`, `lifecycle-mode.ts` mit Mode-Switching
   - Nachher: Direkte Tool-Integration im Controller
   - Grund: Es gab nur einen Mode ("editor"), unnötiger Overhead

2. **LayerManager extrahiert**
   - Vorher: Layer-Logik inline im 941 LOC Controller
   - Nachher: Separate `services/layer-manager.ts` (330 LOC)
   - Verantwortung: Layer Visibility, Persistence, Batch Operations

3. **ViewBuilder extrahiert**
   - Vorher: View-Erstellung inline im Controller
   - Nachher: Factory-Funktion `view-builder.ts` (204 LOC)
   - Verantwortung: Header, Toolbar, Panels, Event Wiring

4. **UndoManager Lifecycle gefixt**
   - Vorher: Dummy-File als Fallback, unsichere `any` Casts
   - Nachher: Type-safe, nur wenn File existiert, kein Dummy

5. **Controller-Größe reduziert**
   - Vorher: 941 LOC (Orchestrator + View + Layer + Lifecycle)
   - Nachher: 482 LOC (~51% Reduktion, nur Orchestration)

## Connections

**Verwendet von:**
- Main Plugin (`src/app/main.ts`) - View Registration

**Abhängig von:**
- `@features/maps` - Tile Rendering, Coordinate Systems, Overlays
- `@features/climate` - Climate Brush Tool
- `@features/factions` - Faction Territory Visualization
- `@services/state` - Reactive Stores (TileStore, etc.)
- `@ui/components` - ViewContainer, Form Builder
- `@ui/maps` - MapHeader, MapManager

## Public API

```typescript
// Controller erstellen
const controller = new CartographerController(app, {
    plugin: pluginInstance,
    // Optional dependency injection for testing
    createMapManager: (app, opts) => createMapManager(app, opts),
    createMapLayer: (app, host, file, opts) => createMapLayer(app, host, file, opts),
    loadHexOptions: async (app, file) => { /* ... */ }
});

// View öffnen
await controller.onOpen(hostElement, fallbackFile);

// Tool wechseln
await controller.switchTool("terrain-brush");

// Layer togglen
controller.toggleLayer("temperature");
controller.toggleLayerPanel();

// Undo/Redo
await controller.undo();
await controller.redo();

// Cleanup
await controller.onClose();
```

## Tool System

### Tool Registry

Tools registrieren sich selbst via `TOOL_REGISTRY` (`editor/tool-registry.ts`):

| Tool ID | Beschreibung | Shortcut |
|---------|--------------|----------|
| `tile-brush` | Basis-Tiles malen | `1` |
| `terrain-brush` | Terrain-Features setzen | - |
| `area-brush` | Regionen/Areas definieren | - |
| `location-marker` | Locations platzieren | `2` |
| `feature-brush` | Spezial-Features (Flüsse, Straßen) | - |
| `climate-brush` | Klima-Zonen bearbeiten | - |
| `inspector` | Hex-Daten inspizieren | `3` |

### Tool Lifecycle

```typescript
// ToolPanelManager koordiniert Tool-Switching
await toolManager.switchTo("terrain-brush");

// Tools implementieren ToolPanelHandle Interface
interface ToolPanelHandle {
    activate(): void;           // Called when tool becomes active
    deactivate(): void;         // Called when switching away
    onHexClick(coord: AxialCoord, event: PointerEvent): Promise<void>;  // Handle hex clicks (uses AxialCoord)
    onMapRendered(): void;      // Notification after map render
    destroy(): void;            // Cleanup resources
}
```

## Layer System

### LayerManager Responsibilities

- Load/save layer config from plugin settings
- Handle layer visibility changes (single + batch)
- Toggle layer panel visibility
- Apply layer presets
- Coordinate with ElevationLayerManager

### Layer Categories

**Base Layers:**
- Terrain Icons (terrain + flora)

**Environment:**
- Weather Overlay
- Water Systems (4 children)
- Elevation Visualization (4 children)

**Human Geography:**
- Terrain Features (5 children: rivers, roads, borders, cliffs, elevation lines)
- Faction Territories
- Location Influence Areas

**Markers & Indicators:**
- Location Markers
- Building Indicators

## Services

### Map Loading (`services/map-loader.ts`)

```typescript
const result = await loadMap(app, file, view, {
    loadHexOptions,
    createMapLayer
}, signal);

// Returns: { layer, options, overlayMessage }
```

### Map Initialization (`services/map-initializer.ts`)

```typescript
const result = await initializeMapSystems(app, file, options);
// Initializes: climate, factions, terrain features
// Returns: { warnings: string[] }
```

### Layer Management (`services/layer-manager.ts`)

```typescript
const layerManager = new LayerManager({
    app,
    plugin,
    getLayerPanel: () => view?.layerPanel ?? null,
    getHandles: () => mapLayer?.handles ?? null,
    elevationManager
});

await layerManager.loadConfig();
layerManager.handleConfigChange(layerId, config);
layerManager.handleConfigChangeBatch(changes);
layerManager.togglePanel(leftSidebarHost);
```

## Usage Example

```typescript
import { openCartographer, VIEW_TYPE_CARTOGRAPHER } from "src/workmodes/cartographer";

// Open specific map
const mapFile = app.vault.getAbstractFileByPath("Maps/world.md");
await openCartographer(app, mapFile as TFile);

// Get current cartographer view
const leaves = app.workspace.getLeavesOfType(VIEW_TYPE_CARTOGRAPHER);
const view = leaves[0]?.view as CartographerView;

// Access controller
const controller = view.controller;

// Switch tool programmatically
await controller.switchTool("terrain-brush");

// Toggle layer
controller.toggleLayer("faction-overlay");
```

## Keyboard Shortcuts

| Shortcut | Action | Context |
|----------|--------|---------|
| `1` | Switch to Tile Brush | All |
| `2` | Switch to Location Marker | All |
| `3` | Switch to Inspector | All |
| `B` | Toggle paint/erase mode | Brush tools |
| `R` | Focus region dropdown | Brush tools |
| `F` | Focus faction dropdown | Brush tools |
| `L` | Toggle layer panel | All |
| `W` | Toggle weather layer | All |
| `Shift+F` | Toggle faction layer | All |
| `?` | Show help modal | All |
| `Ctrl+Z` | Undo | All |
| `Ctrl+Y` | Redo | All |

## Testing

```bash
# Run all Cartographer tests
npm test -- cartographer

# Watch mode (TDD)
./devkit test watch cartographer

# Integration tests
./devkit test run cartographer-integration
```

## See Also

- [docs/workmodes/cartographer.md](/home/aaron/ObsVaults/DnD/.obsidian/plugins/salt-marcher/docs/workmodes/cartographer.md) - User guide & architecture
- [docs/core/map-rendering-architecture.md](/home/aaron/ObsVaults/DnD/.obsidian/plugins/salt-marcher/docs/core/map-rendering-architecture.md) - Rendering system details
- [docs/guides/encounter-integration-architecture.md](/home/aaron/ObsVaults/DnD/.obsidian/plugins/salt-marcher/docs/guides/encounter-integration-architecture.md) - Tool system patterns
- [ROADMAP.md](/home/aaron/ObsVaults/DnD/.obsidian/plugins/salt-marcher/ROADMAP.md) - Current phase & priorities
