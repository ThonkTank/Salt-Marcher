# Component System Architecture

## Type Hierarchy

```
ComponentBasedEntry
├── category: CreatureEntryCategory
├── name: string
├── components: EntryComponent[]
├── description?: string
└── enabled?: boolean

EntryComponent (Discriminated Union)
├── AttackComponent
│   ├── type: "attack"
│   ├── bonus?: string
│   ├── autoCalc?: { ability, proficient }
│   ├── reach?: string
│   ├── target?: string
│   └── attackType?: string
│
├── SaveComponent
│   ├── type: "save"
│   ├── ability: AbilityScoreKey
│   ├── dc: number
│   ├── onSuccess?: string
│   └── onFailure?: string
│
├── DamageComponent
│   ├── type: "damage"
│   ├── dice: string
│   ├── bonus?: number
│   ├── abilityMod?: { ability }
│   ├── damageType?: DamageType
│   └── notes?: string
│
├── ConditionComponent
│   ├── type: "condition"
│   ├── condition: ConditionType | string
│   ├── duration?: { amount, unit }
│   ├── escape?: { type, dc, ability, description }
│   └── notes?: string
│
├── AreaComponent
│   ├── type: "area"
│   ├── shape: AreaShape
│   ├── size: string
│   ├── origin?: string
│   └── notes?: string
│
├── RechargeComponent
│   ├── type: "recharge"
│   ├── min: number
│   ├── max?: number
│   └── timing?: string
│
├── UsesComponent
│   ├── type: "uses"
│   ├── count: number
│   ├── per: "day" | "rest" | RestType | string
│   ├── shared?: { poolName }
│   └── notes?: string
│
├── TriggerComponent
│   ├── type: "trigger"
│   ├── triggerType: "multiattack" | "reaction" | "special"
│   ├── actions: Array<{ name, count?, condition? }>
│   └── restrictions?: string
│
├── HealComponent
│   ├── type: "heal"
│   ├── dice?: string
│   ├── amount?: number
│   ├── abilityMod?: { ability }
│   ├── target?: "hp" | "temp-hp" | string
│   └── notes?: string
│
└── EffectComponent
    ├── type: "effect"
    ├── name?: string
    ├── description: string
    ├── duration?: { amount, unit }
    └── concentration?: boolean
```

## Data Flow

```
User Input (UI)
      ↓
Component Creation
      ↓
Validation
      ↓
ComponentBasedEntry
      ↓
Storage/Serialization
      ↓
Markdown File
```

## Type Safety Flow

```
EntryComponent (union type)
      ↓
Type Guard (isAttackComponent, etc.)
      ↓
Narrowed Type (AttackComponent, etc.)
      ↓
Type-Safe Access
```

## Migration Flow

```
Legacy Entry Format
      ↓
migrateFromLegacy()
      ↓
ComponentBasedEntry
      ↓
migrateToLegacy()
      ↓
Legacy Entry Format
```

## Component Lifecycle

```
1. Creation
   createAttackComponent({ ... })
   ↓

2. Validation
   validateComponent(component)
   ↓

3. Composition
   entry.components.push(component)
   ↓

4. Rendering
   if (isAttackComponent(c)) {
     renderAttack(c)
   }
   ↓

5. Modification
   replaceComponent(entry, newComponent)
   ↓

6. Storage
   JSON.stringify(entry)
```

## Example: Creating a Claw Attack

```typescript
// Step 1: Create components
const attack = createAttackComponent({
  reach: "5 ft.",
  target: "one target",
  autoCalc: {
    ability: "str",
    proficient: true
  }
});

const damage = createDamageComponent("1d6", {
  abilityMod: { ability: "str" },
  damageType: "slashing"
});

// Step 2: Create entry
const entry: ComponentBasedEntry = {
  category: "action",
  name: "Claw",
  components: [attack, damage],
  enabled: true
};

// Step 3: Validate
const errors = validateEntry(entry);
if (errors.length > 0) {
  console.error(errors);
  return;
}

// Step 4: Use
const attackComponent = getFirstComponent(entry, "attack");
if (attackComponent && attackComponent.autoCalc) {
  // Auto-calculate attack bonus from creature stats
  const bonus = calculateAttackBonus(attackComponent.autoCalc, creatureStats);
}
```

## Example: Type-Safe Component Access

```typescript
function renderEntry(entry: ComponentBasedEntry, stats: StatblockData): string {
  let result = `**${entry.name}**\n`;

  for (const component of entry.components) {
    switch (component.type) {
      case "attack":
        // TypeScript knows: component is AttackComponent
        result += `${component.attackType} `;
        if (component.autoCalc) {
          const bonus = calcBonus(component.autoCalc, stats);
          result += `${bonus} to hit, `;
        }
        result += `${component.reach}\n`;
        break;

      case "damage":
        // TypeScript knows: component is DamageComponent
        let dmg = component.dice;
        if (component.abilityMod) {
          const mod = getAbilityMod(component.abilityMod.ability, stats);
          dmg += ` ${mod >= 0 ? '+' : ''}${mod}`;
        }
        if (component.damageType) {
          dmg += ` ${component.damageType}`;
        }
        result += `Damage: ${dmg}\n`;
        break;

      case "save":
        // TypeScript knows: component is SaveComponent
        result += `DC ${component.dc} ${component.ability.toUpperCase()} save`;
        if (component.onSuccess) {
          result += ` (${component.onSuccess})`;
        }
        result += `\n`;
        break;

      // ... other cases

      default:
        // TypeScript enforces exhaustive checking
        const _exhaustive: never = component;
        throw new Error(`Unhandled component type: ${(_exhaustive as any).type}`);
    }
  }

  if (entry.description) {
    result += `\n${entry.description}\n`;
  }

  return result;
}
```

