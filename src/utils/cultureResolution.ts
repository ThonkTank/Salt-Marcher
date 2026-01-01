// Ziel: Shared Culture-Resolution für NPC-Generator und Activity-Selection
// Siehe: docs/services/npcs/Culture-Resolution.md
//
// Funktionen:
// - resolveCultureChain() - Culture-Hierarchie aufbauen (Type/Species → Faction)
// - calculateLayerWeights() - 60%-Kaskade Gewichte berechnen (Leaf=100, Parent=60, ...)
// - mergeWeightedPool() - Items aus allen Layers in gewichteten Pool mergen (Duplikate summiert)
// - aggregateWeightedPools() - Mehrere Pools zusammenführen (Weights summieren)
//
// Für gewichtete Auswahl aus Pool: weightedRandomSelect() aus random.ts verwenden

import type { CreatureDefinition } from '#types/entities/creature';
import type { Faction, CultureData } from '#types/entities/faction';
import type { LayerTraitConfig } from '../types/common/layerTraitConfig';
import { typePresets, speciesPresets } from '../../presets/cultures';
import { vault } from '../infrastructure/vault/vaultInstance';
import { getAllIds } from '../../presets/npcAttributes';

// ============================================================================
// DEBUG HELPER
// ============================================================================

const debug = (...args: unknown[]) => {
  if (process.env.DEBUG_SERVICES === 'true') {
    console.log('[cultureResolution]', ...args);
  }
};

// ============================================================================
// TYPES
// ============================================================================

/** Quelle einer Culture-Ebene */
export type CultureSource = 'register' | 'type' | 'species' | 'faction';

/** Eine Ebene in der Culture-Hierarchie */
export interface CultureLayer {
  source: CultureSource;
  culture: CultureData;
  factionId?: string;
}

// ============================================================================
// REGISTER BASE LAYER
// ============================================================================

/**
 * Basis-Culture aus dem zentralen Register.
 * Enthält alle verfügbaren Attribute-IDs als add[].
 * Wird als erstes Layer in der Hierarchie verwendet.
 */
function buildRegisterCulture(): CultureData {
  return {
    personality: { add: getAllIds('personality') },
    values: { add: getAllIds('values') },
    quirks: { add: getAllIds('quirks') },
    appearance: { add: getAllIds('appearance') },
    goals: { add: getAllIds('goals') },
  };
}

// ============================================================================
// CULTURE RESOLUTION
// ============================================================================

/**
 * Bestimmt die Culture-Ebenen für eine Kreatur.
 *
 * Hierarchie (von Root nach Leaf):
 * 1. Register (Base-Layer mit allen verfügbaren Attributen)
 * 2. Species-Culture (falls creature.species gesetzt) ODER Type-Preset
 * 3. Faction-Kette (Root → ... → Leaf) via parentId
 *
 * @param creature - Die Kreatur-Definition (kann null sein für Fallback)
 * @param faction - Die Fraktion (falls vorhanden)
 */
export function resolveCultureChain(
  creature: CreatureDefinition | null | undefined,
  faction: Faction | null | undefined
): CultureLayer[] {
  const layers: CultureLayer[] = [];

  // 1. Register als Base-Layer
  layers.push({ source: 'register', culture: buildRegisterCulture() });
  debug('Culture layer: register (base)');

  if (!creature) {
    // Fallback auf humanoid wenn keine Kreatur
    const fallback = typePresets['humanoid'];
    if (fallback) {
      layers.push({ source: 'type', culture: fallback });
      debug('Culture layer: type = humanoid (no creature fallback)');
    }
  } else {
    // 2. Species-Culture (ersetzt Type) ODER Type-Preset
    if (creature.species) {
      const speciesCulture = speciesPresets[creature.species];
      if (speciesCulture) {
        layers.push({ source: 'species', culture: speciesCulture });
        debug('Culture layer: species =', creature.species);
      } else {
        // Fallback auf Type wenn Species nicht gefunden
        addTypeCulture(layers, creature);
      }
    } else {
      addTypeCulture(layers, creature);
    }
  }

  // 3. Faction-Kette hinzufügen (von Root nach Leaf)
  if (faction) {
    const factionChain = buildFactionChain(faction);
    for (const f of factionChain) {
      if (f.culture) {
        layers.push({
          source: 'faction',
          culture: f.culture,
          factionId: f.id,
        });
        debug('Culture layer: faction =', f.id);
      }
    }
  }

  debug('Total culture layers:', layers.length);
  return layers;
}

