// Ziel: Shared Culture-Resolution für NPC-Generator und Activity-Selection
// Siehe: docs/services/npcs/Culture-Resolution.md
//
// Funktionen:
// - resolveCultureChain() - Culture-Hierarchie aufbauen (Type/Species → Faction)
// - selectCultureLayer() - 60%-Kaskade Layer-Auswahl
// - getCultureField() - Feld aus Layers mit Fallback holen
//
// DISKREPANZEN (als [HACK] markiert):
// ================================================
//
// [HACK: Culture-Resolution.md#forbidden] Forbidden-Listen ignoriert
//   → Nur positive Pools, keine Ausschluss-Logik
//
// [HACK: Culture-Resolution.md#faction-chain] Keine Faction-Ketten-Traversierung
//   → Nur direkte Faction.culture, parentId ignoriert

import type { CreatureDefinition } from '#types/entities/creature';
import type { Faction, CultureData } from '#types/entities/faction';
import { typePresets, speciesPresets } from '../../presets/cultures';

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
export type CultureSource = 'type' | 'species' | 'faction';

/** Eine Ebene in der Culture-Hierarchie */
export interface CultureLayer {
  source: CultureSource;
  culture: CultureData;
  factionId?: string;
}

// ============================================================================
// CULTURE RESOLUTION
// ============================================================================

/**
 * Bestimmt die Culture-Ebenen für eine Kreatur.
 *
 * [HACK: Culture-Resolution.md#faction-chain] Keine Faction-Ketten-Traversierung
 *
 * Hierarchie (von Root nach Leaf):
 * 1. Species-Culture (falls creature.species gesetzt) ODER Type-Preset
 * 2. Faction.culture (falls vorhanden)
 *
 * @param creature - Die Kreatur-Definition (kann null sein für Fallback)
 * @param faction - Die Fraktion (falls vorhanden)
 */
export function resolveCultureChain(
  creature: CreatureDefinition | null | undefined,
  faction: Faction | null | undefined
): CultureLayer[] {
  const layers: CultureLayer[] = [];

  if (!creature) {
    // Fallback auf humanoid wenn keine Kreatur
    const fallback = typePresets['humanoid'];
    if (fallback) {
      layers.push({ source: 'type', culture: fallback });
      debug('Culture layer: type = humanoid (no creature fallback)');
    }
  } else {
    // 1. Basis: Species-Culture (ersetzt Type) ODER Type-Preset
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

  // 2. Faction-Culture hinzufügen (falls vorhanden)
  // [HACK: Culture-Resolution.md#faction-chain] Nur direkte Faction, keine parentId-Kette
  if (faction?.culture) {
    layers.push({
      source: 'faction',
      culture: faction.culture,
      factionId: faction.id,
    });
    debug('Culture layer: faction =', faction.id);
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
 * Wählt eine Layer aus den Culture-Layers mit 60%-Kaskade.
 *
 * Leaf bekommt 60%, Rest kaskadiert:
 * - 1 Layer: 100%
 * - 2 Layer: Root 40%, Leaf 60%
 * - 3 Layer: Root 16%, Mid 24%, Leaf 60%
 */
export function selectCultureLayer(layers: CultureLayer[]): CultureLayer | null {
  if (layers.length === 0) return null;
  if (layers.length === 1) return layers[0];

  // 60%-Kaskade berechnen (von Leaf nach Root)
  const probabilities: number[] = [];
  let remaining = 1.0;

  for (let i = layers.length - 1; i > 0; i--) {
    probabilities.unshift(remaining * 0.6);
    remaining *= 0.4;
  }
  probabilities.unshift(remaining); // Root bekommt Rest

  debug('Layer probabilities:', probabilities);

  // Gewichtete Auswahl
  const roll = Math.random();
  let cumulative = 0;

  for (let i = 0; i < layers.length; i++) {
    cumulative += probabilities[i];
    if (roll < cumulative) {
      debug('Selected layer:', i, layers[i].source);
      return layers[i];
    }
  }

  return layers[layers.length - 1];
}

/**
 * Holt ein Feld aus den Culture-Layers mit Fallback.
 * Versucht erst die gewählte Layer (per 60%-Kaskade), dann Fallback auf alle Layers.
 */
export function getCultureField<K extends keyof CultureData>(
  layers: CultureLayer[],
  field: K
): CultureData[K] | undefined {
  // Erst per Kaskade auswählen
  const selected = selectCultureLayer(layers);
  if (selected?.culture[field]) {
    return selected.culture[field];
  }

  // Fallback: Erste Layer mit Daten (von Leaf nach Root)
  for (let i = layers.length - 1; i >= 0; i--) {
    const value = layers[i].culture[field];
    if (value) {
      debug(`Field ${field}: fallback to layer`, i);
      return value;
    }
  }

  return undefined;
}
