# Component System Quick Reference

## Quick Start

### Adding a Component to an Entry

```typescript
import { EntryComponent, ComponentType } from './entry-card';

// Create a new component
const attackComponent: EntryComponent = {
  type: 'attack',
  id: generateComponentId(),
  data: {
    type: 'attack',
    to_hit: '+5',
    reach: '5 ft.',
    target: 'one target'
  }
};

// Add to entry
entry.components = entry.components || [];
entry.components.push(attackComponent);
```

### Component Types at a Glance

| Type | Category | Fields | Use Case |
|------|----------|--------|----------|
| `attack` | Combat | to_hit, reach, target | Melee/ranged attacks |
| `damage` | Combat | damage, damages[] | Damage rolls |
| `save` | Combat | save_ability, save_dc, save_effect | Saving throws |
| `area` | Combat | area_type, size | AOE effects |
| `condition` | Effects | condition, duration, save_at_end | Status effects |
| `recharge` | Meta | recharge | Usage limits |
| `uses` | Meta | uses | Daily limits |

## Common Patterns

### Attack with Damage

```typescript
entry.components = [
  {
    type: 'attack',
    id: '1',
    data: { type: 'attack', to_hit: '+5', reach: '5 ft.', target: 'one target' }
  },
  {
    type: 'damage',
    id: '2',
    data: { type: 'damage', damage: '1d8 +3 slashing' }
  }
];
```

### Save-based Area Effect

```typescript
entry.components = [
  {
    type: 'area',
    id: '1',
    data: { type: 'area', area_type: 'cone', size: '30 ft.' }
  },
  {
    type: 'save',
    id: '2',
    data: { type: 'save', save_ability: 'DEX', save_dc: 15, save_effect: 'half damage' }
  },
  {
    type: 'damage',
    id: '3',
    data: { type: 'damage', damage: '10d6 fire' }
  }
];
```

### Condition with Save

```typescript
entry.components = [
  {
    type: 'save',
    id: '1',
    data: { type: 'save', save_ability: 'CON', save_dc: 14, save_effect: 'no effect' }
  },
  {
    type: 'condition',
    id: '2',
    data: {
      type: 'condition',
      condition: 'poisoned',
      duration: '1 minute',
      save_at_end: true
    }
  }
];
```

## Key Functions

### Migration & Sync

```typescript
// Migrate legacy entry to components
migrateEntryToComponents(entry);

// Sync components back to legacy fields
syncComponentsToEntry(entry);
```

### Component Creation

```typescript
// Generate unique ID
const id = generateComponentId();
// Returns: "component-1696512345678-abc123def"

// Create default data
const data = createDefaultComponentData('attack');
// Returns: { type: 'attack' }
```

### Rendering

```typescript
// Render full components section
createComponentsSection(parent, entry, data, onUpdate);

// Render single component
createComponentCard(parent, component, entry, data, onUpdate, onDelete, ...);

// Render component content
renderComponentContent(parent, component, entry, data, onUpdate);
```

## Component Data Interfaces

### Attack Component

```typescript
interface AttackComponentData {
  type: 'attack';
  to_hit?: string;       // "+5"
  to_hit_from?: any;     // Auto-calc config
  reach?: string;        // "5 ft." or "30/120 ft."
  target?: string;       // "one target"
}
```

### Damage Component

```typescript
interface DamageComponentData {
  type: 'damage';
  damage?: string;       // "1d8 +3 slashing"
  damage_from?: any;     // Auto-calc config
  damages?: DamageInstance[];
}
```

### Save Component

```typescript
interface SaveComponentData {
  type: 'save';
  save_ability?: string; // "STR", "DEX", etc.
  save_dc?: number;      // 1-30
  save_effect?: string;  // "half damage"
}
```

### Condition Component

```typescript
interface ConditionComponentData {
  type: 'condition';
  condition: string;     // "poisoned"
  duration?: string;     // "1 minute"
  save_at_end?: boolean; // true/false
}
```

### Area Component

```typescript
interface AreaComponentData {
  type: 'area';
  area_type: 'line' | 'cone' | 'sphere' | 'cube' | 'cylinder' | 'custom';
  size: string;          // "30 ft."
}
```

### Recharge Component

```typescript
interface RechargeComponentData {
  type: 'recharge';
  recharge: string;      // "Recharge 5-6"
}
```

### Uses Component

```typescript
interface UsesComponentData {
  type: 'uses';
  uses: string;          // "3/Day"
}
```

