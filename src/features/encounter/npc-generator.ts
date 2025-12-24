/**
 * NPC generation utilities.
 *
 * Handles:
 * - Resolving faction culture with inheritance
 * - Generating names from culture patterns
 * - Generating personality traits from weighted pools
 * - Finding existing NPCs or creating new ones
 *
 * @see docs/domain/NPC-System.md
 * @see docs/domain/Faction.md
 */

import type {
  Faction,
  CultureData,
  ResolvedCulture,
  WeightedTrait,
  WeightedQuirk,
  NPC,
  PersonalityTraits,
  CreatureDefinition,
  GameDateTime,
  EncounterLeadNpc,
} from '@core/schemas';
import { EMPTY_RESOLVED_CULTURE, NPC_RECENCY_PENALTIES } from '@core/schemas';
import type { NpcSelectionResult } from './types';

// ============================================================================
// Culture Resolution (Inheritance)
// ============================================================================

/**
 * Resolve faction culture by merging with parent cultures.
 * Child values override/extend parent values.
 */
export function resolveFactionCulture(
  faction: Faction,
  factionRegistry: ReadonlyMap<string, Faction>
): ResolvedCulture {
  // Build inheritance chain (child → parent → grandparent → ...)
  const chain: CultureData[] = [];
  let current: Faction | undefined = faction;

  while (current) {
    if (current.culture) {
      chain.push(current.culture);
    }

    if (current.parentId) {
      current = factionRegistry.get(current.parentId);
    } else {
      current = undefined;
    }
  }

  // Merge from root to leaf (parents first, child overrides)
  chain.reverse();

  return chain.reduce<ResolvedCulture>((acc, culture) => {
    return mergeCulture(acc, culture);
  }, EMPTY_RESOLVED_CULTURE);
}

/**
 * Merge a CultureData into a ResolvedCulture.
 * Arrays are extended, not replaced.
 */
function mergeCulture(
  base: ResolvedCulture,
  overlay: CultureData
): ResolvedCulture {
  return {
    naming: {
      patterns: mergeArrays(base.naming.patterns, overlay.naming?.patterns),
      prefixes: mergeArrays(base.naming.prefixes, overlay.naming?.prefixes),
      roots: mergeArrays(base.naming.roots, overlay.naming?.roots),
      suffixes: mergeArrays(base.naming.suffixes, overlay.naming?.suffixes),
      titles: mergeArrays(base.naming.titles, overlay.naming?.titles),
    },
    personality: {
      common: mergeArrays(base.personality.common, overlay.personality?.common),
      rare: mergeArrays(base.personality.rare, overlay.personality?.rare),
      forbidden: mergeArrays(
        base.personality.forbidden,
        overlay.personality?.forbidden
      ),
    },
    quirks: mergeArrays(base.quirks, overlay.quirks),
    values: {
      priorities: mergeArrays(
        base.values.priorities,
        overlay.values?.priorities
      ),
      taboos: mergeArrays(base.values.taboos, overlay.values?.taboos),
      greetings: mergeArrays(base.values.greetings, overlay.values?.greetings),
    },
    speech: overlay.speech ?? base.speech,
    activities: mergeArrays(base.activities, overlay.activities),
  };
}

/**
 * Merge two arrays, with overlay values taking priority.
 * Overlay values are added to the front for higher selection weight.
 */
function mergeArrays<T>(base: readonly T[], overlay?: readonly T[]): T[] {
  if (!overlay || overlay.length === 0) {
    return [...base];
  }
  // Overlay first (higher priority), then base (without duplicates)
  const result = [...overlay];
  for (const item of base) {
    if (!result.includes(item)) {
      result.push(item);
    }
  }
  return result;
}

// ============================================================================
// Name Generation
// ============================================================================

/**
 * Generate an NPC name from resolved culture.
 */
