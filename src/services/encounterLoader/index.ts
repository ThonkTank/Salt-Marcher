// Ziel: Encounter Loader Service - Preset → CombatState
// Siehe: docs/services/encounterLoader.md
//
// ============================================================================
// ⚠️ ON HOLD - Combat-Initialisierung ist vorübergehend deaktiviert.
// Nur loadEncounterGroups() ist verfügbar.
// ============================================================================
//
// Laedt EncounterPresets und transformiert sie in CombatStateWithLayers.
// Party wird immer zur Runtime uebergeben, nie aus Preset geladen.

import type { EncounterPreset } from '@/types/entities/encounterPreset';
import type { CombatMapConfig } from '@/types/combatTerrain';
import { resolvePreset, calculateDefaultAlliances, resetNpcCounter } from './resolvePreset';

// ============================================================================
// ON HOLD: Combat-Imports deaktiviert
// ============================================================================
// import type { CombatStateWithLayers } from '@/types/combat';
// import type { PartyInput } from '../combatTracking/initialiseCombat';
// import { initialiseCombat } from '../combatTracking';
// import { calculateInitiativeFromGroups } from '../encounterGenerator/difficulty';

// ============================================================================
// RE-EXPORTS
// ============================================================================

export { resolvePreset, calculateDefaultAlliances, resetNpcCounter } from './resolvePreset';

// ============================================================================
// PLACEHOLDER TYPES (ON HOLD)
// ============================================================================

/** ON HOLD: Placeholder für PartyInput während Combat deaktiviert ist. */
export interface PartyInput {
  characters: { id: string; name: string; level: number }[];
  level: number;
  size: number;
}

// ============================================================================
// TYPES
// ============================================================================

/**
 * Optionen fuer loadEncounterPreset.
 */
export interface LoadEncounterOptions {
  /** Override fuer Map-Konfiguration (ignoriert preset.combat.mapId). */
  overrideMapConfig?: CombatMapConfig;
  /** Override fuer Resource-Budget (ignoriert preset.combat.resourceBudget). */
  overrideResourceBudget?: number;
  /** Funktion zum Laden von CombatMapConfig nach mapId. */
  mapConfigLoader?: (mapId: string) => CombatMapConfig | undefined;
}

// ============================================================================
// DEBUG HELPER
// ============================================================================

const debug = (...args: unknown[]) => {
  if (process.env.DEBUG_SERVICES === 'true') {
    console.log('[encounterLoader]', ...args);
  }
};

// ============================================================================
// PUBLIC API
// ============================================================================

/**
 * ON HOLD: Combat-Initialisierung ist deaktiviert.
 * @throws Error - Combat initialization is currently on hold
 */
export function loadEncounterPreset(
  _preset: EncounterPreset,
  _party: PartyInput,
  _options: LoadEncounterOptions = {}
): never {
  throw new Error('Combat initialization is currently on hold. Use loadEncounterGroups() instead.');
}

/**
 * Convenience-Funktion: Laedt Preset nur bis zu EncounterGroups.
 * Nuetzlich wenn Combat-Initialisierung extern erfolgt.
 *
 * @param preset Das zu ladende Preset
 * @returns Tuple von [groups, alliances]
 */
export function loadEncounterGroups(
  preset: EncounterPreset
): { groups: ReturnType<typeof resolvePreset>; alliances: Record<string, string[]> } {
  const groups = resolvePreset(preset);
  const alliances = preset.alliances ?? calculateDefaultAlliances(groups);
  debug('loadEncounterGroups:', { groupCount: groups.length, allianceCount: Object.keys(alliances).length });
  return { groups, alliances };
}
