// Ziel: NPC-Generierung für Encounter, Quest, Shop, POI
// Siehe: docs/services/npcs/NPC-Generation.md
//
// Pipeline (vereinfacht):
// 1. resolveCultureChain() - Hierarchie: Register → Species/Type → Factions
// 2. generateNameFromCulture() - Name aus Naming-Pools (60%-Kaskade)
// 3. rollAttribute() - Generische Funktion für alle 5 Attribute
// 4. generateNPC() - Orchestriert Pipeline, gibt NPC zurück (OHNE Persistierung)
//
// Neue Struktur (6 unabhängige Felder):
// - name: Generiert aus Naming-Patterns
// - personality: EIN Trait (z.B. "mutig", "feige")
// - value: EIN Wert (z.B. "Freundschaft", "Macht")
// - quirk: EINE Eigenheit (optional)
// - appearance: EIN Merkmal (optional)
// - goal: EIN Ziel (z.B. "Überleben", "Rache")
//
// Gewichtungs-Mechanik:
// - 60%-Kaskade: Leaf=100, Parent=60, Grandparent=36...
// - unwanted[]: Viertelt bisherigen akkumulierten Wert

import type { CreatureDefinition } from '#types/entities/creature';
import type { Faction, CultureData } from '#types/entities/faction';
import type { NPC } from '#types/entities/npc';
import type { GameDateTime } from '#types/time';
import type { HexCoordinate } from '#types/hexCoordinate';
import type { LayerTraitConfig } from '#types/common/layerTraitConfig';
import {
  weightedRandomSelect,
  randomSelect,
  resolveCultureChain,
  mergeWeightedPool,
  accumulateWithUnwanted,
  rollDice,
  type CultureLayer,
} from '@/utils';
import { FALLBACK_NPC_NAMES } from '@/constants';
import {
  personalityPresets,
  valuePresets,
  quirkPresets,
  appearancePresets,
  goalPresets,
} from '../../../presets/npcAttributes';

// ============================================================================
// DEBUG HELPER
// ============================================================================

const debug = (...args: unknown[]) => {
  if (process.env.DEBUG_SERVICES === 'true') {
    console.log('[npcGenerator]', ...args);
  }
};

// ============================================================================
// TYPES
// ============================================================================

/** Optionen für NPC-Generierung */
export interface GenerateNPCOptions {
  position?: HexCoordinate;
  time: GameDateTime;  // Required - Caller muss Zeit übergeben
}

/** Preset-Struktur für Attribute mit optionalem Tag-Filter */
interface AttributePreset {
  id: string;
  name: string;
  description?: string;
  compatibleTags?: string[];
}

// ============================================================================
// NAME GENERATION
// ============================================================================

/**
 * Generiert einen Namen aus dem Naming-Config.
 * Pattern-Platzhalter: {prefix}, {root}, {suffix}, {title}
 *
 * Merged alle Naming-Komponenten über alle Culture-Layers mit 60%-Kaskade.
 */
function generateNameFromCulture(layers: CultureLayer[]): string {
  // Merge all naming components across layers
  const patterns = mergeWeightedPool(layers, c => c.naming?.patterns);
  const prefixes = mergeWeightedPool(layers, c => c.naming?.prefixes);
  const roots = mergeWeightedPool(layers, c => c.naming?.roots);
  const suffixes = mergeWeightedPool(layers, c => c.naming?.suffixes);
  const titles = mergeWeightedPool(layers, c => c.naming?.titles);

  debug('Merged naming pools:', {
    patterns: patterns.length,
    prefixes: prefixes.length,
    roots: roots.length,
    suffixes: suffixes.length,
    titles: titles.length,
  });

  if (patterns.length === 0) {
    debug('No naming patterns, using fallback');
    return generateFallbackName();
  }

  // Select pattern from merged pool
  const pattern = weightedRandomSelect(patterns) ?? '{root}';

  // Fill placeholders from merged pools
  const name = pattern
    .replace('{prefix}', weightedRandomSelect(prefixes) ?? '')
    .replace('{root}', weightedRandomSelect(roots) ?? 'Unknown')
    .replace('{suffix}', weightedRandomSelect(suffixes) ?? '')
    .replace('{title}', weightedRandomSelect(titles) ?? '')
    .trim()
    .replace(/\s+/g, ' ');

  debug('Generated name:', name, 'from pattern:', pattern);
  return name || 'Unknown';
}

/**
 * Fallback-Name wenn keine Naming-Config vorhanden.
 */
function generateFallbackName(): string {
  return randomSelect([...FALLBACK_NPC_NAMES]) ?? 'Unknown';
}

// ============================================================================
// GENERIC ATTRIBUTE ROLLING
// ============================================================================

