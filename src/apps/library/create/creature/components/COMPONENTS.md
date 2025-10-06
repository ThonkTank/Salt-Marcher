# Dynamic Component System for Creature Entries

## Overview

The dynamic component system allows flexible composition of creature abilities by adding, removing, and reordering modular components within an entry. This replaces the fixed section-based approach with a more flexible component-based architecture.

## Architecture

### Component Types

The system supports seven component types organized into three categories:

#### Combat Components
- **Attack Roll** (`attack`): To hit, reach/range, and target
- **Damage** (`damage`): Damage dice, type, and effects
- **Saving Throw** (`save`): Save DC and effects
- **Area of Effect** (`area`): Cone, sphere, line, etc.

#### Effects Components
- **Condition** (`condition`): Apply conditions like poisoned, stunned

#### Meta Components
- **Recharge** (`recharge`): Recharge 5-6, daily limits
- **Limited Uses** (`uses`): Number of uses per day/rest

### Data Structure

```typescript
interface EntryComponent {
  type: ComponentType;
  id: string;
  data: ComponentData;
}

interface CreatureEntryWithComponents extends CreatureEntry {
  components?: EntryComponent[];
}
```

Each component has:
- `type`: Identifies the component type
- `id`: Unique identifier for tracking
- `data`: Type-specific configuration

## Usage

### Adding Components

1. Open an entry card
2. Click the "Add Component..." dropdown at the bottom
3. Select a component type from the categorized list
4. Configure the component's fields

### Managing Components

Each component card provides controls for:

- **Move Up/Down**: Reorder components with arrow buttons
- **Duplicate**: Create a copy of the component
- **Delete**: Remove the component

### Component Rendering

Components render their own UI based on type:

```typescript
function renderComponentContent(
  parent: HTMLElement,
  component: EntryComponent,
  entry: CreatureEntryWithComponents,
  data: StatblockData,
  onUpdate: () => void
): void {
  switch (component.type) {
    case 'attack':
      renderAttackComponent(...);
      break;
    case 'damage':
      renderDamageComponent(...);
      break;
    // ... other cases
  }
}
```

## Backward Compatibility

The system maintains full backward compatibility with existing entries through:

### Migration

When an entry is loaded, `migrateEntryToComponents()` automatically converts legacy fields to components:

```typescript
// Legacy entry with direct fields
{
  to_hit: "+5",
  reach: "5 ft.",
  damage: "1d8 +3 slashing"
}

// Migrated to components
{
  components: [
    {
      type: 'attack',
      id: 'component-123',
      data: { to_hit: "+5", reach: "5 ft." }
    },
    {
      type: 'damage',
      id: 'component-456',
      data: { damage: "1d8 +3 slashing" }
    }
  ]
}
```

### Synchronization

`syncComponentsToEntry()` ensures legacy fields stay synchronized:

- When components are modified, legacy fields are updated
- This allows old code to continue working with component-based entries
- Ensures compatibility with save/load operations

### Fallback Rendering

If an entry has no components, the legacy section-based UI is rendered:

```typescript
if (!entry.components || entry.components.length === 0) {
  // Render legacy sections
  createAttackSection(...);
  createSaveSection(...);
  createMetaSection(...);
}
```

## Component Implementation

### Creating a New Component

1. **Define the data interface**:
```typescript
export interface MyComponentData {
  type: 'mycomponent';
  field1: string;
  field2?: number;
}
```

2. **Add to ComponentType union**:
```typescript
export type ComponentType =
  | 'attack'
  | 'save'
  | 'mycomponent'; // Add here
```

3. **Add metadata**:
```typescript
const COMPONENT_TYPES: ComponentTypeMetadata[] = [
  // ...
  {
    type: 'mycomponent',
    label: 'My Component',
    icon: 'icon-name',
    description: 'Component description',
    category: 'combat' // or 'effects' or 'meta'
  }
];
```

4. **Implement rendering**:
```typescript
function renderMyComponent(
  parent: HTMLElement,
  data: MyComponentData,
  onUpdate: () => void
): void {
  const grid = parent.createDiv({ cls: 'sm-cc-component-grid' });

  grid.createEl('label', { text: 'Field 1' });
  createTextInput(grid, {
    value: data.field1,
    onInput: (value) => {
      data.field1 = value;
      onUpdate();
    }
  });
}
```

5. **Add to switch statement**:
```typescript
case 'mycomponent':
  renderMyComponent(parent, component.data as MyComponentData, onUpdate);
  break;
```

## Component Details

### Attack Component

Fields:
- To Hit: Attack bonus (e.g., "+5")
- Reach/Range: Distance (e.g., "5 ft." or "30/120 ft.")
- Target: What is targeted (e.g., "one target")

### Damage Component

Integrates with the full damage component system:
- Multiple damage instances
- Dice notation (e.g., "2d6")
- Damage types (slashing, fire, etc.)
- Auto-calculation from ability scores

