# contracts/

**Purpose**: Core contract types, interfaces, and events for the Cartographer workmode.

## Contents

| Element | Description |
|---------|-------------|
| `controller-interfaces.ts` | Shared Controller interfaces to prevent circular dependencies (~198 LOC) |
| `events.ts` | Type-safe event system with typed payloads (~135 LOC) |
| `layer-id-mapping.ts` | Layer ID mapping utilities |
| `types.ts` | Public type definitions (re-exports AxialCoord from @geometry) |

## Connections

**Used by**:
- `../controller.ts` - Uses CoreToolContext and sub-interfaces
- `../editor/tool-panel-manager.ts` - Uses ToolPanelHandle interface
- `../services/error-boundary.ts` - Uses HexCoord from controller-interfaces
- All tool panels (`../editor/tools/**`) - Use specialized context types

**Depends on**:
- `@geometry` - AxialCoord (coordinate system)
- `@features/maps/config` - HexOptions
- `@features/maps/rendering` - RenderHandles
- `@features/maps/undo-manager` - UndoManager
- `@ui/components` - ViewContainerHandle
- `obsidian` - App, TFile

## Public API

### Controller Context Interfaces

```typescript
// Core context - minimal interface for all tools
interface CoreToolContext {
    app: App;
    getFile(): TFile | null;
    setStatus(message: string, tone?: "info" | "loading" | "error"): void;
    getAbortSignal(): AbortSignal | null;
}

// Rendering context - canvas and coordinate conversion
interface RenderingContext {
    getHandles(): RenderHandles | null;
    getSurface(): ViewContainerHandle | null;
    toContentPoint(ev: MouseEvent | PointerEvent): DOMPoint | null;
}

// Map context - configuration and coordinate info
interface MapContext {
    getOptions(): HexOptions | null;
    getBase(): AxialCoord;  // Uses AxialCoord from @geometry
    getPadding(): number;
}

// Undo context - undo/redo functionality
interface UndoContext {
    /** Safe accessor - returns null when no map loaded */
    getUndoManager(): UndoManager | null;
    /** Throws with clear error if undo not available */
    requireUndoManager(): UndoManager;
}

// Layer context - layer visibility controls
interface LayerContext {
    getLayerPanel(): LayerControlPanelHandle | null;
}

// Navigation context - tool switching
interface NavContext {
    switchTool?(toolId: string): Promise<void>;
}
```

### Specialized Context Types

```typescript
// Full context (backward compatibility)
type ToolPanelContext = CoreToolContext & RenderingContext & MapContext & UndoContext & LayerContext & NavContext;

// Minimal context for simple tools (info panels, settings)
type MinimalToolContext = CoreToolContext & UndoContext;

// Brush tool context (paint/edit the map)
type BrushToolContext = CoreToolContext & RenderingContext & MapContext & UndoContext;

// Inspector tool context (display and manage overlays)
type InspectorToolContext = CoreToolContext & RenderingContext & MapContext & LayerContext;
```

### Tool Panel Interface

```typescript
// All tool panels must implement this interface
type ToolPanelHandle = {
    activate(): void;
    deactivate(): void;
    destroy(): void;
    onMapRendered?(): void | Promise<void>;
    handleHexClick?(coord: AxialCoord, event: PointerEvent): Promise<boolean>;  // Uses AxialCoord
    setDisabled?(disabled: boolean): void;
    toggleMode?(): void;
};
```

### Type-Safe Event System

```typescript
// Event type constants
const CARTOGRAPHER_EVENTS = {
    HEX_CLICK: "hex:click",
    HEX_HOVER: "hex:hover",
    TOOL_CHANGE: "tool:change",
    LAYER_CHANGE: "layer:change",
    TERRAINS_UPDATED: "salt:terrains-updated",
} as const;

// Typed event payloads (all use AxialCoord from @geometry)
interface CartographerEventPayloads {
    [CARTOGRAPHER_EVENTS.HEX_CLICK]: { coord: AxialCoord; nativeEvent: PointerEvent | MouseEvent };
    [CARTOGRAPHER_EVENTS.HEX_HOVER]: { coord: AxialCoord; nativeEvent: MouseEvent };
    [CARTOGRAPHER_EVENTS.TOOL_CHANGE]: { from: string | null; to: string };
    [CARTOGRAPHER_EVENTS.LAYER_CHANGE]: { layerId: string; visible: boolean; opacity?: number };
    [CARTOGRAPHER_EVENTS.TERRAINS_UPDATED]: { mapPath: string; count: number };
}

// Helper functions
emitCartographerEvent<K>(target: EventTarget, type: K, detail: CartographerEventPayloads[K]): void;
onCartographerEvent<K>(target: EventTarget, type: K, handler: (payload: CartographerEventPayloads[K]) => void): () => void;
extractHexCoord(event: Event): AxialCoord | null; // @deprecated Legacy compatibility (returns AxialCoord)
```

