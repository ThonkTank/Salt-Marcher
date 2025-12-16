// src/services/validation/index.ts
// Schema validation infrastructure for Salt Marcher domain documents

/**
 * Schema Validation Infrastructure
 *
 * Provides runtime validators for domain documents (Markdown + YAML frontmatter).
 * These validators are intentionally lightweight so they can run inside DevKit
 * tooling without requiring a full build step.
 *
 * **Usage:**
 * ```typescript
 * import { validateCreature } from '@services/validation';
 *
 * const errors = validateCreature(doc);
 * if (errors.length > 0) {
 *   console.error('Validation failed:', errors);
 * }
 * ```
 */

export type {
    SchemaLocation,
    SchemaDocument,
    SchemaValidationError,
    SchemaValidator,
    SchemaDefinition,
} from "./schemas";

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
} from "./schemas";

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
} from "./schemas";