/**
 * Würfelt einen Attribut-Wert aus dem akkumulierten Pool.
 *
 * @param layers - Culture-Layers (Register → Species/Type → Factions)
 * @param extractor - Holt LayerTraitConfig aus CultureData
 * @param presets - Alle verfügbaren Presets für dieses Attribut
 * @param creature - Optional: Für Tag-Filterung
 * @returns Attribut-ID oder undefined
 */
function rollAttribute(
  layers: CultureLayer[],
  extractor: (culture: CultureData) => LayerTraitConfig | undefined,
  presets: AttributePreset[],
  creature?: CreatureDefinition
): string | undefined {
  // Gewichte über alle Layers akkumulieren
  const weights = accumulateWithUnwanted(layers, extractor);

  // Pool bauen aus Presets die Gewicht > 0 haben
  const creatureTags = creature?.tags ?? [];
  const pool = presets
    .filter(preset => {
      // Tag-Filter: Keine compatibleTags = kompatibel mit allen
      if (!preset.compatibleTags || preset.compatibleTags.length === 0) {
        return true;
      }
      return preset.compatibleTags.some(tag => creatureTags.includes(tag));
    })
    .map(preset => ({
      item: preset.id,
      randWeighting: weights.get(preset.id) ?? 0,
    }))
    .filter(entry => entry.randWeighting > 0);

  debug('Attribute pool size:', pool.length);

  if (pool.length === 0) {
    return undefined;
  }

  return weightedRandomSelect(pool) ?? undefined;
}

/**
 * Würfelt ein Attribut und gibt die Description zurück.
 */
function rollAttributeDescription(
  layers: CultureLayer[],
  extractor: (culture: CultureData) => LayerTraitConfig | undefined,
  presets: AttributePreset[],
  creature?: CreatureDefinition
): string | undefined {
  const id = rollAttribute(layers, extractor, presets, creature);
  if (!id) return undefined;

  const preset = presets.find(p => p.id === id);
  return preset?.description ?? preset?.name ?? id;
}

// ============================================================================
// ID GENERATION
// ============================================================================

/**
 * Generiert eine eindeutige NPC-ID.
 * Format: npc-<timestamp>-<random>
 */
function generateNPCId(): string {
  const timestamp = Date.now().toString(36);
  const random = Math.random().toString(36).substring(2, 8);
  return `npc-${timestamp}-${random}`;
}

// ============================================================================
// MAIN FUNCTION
// ============================================================================

/**
 * Generiert einen neuen NPC für die Kreatur.
 *
 * @param creature - Die Kreatur-Definition (aus Preset oder Vault)
 * @param faction - Die Fraktion (falls vorhanden)
 * @param options - Position und Zeit (time ist required)
 * @returns Vollständiges NPC-Objekt (NICHT persistiert)
 */
export function generateNPC(
  creature: CreatureDefinition,
  faction: Faction | null,
  options: GenerateNPCOptions
): NPC {
  debug('Generating NPC for creature:', creature.id, 'faction:', faction?.id ?? 'none');

  // 1. Culture-Chain aufbauen (Register → Species/Type → Factions)
  const layers = resolveCultureChain(creature, faction);
  debug('Culture layers:', layers.length);

  // 2. Name generieren
  const name = generateNameFromCulture(layers);

  // 3. Alle Attribute unabhängig würfeln
  const personality = rollAttribute(layers, c => c.personality, personalityPresets) ?? 'neutral';
  const value = rollAttribute(layers, c => c.values, valuePresets) ?? 'survival';
  const quirk = rollAttributeDescription(layers, c => c.quirks, quirkPresets, creature);
  const appearance = rollAttributeDescription(layers, c => c.appearance, appearancePresets, creature);
  const goal = rollAttributeDescription(layers, c => c.goals, goalPresets) ?? 'Überleben';

  // 4. HP würfeln
  const maxHp = rollDice(creature.hitDice);

  // 5. NPC zusammenbauen
  const now = options.time;

  const npc: NPC = {
    id: generateNPCId(),
    name,
    creature: {
      type: creature.tags[0] ?? 'unknown',
      id: creature.id,
    },
    factionId: faction?.id,
    personality,
    value,
    quirk,
    appearance,
    goal,
    status: 'alive',
    firstEncounter: now,
    lastEncounter: now,
    encounterCount: 1,
    lastKnownPosition: options?.position,
    reputations: [],
    currentHp: maxHp,
    maxHp,
    possessions: [],  // Persistente Besitztümer (via encounterLoot befüllt)
    carriedPossessions: undefined,  // Ephemer: was NPC gerade dabei hat (berechnet pro Encounter)
  };

  debug('Generated NPC:', {
    id: npc.id,
    name: npc.name,
    personality: npc.personality,
    value: npc.value,
    quirk: npc.quirk,
    appearance: npc.appearance,
    goal: npc.goal,
    hp: `${npc.currentHp}/${npc.maxHp}`,
  });

  return npc;
}

export default generateNPC;
