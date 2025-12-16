/**
 * Schemas Index
 *
 * Re-exports all schema types for convenient imports.
 *
 * @module schemas
 */

// Common (type utilities)
export * from './common';

// Geometry (hex coordinates, rendering primitives)
export * from './geometry';

// Map (tiles, map data)
export * from './map';

// Character (core stats, abilities, spells, creatures)
export * from './character';

// Combat (damage, conditions, attacks)
export * from './combat';

// Encounter (party, encounter generation)
export * from './encounter';

// Travel (routes, waypoints, tokens)
export * from './travel';

// Calendar (dates, calendar config)
export * from './calendar';

// Weather (weather calculation types)
export * from './weather';

// Library (entity types for library system)
export * from '../../Shared/schemas/library';

// Presets (bundled creature/terrain data)
export * from '../../SaltMarcherCore/schemas/preset';
