# Library Workmode

## Purpose

Entity CRUD workmode for managing D&D 5e campaign data: creatures, spells, items, equipment, factions, locations, encounter tables, calendars, playlists, regions, and terrains. Provides CreateSpec-driven UI generation and markdown storage.

## Architecture Layer

**Workmodes** - Application layer (top-level)

## Core Files

| File | Purpose |
|------|---------|
| `index.ts` | Barrel export (public API entry point) |
| `library-controller.ts` | Lifecycle orchestration and state management |
| `view.ts` | LibraryView implementation (extends TabbedBrowseView) |
| `registry.ts` | Entity type registration and CreateSpec access |
| `library-types.ts` | Shared type definitions |
| `DIRECTORY.md` | This file (architecture documentation) |

## Public API

### Entity Types

```typescript
// Each entity type has its own subdirectory:
// - creatures/
// - spells/
// - items/
// - equipment/
// - factions/
// - locations/
// - encounter-tables/
// - calendars/
// - playlists/
// - regions/
// - terrains/
// - characters/
```

**11 Entity Types Supported:**
- Creatures (329 presets)
- Spells (338 presets)
- Items (magic items)
- Equipment (weapons, armor)
- Factions (political entities)
- Locations (settlements, dungeons)
- Encounter Tables (random encounters)
- Calendars (custom timekeeping)
- Playlists (audio collections)
- Regions (geographic areas)
- Terrains (biome definitions)
- Characters (PCs/NPCs)

### CreateSpec Pattern

```typescript
// Import from: src/workmodes/library/{entity}/create-spec.ts
import type { CreateSpec } from "src/workmodes/library/core/create-spec-types";

export const creatureCreateSpec: CreateSpec<Creature> = {
  fields: [
    { id: "name", type: "text", label: "Name", required: true },
    { id: "cr", type: "number", label: "Challenge Rating" },
    { id: "type", type: "dropdown", label: "Type", options: CREATURE_TYPES },
    { id: "abilities", type: "repeating", label: "Special Abilities", fields: [...] },
  ],
  storage: {
    path: "Creatures",
    bodyTemplate: (creature) => statblockToMarkdown(creature),
  },
};
```

**CreateSpec Auto-Generates:**
- UI form rendering
- Validation logic
- Storage/serialization
- Type inference

### Field Types (15+)

```typescript
// Primitive types
"text"          // Single-line input
"textarea"      // Multi-line input
"number"        // Numeric input
"checkbox"      // Boolean toggle
"dropdown"      // Select from options

// Complex types
"repeating"     // Array of sub-fields
"composite"     // Nested object
"tags"          // Tag picker
"file-picker"   // Obsidian file link
"dice-notation" // e.g., "2d6+3"

// Custom types
"ability-scores"  // D&D ability block
"damage-type"     // Damage type selector
"spell-level"     // 0-9 spell levels
```

### Registry System

```typescript
// Import from: src/workmodes/library/registry.ts
import {
  getEntityType,
  registerEntityType,
  getAllEntityTypes,
  getCreateSpec,
} from "src/workmodes/library/registry";

// Get CreateSpec for entity type
const spec = getCreateSpec("creatures");

// List all registered types
const types = getAllEntityTypes(); // ["creatures", "spells", "items", ...]
```

### Storage Layer

```typescript
// Import from: src/workmodes/library/storage
import {
  loadEntity,
  saveEntity,
  deleteEntity,
  listEntities,
} from "src/workmodes/library/storage/data-sources";

// Load entity by path
const creature = await loadEntity(app, "Creatures/goblin.md");

// Save entity
await saveEntity(app, "Creatures", creatureData);

// List all entities of type
const allCreatures = await listEntities(app, "Creatures");
```

**Storage Format:**
```markdown
---
smType: creature
name: Goblin
cr: 0.25
---

# Goblin

A small, green-skinned humanoid...
```

### Serializers

```typescript
// Each entity type has a serializer:
// Import from: src/workmodes/library/{entity}/serializer.ts

import { creatureToFrontmatter, frontmatterToCreature } from "src/workmodes/library/creatures/serializer";

// Entity → Markdown frontmatter
const yaml = creatureToFrontmatter(creature);

// Frontmatter → Entity
const creature = frontmatterToCreature(yamlData);
```

### Controller & View Integration

```typescript
// Import from: src/workmodes/library (barrel export)
import { LibraryView, LibraryController } from "src/workmodes/library";
import type { LibraryControllerContext } from "src/workmodes/library";

// Create controller (lifecycle management)
const controller = new LibraryController({ app });
await controller.init();

// Check if initialized
const isInitialized = controller.getInitialized(); // boolean

// Obsidian leaf opens library workmode
const leaf = workspace.getLeaf();
await leaf.setViewState({
  type: "salt-marcher-library",
  state: { entityType: "creatures" },
});

// Cleanup
controller.destroy();
```

**Controller Pattern**: Unlike Cartographer/SessionRunner which have complex orchestration, Library delegates most functionality to TabbedBrowseView from `@features/data-manager`. The controller provides minimal lifecycle management (init/destroy) and serves as an extension point for future shared state/lifecycle needs.

**LibraryController Methods**:
- `init()` - Initialize controller (called during view construction)
- `destroy()` - Cleanup resources (called during view destruction)
- `getInitialized()` - Check initialization state

## Internal Implementation (Do Not Export to Features/Services)

### UI Components

- `core/form-builder.ts` - Generates UI from CreateSpec
- `core/field-renderers.ts` - Field type → DOM element
- `{entity}/ui.ts` - Entity-specific UI customization

### Data Validation

