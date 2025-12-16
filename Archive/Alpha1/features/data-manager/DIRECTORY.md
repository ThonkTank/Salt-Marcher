# Data Manager Feature

## Purpose

UI infrastructure for entity management across Salt Marcher. Provides CreateSpec-based CRUD operations, form generation, browse views, and field rendering. **Note: This is UI infrastructure, not a domain feature.**

## Architecture Layer

**Features** - Shared systems layer (mid-level)

**Note:** This module may be better suited for `src/ui/` or `src/services/` since it provides UI infrastructure rather than domain logic.

## Public API

### Modal System

```typescript
// Import from: src/features/data-manager
import {
  openCreateModal,              // Open entity creation modal
  Modal,                        // Base modal class
  type ModalOptions,
} from "src/features/data-manager";

// Open create dialog for entity type
await openCreateModal(app, {
  spec: creatureSpec,
  onSave: async (data) => {
    await saveToVault(data);
  },
});
```

### Browse Infrastructure

```typescript
// Import from: src/features/data-manager/browse
import {
  TabbedBrowseView,             // Tabbed entity browser
  GenericListRenderer,          // List rendering
  FilterControls,               // Search/filter UI
  type BrowseConfig,
  type FilterConfig,
} from "src/features/data-manager/browse";

// Create browse view
const view = new TabbedBrowseView({
  app,
  spec: creatureSpec,
  onSelect: (entity) => console.log(entity),
});
```

### Field Rendering

```typescript
// Import from: src/features/data-manager/fields
import {
  FieldManager,                 // Field renderer registry
  FieldRendererRegistry,        // Custom field types
  NumberStepperControl,         // Number input with +/- buttons
  ClickableIcon,                // Icon button component
} from "src/features/data-manager/fields";
```

### Storage System

```typescript
// Import from: src/features/data-manager/storage
import {
  Storage,                      // Entity storage interface
  EntrySystem,                  // Entry management
  type StorageAdapter,
} from "src/features/data-manager/storage";
```

### Layout System

```typescript
// Import from: src/features/data-manager/layout
import {
  Layouts,                      // Layout definitions
  type LayoutConfig,
} from "src/features/data-manager/layout";
```

### Types

```typescript
// Import from: src/features/data-manager
import type {
  CreateSpec,                   // Entity definition spec
  FieldDefinition,              // Field schema
  FieldRenderer,                // Custom field renderer
  ValidationRule,               // Field validation
} from "src/features/data-manager/types";
```

## Subdirectories

### `browse/`
Entity browsing and list rendering infrastructure:
- `tabbed-browse-view.ts` - Multi-tab entity browser
- `generic-list-renderer.ts` - Configurable list rendering
- `filter-controls.ts` - Search, sort, filter UI
- `schema-builder.ts` - Convert CreateSpec → Browse schema
- `auto-loader.ts` - Automatic entity loading
- `action-factory.ts` - Action button generation

### `fields/`
Field rendering and input controls:
- `field-manager.ts` - Field renderer coordinator
- `field-renderer-registry.ts` - Custom field type registration
- `number-stepper-control.ts` - Numeric input with increment/decrement
- `clickable-icon.ts` - Icon button component

### `layout/`
Form layout definitions:
- `layouts.ts` - Layout configurations (grid, stack, etc.)

### `modal/`
Modal dialog system:
- `modal.ts` - Base modal class
- `open-create-modal.ts` - Entity creation modal

### `storage/`
Data persistence layer:
- `storage.ts` - Storage interface
- `entry-system.ts` - Entry management

### `utils/`
Shared utilities for data-manager components

## Allowed Dependencies

- **Services** - `src/services/state` for reactive stores
- **Obsidian API** - `App`, `Modal`, `Setting` for UI components

## Forbidden Dependencies

- ❌ `src/workmodes/*` - Infrastructure should not depend on applications
- ❌ `src/features/*` (domain features) - UI infrastructure should be independent

## Technical Debt

**Layer Placement:**
This module provides UI infrastructure, not domain logic. Consider moving to:
- `src/ui/entity-manager/` - If we add more UI infrastructure
- `src/services/ui/` - As a service layer component

**Priority:** Low (current location works but violates feature layer principle)

**Refactoring Impact:**
- Update imports in workmodes (Library, Session Runner)
- Update architecture documentation
- Rename from "data-manager" to "entity-ui" or "entity-manager"

## Design Principles

1. **CreateSpec-Driven** - All UI generated from declarative specs
2. **Reusable Components** - Field renderers, layouts, modals shared across entity types
3. **Separation of Concerns** - UI generation separate from data persistence
4. **Type-Safe** - TypeScript ensures field types match specs

## Common Pitfalls

### ❌ Don't Bypass CreateSpec

```typescript
// Bad: Manual form generation
const input = createEl("input");
container.appendChild(input);

// Good: Use CreateSpec + FieldManager
const field = { type: "text", id: "name", label: "Name" };
fieldManager.renderField(field, container);
```

### ❌ Don't Mix UI and Domain Logic

```typescript
// Bad: Domain logic in field renderer
renderer.onSave = async (value) => {
  await calculateEncounterDifficulty(value);  // Domain logic!
  await saveToVault(value);
};

// Good: Separate concerns
renderer.onSave = async (value) => {
  await saveToVault(value);
};
// Call calculateEncounterDifficulty in domain layer
```

## Architecture Notes

**Why in features layer?**
- Historical reason: Started as feature-specific UI
- Grew into shared infrastructure for all entities
- **Should be moved to services or ui layer** (see Technical Debt)

**Why CreateSpec-based?**
- Single source of truth for entity structure
- Auto-generates forms, validation, storage
- Changes to spec automatically update UI

**Why separate from workmodes?**
- Library workmode needs entity CRUD
- Session Runner needs entity browsing
- Almanac needs event management
- Shared infrastructure prevents duplication

## Related Documentation

- [FIELD_TYPES.md](/home/aaron/ObsVaults/DnD/.obsidian/plugins/salt-marcher/src/features/data-manager/FIELD_TYPES.md) - Field type reference
- [create-dialog-integration.md](/home/aaron/ObsVaults/DnD/.obsidian/plugins/salt-marcher/src/features/data-manager/create-dialog-integration.md) - Integration guide
- [CLAUDE.md](/home/aaron/ObsVaults/DnD/.obsidian/plugins/salt-marcher/CLAUDE.md) - Architecture standards