### Save Component

Fields:
- Save Ability: STR, DEX, CON, INT, WIS, CHA
- DC: Difficulty class (1-30)
- On Success: What happens on successful save

### Condition Component

Fields:
- Condition: Name (poisoned, stunned, etc.)
- Duration: How long it lasts
- Save at end: Checkbox for recurring saves

### Area Component

Fields:
- Type: Sphere, cone, line, cube, cylinder, custom
- Size: Dimensions (e.g., "20 ft.")

### Recharge Component

Single field:
- Recharge: Usage limits (e.g., "Recharge 5-6")

### Uses Component

Single field:
- Uses: Daily limits (e.g., "1/Day", "3/Day each")

## Styling

Component cards use CSS classes for theming:

```css
.sm-cc-component-card--attack { border-left: 3px solid #e74c3c; }
.sm-cc-component-card--damage { border-left: 3px solid #f39c12; }
.sm-cc-component-card--save { border-left: 3px solid #3498db; }
```

See `entry-card.css` for complete styling.

## Integration

### With Entry Model

Components sync to legacy `CreatureEntry` fields:
- `attack` → `to_hit`, `reach`, `target`
- `save` → `save_ability`, `save_dc`, `save_effect`
- `damage` → `damage`, `damage_from`
- `recharge` → `recharge`

### With Auto-Calculation

Damage components support auto-calculation:
```typescript
{
  type: 'damage',
  data: {
    damages: [{
      dice: '2d6',
      bonus: 'auto',
      bonusAbility: 'str',
      damageType: 'slashing'
    }]
  }
}
```

### With Validation

Each component type can implement validation:
```typescript
function validateComponent(component: EntryComponent): string[] {
  const errors: string[] = [];

  switch (component.type) {
    case 'attack':
      if (!component.data.to_hit) {
        errors.push('Attack needs to-hit value');
      }
      break;
  }

  return errors;
}
```

## Best Practices

1. **Component Order**: Place components in logical order:
   - Attack → Damage → Save → Condition → Recharge/Uses

2. **Minimal Components**: Only add components that are needed
   - Don't add empty components
   - Remove unused components

3. **Consistency**: Use consistent terminology across similar entries

4. **Testing**: Always test migration of legacy entries

## Future Enhancements

Potential additions:
- Drag-and-drop reordering
- Component templates/presets
- Conditional rendering (show damage only if attack hits)
- Component grouping/nesting
- Export to different formats
- Component validation rules
- Undo/redo for component operations

## Files

- `entry-card.ts`: Main implementation
- `entry-card.css`: Component styling
- `attack-component.ts`: Attack component implementation
- `save-component.ts`: Save component implementation
- `damage-component.ts`: Damage component implementation
- `entry-model.ts`: Data models

## Examples

### Simple Attack Entry

```typescript
{
  name: "Longsword",
  category: "action",
  components: [
    {
      type: 'attack',
      id: 'atk-1',
      data: {
        type: 'attack',
        to_hit: '+5',
        reach: '5 ft.',
        target: 'one target'
      }
    },
    {
      type: 'damage',
      id: 'dmg-1',
      data: {
        type: 'damage',
        damage: '1d8 +3 slashing'
      }
    }
  ]
}
```

### Complex Ability with Save

```typescript
{
  name: "Fire Breath",
  category: "action",
  components: [
    {
      type: 'area',
      id: 'area-1',
      data: {
        type: 'area',
        area_type: 'cone',
        size: '30 ft.'
      }
    },
    {
      type: 'save',
      id: 'save-1',
      data: {
        type: 'save',
        save_ability: 'DEX',
        save_dc: 15,
        save_effect: 'half damage'
      }
    },
    {
      type: 'damage',
      id: 'dmg-1',
      data: {
        type: 'damage',
        damage: '10d6 fire'
      }
    },
    {
      type: 'recharge',
      id: 'rec-1',
      data: {
        type: 'recharge',
        recharge: 'Recharge 5-6'
      }
    }
  ]
}
```

### Limited Use Ability with Condition

```typescript
{
  name: "Stunning Strike",
  category: "action",
  components: [
    {
      type: 'attack',
      id: 'atk-1',
      data: {
        type: 'attack',
        to_hit: '+7',
        reach: '5 ft.',
        target: 'one creature'
      }
    },
    {
      type: 'save',
      id: 'save-1',
      data: {
        type: 'save',
        save_ability: 'CON',
        save_dc: 15,
        save_effect: 'no effect'
      }
    },
    {
      type: 'condition',
      id: 'cond-1',
      data: {
        type: 'condition',
        condition: 'stunned',
        duration: 'until the end of monk\'s next turn',
        save_at_end: false
      }
    },
    {
      type: 'uses',
      id: 'uses-1',
      data: {
        type: 'uses',
        uses: '3/Day'
      }
    }
  ]
}
```
