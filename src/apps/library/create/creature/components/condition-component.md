# Condition Component

Modular UI component for managing D&D 5e status conditions in the creature creator entry system.

## Overview

The Condition component handles status effects like Grappled, Poisoned, Prone, etc. It provides a flexible interface for defining conditions with duration, escape mechanisms, and additional effects.

## Features

- Searchable dropdown with all standard D&D 5e conditions
- Smart defaults based on condition type
- Duration configuration (rounds, minutes, hours, etc.)
- Multiple escape mechanisms:
  - Escape DC (for grapple/restrained)
  - Save to end (ability + DC)
  - Action-based escape
- Exhaustion level tracking (1-6)
- Multiple conditions support
- Real-time preview of formatted text
- Validation with helpful error messages

## Standard D&D 5e Conditions

| Condition | Common Use | Default Escape |
|-----------|------------|----------------|
| Blinded | Vision loss | Save to end |
| Charmed | Mind control | Save to end |
| Deafened | Hearing loss | None |
| Exhaustion | Fatigue (levels 1-6) | Special |
| Frightened | Fear effects | Save to end |
| Grappled | Physical restraint | Escape DC |
| Incapacitated | Cannot act | None |
| Invisible | Cannot be seen | None |
| Paralyzed | Cannot move | Save to end |
| Petrified | Turned to stone | Save to end |
| Poisoned | Toxin effects | Save to end |
| Prone | Knocked down | Action |
| Restrained | Bound/trapped | Escape DC |
| Stunned | Dazed/shocked | Save to end |
| Unconscious | Knocked out | None |

## Basic Usage

```typescript
import { createConditionComponent } from "./condition-component";
import type { ConditionInstance } from "./condition-component";

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

// Create component
const component = createConditionComponent(container, {
  conditions,
  data: statblockData,
  onChange: () => {
    console.log("Conditions updated");
  },
});
```

## API Reference

### Types

#### `ConditionInstance`

```typescript
interface ConditionInstance {
  condition: ConditionType | string;    // Condition type or custom text
  duration?: {
    amount: number;                     // Duration amount
    unit: TimeUnit;                     // Time unit
    text?: string;                      // Custom duration text
  };
  escape?: {
    type: EscapeMechanism;              // How to end the condition
    dc?: number;                        // DC for escape or save
    ability?: AbilityScoreKey;          // Ability for save
    description?: string;               // Custom escape text
  };
  exhaustionLevel?: number;             // For exhaustion (1-6)
  notes?: string;                       // Additional effect text
}
```

#### `EscapeMechanism`

```typescript
type EscapeMechanism = "dc" | "save" | "action" | "none";
```

- **dc**: Requires ability check against DC (e.g., grappled)
- **save**: Requires saving throw to end (e.g., poisoned)
- **action**: Requires action/movement to remove (e.g., prone)
- **none**: No escape mechanism specified

#### `TimeUnit`

```typescript
type TimeUnit = "instant" | "round" | "minute" | "hour" | "day" | "permanent";
```

### Functions

#### `createConditionComponent`

Creates the UI component for managing conditions.

```typescript
function createConditionComponent(
  parent: HTMLElement,
  options: ConditionComponentOptions
): HTMLElement
```

**Options:**
- `conditions`: Array of condition instances
- `data`: Creature statblock data
- `onChange`: Callback when conditions change
- `maxConditions`: Maximum number of conditions (default: 3)

#### `formatConditionString`

Formats a single condition into human-readable text.

```typescript
function formatConditionString(instance: ConditionInstance): string
```

**Examples:**
- `"target has the Grappled condition (escape DC 14)"`
- `"target is Poisoned for 1 minute (DC 15 Constitution save ends)"`
- `"target has the Prone condition (costs half movement to stand up)"`

#### `conditionInstancesToString`

Converts multiple conditions into a single formatted string.

```typescript
function conditionInstancesToString(conditions: ConditionInstance[]): string
```

**Example:**
```typescript
const conditions = [
  { condition: "grappled", escape: { type: "dc", dc: 14 } },
  { condition: "restrained", escape: { type: "dc", dc: 14 } },
];

const result = conditionInstancesToString(conditions);
// "target has the Grappled condition (escape DC 14), and has the Restrained condition (escape DC 14)"
```

#### `parseConditionString`

Parses legacy condition text back into condition instances.

```typescript
function parseConditionString(conditionStr: string): ConditionInstance[]
```

**Example:**
```typescript
const parsed = parseConditionString("target is Grappled (escape DC 14)");
// Returns: [{ condition: "grappled", escape: { type: "dc", dc: 14 } }]
```

