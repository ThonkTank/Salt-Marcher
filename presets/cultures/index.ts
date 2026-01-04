// Culture-Presets fuer NPC-Generation
// Siehe: docs/types/culture.md
//
// Culture-Entities sind eigenstaendige Presets mit ID-Konvention:
// - type:{creatureType} - Basis-Kulturen fuer D&D Creature-Types (Fallback)
// - species:{speciesId} - Species-spezifische Kulturen
// - faction:{factionId} - Faction-spezifische Kulturen
//
// Hierarchie bei Aufloesung (cultureResolution.ts):
// 1. Faction-Culture (hoechste Prioritaet)
// 2. Species-Culture
// 3. Type-Culture (niedrigste Prioritaet, Fallback)

import { z } from 'zod';
import { cultureSchema, type Culture } from '../../src/types/entities/culture';
import { typeCulturePresets, typePresets } from './types';
import { speciesCulturePresets, speciesPresets } from './species';
import { factionCulturePresets } from './factions';

// ============================================================================
// COMBINED CULTURE-PRESETS
// ============================================================================

/**
 * Alle Culture-Presets als validiertes Array.
 * Kombiniert Type-, Species- und Faction-Kulturen.
 */
export const culturePresets: Culture[] = z.array(cultureSchema).parse([
  ...typeCulturePresets,
  ...speciesCulturePresets,
  ...factionCulturePresets,
]);

/**
 * Culture-Presets als Map fuer schnellen ID-Lookup.
 */
export const culturePresetsMap: Map<string, Culture> = new Map(
  culturePresets.map(c => [c.id, c])
);

// ============================================================================
// RE-EXPORTS
// ============================================================================

// Kategorisierte Exports
export { typeCulturePresets, typePresets } from './types';
export { speciesCulturePresets, speciesPresets } from './species';
export { factionCulturePresets } from './factions';

// Type re-export
export type { Culture } from '../../src/types/entities/culture';

// Default-Export fuer CLI-Generator
export default culturePresets;