## Comparison: Legacy vs Component-Based

### Legacy Format (Monolithic)
```typescript
interface LegacyEntry {
  category: string;
  name?: string;
  // Attack fields
  kind?: string;
  to_hit?: string;
  range?: string;
  target?: string;
  // Damage fields
  damage?: string;
  // Save fields
  save_ability?: string;
  save_dc?: number;
  save_effect?: string;
  // Meta fields
  recharge?: string;
  text?: string;
  // ... many optional fields
}

// Problem: All fields mixed together
// Problem: Unclear which fields are relevant
// Problem: Hard to validate
// Problem: Limited flexibility
```

### Component-Based Format (Modular)
```typescript
interface ComponentBasedEntry {
  category: CreatureEntryCategory;
  name: string;
  components: EntryComponent[];
  description?: string;
  enabled?: boolean;
}

// Benefit: Clear separation of concerns
// Benefit: Each component self-contained
// Benefit: Easy to validate
// Benefit: Infinite flexibility
```

## Design Patterns

### Factory Pattern
```typescript
// Instead of: new AttackComponent(...)
// Use: createAttackComponent(...)
const attack = createAttackComponent({
  reach: "5 ft.",
  autoCalc: { ability: "str", proficient: true }
});
```

### Builder Pattern
```typescript
// Pre-built common patterns
const greataxe = createMeleeAttackEntry(
  "Greataxe",
  "1d12",
  "slashing"
);
```

### Strategy Pattern
```typescript
// Different component types = different strategies
const renderers: Record<ComponentType, (c: any) => string> = {
  attack: (c: AttackComponent) => renderAttack(c),
  damage: (c: DamageComponent) => renderDamage(c),
  save: (c: SaveComponent) => renderSave(c),
  // ... etc
};
```

### Visitor Pattern
```typescript
// Type guards + switch = visitor
function visitComponent(component: EntryComponent) {
  if (isAttackComponent(component)) return processAttack(component);
  if (isDamageComponent(component)) return processDamage(component);
  // ... etc
}
```

### Composite Pattern
```typescript
// Entry composed of multiple components
interface ComponentBasedEntry {
  components: EntryComponent[];
}
```

## Extension Points

### Adding Custom Damage Types
```typescript
// In types.ts, expand the union:
export type DamageType =
  | "acid"
  | "bludgeoning"
  // ... standard types
  | "custom"; // Allow custom types

// Then in component:
interface DamageComponent {
  damageType?: DamageType | string; // Allow any string
}
```

### Adding Component Metadata
```typescript
interface BaseComponent {
  type: ComponentType;
  metadata?: {
    source?: string;      // "PHB", "DMG", etc.
    tags?: string[];      // ["magical", "weapon"]
    rarity?: string;      // "common", "rare"
    customData?: Record<string, any>;
  };
}
```

### Custom Validation Rules
```typescript
// Add validation plugin system
type ValidationRule = (
  component: EntryComponent,
  entry: ComponentBasedEntry
) => string[];

const customRules: ValidationRule[] = [
  // Ensure breath weapons have recharge
  (component, entry) => {
    if (
      hasComponentType(entry, "area") &&
      entry.name.toLowerCase().includes("breath")
    ) {
      if (!hasComponentType(entry, "recharge") &&
          !hasComponentType(entry, "uses")) {
        return ["Breath weapons should have recharge or uses"];
      }
    }
    return [];
  }
];
```

## Performance Optimization

### Component Caching
```typescript
const componentCache = new WeakMap<ComponentBasedEntry, Map<ComponentType, EntryComponent[]>>();

function getCachedComponents<T extends ComponentType>(
  entry: ComponentBasedEntry,
  type: T
): Array<Extract<EntryComponent, { type: T }>> {
  if (!componentCache.has(entry)) {
    componentCache.set(entry, new Map());
  }

  const cache = componentCache.get(entry)!;
  if (!cache.has(type)) {
    cache.set(type, findComponentsByType(entry, type));
  }

  return cache.get(type)! as any;
}
```

### Lazy Validation
```typescript
function validateLazy(entry: ComponentBasedEntry): () => string[] {
  let cachedErrors: string[] | null = null;

  return () => {
    if (cachedErrors === null) {
      cachedErrors = validateEntry(entry);
    }
    return cachedErrors;
  };
}
```

## Testing Strategy

### Unit Tests
- Test each factory function
- Test each type guard
- Test each utility function
- Test validation rules

### Integration Tests
- Test component combinations
- Test migration round-trips
- Test serialization/deserialization

### Type Tests
- Test discriminated union narrowing
- Test exhaustive switch statements
- Test generic type preservation
- Test required/optional field enforcement

## Future Enhancements

1. **Component Templates**: Save common component groups
2. **Component Library**: Browse and insert pre-made components
3. **Visual Editor**: Drag-and-drop component composition
4. **Component Preview**: Live preview of rendered output
5. **Component Validation UI**: Inline error highlighting
6. **Component Search**: Find entries by component types
7. **Component Analytics**: Track most-used component combinations
8. **Component Export**: Share component presets with community