## Usage Example

```typescript
import {
    type BrushToolContext,
    type ToolPanelHandle,
    CARTOGRAPHER_EVENTS,
    emitCartographerEvent,
    onCartographerEvent
} from "../domain";
import type { AxialCoord } from "@geometry";

// Implement a brush tool with specialized context
class MyBrushTool implements ToolPanelHandle {
    constructor(private ctx: BrushToolContext) {}

    activate() {
        // Setup event listeners with type-safe events
        this.cleanup = onCartographerEvent(
            this.ctx.getSurface()!.el,
            CARTOGRAPHER_EVENTS.HEX_CLICK,
            ({ coord, nativeEvent }) => {
                console.log("Clicked hex:", coord);  // coord is AxialCoord
            }
        );
    }

    deactivate() {
        this.cleanup?.();
    }

    async handleHexClick(coord: AxialCoord, event: PointerEvent) {
        // Access rendering context
        const handles = this.ctx.getHandles();
        if (!handles) return false;

        // Access undo manager
        const undo = this.ctx.requireUndoManager();
        undo.pushState({ type: "paint", coord });

        return true; // Consumed the click
    }

    destroy() {
        this.cleanup?.();
    }
}
```

## Design Rationale

### Context Decomposition (Wave 1)

Previously, all tools received a massive `ToolPanelContext` with 15+ properties. This made:
- Dependencies unclear (does this tool need rendering? undo? layers?)
- Testing difficult (mock 15+ properties for every test)
- Type safety weak (always `!` assertions because properties nullable)

**Solution**: Split into 6 sub-interfaces:
- **CoreToolContext**: Minimal interface for all tools
- **RenderingContext**: Canvas and coordinate conversion
- **MapContext**: Map configuration and layout
- **UndoContext**: Undo/redo functionality
- **LayerContext**: Layer visibility controls
- **NavContext**: Tool switching

**Benefits**:
- Explicit dependencies (BrushToolContext = Core + Rendering + Map + Undo)
- Easier testing (mock only what you need)
- Better type safety (InspectorToolContext doesn't have undo, so no `!` assertions)

### Type-Safe Events (Wave 1)

Previously, events used magic strings and untyped `CustomEvent.detail`:
```typescript
// ❌ Old way - easy to break
element.dispatchEvent(new CustomEvent("hex:click", { detail: coord })); // Wrong payload!
element.addEventListener("hex:click", (e) => {
    const coord = e.detail; // any type, no autocomplete
});
```

**Solution**: CARTOGRAPHER_EVENTS constants + typed payloads
```typescript
// ✅ New way - compile-time safety
emitCartographerEvent(element, CARTOGRAPHER_EVENTS.HEX_CLICK, {
    coord, // Required by CartographerEventPayloads
    nativeEvent: evt
});

onCartographerEvent(element, CARTOGRAPHER_EVENTS.HEX_CLICK, ({ coord, nativeEvent }) => {
    // Full autocomplete, type checking
});
```

**Benefits**:
- Prevents magic string typos
- Ensures correct payloads at compile time
- Autocomplete for event types and payloads
- Cleanup function from `onCartographerEvent()` prevents memory leaks

### Safe UndoManager Access (Wave 1)

UndoContext provides two safe access patterns:

```typescript
// 1. Safe accessor - returns null when no map
const undo = ctx.getUndoManager();
if (undo) {
    undo.pushState(...);
}

// 2. Throws with clear error if not available
const undo = ctx.requireUndoManager(); // throws "No undo manager available"
undo.pushState(...);
```

**Benefits**:
- Explicit null checks prevent runtime errors
- Clear error messages when undo unavailable
- Type-safe (no `any` casts)

## See Also

- [../controller.ts](../controller.ts) - Controller implementation
- [../editor/tool-panel-manager.ts](../editor/tool-panel-manager.ts) - Tool lifecycle management
- [services/error-boundary.ts](../services/error-boundary.ts) - Error isolation using ErrorContext
- [docs/workmodes/cartographer.md](/home/aaron/ObsVaults/DnD/.obsidian/plugins/salt-marcher/docs/workmodes/cartographer.md) - Architecture overview