## Styling Classes

### Component Cards

```css
.sm-cc-component-card                   /* Base card */
.sm-cc-component-card--attack           /* Attack type */
.sm-cc-component-card--damage           /* Damage type */
.sm-cc-component-card--save             /* Save type */
.sm-cc-component-card--condition        /* Condition type */
.sm-cc-component-card--area             /* Area type */
.sm-cc-component-card--recharge         /* Recharge type */
.sm-cc-component-card--uses             /* Uses type */
```

### Component Structure

```css
.sm-cc-component-header                 /* Card header */
.sm-cc-component-label-group            /* Icon + label */
.sm-cc-component-icon                   /* Icon container */
.sm-cc-component-label                  /* Label text */
.sm-cc-component-controls               /* Button group */
.sm-cc-component-btn                    /* Control button */
.sm-cc-component-content                /* Content area */
.sm-cc-component-grid                   /* Form grid */
.sm-cc-component-field                  /* Field container */
```

### Component Selector

```css
.sm-cc-component-selector               /* Selector container */
.sm-cc-component-select                 /* Dropdown */
.sm-cc-components-section               /* Main section */
.sm-cc-components-list                  /* Component list */
```

## Event Handlers

### onUpdate Callback

```typescript
const onUpdate = () => {
  // Sync to legacy fields
  syncComponentsToEntry(entry);

  // Save changes
  saveEntry(entry);

  // Re-render if needed
  render();
};
```

### onDelete Callback

```typescript
const onDelete = () => {
  // Remove from array
  entry.components!.splice(index, 1);

  // Update and re-render
  syncComponentsToEntry(entry);
  onUpdate();
  render();
};
```

### Move Callbacks

```typescript
const onMoveUp = () => {
  if (index > 0) {
    [entry.components![index - 1], entry.components![index]] =
      [entry.components![index], entry.components![index - 1]];
    syncComponentsToEntry(entry);
    onUpdate();
    render();
  }
};

const onMoveDown = () => {
  if (index < entry.components!.length - 1) {
    [entry.components![index], entry.components![index + 1]] =
      [entry.components![index + 1], entry.components![index]];
    syncComponentsToEntry(entry);
    onUpdate();
    render();
  }
};
```

## Validation

### Basic Validation

```typescript
function validateComponent(component: EntryComponent): string[] {
  const errors: string[] = [];

  switch (component.type) {
    case 'attack':
      const attackData = component.data as AttackComponentData;
      if (!attackData.to_hit) {
        errors.push('Attack requires to-hit value');
      }
      if (!attackData.target) {
        errors.push('Attack requires target');
      }
      break;

    case 'save':
      const saveData = component.data as SaveComponentData;
      if (!saveData.save_ability) {
        errors.push('Save requires ability');
      }
      if (!saveData.save_dc) {
        errors.push('Save requires DC');
      }
      break;
  }

  return errors;
}
```

## Testing Checklist

- [ ] Add component via dropdown
- [ ] Edit component fields
- [ ] Move component up
- [ ] Move component down
- [ ] Duplicate component
- [ ] Delete component
- [ ] Save and reload entry
- [ ] Migrate legacy entry
- [ ] Test with empty entry
- [ ] Test keyboard navigation
- [ ] Test mobile layout

## Performance Tips

1. **Minimize re-renders**: Only re-render changed components
2. **Debounce input**: Use debounced handlers for text inputs
3. **Lazy initialization**: Initialize complex components on demand
4. **Efficient updates**: Use targeted DOM updates
5. **Memory management**: Clean up event listeners on delete

## Debugging

### Check Component State

```typescript
console.log('Components:', entry.components);
console.log('Legacy fields:', {
  to_hit: entry.to_hit,
  damage: entry.damage,
  save_ability: entry.save_ability
});
```

### Verify Sync

```typescript
// Before sync
console.log('Before:', entry.to_hit);

// Sync
syncComponentsToEntry(entry);

// After sync
console.log('After:', entry.to_hit);
```

### Check Migration

```typescript
// Before migration
const hadComponents = !!entry.components?.length;

// Migrate
migrateEntryToComponents(entry);

// After migration
console.log('Migrated:', !hadComponents && !!entry.components?.length);
```

## Common Issues

### Components not appearing
- Check if `entry.components` is defined
- Verify component IDs are unique
- Ensure `createComponentsSection()` is called

### Changes not saving
- Verify `onUpdate()` is called
- Check if `syncComponentsToEntry()` is working
- Ensure save function is triggered