- `core/validation.ts` - Schema validation
- `{entity}/validator.ts` - Entity-specific rules

### Preset Data

- Bundled in `Presets/{EntityType}/` directory
- Loaded at build time via `scripts/generate-preset-data.mjs`
- Imported via `./devkit import-presets {type} --force`

## Allowed Dependencies

- **Services** - `src/services/state` for reactive stores
- **Features** - `src/features/maps`, `src/features/factions`, etc. for domain logic
- **Obsidian API** - `App`, `Vault`, `TFile`, `Modal`, `View`

## Forbidden Dependencies

- ❌ Other workmodes - Each workmode is self-contained
- ❌ Direct vault manipulation - Use storage layer instead

## Usage Patterns

### Defining a New Entity Type

1. **Create directory:** `src/workmodes/library/my-entity/`
2. **Define types:** `types.ts` with interface
3. **Define CreateSpec:** `create-spec.ts` with fields + storage
4. **Define serializer:** `serializer.ts` for MD conversion
5. **Register:** Add to `registry.ts`

Example:
```typescript
// src/workmodes/library/traps/create-spec.ts
import type { CreateSpec } from "../core/create-spec-types";
import type { Trap } from "./types";

export const trapCreateSpec: CreateSpec<Trap> = {
  fields: [
    { id: "name", type: "text", label: "Name", required: true },
    { id: "triggerType", type: "dropdown", label: "Trigger", options: [...] },
    { id: "damage", type: "dice-notation", label: "Damage" },
  ],
  storage: {
    path: "Traps",
    bodyTemplate: (trap) => `## ${trap.name}\n\n${trap.description}`,
  },
};
```

### Adding a Field to Existing Entity

1. **Edit CreateSpec:** Add field to `fields` array
2. **Update types:** Add property to TypeScript interface
3. **Update serializer:** Handle new field in YAML conversion
4. **Rebuild:** `npm run build`

UI auto-updates! No manual form code needed.

### Loading Preset Data

```bash
# Generate preset data from Presets/ directory
npm run build  # Runs generate-preset-data.mjs

# Import into vault
./devkit import-presets creatures --force
```

## Testing

Test files: `devkit/testing/unit/library/` and `devkit/testing/unit/workmodes/library/`

### Key Test Suites

- `creatures/create-spec.test.ts` - Creature CreateSpec validation
- `spells/spell-serializer.test.ts` - Spell MD conversion
- `view.test.ts` - Library workmode UI
- Golden tests in `devkit/testing/unit/golden/library/`

### Test Coverage

- 161 tests across 11 entity types
- Full serialization round-trip tests
- CreateSpec field validation
- Preset data integrity checks

## Design Principles

1. **Declarative UI** - CreateSpec defines fields, form auto-generated
2. **Type-Safe** - TypeScript enforces schema consistency
3. **Markdown-First** - Human-readable storage format
4. **Preset-Driven** - 600+ bundled D&D entities
5. **Single Responsibility** - Each entity type is independent module

## Common Pitfalls

### ❌ Don't Bypass CreateSpec

```typescript
// Bad: Manual form construction
const form = document.createElement("form");
const nameInput = document.createElement("input");
// ... 100 lines of DOM manipulation

// Good: Define CreateSpec, form auto-generated
const spec: CreateSpec<MyEntity> = {
  fields: [
    { id: "name", type: "text", label: "Name" },
  ],
};
```

### ❌ Don't Forget to Update Serializer

```typescript
// Bad: Added field to CreateSpec but not serializer
// Result: Field not saved to markdown!

// Good: Update both CreateSpec AND serializer
// create-spec.ts
{ id: "newField", type: "text", label: "New Field" }

// serializer.ts
export function toFrontmatter(entity: MyEntity) {
  return {
    ...existingFields,
    newField: entity.newField,  // ← Add this!
  };
}
```

### ❌ Don't Import Library Types in Features

```typescript
// Bad: Feature depends on workmode!
import type { Creature } from "src/workmodes/library/creatures/creature-types";

// Good: Define shared types in feature if needed
// Or use type-only import (allowed exception)
import type { Creature } from "workmodes/library/creatures/creature-types";
```

## Architecture Notes

**Why workmodes layer?**
- Library is a self-contained application
- Not used by other workmodes (each loads entities directly)
- Has its own UI, routing, and user workflows

**Why CreateSpec pattern?**
- DRY: Single source of truth for entity schema
- Reduces boilerplate from ~500 lines → 50 lines per entity
- Type-safe field definitions
- Auto-generates UI, validation, storage

**Why markdown storage?**
- Obsidian native format
- Human-readable
- Supports linking between entities
- Can be edited manually in any text editor

**Preset data workflow:**
1. Author creates `Presets/Creatures/goblin.md`
2. Build script scans `Presets/` → generates `data.json`
3. Plugin bundles `data.json` in build
4. User runs `./devkit import-presets creatures`
5. Data imported to vault

## Performance Notes

- CreateSpec field generation: <1ms per form
- Preset import (329 creatures): ~500ms
- Entity list rendering (1000 items): ~100ms with virtualization
- Markdown serialization: ~1ms per entity

## Related Documentation

- [docs/workmodes/library.md](/home/aaron/ObsVaults/DnD/.obsidian/plugins/salt-marcher/docs/workmodes/library.md) - User guide
- [docs/reference/create-spec-schema.md](/home/aaron/ObsVaults/DnD/.obsidian/plugins/salt-marcher/docs/reference/create-spec-schema.md) - Field types
- [CLAUDE.md](/home/aaron/ObsVaults/DnD/.obsidian/plugins/salt-marcher/CLAUDE.md#createspec-pattern) - CreateSpec pattern
