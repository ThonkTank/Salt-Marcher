// Ziel: NPC-Generierung für Encounter, Quest, Shop, POI
// Siehe: docs/services/NPCs/NPC-Generation.md
//
// Pipeline:
// 1. resolveCultureChain() - Culture-Resolution (aus @/utils)
// 2. getCultureField() - 60%-Kaskade Selektion (aus @/utils)
// 3. generateNameFromCulture() - Name aus Patterns
// 4. rollPersonalityFromCulture() - Primary + Secondary Traits
// 5. rollQuirkFromCulture() - Optionaler Quirk
// 6. selectPersonalGoal() - Ziel mit Culture-Pool
// 7. generateNPC() - Orchestriert Pipeline, gibt NPC zurück (OHNE Persistierung)
//
//
// TASKS:
// |  # | Status | Domain | Layer    | Beschreibung                                                  |  Prio  | MVP? | Deps | Spec                                           | Imp.                                                  |
// |--:|:----:|:-----|:-------|:------------------------------------------------------------|:----:|:--:|:---|:---------------------------------------------|:----------------------------------------------------|
// | 53 |   🔶   | NPCs   | services | Culture-Resolution: Forbidden-Listen implementieren           | mittel | Nein | -    | Culture-Resolution.md#Forbidden-Listen         | npcGenerator.ts.rollPersonalityFromCulture() [ändern] |
// | 54 |   🔶   | NPCs   | services | Culture-Resolution: Faction-Ketten-Traversierung via parentId | mittel | Nein | -    | Culture-Resolution.md#buildFactionChain()      | npcGenerator.ts.resolveCultureChain() [ändern]        |
// | 55 |   🔶   | NPCs   | services | Quirk-Filterung: compatibleTags aus Creature pruefen          | mittel | Nein | -    | NPC-Generation.md#Quirk-Generierung            | npcGenerator.ts.rollQuirkFromCulture() [ändern]       |
// | 56 |   ⬜    | NPCs   | services | PersonalityBonus: Multiplikatoren auf Goals anwenden          | mittel | Nein | -    | NPC-Generation.md#PersonalGoal-Pool-Hierarchie | npcGenerator.ts.selectPersonalGoal() [ändern]         |
// | 57 |   🔶   | NPCs   | services | getDefaultTime: Zeit aus sessionState statt Hardcoded-Wert    | mittel | Nein | -    | NPC-Generation.md#API                          | npcGenerator.ts.getDefaultTime() [ändern]             |
// | 58 |   ✅    | NPCs   | services | Species-Cultures in Culture-Resolution implementiert          | mittel | Nein | -    | Culture-Resolution.md#Kultur-Hierarchie        | npcGenerator.ts.resolveCultureChain() [fertig]        |
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
import { randomSelect, weightedRandomSelect, resolveCultureChain, getCultureField, type CultureLayer } from '@/utils';

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
 * [#53] Forbidden-Listen ignoriert
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
 * [#55] Quirk-Filterung fehlt → compatibleTags nicht geprüft
 *
 * @returns Quirk-Description oder undefined (50% Chance auf keinen Quirk)
 */
function rollQuirkFromCulture(
  layers: CultureLayer[],
  _creature: CreatureDefinition // Unused, siehe #55
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
 * [#56] PersonalityBonus fehlt → Multiplikatoren nicht angewendet
 *
 * Pool-Hierarchie: Generic → Culture-Goals
 */
function selectPersonalGoal(
  layers: CultureLayer[],
  _personality: PersonalityTraits // Unused, siehe #56
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
 * [#57] Zeit sollte aus sessionState kommen.
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