export function generateNpcName(culture: ResolvedCulture): string {
  const { naming } = culture;

  // Select a random pattern
  const patterns = naming.patterns.length > 0 ? naming.patterns : ['{root}'];
  const pattern = patterns[Math.floor(Math.random() * patterns.length)];

  // Fill in pattern variables
  let name = pattern;

  if (pattern.includes('{prefix}') && naming.prefixes.length > 0) {
    const prefix = naming.prefixes[Math.floor(Math.random() * naming.prefixes.length)];
    name = name.replace('{prefix}', prefix);
  } else {
    name = name.replace('{prefix}', '');
  }

  if (pattern.includes('{root}') && naming.roots.length > 0) {
    const root = naming.roots[Math.floor(Math.random() * naming.roots.length)];
    name = name.replace('{root}', root);
  } else {
    name = name.replace('{root}', 'Unknown');
  }

  if (pattern.includes('{suffix}') && naming.suffixes.length > 0) {
    const suffix = naming.suffixes[Math.floor(Math.random() * naming.suffixes.length)];
    name = name.replace('{suffix}', suffix);
  } else {
    name = name.replace('{suffix}', '');
  }

  if (pattern.includes('{title}') && naming.titles.length > 0) {
    const title = naming.titles[Math.floor(Math.random() * naming.titles.length)];
    name = name.replace('{title}', title);
  } else {
    name = name.replace('{title}', '');
  }

  // Clean up extra spaces
  return name.trim().replace(/\s+/g, ' ');
}

// ============================================================================
// Personality Generation
// ============================================================================

/**
 * Select a trait from a weighted pool.
 */
function selectWeightedTrait(traits: readonly WeightedTrait[]): string | null {
  if (traits.length === 0) return null;

  // Calculate total weight
  const totalWeight = traits.reduce((sum, t) => sum + t.weight, 0);
  if (totalWeight <= 0) return traits[0]?.trait ?? null;

  // Weighted random selection
  let random = Math.random() * totalWeight;
  for (const t of traits) {
    random -= t.weight;
    if (random <= 0) {
      return t.trait;
    }
  }

  return traits[traits.length - 1].trait;
}

/**
 * Generate personality traits from resolved culture.
 * Primary: from common pool
 * Secondary: from common pool (different) or rare pool (10% chance)
 */
export function generatePersonality(
  culture: ResolvedCulture
): PersonalityTraits {
  const { personality } = culture;
  const forbidden = new Set(personality.forbidden);

  // Filter out forbidden traits
  const commonPool = personality.common.filter((t) => !forbidden.has(t.trait));
  const rarePool = personality.rare.filter((t) => !forbidden.has(t.trait));

  // Primary trait from common pool
  const primary = selectWeightedTrait(commonPool) ?? 'neutral';

  // Secondary: 10% chance from rare pool, else from common (different from primary)
  let secondary: string;
  if (rarePool.length > 0 && Math.random() < 0.1) {
    secondary = selectWeightedTrait(rarePool) ?? primary;
  } else {
    // Select from common, excluding primary
    const remainingCommon = commonPool.filter((t) => t.trait !== primary);
    secondary = selectWeightedTrait(remainingCommon) ?? primary;
  }

  return { primary, secondary };
}

/**
 * Roll a quirk from resolved culture.
 * 30% chance to have a quirk.
 */
export function rollQuirkFromCulture(
  culture: ResolvedCulture
): string | undefined {
  if (culture.quirks.length === 0) return undefined;
  if (Math.random() > 0.3) return undefined;

  // Weighted selection
  const totalWeight = culture.quirks.reduce((sum, q) => sum + q.weight, 0);
  if (totalWeight <= 0) return undefined;

  let random = Math.random() * totalWeight;
  for (const quirk of culture.quirks) {
    random -= quirk.weight;
    if (random <= 0) {
      return quirk.quirk;
    }
  }

  return culture.quirks[culture.quirks.length - 1].quirk;
}

/**
 * Generate a personal goal for the NPC.
 */
export function generatePersonalGoal(
  culture: ResolvedCulture
): string {
  const { values } = culture;

  // Use priorities as goal seeds
  if (values.priorities.length > 0) {
    const priority =
      values.priorities[Math.floor(Math.random() * values.priorities.length)];
    return `Pursue ${priority}`;
  }

  return 'Survive and prosper';
}

