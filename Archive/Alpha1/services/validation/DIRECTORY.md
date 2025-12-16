# validation/

**Purpose**: Schema validation infrastructure for Salt Marcher domain documents (Markdown + YAML frontmatter).

## Contents

| Element | Type | Description |
|---------|------|-------------|
| `schemas.ts` | File | Runtime validators and type definitions for all domain document types |
| `index.ts` | File | Barrel export of validation functions and types |

## Connections

**Used by:**
- DevKit CLI validation commands
- Repository parse/validation logic
- Import/export utilities

**Depends on:**
- None (intentionally standalone for DevKit usage)

## Public API

```typescript
// Validation types
export type {
    SchemaLocation,        // Directory path + optional flag
    SchemaDocument,        // Parsed document (frontmatter + body + path)
    SchemaValidationError, // { field, message }
    SchemaValidator,       // (doc) => errors[]
    SchemaDefinition,      // Complete schema spec
};

// Validation functions
export {
    validateCreature,
    validateSpell,
    validateItem,
    validateCharacter,
    validateLocation,
    validateFaction,
    validateCalendar,
    validateEvent,
    validateLootTemplate,
};

// Document type definitions
export type {
    CreatureDocument,
    SpellDocument,
    ItemDocument,
    CharacterDocument,
    LocationDocument,
    FactionDocument,
    CalendarDocument,
    EventDocument,
    LootTemplateDocument,
};
```

## Usage Example

```typescript
import { validateCreature, type SchemaValidationError } from '@services/validation';

const doc = {
    frontmatter: {
        name: 'Goblin',
        type: 'Humanoid',
        size: 'Small',
        cr: 0.25,
    },
    body: '# Goblin\n\nSmall greenskin...',
    filePath: 'Creatures/Goblin.md',
};

const errors: SchemaValidationError[] = validateCreature(doc);
if (errors.length > 0) {
    console.error('Validation failed:', errors);
    // [{ field: 'hp', message: 'Field is required.' }]
} else {
    console.log('Document is valid!');
}
```

## Design Principles

**Lightweight**: No build dependencies, runs in DevKit without compilation

**Focused**: Validates required fields and basic types, not full domain logic

**Extensible**: Easy to add new validators for new document types

**Consistent**: All validators follow same pattern and error format

## Validation Rules

Validators check:
- Required fields are present
- Field types are correct (string, number, array, object)
- Numeric constraints (min/max values)
- Array element types
- Object shape guarantees

Validators do NOT check:
- Complex business logic
- Cross-document relationships
- Computed/derived values
- Full domain invariants (handled by repositories/domain services)
