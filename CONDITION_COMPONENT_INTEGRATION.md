# Condition Component - Integration Guide

## Quick Start

The Condition Component is now ready for integration into the Salt Marcher plugin's creature creator. Here's how to use it:

## Basic Import

```typescript
import {
  createConditionComponentUI,
  formatConditionString,
  conditionInstancesToString,
  validateConditions,
  CONDITION_TYPES,
} from "./src/apps/library/create/creature/components/condition-component";

import type {
  ConditionInstance,
  ConditionComponentOptions,
} from "./src/apps/library/create/creature/components/condition-component";
```

## Simple Example

```typescript
// Define condition data
const conditions: ConditionInstance[] = [
  {
    condition: "grappled",
    escape: {
      type: "dc",
      dc: 14,
    },
  },
];

// Create the UI component
const component = createConditionComponentUI(parentElement, {
  conditions,
  data: creatureStatblock,
  onChange: () => {
    // Handle updates
    const formatted = conditionInstancesToString(conditions);
    console.log(formatted);
    // Output: "target has the Grappled condition (escape DC 14)"
  },
});
```

## Integration with Entry System

### Option 1: Standalone Entry

```typescript
// Create a condition-only entry
const conditionEntry: ComponentBasedEntry = {
  category: "action",
  name: "Constrict",
  components: [
    {
      type: "condition",
      condition: "grappled",
      escape: {
        type: "dc",
        dc: 14,
      },
    },
  ],
};
```

### Option 2: Combined with Attack

```typescript
// Create a complete attack with condition
const tentacleAttack: ComponentBasedEntry = {
  category: "action",
  name: "Tentacle",
  components: [
    {
      type: "attack",
      reach: "10 ft.",
      target: "one target",
      attackType: "Melee Weapon Attack",
      autoCalc: {
        ability: "str",
        proficient: true,
      },
    },
    {
      type: "damage",
      dice: "2d6",
      damageType: "bludgeoning",
      abilityMod: { ability: "str" },
    },
    {
      type: "condition",
      condition: "grappled",
      escape: {
        type: "dc",
        dc: 15,
      },
      notes: "the grappled creature is pulled up to 25 feet toward the creature",
    },
  ],
};
```

### Option 3: Combined with Save

```typescript
// Poison attack requiring save, applying condition on failure
const poisonBite: ComponentBasedEntry = {
  category: "action",
  name: "Poison Bite",
  components: [
    {
      type: "attack",
      reach: "5 ft.",
      target: "one creature",
      attackType: "Melee Weapon Attack",
      autoCalc: { ability: "dex", proficient: true },
    },
    {
      type: "damage",
      dice: "1d4",
      damageType: "piercing",
    },
    {
      type: "save",
      ability: "con",
      dc: 11,
      onFailure: "target is poisoned",
    },
    {
      type: "condition",
      condition: "poisoned",
      duration: { amount: 1, unit: "hour" },
      escape: {
        type: "save",
        ability: "con",
        dc: 11,
      },
    },
  ],
};
```

## Common Use Cases

### 1. Grapple with Escape DC

```typescript
const grapplingTentacle: ConditionInstance = {
  condition: "grappled",
  escape: {
    type: "dc",
    dc: 16, // Set based on creature's Athletics modifier
  },
};
```

### 2. Poison with Duration and Save

```typescript
const poisonEffect: ConditionInstance = {
  condition: "poisoned",
  duration: {
    amount: 1,
    unit: "minute",
  },
  escape: {
    type: "save",
    ability: "con",
    dc: 13,
  },
};
```

### 3. Stun Until Next Turn

```typescript
const stunEffect: ConditionInstance = {
  condition: "stunned",
  duration: {
    amount: 1,
    unit: "round",
    text: "until the end of the creature's next turn",
  },
};
```

### 4. Exhaustion from Shadow

```typescript
const shadowWeakness: ConditionInstance = {
  condition: "exhaustion",
  exhaustionLevel: 1,
  duration: {
    amount: 0,
    unit: "permanent",
  },
  notes: "can be removed by magic such as lesser restoration",
};
```

### 5. Prone from Knockdown

```typescript
const tripAttack: ConditionInstance = {
  condition: "prone",
  escape: {
    type: "action",
    description: "costs half movement to stand up",
  },
};
```

## Rendering Output

Use the formatting functions to generate natural language text:

```typescript
// Single condition
const single = formatConditionString(grapplingTentacle);
// "target has the Grappled condition (escape DC 16)"

// Multiple conditions
const multiple = conditionInstancesToString([grapplingTentacle, poisonEffect]);
// "target has the Grappled condition (escape DC 16), and is Poisoned for 1 minute (DC 13 Constitution save ends)"
```

## Validation

Always validate before saving:

```typescript
const errors = validateConditions(conditions);
if (errors.length > 0) {
  // Show errors to user
  showValidationErrors(errors);
  return;
}

// Safe to save
saveCreatureEntry(entry);
```

## Parsing Legacy Entries

If you have existing condition text, parse it:

```typescript
const legacyText = "target is Grappled (escape DC 14) and is Poisoned for 1 minute";
const parsed = parseConditionString(legacyText);

// Use the parsed conditions
const component = createConditionComponentUI(parent, {
  conditions: parsed,
  data: statblockData,
  onChange: handleUpdate,
});
```

## CSS Styling

The component comes with pre-defined CSS classes. Add these to your stylesheet:

```css
.sm-cc-condition-component {
  padding: 1rem;
  border: 1px solid var(--background-modifier-border);
  border-radius: 4px;
}

.sm-cc-condition-instance {
  margin-bottom: 1rem;
  padding: 0.75rem;
  background: var(--background-secondary);
  border-radius: 4px;
}

.sm-cc-condition-grid {
  display: grid;
  grid-template-columns: 100px 1fr;
  gap: 0.5rem;
  align-items: center;
}

.sm-cc-condition-preview {
  margin-top: 0.5rem;
  padding: 0.5rem;
  background: var(--background-primary-alt);
  border-left: 3px solid var(--interactive-accent);
  font-style: italic;
  color: var(--text-muted);
}

.sm-cc-condition-preview--valid {
  border-left-color: var(--interactive-success);
  color: var(--text-normal);
}

.sm-cc-condition-preview--error {
  border-left-color: var(--interactive-error);
  color: var(--text-error);
}
```

## TypeScript Types

The component is fully typed. Key types:

```typescript
// Main instance type
interface ConditionInstance {
  condition: ConditionType | string;
  duration?: {
    amount: number;
    unit: TimeUnit;
    text?: string;
  };
  escape?: {
    type: EscapeMechanism;
    dc?: number;
    ability?: AbilityScoreKey;
    description?: string;
  };
  exhaustionLevel?: number;
  notes?: string;
}

// All standard D&D 5e conditions
type ConditionType =
  | "blinded" | "charmed" | "deafened" | "exhaustion"
  | "frightened" | "grappled" | "incapacitated" | "invisible"
  | "paralyzed" | "petrified" | "poisoned" | "prone"
  | "restrained" | "stunned" | "unconscious";

// Escape mechanisms
type EscapeMechanism = "dc" | "save" | "action" | "none";

// Time units
type TimeUnit = "instant" | "round" | "minute" | "hour" | "day" | "permanent";
```

## Testing

Run the examples to verify integration:

```typescript
import { examples } from "./src/apps/library/create/creature/components/condition-component.example";

// Run all examples
Object.values(examples).forEach(example => {
  console.log(`Running: ${example.name}`);
  example();
});
```

## Files Reference

| File | Purpose |
|------|---------|
| `condition-component.ts` | Main component implementation |
| `condition-component.example.ts` | 10 usage examples |
| `condition-component.md` | Complete documentation |
| `CONDITION_COMPONENT_SUMMARY.md` | Implementation summary |
| `index.ts` | Updated with exports |

## Next Steps

1. **Add to Entry Builder UI**: Integrate the component into your entry creation dialog
2. **Wire up Data Binding**: Connect condition instances to your creature data model
3. **Add Save Logic**: Persist conditions when saving creature entries
4. **Render in Statblock**: Use formatting functions to display conditions in statblocks
5. **Test with Real Data**: Create test creatures using the component

## Support

For questions or issues:
1. Check the examples in `condition-component.example.ts`
2. Read the full documentation in `condition-component.md`
3. Review the implementation summary in `CONDITION_COMPONENT_SUMMARY.md`

## Version

- **Component Version**: 1.0.0
- **Salt Marcher Version**: 0.1.0
- **Build Status**: ✅ Passing
- **Type Safety**: ✅ Full TypeScript support
