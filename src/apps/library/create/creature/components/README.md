# Component-Based Creature Entry System

A flexible, type-safe component system for creating D&D 5e creature abilities and actions.

## Overview

The component system replaces the monolithic entry format with modular, composable components. Each entry is built from one or more components that represent specific game mechanics:

- **Attack** - Attack rolls and hit modifiers
- **Save** - Saving throw DCs and effects
- **Damage** - Damage dice, bonuses, and types
- **Condition** - Status conditions applied to targets
- **Area** - Area of effect shapes and sizes
- **Recharge** - Dice-based recharge mechanics (5-6, etc.)
- **Uses** - Limited uses per day/rest
- **Trigger** - References to other actions (Multiattack)
- **Heal** - Healing effects
- **Effect** - Freeform special effects

## Core Types

### ComponentBasedEntry

```typescript
interface ComponentBasedEntry {
  category: CreatureEntryCategory;  // trait, action, bonus, reaction, legendary
  name: string;                      // Entry name (e.g., "Claw", "Fire Breath")
  components: EntryComponent[];      // Ordered list of components
  description?: string;              // Freeform Markdown description
  enabled?: boolean;                 // Whether entry is active
}
```

### EntryComponent (Discriminated Union)

All components have a `type` discriminator for type-safe narrowing:

```typescript
type EntryComponent =
  | AttackComponent
  | SaveComponent
  | DamageComponent
  | ConditionComponent
  | AreaComponent
  | RechargeComponent
  | UsesComponent
  | TriggerComponent
  | HealComponent
  | EffectComponent;
```

## Component Details

### AttackComponent

Represents attack roll mechanics.

```typescript
interface AttackComponent {
  type: "attack";
  bonus?: string;              // Manual bonus (e.g., "+5")
  autoCalc?: {                 // Auto-calculation from stats
    ability: AbilityScoreKey | "best_of_str_dex";
    proficient: boolean;
  };
  reach?: string;              // "5 ft." or "range 80/320 ft."
  target?: string;             // "one target", "one creature"
  attackType?: string;         // "Melee Weapon Attack"
}
```

**Example:**
```typescript
createAttackComponent({
  reach: "5 ft.",
  target: "one target",
  attackType: "Melee Weapon Attack",
  autoCalc: { ability: "str", proficient: true }
})
```

### SaveComponent

Represents DC-based saving throws.

```typescript
interface SaveComponent {
  type: "save";
  ability: AbilityScoreKey;    // "dex", "con", "wis", etc.
  dc: number;                  // Difficulty class
  onSuccess?: string;          // "half damage", "negates"
  onFailure?: string;          // Effect description
}
```

**Example:**
```typescript
createSaveComponent("dex", 15, {
  onSuccess: "half damage"
})
```

### DamageComponent

Represents damage dealt.

```typescript
interface DamageComponent {
  type: "damage";
  dice: string;                // "2d6", "1d8"
  bonus?: number;              // Static bonus
  abilityMod?: {               // Add ability modifier
    ability: AbilityScoreKey | "best_of_str_dex";
  };
  damageType?: DamageType;     // "fire", "slashing", etc.
  notes?: string;              // Additional notes
}
```

**Example:**
```typescript
createDamageComponent("1d6", {
  abilityMod: { ability: "str" },
  damageType: "slashing"
})
```

### ConditionComponent

Represents status conditions applied to targets.

```typescript
interface ConditionComponent {
  type: "condition";
  condition: ConditionType | string;  // "poisoned", "grappled", etc.
  duration?: {
    amount: number;
    unit: TimeUnit;            // "round", "minute", "hour", etc.
  };
  escape?: {
    type: "save" | "action" | "special";
    dc?: number;
    ability?: AbilityScoreKey;
    description?: string;
  };
  notes?: string;
}
```

**Example:**
```typescript
createConditionComponent("poisoned", {
  duration: { amount: 1, unit: "minute" },
  escape: {
    type: "save",
    ability: "con",
    dc: 12,
    description: "at the end of each turn"
  }
})
```

### AreaComponent

Represents area of effect mechanics.

```typescript
interface AreaComponent {
  type: "area";
  shape: AreaShape;            // "cone", "sphere", "line", etc.
  size: string;                // "15", "20", "60"
  origin?: string;             // "self", "a point within range"
  notes?: string;
}
```

