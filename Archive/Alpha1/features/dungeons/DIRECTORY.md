# Dungeons Feature

**Zweck**: Canvas-based grid rendering and UI components for dungeon map visualization. Provides room layout, door/feature markers, token management, and zoom/pan interactions.

## Inhalt

| Element | Beschreibung |
|---------|--------------|
| `index.ts` | Barrel export for public API |
| `DIRECTORY.md` | Feature documentation (this file) |
| `grid-renderer.ts` | Canvas-based dungeon visualization with zoom/pan |
| `token-creation-modal.ts` | Modal for creating/editing dungeon tokens |

## Verbindungen

- **Verwendet von**: Session Runner (dungeon visualization), Library (dungeon entity editing)
- **Abhängig von**: Obsidian API (`App`, `Modal`), shared types (`LocationData`, `DungeonRoom`, `DungeonToken`)

## Public API

### Grid Renderer

```typescript
// Import from: src/features/dungeons
import { GridRenderer, type GridRendererOptions } from "src/features/dungeons";

const renderer = new GridRenderer(canvas, {
  gridWidth: 30,
  gridHeight: 20,
  cellSize: 40,
  showGrid: true,
});

renderer.render(dungeonLocation);
renderer.destroy(); // Cleanup
```

### Token Creation Modal

```typescript
// Import from: src/features/dungeons
import { TokenCreationModal, type TokenCreationData } from "src/features/dungeons";

new TokenCreationModal(app, (data) => {
  console.log("Created token:", data.type, data.label);
}).open();
```

## Usage Example

```typescript
import { GridRenderer } from "src/features/dungeons";

const canvas = document.createElement("canvas");
const renderer = new GridRenderer(canvas);

renderer.setOnRoomSelect((room) => {
  console.log("Selected room:", room?.name);
});

renderer.setOnTokenSelect((token) => {
  console.log("Selected token:", token?.label);
});

renderer.render(dungeonLocation);
```

## Architecture Layer

**Features** - Shared systems layer (mid-level)

## Allowed Dependencies

- **Obsidian API** - `App`, `Modal` for UI
- **Types** - `LocationData`, `DungeonRoom`, `DungeonToken` from shared types

## Forbidden Dependencies

- ❌ `src/workmodes/*` - Features cannot depend on applications