/**
 * Fügt Type-Preset als Basis-Culture hinzu.
 * Hilfsfunktion für resolveCultureChain().
 */
function addTypeCulture(layers: CultureLayer[], creature: CreatureDefinition): void {
  const creatureType = creature.tags[0] ?? 'humanoid';
  const typePreset = typePresets[creatureType];

  if (typePreset) {
    layers.push({ source: 'type', culture: typePreset });
    debug('Culture layer: type =', creatureType);
  } else {
    // Fallback auf humanoid wenn Type nicht gefunden
    const fallback = typePresets['humanoid'];
    if (fallback) {
      layers.push({ source: 'type', culture: fallback });
      debug('Culture layer: type = humanoid (fallback)');
    }
  }
}

/**
 * Traversiert die Faction-Hierarchie von Leaf nach Root.
 * Bricht bei fehlender Parent-Faction ab (graceful degradation).
 * @returns [root, ..., parent, leaf] - geordnet für 60%-Kaskade
 */
function buildFactionChain(faction: Faction): Faction[] {
  const chain: Faction[] = [];
  let current: Faction | null = faction;

  while (current) {
    chain.unshift(current);
    if (current.parentId) {
      try {
        current = vault.getEntity<Faction>('faction', current.parentId);
      } catch {
        // Parent nicht gefunden - Kette hier beenden
        debug('Parent faction not found:', current.parentId);
        current = null;
      }
    } else {
      current = null;
    }
  }

  debug('Faction chain:', chain.map(f => f.id));
  return chain;
}

// ============================================================================
// LAYER WEIGHTS (60%-Kaskade)
// ============================================================================

/**
 * Berechnet Layer-Gewichte nach 60%-Kaskade.
 *
 * Leaf bekommt 100, jede höhere Ebene 60% der vorherigen:
 * - 1 Layer: [100]
 * - 2 Layer: [60, 100]
 * - 3 Layer: [36, 60, 100]
 * - 4 Layer: [21.6, 36, 60, 100]
 */
export function calculateLayerWeights(layerCount: number): number[] {
  if (layerCount === 0) return [];
  if (layerCount === 1) return [100];

  const weights: number[] = [];
  let weight = 100;

  // Von Leaf (hinten) nach Root (vorne)
  for (let i = 0; i < layerCount; i++) {
    weights.unshift(weight);
    weight *= 0.6;
  }

  return weights;
}

/**
 * Merged Items aus allen Layers in einen gewichteten Pool.
 * Duplikate werden summiert (Item in Leaf + Parent = 160).
 *
 * @param layers - Die Culture-Layers
 * @param extractor - Funktion um Items aus CultureData zu extrahieren
 * @param getWeight - Optionale Funktion um Basis-Gewicht eines Items zu holen (default: 1.0)
 */
export function mergeWeightedPool<T>(
  layers: CultureLayer[],
  extractor: (culture: CultureData) => T[] | undefined,
  getWeight?: (item: T) => number
): Array<{ item: T; randWeighting: number }> {
  const weights = calculateLayerWeights(layers.length);
  const merged = new Map<string, { item: T; randWeighting: number }>();

  for (let i = 0; i < layers.length; i++) {
    const items = extractor(layers[i].culture);
    if (!items) continue;

    const layerWeight = weights[i];
    for (const item of items) {
      // Content-basierter Key: String direkt, Objekte als JSON
      const key = typeof item === 'string' ? item : JSON.stringify(item);
      const baseWeight = getWeight?.(item) ?? 1.0;
      const itemWeight = baseWeight * layerWeight;

      const existing = merged.get(key);
      if (existing) {
        existing.randWeighting += itemWeight; // Duplikat summieren
      } else {
        merged.set(key, { item, randWeighting: itemWeight });
      }
    }

    debug(`Merged ${items.length} items from layer ${i} (randWeighting: ${layerWeight})`);
  }

  const result = Array.from(merged.values());
  debug('Total merged pool size:', result.length);
  return result;
}

