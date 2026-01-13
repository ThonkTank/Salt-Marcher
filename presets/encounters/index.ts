// Ziel: Encounter Preset Registry - Zentrale Sammlung aller Presets
// Siehe: docs/types/encounter-preset.md
//
// Kombiniert alle Preset-Kategorien in einer einheitlichen Registry.
// Presets koennen nach ID oder Name abgerufen werden.

import type { EncounterPreset } from '../../src/types/entities/encounterPreset';
import { tournamentPresets, getTournamentPresetById, getTournamentPresetByName } from './tournament';
import { templatePresets, getTemplatePresetById } from './templates';

// ============================================================================
// COMBINED REGISTRY
// ============================================================================

/** Alle Encounter Presets (Tournament + Templates). */
export const encounterPresets: EncounterPreset[] = [
  ...tournamentPresets,
  ...templatePresets,
];

// ============================================================================
// LOOKUP FUNCTIONS
// ============================================================================

/**
 * Findet ein Preset nach ID.
 * Sucht in allen Kategorien (Tournament, Templates).
 */
export function getEncounterPresetById(id: string): EncounterPreset | undefined {
  return encounterPresets.find(p => p.id === id);
}

/**
 * Findet ein Preset nach Name.
 * Sucht in allen Kategorien (Tournament, Templates).
 */
export function getEncounterPresetByName(name: string): EncounterPreset | undefined {
  return encounterPresets.find(p => p.name === name);
}

/**
 * Filtert Presets nach Tags.
 * @param tags Tags die das Preset haben muss (AND-Verknuepfung)
 */
export function getEncounterPresetsByTags(tags: string[]): EncounterPreset[] {
  return encounterPresets.filter(p =>
    tags.every(tag => p.tags?.includes(tag))
  );
}

/**
 * Filtert Presets nach Mode.
 * @param mode 'authored' | 'template' | 'embedded'
 */
export function getEncounterPresetsByMode(mode: EncounterPreset['mode']): EncounterPreset[] {
  return encounterPresets.filter(p => p.mode === mode);
}

// ============================================================================
// RE-EXPORTS
// ============================================================================

// Tournament Presets
export {
  tournamentPresets,
  getTournamentPresetById,
  getTournamentPresetByName,
} from './tournament';

// Template Presets
export {
  templatePresets,
  getTemplatePresetById,
} from './templates';

// Default export: All presets
export default encounterPresets;
