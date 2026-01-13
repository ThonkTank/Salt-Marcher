// Ziel: Encounter Loader Service - Preset → CombatState
// Siehe: docs/services/encounterLoader.md
//
// Laedt EncounterPresets und transformiert sie in CombatStateWithLayers.
// Party wird immer zur Runtime uebergeben, nie aus Preset geladen.

import type { EncounterPreset } from '@/types/entities/encounterPreset';
import type { CombatStateWithLayers } from '@/types/combat';
import type { CombatMapConfig } from '@/types/combatTerrain';
import type { PartyInput } from '../combatTracking/initialiseCombat';
import { initialiseCombat } from '../combatTracking';
import { calculateInitiativeFromGroups } from '../encounterGenerator/difficulty';
import { resolvePreset, calculateDefaultAlliances, resetNpcCounter } from './resolvePreset';

// ============================================================================
// RE-EXPORTS
// ============================================================================

export { resolvePreset, calculateDefaultAlliances, resetNpcCounter } from './resolvePreset';

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
 * Laedt ein EncounterPreset und initialisiert Combat.
 *
 * @param preset Das zu ladende Preset
 * @param party Party-Input (immer von aussen uebergeben)
 * @param options Optionale Overrides und Konfiguration
 * @returns CombatStateWithLayers ready for combat
 *
 * @example
 * ```typescript
 * const preset = getEncounterPreset('1v1-melee');
 * const party = getPartyFromSession();
 * const state = loadEncounterPreset(preset, party, {
 *   mapConfigLoader: getMapConfigForScenario,
 * });
 * ```
 */
export function loadEncounterPreset(
  preset: EncounterPreset,
  party: PartyInput,
  options: LoadEncounterOptions = {}
): CombatStateWithLayers {
  const { overrideMapConfig, overrideResourceBudget, mapConfigLoader } = options;

  debug('Loading preset:', preset.id, 'mode:', preset.mode);

  // Step 1: Groups resolvieren (mode-spezifisch)
  const groups = resolvePreset(preset);

  // Step 2: Allianzen bestimmen
  const alliances = preset.alliances ?? calculateDefaultAlliances(groups);

  // Step 3: Map-Konfiguration laden
  let mapConfig: CombatMapConfig | undefined = overrideMapConfig;
  if (!mapConfig && preset.combat?.mapId && mapConfigLoader) {
    mapConfig = mapConfigLoader(preset.combat.mapId);
  }

  // Step 4: Resource-Budget bestimmen
  const resourceBudget =
    overrideResourceBudget ?? preset.combat?.resourceBudget ?? 1.0;

  // Step 5: Initiative Order berechnen
  const initiativeOrder = calculateInitiativeFromGroups(groups);

  // Step 6: Encounter-Distanz bestimmen
  const encounterDistanceFeet = preset.combat?.encounterDistanceFeet;

  debug('Resolved:', {
    groupCount: groups.length,
    allianceCount: Object.keys(alliances).length,
    resourceBudget,
    hasMapConfig: !!mapConfig,
    initiativeOrderLength: initiativeOrder.length,
  });

  // Step 7: Combat initialisieren
  return initialiseCombat({
    groups,
    alliances,
    party,
    resourceBudget,
    encounterDistanceFeet,
    initiativeOrder,
    mapConfig,
  });
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
  return { groups, alliances };
}