/**
 * Aggregiert mehrere gewichtete Pools zu einem.
 * Duplikate werden summiert (keine Kaskade).
 *
 * @param pools - Array von gewichteten Pools
 * @param getKey - Optionale Funktion um Key für Duplikat-Erkennung zu generieren
 * @returns Aggregierter Pool mit summierten randWeightings
 */
export function aggregateWeightedPools<T>(
  pools: Array<Array<{ item: T; randWeighting: number }>>,
  getKey?: (item: T) => string
): Array<{ item: T; randWeighting: number }> {
  const merged = new Map<string, { item: T; randWeighting: number }>();

  for (const pool of pools) {
    for (const entry of pool) {
      const key = getKey?.(entry.item)
        ?? (typeof entry.item === 'string' ? entry.item : JSON.stringify(entry.item));

      const existing = merged.get(key);
      if (existing) {
        existing.randWeighting += entry.randWeighting;
      } else {
        merged.set(key, { item: entry.item, randWeighting: entry.randWeighting });
      }
    }
  }

  debug('aggregateWeightedPools:', pools.length, 'pools →', merged.size, 'unique items');
  return Array.from(merged.values());
}

// ============================================================================
// ACCUMULATE WITH UNWANTED (für NPC-Attribute)
// ============================================================================

/**
 * Akkumuliert Gewichte über Layer mit 60%-Kaskade und unwanted-Vierteln.
 *
 * Verarbeitung pro Layer:
 * 1. Zuerst unwanted verarbeiten (viertelt bisherigen akkumulierten Wert)
 * 2. Dann add verarbeiten (addiert Layer-Gewicht)
 *
 * Beispiel mit 4 Layern (Register → Goblin → Rotfang → Silberblatt):
 * - Kaskade: [21.6, 36, 60, 100]
 * - Trait "gutherzig":
 *   - Register: +21.6 → akkumuliert: 21.6
 *   - Goblin: (nicht) → akkumuliert: 21.6
 *   - Rotfang: unwanted → 21.6 / 4 = 5.4
 *   - Silberblatt: +100 → 5.4 + 100 = 105.4
 *
 * @param layers - Culture-Layers von Root nach Leaf
 * @param extractor - Holt LayerTraitConfig aus CultureData
 * @returns Map<attributeId, akkumuliertesGewicht>
 */
export function accumulateWithUnwanted(
  layers: CultureLayer[],
  extractor: (culture: CultureData) => LayerTraitConfig | undefined
): Map<string, number> {
  const weights = calculateLayerWeights(layers.length);
  const accumulated = new Map<string, number>();

  for (let i = 0; i < layers.length; i++) {
    const config = extractor(layers[i].culture);
    if (!config) continue;

    const layerWeight = weights[i];

    // 1. Zuerst unwanted verarbeiten (viertelt bisherigen Wert)
    for (const id of config.unwanted ?? []) {
      const current = accumulated.get(id) ?? 0;
      const quartered = current / 4;
      accumulated.set(id, quartered);
      debug(`Layer ${i}: unwanted '${id}' → ${current.toFixed(1)} / 4 = ${quartered.toFixed(1)}`);
    }

    // 2. Dann add verarbeiten (addiert Layer-Gewicht)
    for (const id of config.add ?? []) {
      const current = accumulated.get(id) ?? 0;
      const newValue = current + layerWeight;
      accumulated.set(id, newValue);
      debug(`Layer ${i}: add '${id}' → ${current.toFixed(1)} + ${layerWeight.toFixed(1)} = ${newValue.toFixed(1)}`);
    }
  }

  debug('accumulateWithUnwanted: total attributes with weight:', accumulated.size);
  return accumulated;
}
