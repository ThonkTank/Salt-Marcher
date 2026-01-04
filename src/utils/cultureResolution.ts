// Ziel: Culture-Selection und Attribut-Resolution für NPC-Generierung
// Siehe: docs/services/npcs/Culture-Resolution.md
//
// Zwei Phasen:
// 1. selectCulture() - Kultur-Auswahl mit Weighted Pool (4-Step Algorithmus)
// 2. resolveAttributes() - Attribut-Resolution aus Culture + Faction.influence
//
// Utility-Funktionen:
// - mergeLayerConfigs() - Config-Merging für LayerTraitConfig
// - buildFactionChain() - Faction-Hierarchie für influence-Akkumulation

import type { CreatureDefinition } from '#types/entities/creature';
import type { Culture } from '#types/entities/culture';
import type { Species } from '#types/entities/species';
import type { Faction } from '#types/entities/faction';
import type { LayerTraitConfig } from '../types/common/layerTraitConfig';
import type { WeightedItem } from '#types/common/counting';
import { weightedRandomSelect } from './probability';
import { vault } from '../infrastructure/vault/vaultInstance';
import {
  FACTION_CULTURE_BOOST,
  SPECIES_COMPATIBILITY_BOOST,
  PARENT_CULTURE_BOOST,
  DEFAULT_TOLERANCE,
} from '@/constants';

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

/** Aufgelöste NPC-Attribute nach Phase 2 */
export interface ResolvedAttributes {
  appearance: string | undefined;
  styling: string | undefined;
  personality: string | undefined;
  value: string | undefined;
  quirk: string | undefined;
  goal: string | undefined;
  name: string;
}


// ============================================================================
// PHASE 1: CULTURE SELECTION
// ============================================================================

/**
 * Wählt eine Kultur für den NPC basierend auf Creature, Species und Faction.
 *
 * Gewichtungs-Algorithmus (4 Steps):
 * 1. Faction-Boost: usualCultures bekommen hohe Gewichtung
 * 2. Species-Boost: Kulturen mit passender usualSpecies werden bevorzugt
 * 3. Kultur-Fraktions-Kompatibilität: Intolerante Kulturen meiden diverse Fraktionen
 * 4. Ancestor-Boost: Parent-Kulturen von usualCultures erhalten Bonus
 *
 * @param creature - Die Kreatur-Definition
 * @param species - Die Species (für appearance und usualSpecies-Check)
 * @param faction - Die Fraktion (für usualCultures und influence)
 * @param allCultures - Alle verfügbaren Kulturen
 * @returns Die ausgewählte Kultur
 */
export function selectCulture(
  creature: CreatureDefinition | null,
  species: Species | null,
  faction: Faction | null,
  allCultures: Culture[]
): Culture {
  if (allCultures.length === 0) {
    throw new Error('selectCulture: allCultures is empty');
  }

  const pool: WeightedItem<Culture>[] = [];

  for (const culture of allCultures) {
    const weight = calculateCultureWeight(culture, creature, species, faction, allCultures);
    pool.push({ item: culture, randWeighting: weight });
    debug(`Culture '${culture.id}': weight=${weight.toFixed(2)}`);
  }

  const selected = weightedRandomSelect(pool);
  if (!selected) {
    // Fallback auf erste Kultur (sollte nicht passieren da weight >= 1)
    debug('No culture selected, using fallback');
    return allCultures[0];
  }

  debug(`Selected culture: ${selected.id}`);
  return selected;
}

/**
 * Berechnet das Gewicht einer Kultur für die Auswahl.
 *
 * 4-Step Algorithmus:
 * 1. Faction-Boost: usualCulture = 100 + 900 * (1 - factionTolerance), andere = 1
 * 2. Species-Boost: kompatibel = weight * (1 + 9 * (1 - cultureTolerance))
 * 3. Kultur-Fraktions-Kompatibilität: weight *= cultureTolerance wenn Fraktion "fremde" Species hat
 * 4. Ancestor-Boost: weight *= (1 + 2 / 2^(depth-1)) für Parent-Kulturen
 */