### Reordering not working
- Check array bounds
- Verify re-render is triggered
- Ensure state is updated

### Migration not working
- Check if entry has legacy fields
- Verify migration function is called
- Ensure `entry.components` is initialized

## File Locations

```
src/apps/library/create/creature/components/
├── entry-card.ts          - Main implementation
├── entry-card.css         - Component styling
├── COMPONENTS.md          - Full documentation
├── UI_GUIDE.md           - Visual reference
└── QUICK_REFERENCE.md    - This file
```

## External Resources

- [Obsidian API](https://docs.obsidian.md/Reference/API)
- [TypeScript Handbook](https://www.typescriptlang.org/docs/handbook/)
- [CSS Grid Guide](https://css-tricks.com/snippets/css/complete-guide-grid/)
- [Accessibility Guidelines](https://www.w3.org/WAI/WCAG21/quickref/)

---

**Last Updated:** 2025-10-05
**Version:** 1.0.0
**Maintained by:** Salt Marcher Plugin Team

---

## NEW: Recharge & Uses Components

### Import Statements

```typescript
// UI Components
import {
  createRechargeComponentUI,
  createUsesComponentUI,
} from "./components";

// Types
import type {
  RechargeComponent,
  UsesComponent,
  RechargeComponentHandle,
  UsesComponentHandle,
} from "./components";

// Utility Functions
import {
  formatRechargeOutput,
  formatUsesOutput,
  parseRechargeString,
  parseUsesString,
  validateRechargeComponent,
  validateUsesComponent,
} from "./components";
```

### Recharge Component Quick Start

```typescript
// Create recharge UI (e.g., dragon breath weapon)
const handle = createRechargeComponentUI(container, {
  recharge: { type: "recharge", min: 5, max: 6 },
  onUpdate: (recharge) => console.log(recharge),
});

// Common patterns
{ type: "recharge", min: 5, max: 6 }  // "(Recharge 5-6)"
{ type: "recharge", min: 6, max: 6 }  // "(Recharge 6)"
{ type: "recharge", min: 5, max: 6, timing: "start of turn" }  // With timing
```

### Uses Component Quick Start

```typescript
// Create uses UI (e.g., daily ability)
const handle = createUsesComponentUI(container, {
  uses: { type: "uses", count: 2, per: "day" },
  enableTracking: true,
  onUpdate: (uses) => console.log(uses),
});

// Common patterns
{ type: "uses", count: 2, per: "day" }    // "(2/Day)"
{ type: "uses", count: 3, per: "short" }  // "(3/Short Rest)"
{ type: "uses", count: 1, per: "long" }   // "(1/Long Rest)"
{ type: "uses", count: 1, per: "dawn" }   // "(1/Dawn)"
```

### Recharge API

```typescript
const handle = createRechargeComponentUI(parent, options);

handle.getValue()         // Get current RechargeComponent
handle.setValue(recharge) // Set new RechargeComponent
handle.refresh()          // Force UI refresh
handle.validate()         // Get validation errors

formatRechargeOutput(recharge)       // "(Recharge 5-6)"
parseRechargeString("Recharge 5-6")  // { type, min, max }
validateRechargeComponent(recharge)  // string[]
```

### Uses API

```typescript
const handle = createUsesComponentUI(parent, options);

handle.getValue()       // Get current UsesComponent
handle.setValue(uses)   // Set new UsesComponent
handle.refresh()        // Force UI refresh
handle.validate()       // Get validation errors

// If enableTracking: true
handle.getRemainingUses!()        // Get remaining uses
handle.setRemainingUses!(count)   // Set remaining uses

formatUsesOutput(uses)       // "(2/Day)"
parseUsesString("2/Day")     // { type, count, per }
validateUsesComponent(uses)  // string[]
```

### CSS Classes

```css
/* Recharge Component */
.sm-cc-recharge-component
.sm-cc-recharge-preset-btn
.sm-cc-recharge-die-face
.sm-cc-recharge-preview-text

/* Uses Component */
.sm-cc-uses-component
.sm-cc-uses-preset-btn
.sm-cc-uses-tracking-section
.sm-cc-uses-preview-text
```

### Full Documentation

- `RECHARGE_USES_COMPONENTS.md` - Complete guide for both components
- `recharge-component.example.ts` - 10 recharge examples
- `uses-component.example.ts` - 14 uses examples
- `IMPLEMENTATION_SUMMARY.md` - Technical details

**Added:** 2025-10-05
