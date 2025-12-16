# services/

**Purpose**: Infrastructure services for the Cartographer workmode.

## Contents

| Element | Description |
|---------|-------------|
| `error-boundary.ts` | Error isolation and recovery for tool operations (~124 LOC) |

## Connections

**Used by**:
- `../editor/tool-panel-manager.ts` - Wraps tool operations with error boundaries

**Depends on**:
- `../domain/controller-interfaces.ts` - HexCoord type

## Public API

### Error Boundary Factory

```typescript
/**
 * Create an error boundary for isolating tool failures.
 * Tracks error states per tool and provides recovery mechanisms.
 */
function createErrorBoundary(
    onError: (err: unknown, ctx: ErrorContext) => void,
    onRecovery?: () => void
): ErrorBoundary;
```

### Interfaces

```typescript
/**
 * Error isolation boundary that catches and handles errors without crashing.
 */
interface ErrorBoundary {
    /**
     * Wrap an async operation with error handling.
     * Returns null if operation throws.
     */
    wrap<T>(operation: () => Promise<T>, context: ErrorContext): Promise<T | null>;

    /**
     * Wrap a synchronous operation with error handling.
     * Returns null if operation throws.
     */
    wrapSync<T>(operation: () => T, context: ErrorContext): T | null;

    /**
     * Check if a tool is currently in an error state.
     */
    hasError(toolId: string): boolean;

    /**
     * Clear the error state for a tool.
     */
    clearError(toolId: string): void;
}

/**
 * Context information for error reporting.
 */
interface ErrorContext {
    /** ID of the tool that triggered the error (if applicable) */
    toolId?: string;
    /** Name of the operation being performed */
    operation: string;
    /** Hex coordinate where error occurred (if applicable) */
    coord?: HexCoord;
}
```

## Usage Example

```typescript
import { createErrorBoundary } from "../services/error-boundary";
import { configurableLogger } from "@app/configurable-logger";
const logger = configurableLogger.forModule("my-tool");

// Create boundary with error logging
const boundary = createErrorBoundary(
    (err, ctx) => {
        logger.error("Tool operation failed", {
            toolId: ctx.toolId,
            operation: ctx.operation,
            coord: ctx.coord,
            error: err
        });
    },
    () => {
        // Optional: Reset to safe state
        resetToDefaultTool();
    }
);

// Wrap async operations
const result = await boundary.wrap(
    async () => {
        // Dangerous operation that might throw
        await processHexClick(coord);
    },
    {
        toolId: "terrain-brush",
        operation: "handleHexClick",
        coord: { r: 0, c: 0 }
    }
);

if (result === null) {
    // Operation failed, but plugin didn't crash
    showNotice("Operation failed. See console for details.");
}

// Wrap synchronous operations
const value = boundary.wrapSync(
    () => calculateComplexValue(),
    { operation: "calculate" }
);

// Check error state
if (boundary.hasError("terrain-brush")) {
    // Tool is in error state, maybe disable it
    disableToolButton("terrain-brush");
}

// Clear error state when switching tools
boundary.clearError("terrain-brush");
```

## Design Rationale

### Problem

Previously, errors in tool operations could crash the entire Cartographer workmode:
```typescript
// ❌ Old way - errors bubble up
async handleHexClick(coord: HexCoord) {
    const data = await fetchData(); // If this throws, entire tool breaks
    processData(data);
}
```

**Issues**:
- Single tool error crashes entire workmode
- User loses all work (map not saved yet)
- No way to recover or identify which tool failed
- Debugging difficult (stack trace lost)

### Solution

Error boundaries provide isolation and recovery:
```typescript
// ✅ New way - errors contained
const result = await boundary.wrap(
    async () => {
        const data = await fetchData();
        processData(data);
    },
    { toolId: "terrain-brush", operation: "handleHexClick", coord }
);

// Plugin continues running even if operation failed
if (result === null) {
    // Graceful degradation
}
```

**Benefits**:
- **Isolation**: Tool errors don't crash the workmode
- **Context**: Rich error context (tool ID, operation name, coordinate)
- **Recovery**: Optional recovery callback to reset state
- **State Tracking**: Per-tool error states for UI feedback
- **Debugging**: Full error context logged for diagnostics

### Error State Tracking

The boundary tracks which tools are in error state:
```typescript
// Tool throws error
await boundary.wrap(
    async () => { throw new Error("Boom"); },
    { toolId: "terrain-brush", operation: "paint" }
);

// Check if tool is broken
if (boundary.hasError("terrain-brush")) {
    // Show warning in UI
    setToolWarning("terrain-brush", "Tool experienced an error");
}

// Clear state when switching away
boundary.clearError("terrain-brush");
```

This enables:
- Visual feedback (red border on tool button)
- Prevent repeated failures (disable broken tool)
- Automatic recovery (clear state on tool switch)

### Recovery Callback

The optional `onRecovery` callback enables automatic cleanup:
```typescript
const boundary = createErrorBoundary(
    (err, ctx) => logger.error("Error", { err, ctx }),
    () => {
        // Called after every error
        switchToSafeTool();
        showNotice("Switched to safe tool after error");
    }
);
```

**Use cases**:
- Switch to default tool after error
- Reset panel state
- Reload map data
- Show user notification

## Integration with ToolPanelManager

The error boundary is used by ToolPanelManager to wrap all tool operations:

```typescript
// From tool-panel-manager.ts
private boundary = createErrorBoundary(
    (err, ctx) => {
        logger.error("Tool operation failed", { err, ctx });
        this.ctx.setStatus("Tool error", "error");
    }
);

async switchTo(toolId: string): Promise<void> {
    const result = await this.boundary.wrap(
        async () => {
            // Deactivate old tool
            this.currentTool?.deactivate();

            // Activate new tool
            const newTool = await this.getOrCreateTool(toolId);
            newTool.activate();

            this.currentTool = newTool;
        },
        { toolId, operation: "switchTo" }
    );

    if (result === null) {
        // Tool switch failed, revert to safe state
        this.currentTool = null;
    }
}
```

This ensures:
- Tool activation/deactivation errors don't crash the workmode
- Failed tool switches leave user in consistent state
- Errors are logged with full context

## See Also

- [../editor/tool-panel-manager.ts](../editor/tool-panel-manager.ts) - Uses error boundaries
- [../domain/controller-interfaces.ts](../domain/controller-interfaces.ts) - ToolPanelHandle interface
- [docs/workmodes/cartographer.md](/home/aaron/ObsVaults/DnD/.obsidian/plugins/salt-marcher/docs/workmodes/cartographer.md) - Tool system architecture
