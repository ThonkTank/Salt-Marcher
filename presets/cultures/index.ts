// Culture-Presets für NPC-Generation
// Siehe: docs/services/NPCs/Culture-Resolution.md
//
// Hierarchie:
// 1. Faction.culture (in Faction-Presets eingebettet)
// 2. Species-Cultures (presets/cultures/species/)
// 3. Type-Presets (presets/cultures/types/)

export { typePresets, type TypeCulturePreset } from './types';
export { speciesPresets, type SpeciesCulturePreset } from './species';
