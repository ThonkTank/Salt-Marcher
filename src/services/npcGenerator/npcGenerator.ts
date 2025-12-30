// Ziel: NPC-Generierung für Encounter, Quest, Shop, POI
// Siehe: docs/services/NPCs/NPC-Generation.md
//
// Pipeline:
// 1. resolveCultureChain() - Culture-Resolution
// 2. selectFromCultureLayers() - 60%-Kaskade Selektion
// 3. generateNameFromCulture() - Name aus Patterns
// 4. rollPersonalityFromCulture() - Primary + Secondary Traits
// 5. rollQuirkFromCulture() - Optionaler Quirk
// 6. selectPersonalGoal() - Ziel mit Culture-Pool
// 7. generateNPC() - Orchestriert Pipeline, gibt NPC zurück (OHNE Persistierung)
//
// DISKREPANZEN (als [HACK] oder [TODO] markiert):
// ================================================
//
// [HACK: Culture-Resolution.md#forbidden] Forbidden-Listen ignoriert
//   → Nur positive Pools, keine Ausschluss-Logik
//
// [HACK: Culture-Resolution.md#faction-chain] Keine Faction-Ketten-Traversierung
//   → Nur direkte Faction.culture, parentId ignoriert
//
// [HACK: NPC-Generation.md#quirk-filter] Quirk-Filterung fehlt
//   → compatibleTags nicht geprüft
//
// [TODO: NPC-Generation.md#personality-bonus] PersonalityBonus fehlt
//   → Multiplikatoren auf Goals nicht angewendet
//
// RESOLVED:
// - [2025-12-30] Species-Cultures implementiert (Culture-Resolution.md#species)

import type { CreatureDefinition } from '#types/entities/creature';
import type {
  Faction,
  CultureData,
  WeightedTrait,
  WeightedQuirk,
  WeightedGoal,
  NamingConfig,
  PersonalityConfig,
} from '#types/entities/faction';
import type { NPC, PersonalityTraits } from '#types/entities/npc';
import type { GameDateTime } from '#types/time';
import type { HexCoordinate } from '#types/hexCoordinate';
import { randomSelect, weightedRandomSelect } from '@/utils/random';
import { typePresets, speciesPresets } from '../../../presets/cultures';

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

/** Quelle einer Culture-Ebene */
type CultureSource = 'type' | 'species' | 'faction';

/** Eine Ebene in der Culture-Hierarchie */
interface CultureLayer {
  source: CultureSource;
  culture: CultureData;
  factionId?: string;
}

/** Optionen für NPC-Generierung */
export interface GenerateNPCOptions {
  position?: HexCoordinate;
  time?: GameDateTime;
}

// ============================================================================
// GENERIC FALLBACK GOALS
// ============================================================================

const GENERIC_GOALS: WeightedGoal[] = [
  { goal: 'survive', weight: 1.0, description: 'Am Leben bleiben' },
  { goal: 'profit', weight: 0.8, description: 'Profit machen' },
  { goal: 'power', weight: 0.6, description: 'Macht erlangen' },
  { goal: 'freedom', weight: 0.5, description: 'Freiheit bewahren' },
  { goal: 'revenge', weight: 0.3, description: 'Rache nehmen' },
];

// ============================================================================
// CULTURE RESOLUTION
// ============================================================================

/**
 * Bestimmt die Culture-Ebenen für einen NPC.
 *
 * [HACK: Culture-Resolution.md#faction-chain] Keine Faction-Ketten-Traversierung
 *
 * Hierarchie (von Root nach Leaf):
 * 1. Species-Culture (falls creature.species gesetzt) ODER Type-Preset
 * 2. Faction.culture (falls vorhanden)
 */
