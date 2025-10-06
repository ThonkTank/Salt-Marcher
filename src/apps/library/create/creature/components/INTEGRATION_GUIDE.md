# Area Component Integration Guide

This guide shows how to integrate the Area component into creature abilities and spell entries.

## Quick Start

### 1. Import the Component

```typescript
import {
  createAreaComponentUI,
  formatAreaString,
  type AreaInstance,
} from "./components";
```

### 2. Create a Dragon Breath Weapon

```typescript
import { createBreathWeaponEntry } from "./components";

// Create a complete breath weapon entry with area
const fireBreath = createBreathWeaponEntry(
  "Fire Breath",
  "cone",      // shape
  "60",        // size
  "dex",       // save ability
  19,          // DC
  "18d6",      // damage dice
  "fire"       // damage type
);

// The entry automatically includes:
// - Recharge component (5-6)
// - Area component (60-foot cone)
// - Save component (DC 19 Dexterity)
// - Damage component (18d6 fire)
```

### 3. Add Area to Existing Entry

```typescript
import { createAreaComponent, type ComponentBasedEntry } from "./components";

// Existing entry
const entry: ComponentBasedEntry = {
  category: "action",
  name: "Poison Breath",
  components: [
    // ... existing components
  ],
};

// Add area component
entry.components.push(
  createAreaComponent("cone", "30", {
    origin: "Originates from self",
  })
);
```

## UI Integration

### Adding Area UI to Entry Editor

```typescript
import { createAreaComponentUI, type AreaInstance } from "./components";

function createEntryEditor(entry: ComponentBasedEntry) {
  const container = document.createElement("div");

  // Initialize area data
  const areaInstance: AreaInstance = {
    shape: "cone",
    size: 60,
    unit: "feet",
    origin: "self",
  };

  // Create the UI
  const areaHandle = createAreaComponentUI(container, {
    area: areaInstance,
    onChange: () => {
      // Update entry when area changes
      updateEntryArea(entry, areaInstance);
      renderPreview(entry);
    },
    showUnitSelector: true,
    showPreview: true,
  });

  return { container, areaHandle };
}

function updateEntryArea(entry: ComponentBasedEntry, area: AreaInstance) {
  // Convert to component type for storage
  const areaComponent = toAreaComponentType(area);

  // Find and update existing area component, or add new one
  const existingIndex = entry.components.findIndex((c) => c.type === "area");

  if (existingIndex >= 0) {
    entry.components[existingIndex] = areaComponent;
  } else {
    entry.components.push(areaComponent);
  }
}
```

### Read-Only Display

```typescript
import { formatAreaString, formatOriginString } from "./components";

function renderAreaDisplay(area: AreaInstance): string {
  const areaStr = formatAreaString(area);
  const originStr = formatOriginString(area);

  return `
    <div class="area-display">
      <strong>Area:</strong> ${areaStr}
      <br>
      <em>${originStr}</em>
    </div>
  `;
}
```

## Common Patterns

### Pattern 1: Spell with Scalable Area

```typescript
function createScalableSpell(spellLevel: number) {
  const baseRadius = 10;
  const scaledRadius = baseRadius + (spellLevel - 1) * 5;

  const area: AreaInstance = {
    shape: "sphere",
    size: scaledRadius,
    unit: "feet",
    origin: "point",
  };

  return {
    name: `Fireball (Level ${spellLevel})`,
    area: formatAreaString(area),
  };
}

// Level 3: "20-foot radius sphere"
// Level 4: "25-foot radius sphere"
```

### Pattern 2: Conditional Area

```typescript
function createConditionalBreath() {
  const normalBreath: AreaInstance = {
    shape: "cone",
    size: 30,
    unit: "feet",
    origin: "self",
  };

  const enhancedBreath: AreaInstance = {
    shape: "cone",
    size: 60,
    unit: "feet",
    origin: "self",
  };

  return {
    normal: formatAreaString(normalBreath),
    enhanced: formatAreaString(enhancedBreath),
  };
}
```

### Pattern 3: Multi-Option Area

```typescript
function createWallSpell() {
  const lineOption: AreaInstance = {
    shape: "line",
    size: 60,
    secondarySize: 10,
    unit: "feet",
    origin: "point",
  };

  const circleOption: AreaInstance = {
    shape: "sphere",
    size: 20,
    unit: "feet",
    origin: "point",
  };

  return {
    description: `You create a wall of fire. Choose one of the following:
      - ${formatAreaString(lineOption)}
      - ${formatAreaString(circleOption)}`,
  };
}
```

## Complete Example: Creature Entry

```typescript
import {
  type ComponentBasedEntry,
  createAreaComponent,
  createSaveComponent,
  createDamageComponent,
  createRechargeComponent,
} from "./components";

function createBlackDragonAcidBreath(): ComponentBasedEntry {
  return {
    category: "action",
    name: "Acid Breath",
    components: [
      // Recharge 5-6
      createRechargeComponent(5),

      // 60-foot line that is 5 feet wide
      createAreaComponent("line", "60 × 5", {
        origin: "Originates from self",
      }),

      // DC 18 Dexterity save
      createSaveComponent("dex", 18, {
        onSuccess: "half damage",
      }),

      // 54 (12d8) acid damage
      createDamageComponent("12d8", {
        damageType: "acid",
      }),
    ],
    description: "The dragon exhales acid in a line.",
    enabled: true,
  };
}
```

## Validation in Forms