function calculateCultureWeight(
  culture: Culture,
  creature: CreatureDefinition | null,
  species: Species | null,
  faction: Faction | null,
  allCultures: Culture[]
): number {
  const factionTolerance = faction?.cultureTolerance ?? DEFAULT_TOLERANCE;
  const cultureTolerance = culture.tolerance ?? DEFAULT_TOLERANCE;

  // Step 1: Faction-Boost
  const isUsualCulture = faction?.usualCultures?.includes(culture.id) ?? false;
  let weight = isUsualCulture
    ? 100 + FACTION_CULTURE_BOOST * (1 - factionTolerance)
    : 1;

  debug(`Step 1 (${culture.id}): isUsualCulture=${isUsualCulture}, weight=${weight.toFixed(2)}`);

  // Step 2: Species-Boost
  const creatureSpecies = species?.id ?? creature?.species ?? '';
  const isCompatibleSpecies = culture.usualSpecies?.includes(creatureSpecies) ?? true;

  if (isCompatibleSpecies && culture.usualSpecies && culture.usualSpecies.length > 0) {
    weight *= 1 + SPECIES_COMPATIBILITY_BOOST * (1 - cultureTolerance);
    debug(`Step 2 (${culture.id}): species '${creatureSpecies}' compatible, weight=${weight.toFixed(2)}`);
  }

  // Step 3: Kultur-Fraktions-Kompatibilität
  const acceptedSpecies = faction?.acceptedSpecies ?? [];
  const usualSpecies = culture.usualSpecies ?? [];

  if (acceptedSpecies.length > 0 && usualSpecies.length > 0) {
    const hasUnwantedSpecies = acceptedSpecies.some(
      s => !usualSpecies.includes(s)
    );

    if (hasUnwantedSpecies) {
      weight *= cultureTolerance;
      debug(`Step 3 (${culture.id}): faction has unwanted species, weight *= ${cultureTolerance} = ${weight.toFixed(2)}`);
    }
  }

  // Step 4: Ancestor-Boost
  const ancestorBoost = calculateAncestorBoost(
    culture,
    faction?.usualCultures ?? [],
    allCultures
  );
  weight *= ancestorBoost;

  if (ancestorBoost > 1) {
    debug(`Step 4 (${culture.id}): ancestor boost = ${ancestorBoost.toFixed(2)}, weight=${weight.toFixed(2)}`);
  }

  return weight;
}

/**
 * Berechnet den Ancestor-Boost für eine Kultur.
 *
 * Wenn die Kultur ein Ancestor (Parent, Grandparent, ...) einer usualCulture ist,
 * bekommt sie einen abnehmenden Boost:
 * - depth=1 (direct parent): 3.0
 * - depth=2 (grandparent): 2.0
 * - depth=3: 1.5
 * - usw.
 *
 * Formel: 1 + (PARENT_CULTURE_BOOST - 1) / 2^(depth - 1)
 */
function calculateAncestorBoost(
  culture: Culture,
  usualCultures: string[],
  allCultures: Culture[]
): number {
  if (usualCultures.length === 0) return 1;

  // Für jede usualCulture prüfen ob culture ein Ancestor ist
  for (const usualCultureId of usualCultures) {
    const usualCulture = allCultures.find(c => c.id === usualCultureId);
    if (!usualCulture) continue;

    let current: Culture | undefined = usualCulture;
    let depth = 0;

    // Parent-Kette nach oben traversieren
    while (current?.parentId) {
      depth++;
      if (current.parentId === culture.id) {
        // culture ist Ancestor von usualCulture in Tiefe depth
        const boost = 1 + (PARENT_CULTURE_BOOST - 1) / Math.pow(2, depth - 1);
        debug(`Ancestor boost: ${culture.id} is depth-${depth} parent of ${usualCultureId}, boost=${boost.toFixed(2)}`);
        return boost;
      }
      current = allCultures.find(c => c.id === current!.parentId);
    }
  }

  return 1; // Kein Ancestor einer usualCulture
}

// ============================================================================
// PHASE 2: ATTRIBUTE RESOLUTION
// ============================================================================

/**
 * Löst NPC-Attribute aus Culture, Species und Faction.influence auf.
 *
 * Quellen:
 * - appearance: Species.appearance (+ Creature.appearanceOverride)
 * - styling: Culture.styling
 * - personality: Culture.personality
 * - values: Culture.values + Faction.influence.values (über Faction-Kette)
 * - quirks: Culture.quirks
 * - goals: Culture.goals + Faction.influence.goals (über Faction-Kette)
 * - naming: Culture.naming
 *
 * @param creature - Die Kreatur-Definition
 * @param species - Die Species
 * @param culture - Die ausgewählte Kultur
 * @param faction - Die Fraktion (für influence)
 * @returns Aufgelöste Attribute
 */
