# editor/

**Purpose**: Tool panel system for Cartographer editing tools (brushes, inspectors, markers).

## Contents

| Element | Description |
|---------|-------------|
| `form-builder.ts` | Declarative form DSL for tool panels (~839 LOC) |
| `tool-panel-manager.ts` | Tool lifecycle and switching coordinator |
| `tool-registry.ts` | Central tool registration and factory |
| `tool-panel.interface.ts` | ToolPanelHandle interface definition |
| `editor-telemetry.ts` | Telemetry tracking for editor operations |
| `tools/` | Individual tool implementations (brushes, inspector, markers) |

## Connections

**Used by**:
- `../controller.ts` - Creates and manages ToolPanelManager
- `tools/**/*-tool.ts` - Import form builder and registry

**Depends on**:
- `../domain/controller-interfaces.ts` - ToolPanelHandle, context types
- `../services/error-boundary.ts` - Error isolation for tool operations
- `@features/maps` - Coordinate system, rendering
- `@ui/components` - ViewContainer

## Public API

### Form Builder DSL

```typescript
/**
 * Build declarative form UI for tool panels.
 * Supports headers, hints, sections, brush controls, checkboxes, selects, buttons.
 *
 * v2 Features (opt-in):
 * - Validation: required fields, custom validators
 * - State binding: automatic sync with external state
 * - Conditional visibility: dynamic show/hide
 */
function buildForm(container: HTMLElement, options: FormBuilderOptions): FormBuilderResult;

interface FormBuilderResult {
    getControl(id: string): HTMLElement | null;
    getAllControls(): Map<string, HTMLElement>;
    root: HTMLElement;

    // v2 methods
    validate(): { valid: boolean; errors: Map<string, string> };
    getValues(): Record<string, unknown>;
    setValues(values: Record<string, unknown>): void;
    refresh(): void;
}
```

### Form Control Types

```typescript
type FormControl =
    | HeaderControl          // Panel title
    | HintControl           // Info message
    | SectionControl        // Group of controls
    | BrushModeToggleControl // Paint/Erase radio buttons
    | RadiusSliderControl   // 1-6 range with value display
    | CheckboxControl       // Boolean toggle
    | SelectControl         // Dropdown
    | ColorPickerControl    // Color input
    | ButtonControl         // Action button
    | ButtonGroupControl;   // Multiple buttons in a row

// Example: Radius slider with v2 features
interface RadiusSliderControl {
    kind: "radius-slider";
    id: string;
    value?: number;
    min?: number;
    max?: number;
    showLabel?: boolean;
    onChange?: (ctx: { value: number; element: HTMLInputElement }) => void;

    // v2 features (opt-in)
    required?: boolean;
    validate?: (value: number) => string | null;
    bind?: {
        get: () => number;
        set: (value: number) => void;
    };
    visible?: () => boolean;
}
```

### Tool Panel Manager

```typescript
/**
 * Manages tool lifecycle and switching.
 * Wraps all operations with error boundaries.
 */
class ToolPanelManager {
    constructor(
        private ctx: ToolPanelContext,
        private panelHost: HTMLElement,
        private toolbarHost: HTMLElement
    );

    async switchTo(toolId: string): Promise<void>;
    getCurrentTool(): ToolPanelHandle | null;
    destroy(): void;
}
```

### Tool Registry

```typescript
/**
 * Central registry of all available tools.
 * Tools register themselves via TOOL_REGISTRY.
 */
interface ToolRegistration {
    id: string;
    name: string;
    icon: string;
    shortcut?: string;
    factory: (ctx: ToolPanelContext, host: HTMLElement) => ToolPanelHandle;
}

const TOOL_REGISTRY: Map<string, ToolRegistration>;
```

## Usage Example

### Creating a Tool Panel with Form Builder