**Example:**
```typescript
createAreaComponent("cone", "15", {
  origin: "self"
})
```

### RechargeComponent

Represents dice-based recharge mechanics.

```typescript
interface RechargeComponent {
  type: "recharge";
  min: number;                 // Minimum roll (5 for "5-6")
  max?: number;                // Maximum roll (usually 6)
  timing?: string;             // "start of turn"
}
```

**Example:**
```typescript
createRechargeComponent(5, {
  timing: "start of turn"
})
```

### UsesComponent

Represents limited-use abilities.

```typescript
interface UsesComponent {
  type: "uses";
  count: number;               // Number of uses
  per: "day" | "rest" | RestType | string;
  shared?: {
    poolName: string;          // Shared pool name
  };
  notes?: string;
}
```

**Example:**
```typescript
createUsesComponent(3, "day")
```

### TriggerComponent

References other actions (e.g., Multiattack).

```typescript
interface TriggerComponent {
  type: "trigger";
  triggerType: "multiattack" | "reaction" | "special";
  actions: Array<{
    name: string;              // Action name to trigger
    count?: number;            // Times to use (default: 1)
    condition?: string;        // Conditional use
  }>;
  restrictions?: string;
}
```

**Example:**
```typescript
createTriggerComponent("multiattack", [
  { name: "Claw", count: 2 },
  { name: "Bite", count: 1 }
])
```

### HealComponent

Represents healing effects.

```typescript
interface HealComponent {
  type: "heal";
  dice?: string;               // "2d8"
  amount?: number;             // Static amount
  abilityMod?: {
    ability: AbilityScoreKey;
  };
  target?: "hp" | "temp-hp" | string;
  notes?: string;
}
```

**Example:**
```typescript
{
  type: "heal",
  dice: "2d8",
  abilityMod: { ability: "wis" },
  target: "hp"
}
```

### EffectComponent

Freeform special effects.

```typescript
interface EffectComponent {
  type: "effect";
  name?: string;
  description: string;
  duration?: {
    amount: number;
    unit: TimeUnit;
  };
  concentration?: boolean;
}
```

**Example:**
```typescript
createEffectComponent(
  "The creature makes a Wisdom (Perception) check",
  { name: "Enhanced Senses" }
)
```

## Common Patterns

### Simple Melee Attack

```typescript
const clawAttack: ComponentBasedEntry = {
  category: "action",
  name: "Claw",
  components: [
    createAttackComponent({
      reach: "5 ft.",
      target: "one target",
      attackType: "Melee Weapon Attack",
      autoCalc: { ability: "str", proficient: true }
    }),
    createDamageComponent("1d6", {
      abilityMod: { ability: "str" },
      damageType: "slashing"
    })
  ],
  enabled: true
};
```

### Breath Weapon

```typescript
const fireBreath: ComponentBasedEntry = {
  category: "action",
  name: "Fire Breath",
  components: [
    createRechargeComponent(5),
    createAreaComponent("cone", "15"),
    createSaveComponent("dex", 15, { onSuccess: "half damage" }),
    createDamageComponent("6d6", { damageType: "fire" })
  ],
  description: "The dragon exhales fire in a 15-foot cone.",
  enabled: true
};
```

### Multiattack

```typescript
const multiattack: ComponentBasedEntry = {
  category: "action",
  name: "Multiattack",
  components: [
    createTriggerComponent("multiattack", [
      { name: "Claw", count: 2 },
      { name: "Bite", count: 1 }
    ])
  ],
  description: "The creature makes two claw attacks and one bite attack.",
  enabled: true
};
```

### Attack with Condition

```typescript
const poisonSting: ComponentBasedEntry = {
  category: "action",
  name: "Poison Sting",
  components: [
    createAttackComponent({
      reach: "5 ft.",
      target: "one creature",
      autoCalc: { ability: "dex", proficient: true }
    }),
    createDamageComponent("1d4", {
      abilityMod: { ability: "dex" },
      damageType: "piercing"
    }),
    createSaveComponent("con", 12, {
      onSuccess: "negates poisoned condition"
    }),
    createConditionComponent("poisoned", {
      duration: { amount: 1, unit: "minute" },
      escape: {
        type: "save",
        ability: "con",
        dc: 12,
        description: "at the end of each turn"
      }
    })
  ],
  enabled: true
};
```