function resolveCultureChain(
  creature: CreatureDefinition,
  faction: Faction | null
): CultureLayer[] {
  const layers: CultureLayer[] = [];

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
 * Wählt ein Feld aus den Culture-Layers mit 60%-Kaskade.
 *
 * Leaf bekommt 60%, Rest kaskadiert:
 * - 1 Layer: 100%
 * - 2 Layer: Root 40%, Leaf 60%
 * - 3 Layer: Root 16%, Mid 24%, Leaf 60%
 */
function selectCultureLayer(layers: CultureLayer[]): CultureLayer | null {
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
 * Versucht erst die gewählte Layer, dann Fallback auf alle Layers.
 */
function getCultureField<K extends keyof CultureData>(
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

// ============================================================================
// NAME GENERATION
// ============================================================================

/**
 * Generiert einen Namen aus dem Naming-Config.
 * Pattern-Platzhalter: {prefix}, {root}, {suffix}, {title}
 */
function generateNameFromCulture(layers: CultureLayer[]): string {
  const naming = getCultureField(layers, 'naming') as NamingConfig | undefined;

  if (!naming?.patterns || naming.patterns.length === 0) {
    debug('No naming patterns, using fallback');
    return generateFallbackName();
  }

  // Zufälliges Pattern wählen
  const pattern = randomSelect(naming.patterns) ?? '{root}';

  // Platzhalter ersetzen
  const name = pattern
    .replace('{prefix}', randomSelect(naming.prefixes ?? []) ?? '')
    .replace('{root}', randomSelect(naming.roots ?? []) ?? 'Unknown')
    .replace('{suffix}', randomSelect(naming.suffixes ?? []) ?? '')
    .replace('{title}', randomSelect(naming.titles ?? []) ?? '')
    .trim()
    .replace(/\s+/g, ' '); // Mehrfache Leerzeichen entfernen

  debug('Generated name:', name, 'from pattern:', pattern);
  return name || 'Unknown';
}

/**
 * Fallback-Name wenn keine Naming-Config vorhanden.
 */
function generateFallbackName(): string {
  const fallbackNames = ['Stranger', 'Unknown', 'Nameless', 'Shadow', 'Wanderer'];
  return randomSelect(fallbackNames) ?? 'Unknown';
}

// ============================================================================
// PERSONALITY GENERATION
// ============================================================================

/**
 * Würfelt Persönlichkeits-Traits aus dem Culture-Pool.
 * Primary und Secondary sind unterschiedlich (keine Duplikate).
 *
 * [HACK: Culture-Resolution.md#forbidden] Forbidden-Listen ignoriert
 */
function rollPersonalityFromCulture(layers: CultureLayer[]): PersonalityTraits {
  const personality = getCultureField(layers, 'personality') as PersonalityConfig | undefined;

  if (!personality) {
    debug('No personality config, using defaults');
    return { primary: 'neutral', secondary: 'reserved' };
  }

  // Alle Traits sammeln (common + rare)
  const allTraits: WeightedTrait[] = [
    ...(personality.common ?? []),
    ...(personality.rare ?? []),
  ];

  if (allTraits.length === 0) {
    return { primary: 'neutral', secondary: 'reserved' };
  }

  // Primary wählen
  const primaryTrait = weightedRandomSelect(
    allTraits.map(t => ({ item: t.trait, weight: t.weight }))
  );
  const primary = primaryTrait ?? 'neutral';

  // Secondary wählen (ohne Primary)
  const remaining = allTraits.filter(t => t.trait !== primary);
  const secondaryTrait = remaining.length > 0
    ? weightedRandomSelect(remaining.map(t => ({ item: t.trait, weight: t.weight })))
    : null;
  const secondary = secondaryTrait ?? 'reserved';

  debug('Personality:', { primary, secondary });
  return { primary, secondary };
}

// ============================================================================
// QUIRK GENERATION
// ============================================================================

/**
 * Würfelt einen Quirk aus dem Culture-Pool.
 *
 * [HACK: NPC-Generation.md#quirk-filter] Quirk-Filterung fehlt
 * → compatibleTags nicht geprüft, alle Quirks werden berücksichtigt
 *
 * @returns Quirk-Description oder undefined (50% Chance auf keinen Quirk)
 */
function rollQuirkFromCulture(
  layers: CultureLayer[],
  _creature: CreatureDefinition // Unused wegen HACK
): string | undefined {
  // 50% Chance auf keinen Quirk
  if (Math.random() < 0.5) {
    debug('No quirk (random skip)');
    return undefined;
  }

  const quirks = getCultureField(layers, 'quirks') as WeightedQuirk[] | undefined;

  if (!quirks || quirks.length === 0) {
    debug('No quirks in culture');
    return undefined;
  }

  // Gewichtete Auswahl (ohne compatibleTags-Filter)
  const selected = weightedRandomSelect(
    quirks.map(q => ({ item: q, weight: q.weight }))
  );

  if (!selected) return undefined;

  debug('Selected quirk:', selected.quirk, '-', selected.description);
  return selected.description ?? selected.quirk;
}

// ============================================================================
// GOAL SELECTION
// ============================================================================

/**
 * Wählt ein persönliches Ziel aus dem kombinierten Pool.
 *
 * [TODO: NPC-Generation.md#personality-bonus] PersonalityBonus fehlt
 * → Multiplikatoren auf Goals nicht angewendet
 *
 * Pool-Hierarchie: Generic → Culture-Goals
 */
function selectPersonalGoal(
  layers: CultureLayer[],
  _personality: PersonalityTraits // Unused wegen TODO
): string {
  // Culture-Goals holen
  const cultureGoals = getCultureField(layers, 'goals') as WeightedGoal[] | undefined;

  // Pools kombinieren
  const combinedPool = [
    ...GENERIC_GOALS,
    ...(cultureGoals ?? []),
  ];

  // Gewichtete Auswahl
  const selected = weightedRandomSelect(
    combinedPool.map(g => ({ item: g, weight: g.weight }))
  );

  const goal = selected?.description ?? selected?.goal ?? 'survive';
  debug('Selected goal:', goal);
  return goal;
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
// DEFAULT TIME
// ============================================================================

/**
 * Liefert eine Default-Zeit für firstEncounter/lastEncounter.
 * [HACK] Sollte eigentlich aus sessionState kommen.
 */
function getDefaultTime(): GameDateTime {
  return {
    day: 1,
    month: 1,
    year: 1,
    hour: 12,
    minute: 0,
    segment: 'midday',
  };
}

// ============================================================================
// MAIN FUNCTION
// ============================================================================

/**
 * Generiert einen neuen NPC für die Kreatur.
 *
 * @param creature - Die Kreatur-Definition (aus Preset oder Vault)
 * @param faction - Die Fraktion (falls vorhanden)
 * @param options - Optionale Position und Zeit
 * @returns Vollständiges NPC-Objekt (NICHT persistiert)
 */
export function generateNPC(
  creature: CreatureDefinition,
  faction: Faction | null,
  options?: GenerateNPCOptions
): NPC {
  debug('Generating NPC for creature:', creature.id, 'faction:', faction?.id ?? 'none');

  // 1. Culture-Chain aufbauen
  const layers = resolveCultureChain(creature, faction);

  // 2. Name generieren
  const name = generateNameFromCulture(layers);

  // 3. Personality würfeln
  const personality = rollPersonalityFromCulture(layers);

  // 4. Quirk würfeln
  const quirk = rollQuirkFromCulture(layers, creature);

  // 5. Personal Goal wählen
  const personalGoal = selectPersonalGoal(layers, personality);

  // 6. NPC zusammenbauen
  const now = options?.time ?? getDefaultTime();

  const npc: NPC = {
    id: generateNPCId(),
    name,
    creature: {
      type: creature.tags[0] ?? 'unknown',
      id: creature.id,
    },
    factionId: faction?.id,
    personality,
    quirk,
    personalGoal,
    status: 'alive',
    firstEncounter: now,
    lastEncounter: now,
    encounterCount: 1,
    lastKnownPosition: options?.position,
  };

  debug('Generated NPC:', {
    id: npc.id,
    name: npc.name,
    personality: npc.personality,
    goal: npc.personalGoal,
  });

  return npc;
}

export default generateNPC;