export function resolveAttributes(
  creature: CreatureDefinition | null,
  species: Species | null,
  culture: Culture,
  faction: Faction | null
): ResolvedAttributes {
  debug('Resolving attributes for culture:', culture.id);

  // Faction-Kette für influence-Akkumulation
  const factionChain = faction ? buildFactionChain(faction) : [];
  const allInfluence = factionChain
    .filter(f => f.influence)
    .map(f => f.influence!);

  // Appearance aus Species (+ Creature-Override)
  const appearancePool = mergeLayerConfigs(
    species?.appearance,
    creature?.appearanceOverride
  );
  const appearance = rollFromPool(appearancePool);

  // Styling aus Culture
  const styling = rollFromPool(culture.styling);

  // Personality aus Culture
  const personality = rollFromPool(culture.personality);

  // Values aus Culture + Faction.influence
  const valuesPool = mergeLayerConfigs(
    culture.values,
    ...allInfluence.map(i => i.values)
  );
  const value = rollFromPool(valuesPool);

  // Quirks aus Culture
  const quirk = rollFromPool(culture.quirks);

  // Goals aus Culture + Faction.influence
  const goalsPool = mergeLayerConfigs(
    culture.goals,
    ...allInfluence.map(i => i.goals)
  );
  const goal = rollFromPool(goalsPool);

  // Name aus Culture.naming
  const name = generateNameFromNaming(culture.naming);

  debug('Resolved attributes:', { appearance, styling, personality, value, quirk, goal, name });

  return {
    appearance,
    styling,
    personality,
    value,
    quirk,
    goal,
    name,
  };
}

/**
 * Merged mehrere LayerTraitConfigs zu einem.
 * add[] werden konkateniert, unwanted[] werden konkateniert.
 */
export function mergeLayerConfigs(
  ...configs: (LayerTraitConfig | undefined)[]
): LayerTraitConfig {
  const add: string[] = [];
  const unwanted: string[] = [];

  for (const config of configs) {
    if (!config) continue;
    if (config.add) add.push(...config.add);
    if (config.unwanted) unwanted.push(...config.unwanted);
  }

  return { add, unwanted };
}

/**
 * Wählt zufällig einen Trait aus einem LayerTraitConfig.
 * Berücksichtigt unwanted (werden aus Pool entfernt).
 */
function rollFromPool(config: LayerTraitConfig | undefined): string | undefined {
  if (!config?.add || config.add.length === 0) return undefined;

  // unwanted aus Pool filtern
  const unwantedSet = new Set(config.unwanted ?? []);
  const pool = config.add.filter(item => !unwantedSet.has(item));

  if (pool.length === 0) return undefined;

  // Uniform random selection
  const index = Math.floor(Math.random() * pool.length);
  return pool[index];
}

/**
 * Generiert einen Namen aus NamingConfig.
 * Verwendet Pattern mit Platzhaltern: {prefix}, {root}, {suffix}, {title}
 */
function generateNameFromNaming(naming: Culture['naming']): string {
  if (!naming?.patterns || naming.patterns.length === 0) {
    return generateFallbackName();
  }

  // Zufälliges Pattern wählen
  const pattern = naming.patterns[Math.floor(Math.random() * naming.patterns.length)];

  // Platzhalter füllen
  const selectRandom = (arr?: string[]) =>
    arr && arr.length > 0 ? arr[Math.floor(Math.random() * arr.length)] : '';

  const name = pattern
    .replace('{prefix}', selectRandom(naming.prefixes))
    .replace('{root}', selectRandom(naming.roots) || 'Unknown')
    .replace('{suffix}', selectRandom(naming.suffixes))
    .replace('{title}', selectRandom(naming.titles))
    .trim()
    .replace(/\s+/g, ' ');

  return name || 'Unknown';
}

/**
 * Fallback-Name wenn keine Naming-Config vorhanden.
 */
function generateFallbackName(): string {
  const fallbackNames = ['Stranger', 'Unknown', 'Wanderer', 'Traveler'];
  return fallbackNames[Math.floor(Math.random() * fallbackNames.length)];
}

// ============================================================================
// FACTION CHAIN (für influence-Akkumulation)
// ============================================================================

/**
 * Traversiert die Faction-Hierarchie von Leaf nach Root.
 * Bricht bei fehlender Parent-Faction ab (graceful degradation).
 *
 * @returns [root, ..., parent, leaf] - geordnet für Kaskade
 */
export function buildFactionChain(faction: Faction): Faction[] {
  const chain: Faction[] = [];
  let current: Faction | null = faction;

  while (current) {
    chain.unshift(current);
    if (current.parentId) {
      try {
        current = vault.getEntity<Faction>('faction', current.parentId);
      } catch {
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