// ============================================================================
// NPC Selection / Generation
// ============================================================================

/**
 * Calculate match score for an existing NPC.
 * Higher score = better match.
 */
export function calculateNpcMatchScore(
  npc: NPC,
  creature: CreatureDefinition,
  faction: Faction,
  daysSinceLastEncounter: number
): number {
  // Must match creature type and faction
  if (npc.creature.id !== creature.id) return -1;
  if (npc.factionId !== faction.id) return -1;
  if (npc.status === 'dead') return -1;

  let score = 100; // Base score for valid match

  // Recency penalty (avoid re-using NPCs encountered recently)
  if (daysSinceLastEncounter < NPC_RECENCY_PENALTIES.TOO_RECENT_DAYS) {
    score += NPC_RECENCY_PENALTIES.TOO_RECENT_PENALTY;
  } else if (daysSinceLastEncounter > NPC_RECENCY_PENALTIES.LONG_AGO_DAYS) {
    score += NPC_RECENCY_PENALTIES.LONG_AGO_BONUS;
  }

  // Bonus for recurring NPCs (more encounters = more interesting)
  score += Math.min(npc.encounterCount * 5, 25);

  return score;
}

/**
 * Calculate days between two game dates.
 * Simplified: assumes 30 days per month.
 */
export function calculateDaysBetween(
  date1: GameDateTime,
  date2: GameDateTime
): number {
  const days1 = date1.year * 360 + date1.month * 30 + date1.day;
  const days2 = date2.year * 360 + date2.month * 30 + date2.day;
  return Math.abs(days2 - days1);
}

/**
 * Find an existing NPC or generate a new one.
 * Always prefers existing NPCs to avoid unbounded growth.
 */
export function selectOrGenerateNpc(
  creature: CreatureDefinition,
  faction: Faction,
  culture: ResolvedCulture,
  existingNpcs: readonly NPC[],
  currentTime: GameDateTime
): NpcSelectionResult {
  // Calculate match scores for existing NPCs
  const matches = existingNpcs
    .map((npc) => {
      const daysSince = calculateDaysBetween(npc.lastEncounter, currentTime);
      const score = calculateNpcMatchScore(npc, creature, faction, daysSince);
      return { npc, score };
    })
    .filter((m) => m.score > 0)
    .sort((a, b) => b.score - a.score);

  // Always use existing NPC if valid match exists
  if (matches.length > 0) {
    const selected = matches[0];
    return {
      npc: selected.npc,
      isNew: false,
      previousEncounterCount: selected.npc.encounterCount,
    };
  }

  // Only generate new NPC when no existing match
  const newNpc = generateNewNpc(creature, faction, culture, currentTime);
  return {
    npc: newNpc,
    isNew: true,
  };
}

/**
 * Generate a brand new NPC.
 */
export function generateNewNpc(
  creature: CreatureDefinition,
  faction: Faction,
  culture: ResolvedCulture,
  currentTime: GameDateTime
): NPC {
  const name = generateNpcName(culture);
  const personality = generatePersonality(culture);
  const quirk = rollQuirkFromCulture(culture);
  const personalGoal = generatePersonalGoal(culture);

  return {
    id: `npc-${Date.now()}-${Math.random().toString(36).substring(2, 7)}` as never,
    name,
    creature: {
      type: creature.name,
      id: creature.id,
    },
    factionId: faction.id,
    personality,
    quirk,
    personalGoal,
    status: 'alive',
    firstEncounter: currentTime,
    lastEncounter: currentTime,
    encounterCount: 1,
  };
}

/**
 * Create EncounterLeadNpc from NPC data.
 */
export function createEncounterLeadNpc(
  npc: NPC,
  isRecurring: boolean
): EncounterLeadNpc {
  return {
    npcId: npc.id,
    name: npc.name,
    personality: npc.personality,
    personalGoal: npc.personalGoal,
    quirk: npc.quirk,
    isRecurring,
  };
}