```typescript
function validateEntryWithArea(entry: ComponentBasedEntry): string[] {
  const errors: string[] = [];

  // Find area component
  const areaComponent = entry.components.find((c) => c.type === "area");

  if (areaComponent && isAreaComponent(areaComponent)) {
    // Validate using built-in validator
    const areaErrors = validateAreaComponent(areaComponent);
    errors.push(...areaErrors);

    // Additional custom validation
    if (areaComponent.shape === "line" && !areaComponent.size.includes("×")) {
      errors.push("Line area should specify width (e.g., '60 × 5')");
    }
  }

  return errors;
}
```

## Data Persistence

### Saving to JSON

```typescript
import { toAreaComponentType } from "./components";

function saveEntry(entry: ComponentBasedEntry): string {
  // Components are already in the correct format
  return JSON.stringify(entry, null, 2);
}
```

### Loading from JSON

```typescript
import { fromAreaComponentType } from "./components";

function loadEntry(json: string): ComponentBasedEntry {
  const entry: ComponentBasedEntry = JSON.parse(json);

  // Components are automatically typed correctly
  return entry;
}

// For editing, convert area component to instance
function prepareForEditing(entry: ComponentBasedEntry): AreaInstance | null {
  const areaComponent = entry.components.find((c) => c.type === "area");

  if (areaComponent && isAreaComponent(areaComponent)) {
    return fromAreaComponentType(areaComponent);
  }

  return null;
}
```

## Preview Generation

```typescript
import { generateAreaPreview, formatAreaString } from "./components";

function generateEntryPreview(entry: ComponentBasedEntry): string {
  let preview = `## ${entry.name}\n\n`;

  const areaComponent = entry.components.find((c) => c.type === "area");

  if (areaComponent && isAreaComponent(areaComponent)) {
    const area = fromAreaComponentType(areaComponent);

    preview += `**Area:** ${formatAreaString(area)}\n\n`;
    preview += "```\n";
    preview += generateAreaPreview(area);
    preview += "\n```\n\n";
  }

  // Add other components...

  return preview;
}
```

## Best Practices

### 1. Always Validate

```typescript
// Before saving
const errors = validateEntry(entry);
if (errors.length > 0) {
  showValidationErrors(errors);
  return;
}
```

### 2. Provide Defaults

```typescript
function getDefaultArea(shape: AreaShape): AreaInstance {
  const defaults: Record<AreaShape, AreaInstance> = {
    cone: { shape: "cone", size: 15, unit: "feet", origin: "self" },
    sphere: { shape: "sphere", size: 20, unit: "feet", origin: "point" },
    cube: { shape: "cube", size: 10, unit: "feet", origin: "point" },
    line: { shape: "line", size: 60, secondarySize: 5, unit: "feet", origin: "self" },
    cylinder: { shape: "cylinder", size: 10, secondarySize: 20, unit: "feet", origin: "point" },
    emanation: { shape: "emanation", size: 10, unit: "feet", origin: "self" },
  };

  return defaults[shape];
}
```

### 3. Handle Edge Cases

```typescript
function safeFormatArea(area: AreaInstance | undefined): string {
  if (!area) return "No area specified";

  try {
    return formatAreaString(area);
  } catch (error) {
    console.error("Error formatting area:", error);
    return "Invalid area configuration";
  }
}
```

### 4. Preserve User Intent

```typescript
// When updating area, preserve custom notes
function updateAreaShape(area: AreaInstance, newShape: AreaShape): AreaInstance {
  const updated = { ...area, shape: newShape };

  // Preserve notes/custom origin
  if (area.notes) {
    updated.notes = area.notes;
  }

  return updated;
}
```

## Testing Integration

```typescript
import { formatAreaString } from "./components";

describe("Dragon Breath Integration", () => {
  it("should create valid breath weapon entry", () => {
    const entry = createBlackDragonAcidBreath();

    expect(entry.name).toBe("Acid Breath");
    expect(entry.components).toHaveLength(4);

    const areaComponent = entry.components.find((c) => c.type === "area");
    expect(areaComponent).toBeDefined();

    if (areaComponent && isAreaComponent(areaComponent)) {
      const area = fromAreaComponentType(areaComponent);
      expect(formatAreaString(area)).toBe("60-foot line that is 5 feet wide");
    }
  });
});
```

## Troubleshooting

### Area Not Displaying

```typescript
// Check if area component exists
const hasArea = entry.components.some((c) => c.type === "area");
if (!hasArea) {
  console.warn("No area component found in entry");
}

// Check if area is valid
const areaComponent = entry.components.find((c) => c.type === "area");
if (areaComponent && isAreaComponent(areaComponent)) {
  const errors = validateAreaComponent(areaComponent);
  if (errors.length > 0) {
    console.error("Invalid area:", errors);
  }
}
```

### Preview Not Updating

```typescript
// Make sure to call refresh after programmatic changes
const handle = createAreaComponentUI(container, { area, onChange });

// Later...
area.size = 30;
handle.refresh(); // Refresh the UI
```

### Unit Conversion

```typescript
// If you need to convert between units
function convertFeetToMeters(feet: number): number {
  return Math.round(feet * 0.3048);
}

function convertMetersToFeet(meters: number): number {
  return Math.round(meters / 0.3048);
}
```

## Related Components

The Area component works seamlessly with:

- **Save Component**: For AoE effects requiring saves
- **Damage Component**: For AoE damage
- **Recharge Component**: For rechargeable breath weapons
- **Condition Component**: For AoE status effects

See individual component documentation for more details.