```typescript
import { buildForm } from "../form-builder";
import { type BrushToolContext, type ToolPanelHandle } from "../../domain";

export class TerrainBrushTool implements ToolPanelHandle {
    private form: FormBuilderResult;
    private state = { mode: "paint" as "paint" | "erase", radius: 1 };

    constructor(private ctx: BrushToolContext, host: HTMLElement) {
        this.form = buildForm(host, {
            sections: [
                { kind: "header", text: "Terrain Brush" },

                // Brush mode toggle
                {
                    kind: "brush-mode-toggle",
                    id: "mode",
                    value: this.state.mode,
                    onChange: ({ value }) => {
                        this.state.mode = value;
                    }
                },

                // Radius slider with v2 state binding
                {
                    kind: "radius-slider",
                    id: "radius",
                    min: 1,
                    max: 6,
                    value: this.state.radius,
                    onChange: ({ value }) => {
                        this.state.radius = value;
                    },
                    // v2: State binding (automatic sync)
                    bind: {
                        get: () => this.state.radius,
                        set: (value) => { this.state.radius = value; }
                    },
                    // v2: Validation
                    required: true,
                    validate: (value) => value < 1 ? "Radius must be at least 1" : null
                },

                // Conditional checkbox (v2: visible)
                {
                    kind: "checkbox",
                    id: "smoothEdges",
                    label: "Smooth Edges",
                    checked: false,
                    // v2: Only show when radius > 1
                    visible: () => this.state.radius > 1,
                    onChange: ({ checked }) => {
                        console.log("Smooth edges:", checked);
                    }
                }
            ]
        });
    }

    activate() {
        this.form.root.style.display = "";
    }

    deactivate() {
        this.form.root.style.display = "none";
    }

    async handleHexClick(coord: HexCoord, event: PointerEvent) {
        // v2: Validate before processing
        const validation = this.form.validate();
        if (!validation.valid) {
            console.error("Invalid form state:", validation.errors);
            return false;
        }

        // Process click with current state
        if (this.state.mode === "paint") {
            await this.paintTerrain(coord, this.state.radius);
        }

        return true;
    }

    destroy() {
        this.form.root.remove();
    }
}
```

### Registering a Tool

```typescript
import { TOOL_REGISTRY } from "../tool-registry";
import { TerrainBrushTool } from "./terrain-brush-tool";

TOOL_REGISTRY.set("terrain-brush", {
    id: "terrain-brush",
    name: "Terrain Brush",
    icon: "🌲",
    factory: (ctx, host) => new TerrainBrushTool(ctx, host)
});
```

## Form Builder v2 Features

### Validation

```typescript
// Define validation rules
const form = buildForm(container, {
    sections: [
        {
            kind: "radius-slider",
            id: "radius",
            required: true,
            validate: (value) => {
                if (value < 1) return "Radius must be at least 1";
                if (value > 6) return "Radius cannot exceed 6";
                return null; // Valid
            }
        }
    ]
});

// Validate on submit
const result = form.validate();
if (!result.valid) {
    for (const [id, error] of result.errors) {
        console.error(`Field ${id}: ${error}`);
    }
}
```

### State Binding

Automatically sync form controls with external state:

```typescript
const state = { radius: 1, mode: "paint" };

const form = buildForm(container, {
    sections: [
        {
            kind: "radius-slider",
            id: "radius",
            bind: {
                get: () => state.radius,
                set: (value) => { state.radius = value; }
            }
        }
    ]
});

// Initial value loaded from state.radius
// Changes automatically update state.radius
// No need for manual onChange sync
```

### Conditional Visibility

Show/hide controls dynamically:

```typescript
const state = { useAdvanced: false };

const form = buildForm(container, {
    sections: [
        {
            kind: "checkbox",
            id: "useAdvanced",
            label: "Advanced Mode",
            bind: {
                get: () => state.useAdvanced,
                set: (value) => { state.useAdvanced = value; }
            }
        },
        {
            kind: "radius-slider",
            id: "advancedRadius",
            // Only visible when advanced mode enabled
            visible: () => state.useAdvanced
        }
    ]
});

// Update visibility when state changes
state.useAdvanced = true;
form.refresh(); // Re-evaluates all visible() conditions
```

### Get/Set Values

Bulk operations on form state:

```typescript
// Get all form values
const values = form.getValues();
// { radius: 3, mode: "paint", smoothEdges: true }

// Set multiple values at once
form.setValues({
    radius: 5,
    mode: "erase"
});
// Triggers onChange handlers and updates bindings
```