## Builder Functions

Pre-built helper functions for common entry patterns:

### createMeleeAttackEntry

```typescript
const greataxe = createMeleeAttackEntry(
  "Greataxe",
  "1d12",
  "slashing"
);
```

### createRangedAttackEntry

```typescript
const longbow = createRangedAttackEntry(
  "Longbow",
  "150/600 ft.",
  "1d8",
  "piercing"
);
```

### createBreathWeaponEntry

```typescript
const lightningBreath = createBreathWeaponEntry(
  "Lightning Breath",
  "line",
  "60",
  "dex",
  14,
  "8d6",
  "lightning"
);
```

### createMultiattackEntry

```typescript
const multiattack = createMultiattackEntry([
  { name: "Bite", count: 1 },
  { name: "Claw", count: 2 }
]);
```

## Type Guards

Use type guards for safe component access:

```typescript
import { isAttackComponent, isDamageComponent } from "./types";

for (const component of entry.components) {
  if (isAttackComponent(component)) {
    console.log(`Attack bonus: ${component.bonus}`);
  }
  if (isDamageComponent(component)) {
    console.log(`Damage: ${component.dice} ${component.damageType}`);
  }
}
```

## Utility Functions

### Finding Components

```typescript
import { findComponentsByType, getFirstComponent } from "./types";

// Get all damage components
const damageComponents = findComponentsByType(entry, "damage");

// Get first attack component
const attack = getFirstComponent(entry, "attack");
```

### Checking Components

```typescript
import { hasComponentType } from "./types";

if (hasComponentType(entry, "save")) {
  console.log("This entry requires a saving throw");
}
```

### Manipulating Components

```typescript
import { removeComponentsByType, replaceComponent } from "./types";

// Remove all damage components
const noDamage = removeComponentsByType(entry, "damage");

// Replace attack component
const updated = replaceComponent(entry, newAttackComponent);
```

## Migration

### Legacy to Component-Based

```typescript
import { migrateFromLegacy } from "./types";

const legacyEntry = {
  category: "action",
  name: "Claw",
  to_hit: "+5",
  range: "5 ft.",
  damage: "1d6+3 slashing"
};

const componentEntry = migrateFromLegacy(legacyEntry);
```

### Component-Based to Legacy

```typescript
import { migrateToLegacy } from "./types";

const legacyFormat = migrateToLegacy(componentEntry);
```

## Validation

```typescript
import { validateEntry, validateComponent } from "./types";

const errors = validateEntry(entry);
if (errors.length > 0) {
  console.error("Validation errors:", errors);
}
```

## Best Practices

1. **Use Type Guards**: Always use type guards when working with components to ensure type safety.

2. **Component Order**: Order components logically (e.g., Attack → Damage → Save → Condition).

3. **Auto-Calculation**: Prefer `autoCalc` over manual bonuses when possible for consistency.

4. **Builder Functions**: Use builder functions for common patterns to reduce boilerplate.

5. **Validation**: Always validate entries before saving or rendering.

6. **Migration**: Use migration functions to maintain backward compatibility.

7. **Component Reuse**: Components are immutable - create new instances when modifying.

## Examples

See `examples.ts` for comprehensive usage examples including:
- Basic melee and ranged attacks
- Save-based effects with conditions
- Area of effect abilities
- Multiattack patterns
- Healing abilities
- Legendary actions
- Reactions
- Complex multi-component entries

## Type Safety

The system uses TypeScript's discriminated unions for complete type safety:

```typescript
function processComponent(component: EntryComponent) {
  switch (component.type) {
    case "attack":
      // TypeScript knows this is AttackComponent
      console.log(component.reach);
      break;
    case "damage":
      // TypeScript knows this is DamageComponent
      console.log(component.damageType);
      break;
    // ... other cases
  }
}
```

## Future Extensions

The component system is designed to be extensible. New component types can be added by:

1. Defining the component interface
2. Adding it to the `EntryComponent` union
3. Creating a type guard function
4. Creating a factory function
5. Adding validation rules

Example new component:

```typescript
interface ResourceComponent {
  type: "resource";
  resourceName: string;
  cost: number;
}

// Add to EntryComponent union:
type EntryComponent =
  | AttackComponent
  | SaveComponent
  | ResourceComponent  // NEW
  | ...;
```
