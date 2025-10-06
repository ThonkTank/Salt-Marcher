# Area Component

The Area Component provides a comprehensive UI and utilities for defining area-of-effect (AoE) patterns in creature abilities and spells.

## Features

- **Multiple Shape Types**: Cone, Sphere, Cube, Line, Cylinder, Emanation
- **Dynamic Dimensions**: Shape-appropriate dimension inputs (radius, length, width, height)
- **Unit Support**: Feet or meters with automatic formatting
- **Origin Points**: Self, point within range, target creature, or custom
- **Visual Preview**: ASCII art diagrams for each shape type
- **Real-time Validation**: Instant feedback on dimension values
- **Type-safe**: Full TypeScript integration with the component system

## Usage

### Basic Example

```typescript
import { createAreaComponent, type AreaInstance } from "./area-component";

const container = document.createElement("div");

const area: AreaInstance = {
  shape: "cone",
  size: 60,
  unit: "feet",
  origin: "self",
};

const handle = createAreaComponent(container, {
  area,
  onChange: () => {
    console.log("Area updated");
  },
});
```

### Formatted Output

```typescript
import { formatAreaString, formatOriginString } from "./area-component";

const area: AreaInstance = {
  shape: "line",
  size: 100,
  secondarySize: 5,
  unit: "feet",
  origin: "self",
};

console.log(formatAreaString(area));
// Output: "100-foot line that is 5 feet wide"

console.log(formatOriginString(area));
// Output: "Originates from self"
```

### Integration with Component System

```typescript
import { toAreaComponentType, fromAreaComponentType } from "./area-component";

// Convert to component type for storage
const component = toAreaComponentType(area);
// { type: "area", shape: "line", size: "100 × 5", origin: "..." }

// Convert back to instance for editing
const instance = fromAreaComponentType(component);
```

## Area Shapes

### Cone
- **Primary Dimension**: Length
- **Example**: "60-foot cone"
- **Common Use**: Dragon breath weapons, Burning Hands

### Sphere
- **Primary Dimension**: Radius
- **Example**: "20-foot radius sphere"
- **Common Use**: Fireball, Thunderwave

### Cube
- **Primary Dimension**: Side Length
- **Example**: "10-foot cube"
- **Common Use**: Cloud of Daggers, Wall spells

### Line
- **Primary Dimension**: Length
- **Secondary Dimension**: Width (optional)
- **Example**: "100-foot line that is 5 feet wide"
- **Common Use**: Lightning Bolt, Gust of Wind

### Cylinder
- **Primary Dimension**: Radius
- **Secondary Dimension**: Height (optional)
- **Example**: "10-foot radius, 40-foot high cylinder"
- **Common Use**: Flame Strike, Insect Plague

### Emanation
- **Primary Dimension**: Radius
- **Example**: "10-foot emanation"
- **Common Use**: Spirit Guardians, Aura of Protection

## Origin Types

- **Self**: Area originates from the creature itself
- **Point**: Area originates from a point within range
- **Target**: Area originates from a target creature
- **Custom**: User-defined origin description

## API Reference

### Types

#### AreaInstance
```typescript
interface AreaInstance {
  shape: AreaShape;
  size: number | string;
  secondarySize?: number | string;
  unit: DistanceUnit;
  origin: OriginType | string;
  notes?: string;
}
```

#### AreaComponentOptions
```typescript
interface AreaComponentOptions {
  area?: AreaInstance;
  onChange: () => void;
  showUnitSelector?: boolean;  // Default: true
  showPreview?: boolean;       // Default: true
}
```

#### AreaComponentHandle
```typescript
interface AreaComponentHandle {
  container: HTMLElement;
  refresh: () => void;
  validate: () => string[];
  getArea: () => AreaInstance;
}
```

### Functions

#### createAreaComponent
Creates the interactive area component UI.

```typescript
function createAreaComponent(
  parent: HTMLElement,
  options: AreaComponentOptions
): AreaComponentHandle
```

#### formatAreaString
Formats an area instance into a human-readable string.