## Design Rationale

### Declarative Forms

Previously, tools built UI imperatively:
```typescript
// ❌ Old way - verbose, error-prone
const header = host.createEl("h3", { text: "Terrain Brush" });
const modeRow = host.createDiv({ cls: "sm-form-row" });
const modeLabel = modeRow.createSpan({ text: "Mode:" });
const paintBtn = modeRow.createEl("button", { text: "Paint" });
const eraseBtn = modeRow.createEl("button", { text: "Erase" });
paintBtn.addEventListener("click", () => { /* ... */ });
eraseBtn.addEventListener("click", () => { /* ... */ });
// ... 50 more lines
```

**Solution**: Declarative DSL
```typescript
// ✅ New way - clear, concise
buildForm(host, {
    sections: [
        { kind: "header", text: "Terrain Brush" },
        { kind: "brush-mode-toggle", id: "mode", onChange: ({ value }) => { /* ... */ } }
    ]
});
```

**Benefits**:
- Less code (50 LOC → 10 LOC)
- Consistent styling (auto-applies CSS classes)
- Easier to read and maintain
- Standard control types prevent UI inconsistencies

### v2 Features (Opt-in)

v2 features are **opt-in** to avoid breaking existing tools:
- v1 tools continue to work unchanged
- v2 tools gradually adopt features as needed
- No "big bang" migration required

**Validation** prevents bad state:
```typescript
// Without validation
const radius = Number(slider.value); // Could be NaN, negative, etc.

// With validation
const result = form.validate();
if (result.valid) {
    const radius = form.getValues().radius; // Guaranteed valid
}
```

**State binding** eliminates sync bugs:
```typescript
// Without binding (easy to forget onChange)
const slider = form.getControl("radius");
state.radius = Number(slider.value); // Only updates on explicit calls

// With binding (automatic sync)
// state.radius is ALWAYS in sync with slider
```

**Conditional visibility** simplifies complex UIs:
```typescript
// Without visibility
if (state.useAdvanced) {
    advancedRow.style.display = "";
} else {
    advancedRow.style.display = "none";
}

// With visibility
form.refresh(); // Automatically shows/hides based on visible() conditions
```

## Tool System Architecture

### Lifecycle

1. **Registration**: Tool registers itself in TOOL_REGISTRY
2. **Lazy Creation**: Tool instance created on first activation
3. **Activation/Deactivation**: Tool shows/hides panel, enables/disables listeners
4. **Destruction**: Tool cleans up resources on plugin unload

```typescript
// Tool lifecycle
const tool = await toolPanelManager.switchTo("terrain-brush");

// 1. If not created: factory(ctx, host) -> ToolPanelHandle
// 2. Deactivate current tool (if any)
// 3. Activate new tool
// 4. Tool remains in memory (persistent panels)

// Later...
await toolPanelManager.switchTo("inspector");
// - Deactivates terrain-brush (panel hidden, listeners disabled)
// - Activates inspector (panel shown, listeners enabled)
// - Terrain-brush state preserved (user can switch back)

// On plugin unload
toolPanelManager.destroy();
// Calls destroy() on all created tools
```

### Error Isolation

All tool operations are wrapped with error boundaries:
```typescript
// From tool-panel-manager.ts
async switchTo(toolId: string): Promise<void> {
    await this.boundary.wrap(
        async () => {
            // Tool activation logic
        },
        { toolId, operation: "switchTo" }
    );
}
```

**Benefits**:
- Tool errors don't crash the workmode
- Rich error context (tool ID, operation, coordinate)
- Automatic recovery (switch to safe tool)

## See Also

- [../domain/controller-interfaces.ts](../domain/controller-interfaces.ts) - ToolPanelHandle interface
- [../services/error-boundary.ts](../services/error-boundary.ts) - Error isolation
- [tools/](tools/) - Tool implementations
- [docs/workmodes/cartographer.md](/home/aaron/ObsVaults/DnD/.obsidian/plugins/salt-marcher/docs/workmodes/cartographer.md) - Tool system overview
