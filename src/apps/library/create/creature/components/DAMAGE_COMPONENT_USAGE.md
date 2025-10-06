# Damage Component Usage Guide

The damage component provides a modular, reusable UI for managing creature damage in the Salt Marcher plugin. It supports multiple damage instances, dice notation validation, and auto-calculation from ability scores.

## Features

- **Multiple Damage Instances**: Support for primary + additional damage
- **Dice Notation Validation**: Real-time validation of dice notation (e.g., 2d6, 1d10+3)
- **Auto Bonus Calculation**: Automatically calculate damage bonus from ability scores
- **Damage Types**: Full support for all D&D 5e damage types (physical, elemental, magical)
- **Conditions**: Optional conditional damage (e.g., "if target is prone")
- **Live Preview**: Shows formatted damage string in real-time

## Basic Usage

```typescript
import { createDamageComponent, type DamageInstance } from "./damage-component";
import type { StatblockData } from "../../../core/creature-files";

// Define damage instances
const damages: DamageInstance[] = [
  {
    dice: "2d6",
    bonus: "auto",
    bonusAbility: "str",
    damageType: "slashing",
    isAdditional: false
  }
];

// Create the component
const damageSection = createDamageComponent(container, {
  damages: damages,
  data: creatureData,
  onChange: () => {
    // Handle updates
    console.log("Damage changed:", damages);
  },
  maxDamages: 5 // Optional, default is 5
});
```

## Damage Instance Structure

```typescript
interface DamageInstance {
  dice: string;                    // Dice notation (e.g., "2d6", "1d10+3")
  bonus?: number | "auto";         // Fixed bonus or "auto" for ability-based
  bonusAbility?: string;           // Ability for auto bonus (str, dex, etc.)
  damageType: DamageTypeValue;     // Damage type (slashing, fire, etc.)
  condition?: string;              // Optional condition text
  isAdditional?: boolean;          // Whether this is additional damage
}
```

## Supported Damage Types

### Physical
- Slashing
- Piercing
- Bludgeoning

### Elemental
- Fire
- Cold
- Lightning
- Thunder
- Acid
- Poison

### Magical
- Necrotic
- Radiant
- Force
- Psychic

## Examples

### Simple Melee Attack
```typescript
const damages: DamageInstance[] = [
  {
    dice: "2d6",
    bonus: "auto",
    bonusAbility: "str",
    damageType: "slashing"
  }
];

// Output: "13 (2d6 + 4) slashing damage"
```

### Attack with Additional Damage
```typescript
const damages: DamageInstance[] = [
  {
    dice: "1d10",
    bonus: "auto",
    bonusAbility: "str",
    damageType: "piercing",
    isAdditional: false
  },
  {
    dice: "2d4",
    damageType: "fire",
    isAdditional: true
  }
];

// Output: "11 (1d10 + 6) piercing damage, plus 5 (2d4) fire damage"
```

### Conditional Damage
```typescript
const damages: DamageInstance[] = [
  {
    dice: "3d6",
    damageType: "cold",
    condition: "if target is prone"
  }
];

// Output: "10 (3d6) cold damage (if target is prone)"
```

### Fixed Bonus (No Auto)
```typescript
const damages: DamageInstance[] = [
  {
    dice: "1d8",
    bonus: 5,
    damageType: "bludgeoning"
  }
];

// Output: "9 (1d8 + 5) bludgeoning damage"
```

### Using Best of STR/DEX
```typescript
const damages: DamageInstance[] = [
  {
    dice: "1d8",
    bonus: "auto",
    bonusAbility: "best_of_str_dex",
    damageType: "slashing"
  }
];

// Uses higher of STR or DEX modifier
```

## Utility Functions

### Validate Dice Notation
```typescript
import { validateDiceNotation } from "./damage-component";

validateDiceNotation("2d6");       // true
validateDiceNotation("1d10+3");    // true
validateDiceNotation("invalid");   // false
```

### Parse Dice Notation
```typescript
import { parseDiceNotation } from "./damage-component";

const parsed = parseDiceNotation("2d8+3");
// { count: 2, sides: 8, modifier: 3 }
```

### Calculate Average Damage
```typescript
import { calculateAverageDamage } from "./damage-component";

const avg = calculateAverageDamage("2d6", 4);
// 11 (average of 2d6 is 7, plus 4)
```

### Format Damage String
```typescript
import { formatDamageString } from "./damage-component";

const instance: DamageInstance = {
  dice: "2d6",
  bonus: 4,
  damageType: "slashing"
};

const formatted = formatDamageString(instance, creatureData);
// "11 (2d6 + 4) slashing"
```

### Convert to Single String
```typescript
import { damageInstancesToString } from "./damage-component";

const damageString = damageInstancesToString(damages, creatureData);
// "13 (2d6 + 4) slashing, plus 5 (2d4) fire"
```

### Parse Damage String
```typescript
import { parseDamageString } from "./damage-component";

// For backwards compatibility - parses existing damage strings
const instances = parseDamageString("13 (2d6 + 4) slashing, plus 5 (2d4) fire");
// Returns array of DamageInstance objects
```

## Integration with Entry System

```typescript
import { createDamageComponent, damageInstancesToString } from "./damage-component";

// In your entry card creation:
const entry: CreatureEntry = {
  category: "action",
  name: "Longsword",
  // ... other fields
};

// Initialize damage instances array
if (!entry.damageInstances) {
  entry.damageInstances = [{
    dice: "1d8",
    bonus: "auto",
    bonusAbility: "str",
    damageType: "slashing"
  }];
}

// Create damage component
const damageComponent = createDamageComponent(container, {
  damages: entry.damageInstances,
  data: creatureData,
  onChange: () => {
    // Update entry's damage string
    entry.damage = damageInstancesToString(entry.damageInstances, creatureData);
    onUpdate();
  }
});
```

## Styling

The component uses CSS custom properties for theming:

```css
/* Import the component styles */
@import "./damage-component.css";

/* Customize if needed */
.sm-cc-damage-instance--primary {
  border-left-color: var(--your-custom-color);
}
```

## CSS Classes

- `.sm-cc-damage-component` - Main container
- `.sm-cc-damage-instance` - Single damage instance
- `.sm-cc-damage-instance--primary` - Primary damage styling
- `.sm-cc-damage-instance--additional` - Additional damage styling
- `.sm-cc-damage-dice-invalid` - Applied when dice notation is invalid
- `.sm-cc-damage-preview--valid` - Applied when preview is valid

## Validation

The component provides real-time validation:

- **Dice notation**: Shows error icon for invalid notation
- **Preview**: Only shows valid damage strings
- **Visual feedback**: Invalid fields are highlighted

Valid dice formats:
- `1d6` - Simple dice
- `2d8` - Multiple dice
- `3d10+2` - Dice with positive modifier
- `1d12-1` - Dice with negative modifier

Invalid formats:
- `d6` - Missing dice count
- `1d` - Missing die size
- `1d6 + 2` - Spaces in notation
- `1d6++2` - Invalid operators

## Accessibility

- All inputs have proper `aria-label` attributes
- Keyboard navigation supported
- Visual validation feedback
- Screen reader friendly labels

## Performance Considerations

- Components are created on-demand
- Updates are batched through the `onChange` callback
- Validation runs on input but doesn't block UI
- Preview updates are debounced implicitly by browser

## Future Enhancements

Potential future improvements:
- Dice roller integration for testing damage
- Damage type suggestions based on weapon/spell
- Import from SRD creatures
- Damage calculator with criticals
- Visual dice display