```typescript
function formatAreaString(area: AreaInstance): string
```

#### formatOriginString
Formats the origin description.

```typescript
function formatOriginString(area: AreaInstance): string
```

#### validateAreaSize
Validates that a size value is positive and finite.

```typescript
function validateAreaSize(size: number | string): boolean
```

#### normalizeAreaSize
Converts a size value to a number.

```typescript
function normalizeAreaSize(size: number | string): number
```

#### generateAreaPreview
Generates ASCII art preview for the shape.

```typescript
function generateAreaPreview(area: AreaInstance): string
```

#### toAreaComponentType
Converts AreaInstance to AreaComponent (for storage).

```typescript
function toAreaComponentType(instance: AreaInstance): AreaComponent
```

#### fromAreaComponentType
Converts AreaComponent back to AreaInstance (for editing).

```typescript
function fromAreaComponentType(component: AreaComponent): AreaInstance
```

#### validateAreaComponent
Validates an AreaComponent from the types system.

```typescript
function validateAreaComponent(component: AreaComponent): string[]
```

## Real-World Examples

### Ancient Red Dragon Breath Weapon

```typescript
const dragonBreath: AreaInstance = {
  shape: "cone",
  size: 90,
  unit: "feet",
  origin: "self",
};

// Output: "90-foot cone"
```

### Fireball Spell

```typescript
const fireball: AreaInstance = {
  shape: "sphere",
  size: 20,
  unit: "feet",
  origin: "point",
};

// Output: "20-foot radius sphere"
// Origin: "Originates from a point within range"
```

### Lightning Bolt Spell

```typescript
const lightningBolt: AreaInstance = {
  shape: "line",
  size: 100,
  secondarySize: 5,
  unit: "feet",
  origin: "self",
};

// Output: "100-foot line that is 5 feet wide"
```

### Spirit Guardians Spell

```typescript
const spiritGuardians: AreaInstance = {
  shape: "emanation",
  size: 15,
  unit: "feet",
  origin: "self",
};

// Output: "15-foot emanation"
```

### Flame Strike Spell

```typescript
const flameStrike: AreaInstance = {
  shape: "cylinder",
  size: 10,
  secondarySize: 40,
  unit: "feet",
  origin: "point",
};

// Output: "10-foot radius, 40-foot high cylinder"
```

## Validation

The component provides comprehensive validation:

```typescript
const handle = createAreaComponent(container, { area, onChange });

const errors = handle.validate();
if (errors.length > 0) {
  console.error("Validation errors:", errors);
  // Example errors:
  // - "Area shape is required"
  // - "Area size must be a positive number"
  // - "Width must be a positive number"
  // - "Area origin is required"
}
```

## Styling

The component uses CSS custom properties for theming:

- `--background-secondary`: Component background
- `--color-blue`: Border accent color
- `--interactive-accent`: Active/focus states
- `--text-normal`: Primary text color
- `--text-muted`: Secondary text color

### CSS Classes

- `.sm-cc-area-component`: Main container
- `.sm-cc-area-grid`: Form field grid
- `.sm-cc-area-preview-section`: Preview area
- `.sm-cc-area-output`: Formatted output display
- `.sm-cc-area-diagram`: ASCII diagram container

## Accessibility

The component is fully accessible:

- Proper ARIA labels on all inputs
- Keyboard navigation support
- Focus indicators for all interactive elements
- Screen reader friendly labels and structure
- Reduced motion support
- High contrast mode support

## Testing

Comprehensive test suite included in `area-component.test.ts`:

```bash
npm test area-component.test.ts
```

Tests cover:
- Size validation and normalization
- Formatting for all shape types
- Origin formatting
- Component type conversion
- Round-trip data preservation
- Real-world spell examples

## Performance

The component is optimized for performance:

- Efficient DOM updates
- Debounced preview rendering
- Minimal re-renders on input changes
- Lazy loading of preview content

## Browser Support

Compatible with all modern browsers:
- Chrome/Edge 90+
- Firefox 88+
- Safari 14+

## License

Part of the Salt Marcher Obsidian plugin.