#### `validateCondition`

Validates a single condition instance.

```typescript
function validateCondition(instance: ConditionInstance): string[]
```

Returns array of error messages (empty if valid).

#### `validateConditions`

Validates all condition instances.

```typescript
function validateConditions(conditions: ConditionInstance[]): string[]
```

## Common Patterns

### Grapple Attack

```typescript
const conditions: ConditionInstance[] = [
  {
    condition: "grappled",
    escape: {
      type: "dc",
      dc: 16, // Based on creature's Strength
    },
  },
];
```

### Poison Effect

```typescript
const conditions: ConditionInstance[] = [
  {
    condition: "poisoned",
    duration: {
      amount: 1,
      unit: "minute",
    },
    escape: {
      type: "save",
      ability: "con",
      dc: 11,
    },
  },
];
```

### Stun (Until End of Turn)

```typescript
const conditions: ConditionInstance[] = [
  {
    condition: "stunned",
    duration: {
      amount: 1,
      unit: "round",
      text: "until the end of the creature's next turn",
    },
  },
];
```

### Exhaustion from Shadow

```typescript
const conditions: ConditionInstance[] = [
  {
    condition: "exhaustion",
    exhaustionLevel: 1,
    duration: {
      amount: 0,
      unit: "permanent",
    },
    notes: "removed by magic such as lesser restoration",
  },
];
```

### Prone from Trip Attack

```typescript
const conditions: ConditionInstance[] = [
  {
    condition: "prone",
    escape: {
      type: "action",
      description: "costs half movement to stand up",
    },
  },
];
```

## Integration with Entry System

The Condition component integrates with the modular entry system and can be combined with other components:

```typescript
import {
  createConditionComponent,
  formatConditionString,
  conditionInstancesToString,
} from "./condition-component";

// In your entry builder:
const conditions: ConditionInstance[] = [
  {
    condition: "grappled",
    escape: { type: "dc", dc: 15 },
  },
];

// Generate final entry text
const effectText = conditionInstancesToString(conditions);
// Use in creature entry description
```

## Smart Defaults

The component automatically suggests appropriate escape mechanisms based on condition type:

- **Grappled/Restrained**: Defaults to escape DC
- **Charmed/Frightened/Paralyzed/Poisoned/Stunned**: Defaults to save to end
- **Prone**: Defaults to action-based escape
- **Others**: Defaults to no escape mechanism

## Validation Rules

1. Condition type is required
2. Exhaustion must have level 1-6
3. DC-based escape requires a DC value
4. Save-based escape requires both ability and DC
5. Duration amount must be positive (except instant/permanent)

## CSS Classes

The component uses these CSS classes for styling:

- `.sm-cc-condition-component`: Main container
- `.sm-cc-condition-instance`: Single condition container
- `.sm-cc-condition-grid`: Form grid layout
- `.sm-cc-condition-field-label`: Field labels
- `.sm-cc-condition-type-select`: Condition dropdown
- `.sm-cc-condition-duration-wrapper`: Duration controls
- `.sm-cc-condition-escape-wrapper`: Escape mechanism controls
- `.sm-cc-condition-preview`: Preview text
- `.sm-cc-condition-preview--valid`: Valid preview state
- `.sm-cc-condition-preview--error`: Error state
- `.sm-cc-condition-add-btn`: Add condition button
- `.sm-cc-condition-delete-btn`: Delete button

## Examples

See `condition-component.example.ts` for comprehensive usage examples including:

1. Basic grapple with escape DC
2. Poisoned with save to end
3. Multiple conditions
4. Exhaustion levels
5. Prone condition
6. Temporary conditions
7. Parsing legacy text
8. Validation and errors
9. Entry system integration
10. Complex conditions with all features

## Best Practices

1. **Use smart defaults**: Let the component suggest escape mechanisms
2. **Validate before saving**: Always call `validateConditions()` before persisting
3. **Provide clear notes**: Add clarifying text for complex conditions
4. **Keep it simple**: Use standard conditions when possible
5. **Test formatting**: Preview the output to ensure it reads naturally
6. **Consider duration**: Match duration to the creature's power level
7. **Balance escape mechanics**: DCs should scale with challenge rating

## Performance Considerations

- Component efficiently re-renders only changed sections
- Validation runs on-demand, not on every keystroke
- Searchable dropdown optimized for quick lookups
- Preview updates are debounced for smooth UX

## Accessibility

- All inputs have proper ARIA labels
- Keyboard navigation fully supported
- Error states clearly indicated
- Preview text provides immediate feedback

## Browser Support

Compatible with all modern browsers supporting ES2020+.
