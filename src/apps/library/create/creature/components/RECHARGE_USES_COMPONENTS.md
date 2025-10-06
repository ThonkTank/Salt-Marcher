# Recharge and Uses Components

Documentation for the Recharge and Uses components used for limited-use abilities in the Salt Marcher plugin.

## Table of Contents

- [Overview](#overview)
- [Recharge Component](#recharge-component)
- [Uses Component](#uses-component)
- [Integration Examples](#integration-examples)
- [Styling](#styling)
- [Accessibility](#accessibility)

## Overview

These components handle two different types of limited-use mechanics common in D&D 5e:

1. **Recharge Component**: For abilities that use dice-based recharge mechanics (e.g., "Recharge 5-6")
2. **Uses Component**: For abilities with a fixed number of uses that reset after certain conditions (e.g., "2/Day", "3/Long Rest")

Both components follow the established patterns in the Salt Marcher codebase and integrate seamlessly with the component-based entry system.

## Recharge Component

### Purpose

The Recharge component handles abilities that recharge on a d6 roll, typically at the start or end of a creature's turn. This is common for powerful creature abilities like dragon breath weapons.

### Data Structure

```typescript
interface RechargeComponent {
  type: "recharge";
  min: number;        // Minimum roll needed (1-6)
  max?: number;       // Maximum roll (default: 6)
  timing?: string;    // When recharge roll occurs
}
```

### Output Formats

- `(Recharge 5-6)` - Standard range (min 5, max 6)
- `(Recharge 6)` - Single number (min and max both 6)
- `(Recharge 4-6)` - Custom range
- `(Recharge 5-6 at start of turn)` - With timing specified

### UI Features

#### Quick Presets
Four common presets for instant selection:
- **5-6**: Most common (dragon breath weapons)
- **6**: Only recharges on a 6
- **4-6**: Easier recharge
- **3-6**: Very easy recharge

#### Visual Die Representation
Shows six die faces (1-6) with highlighted faces indicating the recharge range. Active faces are visually emphasized with color and animation.

#### Custom Range
Separate dropdowns for min and max values allow full customization beyond the presets.

#### Timing Selector
Dropdown for common timing options:
- Not specified
- Start of turn
- End of turn
- Start of combat
- After use

#### Preview
Real-time preview showing the exact output text that will be generated.

### Usage Examples

```typescript
import { createRechargeComponentUI, formatRechargeOutput } from "./recharge-component";

// Create UI component
const handle = createRechargeComponentUI(container, {
  recharge: {
    type: "recharge",
    min: 5,
    max: 6,
  },
  onUpdate: (recharge) => {
    console.log("Updated:", formatRechargeOutput(recharge));
  },
});

// Programmatic control
handle.setValue({
  type: "recharge",
  min: 6,
  max: 6,
  timing: "end of turn",
});

// Get current value
const current = handle.getValue();

// Validate
const errors = handle.validate();
```

### Parsing

Convert existing text to a `RechargeComponent`:

```typescript
import { parseRechargeString } from "./recharge-component";

const recharge1 = parseRechargeString("Recharge 5-6");
// { type: "recharge", min: 5, max: 6 }

const recharge2 = parseRechargeString("(Recharge 6 at start of turn)");
// { type: "recharge", min: 6, max: 6, timing: "start of turn" }
```

### Validation

```typescript
import { validateRechargeComponent } from "./recharge-component";

const errors = validateRechargeComponent({
  type: "recharge",
  min: 5,
  max: 6,
});
// [] (no errors)

const errors2 = validateRechargeComponent({
  type: "recharge",
  min: 7,  // Invalid!
  max: 6,
});
// ["Recharge minimum must be between 1 and 6"]
```

## Uses Component

### Purpose

The Uses component handles abilities with a fixed number of uses that reset under specific conditions (per day, per rest, etc.). This is common for class features, innate spellcasting, and special abilities.

### Data Structure

```typescript
interface UsesComponent {
  type: "uses";
  count: number;      // Number of uses (1-99)
  per: string;        // Reset condition
  shared?: {          // Optional shared pool
    poolName: string;
  };
  notes?: string;
}
```

### Reset Conditions

**Standard periods** (with pretty formatting):
- `"day"` → "Per Day"
- `"short"` → "Per Short Rest"
- `"long"` → "Per Long Rest"
- `"dawn"` → "Per Dawn"
- `"dusk"` → "Per Dusk"
- `"rest"` → "Per Rest (Any)"

**Custom text**: Any other string (e.g., "Per Battle", "Per Moon Phase")

### Output Formats

- `(2/Day)` - Two uses per day
- `(3/Long Rest)` - Three uses per long rest
- `(1/Dawn)` - One use per dawn
- `(5/Battle)` - Custom period

### UI Features

#### Count Presets
Five quick buttons for common use counts (1-5), plus a custom number input for values up to 99.

#### Reset Period Selector
Dropdown with all standard periods plus a "Custom..." option that reveals a text input for custom reset conditions.

#### Optional Use Tracking
When `enableTracking` is enabled:
- Shows current/max uses display (e.g., "2 / 3")
- Increment/decrement buttons
- Reset button to restore to maximum
- Visual feedback when depleted

#### Preview
Real-time preview showing the exact output text.

### Usage Examples

```typescript
import { createUsesComponentUI, formatUsesOutput } from "./uses-component";

// Basic usage
const handle = createUsesComponentUI(container, {
  uses: {
    type: "uses",
    count: 2,
    per: "day",
  },
  onUpdate: (uses) => {
    console.log("Updated:", formatUsesOutput(uses));
  },
});

// With tracking enabled
const handle2 = createUsesComponentUI(container, {
  uses: {
    type: "uses",
    count: 3,
    per: "short",
  },
  enableTracking: true,
  onUpdate: (uses) => {
    console.log("Config updated:", uses);
  },
});

// Use an ability
const remaining = handle2.getRemainingUses!();
handle2.setRemainingUses!(remaining - 1);

// Reset after rest
handle2.setRemainingUses!(handle2.getValue()!.count);
```

### Parsing

Convert existing text to a `UsesComponent`:

```typescript
import { parseUsesString } from "./uses-component";

const uses1 = parseUsesString("2/Day");
// { type: "uses", count: 2, per: "day" }

const uses2 = parseUsesString("(3/Long Rest)");
// { type: "uses", count: 3, per: "long" }

const uses3 = parseUsesString("5/Battle");
// { type: "uses", count: 5, per: "Battle" }
```

### Validation

```typescript
import { validateUsesComponent } from "./uses-component";

const errors = validateUsesComponent({
  type: "uses",
  count: 3,
  per: "day",
});
// [] (no errors)

const errors2 = validateUsesComponent({
  type: "uses",
  count: 0,  // Invalid!
  per: "day",
});
// ["Uses count must be between 1 and 99"]
```

## Integration Examples

### With Component-Based Entry System

```typescript
import {
  type ComponentBasedEntry,
  createRechargeComponent,
  createUsesComponent
} from "./types";

// Dragon breath weapon with recharge
const breathWeapon: ComponentBasedEntry = {
  category: "action",
  name: "Fire Breath",
  components: [
    createRechargeComponent(5, { max: 6 }),
    {
      type: "area",
      shape: "cone",
      size: "60",
    },
    {
      type: "save",
      ability: "dex",
      dc: 18,
      onSuccess: "half damage",
    },
    {
      type: "damage",
      dice: "18d6",
      damageType: "fire",
    },
  ],
  enabled: true,
};

// Innate spellcasting with daily uses
const innateSpell: ComponentBasedEntry = {
  category: "action",
  name: "Dispel Magic",
  components: [
    createUsesComponent(3, "day"),
    {
      type: "effect",
      description: "The creature casts dispel magic (3rd level).",
    },
  ],
  enabled: true,
};
```

### Display in Statblock

```typescript
import { formatRechargeOutput, formatUsesOutput } from "./index";

function renderAbilityHeader(entry: ComponentBasedEntry): string {
  let header = entry.name;

  // Add recharge notation
  const recharge = entry.components.find(c => c.type === "recharge");
  if (recharge) {
    header += ` ${formatRechargeOutput(recharge as RechargeComponent)}`;
  }

  // Add uses notation
  const uses = entry.components.find(c => c.type === "uses");
  if (uses) {
    header += ` ${formatUsesOutput(uses as UsesComponent)}`;
  }

  return header;
}

// Example outputs:
// "Fire Breath (Recharge 5-6)"
// "Dispel Magic (3/Day)"
// "Frightful Presence (1/Day)"
```

### Dynamic Tracking During Combat

```typescript
interface TrackedAbility {
  entry: ComponentBasedEntry;
  remainingUses?: number;
  recharged: boolean;
}

class CombatTracker {
  abilities: Map<string, TrackedAbility> = new Map();

  useAbility(name: string) {
    const ability = this.abilities.get(name);
    if (!ability) return false;

    const uses = ability.entry.components.find(c => c.type === "uses");
    if (uses && ability.remainingUses !== undefined) {
      if (ability.remainingUses > 0) {
        ability.remainingUses--;
        return true;
      }
      return false; // Out of uses
    }

    const recharge = ability.entry.components.find(c => c.type === "recharge");
    if (recharge && !ability.recharged) {
      return false; // Not recharged yet
    }

    ability.recharged = false; // Mark as used
    return true;
  }

  rollRecharge(name: string) {
    const ability = this.abilities.get(name);
    if (!ability) return;

    const recharge = ability.entry.components.find(
      c => c.type === "recharge"
    ) as RechargeComponent;

    if (recharge) {
      const roll = Math.floor(Math.random() * 6) + 1;
      ability.recharged = roll >= recharge.min;
      console.log(
        `${name} recharge roll: ${roll} ${ability.recharged ? '(SUCCESS)' : '(FAILED)'}`
      );
    }
  }

  rest(type: "short" | "long") {
    this.abilities.forEach((ability, name) => {
      const uses = ability.entry.components.find(
        c => c.type === "uses"
      ) as UsesComponent;

      if (uses) {
        const resetOnShort = uses.per === "short" || uses.per === "rest";
        const resetOnLong = uses.per === "long" || uses.per === "rest" ||
                           uses.per === "day" || uses.per === "dawn";

        if ((type === "short" && resetOnShort) ||
            (type === "long" && resetOnLong)) {
          ability.remainingUses = uses.count;
          console.log(`${name} uses reset to ${uses.count}`);
        }
      }

      // Recharge abilities always recharge on rest
      const recharge = ability.entry.components.find(c => c.type === "recharge");
      if (recharge) {
        ability.recharged = true;
        console.log(`${name} recharged`);
      }
    });
  }
}
```

## Styling

### CSS Classes

#### Recharge Component
- `.sm-cc-recharge-component` - Main container
- `.sm-cc-recharge-component--compact` - Compact mode modifier
- `.sm-cc-recharge-preset-btn` - Preset buttons
- `.sm-cc-recharge-preset-btn.active` - Active preset
- `.sm-cc-recharge-die-face` - Individual die face
- `.sm-cc-recharge-die-face.active` - Active (in range) die face
- `.sm-cc-recharge-preview-text` - Output preview

#### Uses Component
- `.sm-cc-uses-component` - Main container
- `.sm-cc-uses-component--compact` - Compact mode modifier
- `.sm-cc-uses-preset-btn` - Count preset buttons
- `.sm-cc-uses-preset-btn.active` - Active preset
- `.sm-cc-uses-tracking-section` - Tracking UI section
- `.sm-cc-uses-tracking-btn` - Increment/decrement buttons
- `.sm-cc-uses-tracking-display` - Current/max display
- `.sm-cc-uses-preview-text` - Output preview

### Theme Support

Both components fully support:
- Light/dark themes
- High contrast mode
- Reduced motion preferences
- Custom color schemes via CSS variables

### Customization

Override CSS variables to match your theme:

```css
.sm-cc-recharge-component {
  --recharge-color: var(--color-blue);
  --die-size: 40px;
  --die-spacing: 0.5rem;
}

.sm-cc-uses-component {
  --uses-color: var(--color-green);
  --preset-size: 48px;
  --tracking-color: var(--interactive-accent);
}
```

## Accessibility

Both components are built with accessibility in mind:

### Keyboard Navigation
- All interactive elements are keyboard accessible
- Logical tab order
- Visual focus indicators
- ESC to close dropdowns (where applicable)

### Screen Readers
- Proper ARIA labels on all controls
- ARIA pressed states on toggle buttons
- ARIA disabled states on unavailable actions
- Semantic HTML structure

### Visual Accessibility
- High contrast mode support
- Sufficient color contrast ratios
- Multiple visual cues (not color alone)
- Reduced motion support for animations

### Usage

```typescript
// Enable tracking for screen reader users
const handle = createUsesComponentUI(container, {
  uses: { type: "uses", count: 3, per: "day" },
  enableTracking: true, // Provides clear feedback
  onUpdate: (uses) => {
    // Announce changes to screen readers
    announceToScreenReader(
      `Uses updated: ${formatUsesOutput(uses!)}`
    );
  },
});
```

## Best Practices

### When to Use Recharge

Use the Recharge component for:
- Dragon breath weapons
- Creature abilities that recharge on dice rolls
- Abilities tied to combat rounds/turns
- Mechanical, dice-based recharge systems

### When to Use Uses

Use the Uses component for:
- Daily limited abilities
- Rest-based features (short/long rest)
- Time-based abilities (dawn/dusk)
- Innate spellcasting
- Class features with fixed uses

### Performance

Both components are optimized:
- Efficient re-rendering
- Minimal DOM manipulation
- Event delegation where appropriate
- Lazy loading of complex UI elements

### Integration Tips

1. **Always validate** before saving to ensure data integrity
2. **Use parseXString** functions for backward compatibility
3. **Enable tracking** only when needed to reduce complexity
4. **Format output** consistently across your UI
5. **Handle edge cases** gracefully (disabled state, validation errors)

## File Locations

- `/src/apps/library/create/creature/components/recharge-component.ts`
- `/src/apps/library/create/creature/components/recharge-component.css`
- `/src/apps/library/create/creature/components/recharge-component.example.ts`
- `/src/apps/library/create/creature/components/uses-component.ts`
- `/src/apps/library/create/creature/components/uses-component.css`
- `/src/apps/library/create/creature/components/uses-component.example.ts`
- `/src/apps/library/create/creature/components/index.ts` (exports)

## See Also

- [Component Architecture](./ARCHITECTURE.md) - Overall component system design
- [Types Documentation](./types.ts) - All component type definitions
- [Damage Component](./DAMAGE_COMPONENT_USAGE.md) - Similar component example
- [Save Component](./save-component.ts) - Save throw mechanics
