# UI Components

**Zweck**: Reusable UI components and patterns shared across workmodes for consistent user interface.

## Inhalt

| Element | Beschreibung |
|---------|--------------|
| components/ | Generic UI components (buttons, modals, inputs, containers) |
| index.ts | Barrel export for public UI components |
| maps/ | Map-specific UI components (headers, lists, workflows) |
| patterns/ | Common UI patterns and compositions |
| utils/ | UI utility functions and helpers |

## Verbindungen

- **Verwendet von**: Workmodes (Library, Cartographer, Session Runner, Almanac)
- **Abhängig von**: Obsidian API, Features (type-only)

## Architektur-Hinweise

UI components sind **view-layer only**:
- **Keine Business Logic** - nur Präsentation und Interaktion
- **Reusable** - verwendet von mehreren Workmodes
- **Stateless** - State wird via Props/Context injiziert
- **Lifecycle Handles** - Return cleanup functions
- **Type-Safe** - TypeScript interfaces für alle Props

## Subdirectories

### Components (`components/`)
Generic reusable components:
- `buttons.ts` - Button components and variants
- `data-entry-modal.ts` - Generic data entry modals
- `modal-factory.ts` - Modal creation utilities
- `select-dropdown.ts` - Dropdown select components
- `status-panel.ts` - Status and info panels
- `view-container.ts` - Container components with lifecycle

### Maps (`maps/`)
Map-specific UI components:
- `components/map-header.ts` - Map file selector header
- `components/map-list.ts` - Map file browser
- `workflows/map-manager.ts` - Map CRUD workflows
- Integration mit map rendering

### Patterns (`patterns/`)
Common UI patterns and compositions:
- Form patterns
- List patterns
- Panel patterns
- Modal patterns

### Utils (`utils/`)
UI utility functions:
- DOM manipulation helpers
- Event handling utilities
- CSS class management
- Accessibility helpers

## Component Pattern

Alle UI components folgen dem **Handle Pattern**:

```typescript
export interface ComponentHandle {
  // DOM element reference (optional)
  readonly element?: HTMLElement;

  // Public methods for interaction
  update(data: ComponentData): void;
  setDisabled(disabled: boolean): void;

  // Lifecycle cleanup
  destroy(): void;
}

export function createComponent(
  host: HTMLElement,
  options: ComponentOptions
): ComponentHandle {
  // Create DOM
  const container = host.createDiv({ cls: 'component' });

  // Setup state and handlers

  // Return handle with cleanup
  return {
    element: container,
    update(data) { /* ... */ },
    setDisabled(disabled) { /* ... */ },
    destroy() {
      container.remove();
      // Cleanup listeners, etc.
    }
  };
}
```

## Import Rules

**Public API:**
```typescript
// Import from barrel export
import { createButton, createModal } from '@ui';

// Import specific components
import { createViewContainer } from '@ui/components/view-container';
import { createMapHeader } from '@ui/maps/components/map-header';
```

**Type-only imports allowed:**
```typescript
import type { MapHeaderHandle } from '@ui/maps/components/map-header';
```

## Styling

- Komponenten verwenden **CSS classes** (nicht inline styles)
- Class naming: `sm-component-name__element--modifier`
- Global styles in `styles.css` oder workmode-specific `.css`
- Obsidian theme variables für Farben

## Testing

Test files: `devkit/testing/unit/ui/`

UI component tests fokussieren auf:
- DOM structure creation
- Event handler registration
- Lifecycle (create/destroy)
- Accessibility (ARIA attributes)
