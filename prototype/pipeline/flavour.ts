/**
 * Encounter Pipeline Step 4: Flavour
 *
 * Enriches EncounterDraft with RP details:
 * - Step 4.1: Activity selection (GENERIC + Faction.culture.activities)
 * - Step 4.2: Goal derivation (Activity + NarrativeRole)
 * - Step 4.3: Lead-NPC generation (Name + 2 Traits + Quirk)
 * - Step 4.4: Loot generation (stub for now)
 */

import type {
  Activity,
  CreatureGroup,
  CreatureInstance,
  EncounterContext,
  EncounterDraft,
  EncounterTemplate,
  EncounterType,
  Faction,
  FlavouredEncounter,
  FlavouredGroup,
  GeneratedLoot,
  GeneratedNpc,
  Goal,
  Item,
  NamingPattern,
  NarrativeRole,
  SelectedItem,
  WeightedActivityRef,
  WeightedQuirk,
  WeightedTrait,
} from '../types/encounter.js';
import type { PresetLookups } from '../loaders/index.js';

// =============================================================================
// Types
// =============================================================================

export type FlavourResult =
  | { success: true; encounter: FlavouredEncounter }
  | { success: false; error: string };

interface WeightedActivity {
  activity: Activity;
  weight: number;
}

// =============================================================================
// Constants
// =============================================================================

/**
 * Generic activities available to all creatures.
 * These form the base pool that faction activities extend.
 */
const GENERIC_ACTIVITIES: Activity[] = [
  { id: 'sleeping', name: 'Sleeping', awareness: 10, detectability: 20, contextTags: ['rest', 'night'] },
  { id: 'resting', name: 'Resting', awareness: 40, detectability: 40, contextTags: ['rest'] },
  { id: 'feeding', name: 'Feeding', awareness: 30, detectability: 50, contextTags: ['rest'] },
  { id: 'traveling', name: 'Traveling', awareness: 55, detectability: 55, contextTags: ['movement'] },
  { id: 'wandering', name: 'Wandering', awareness: 50, detectability: 50, contextTags: ['movement'] },
];

/**
 * Activity definitions for faction-referenced activities.
 * These are looked up by activityId from Faction.culture.activities.
 */
const ACTIVITY_DEFINITIONS: Record<string, Activity> = {
  raiding: { id: 'raiding', name: 'Raiding', awareness: 60, detectability: 90, contextTags: ['combat', 'aggressive'] },
  patrolling: { id: 'patrolling', name: 'Patrolling', awareness: 80, detectability: 60, contextTags: ['guard', 'movement'] },
  ambushing: { id: 'ambushing', name: 'Ambushing', awareness: 95, detectability: 10, contextTags: ['combat', 'stealth'] },
  arguing: { id: 'arguing', name: 'Arguing', awareness: 20, detectability: 70, contextTags: ['social', 'distracted'] },
  looting: { id: 'looting', name: 'Looting', awareness: 35, detectability: 65, contextTags: ['treasure', 'distracted'] },
  hunting: { id: 'hunting', name: 'Hunting', awareness: 90, detectability: 30, contextTags: ['predator', 'stealth'] },
  hiding: { id: 'hiding', name: 'Hiding', awareness: 90, detectability: 5, contextTags: ['stealth', 'defensive'] },
  war_chanting: { id: 'war_chanting', name: 'War Chanting', awareness: 45, detectability: 100, contextTags: ['ritual', 'aggressive'] },
};

/**
 * Default goals by narrative role.
 * Spec: Flavour.md lines 214-218
 */
const DEFAULT_GOALS_BY_ROLE: Record<NarrativeRole, string> = {
  threat: 'dominate',
  victim: 'survive',
  neutral: 'continue_task',
  ally: 'assist',
};

/**
 * Placeholder distance until Perception calculation (#3276) is implemented.
 */
const PLACEHOLDER_ENCOUNTER_DISTANCE = 60;

/**
 * Default loot budget (in gold) when not specified via CLI.
 */
const DEFAULT_BUDGET_BALANCE = 500;

/**
 * Hoard probability by encounter type.
 * Spec: Flavour.md lines 586-593
 */
const HOARD_PROBABILITY: Record<EncounterType, number> = {
  boss: 0.70,
  camp: 0.40,
  patrol: 0.10,
  passing: 0.00,
};

// =============================================================================
// Step 4.1: Activity Selection
// =============================================================================

/**
 * Builds the activity pool from GENERIC + Creature.activities + Faction.activities.
 * Spec: Flavour.md lines 117-123, 147-152
 */
function buildActivityPool(
  creatures: CreatureInstance[],
  faction: Faction | undefined,
  lookups: PresetLookups
): WeightedActivity[] {
  const pool: WeightedActivity[] = [];

  // 1. Add generic activities with default weight
  for (const activity of GENERIC_ACTIVITIES) {
    pool.push({ activity, weight: 0.5 });
  }

  // 2. Add creature-type activities (from Creature.activities)
  for (const instance of creatures) {
    const creatureDef = lookups.creatures.get(instance.definitionId);
    if (creatureDef?.activities) {
      for (const ref of creatureDef.activities) {
        const activityDef = ACTIVITY_DEFINITIONS[ref.activityId];
        if (activityDef) {
          pool.push({ activity: activityDef, weight: ref.weight });
        }
      }
    }
  }

  // 3. Add faction-specific activities
  if (faction?.culture?.activities) {
    for (const ref of faction.culture.activities) {
      const activityDef = ACTIVITY_DEFINITIONS[ref.activityId];
      if (activityDef) {
        pool.push({ activity: activityDef, weight: ref.weight });
      }
    }
  }

  return pool;
}

/**
 * Weighted random selection from activity pool.
 */
function weightedRandomSelect<T>(items: { item: T; weight: number }[]): T {
  const totalWeight = items.reduce((sum, i) => sum + i.weight, 0);
  let random = Math.random() * totalWeight;

  for (const { item, weight } of items) {
    random -= weight;
    if (random <= 0) {
      return item;
    }
  }

  return items[items.length - 1].item;
}

/**
 * Step 4.1: Select activity for a group.
 * Uses pool hierarchy: GENERIC + Creature.activities + Faction.activities
 */
function selectActivity(
  group: CreatureGroup,
  _context: EncounterContext,
  faction: Faction | undefined,
  lookups: PresetLookups
): Activity {
  const pool = buildActivityPool(group.creatures, faction, lookups);

  // Convert to weighted selection format
  const items = pool.map((wa) => ({
    item: wa.activity,
    weight: wa.weight,
  }));

  return weightedRandomSelect(items);
}

// =============================================================================
// Step 4.2: Goal Derivation
// =============================================================================

/**
 * Step 4.2: Derive goal from activity and narrative role.
 * Spec: Flavour.md lines 199-211
 *
 * Priority: 1. Faction.culture.activityGoals[activity.id]
 *           2. DEFAULT_GOALS_BY_ROLE[narrativeRole]
 */
function deriveGoal(
  activity: Activity,
  narrativeRole: NarrativeRole,
  faction?: Faction
): Goal {
  // 1. Check faction-specific goal mapping
  if (faction?.culture?.activityGoals?.[activity.id]) {
    return {
      id: `${activity.id}-faction`,
      name: faction.culture.activityGoals[activity.id],
      priority: narrativeRole === 'threat' ? 'high' : 'medium',
    };
  }

  // 2. Default goal by role
  const goalName = DEFAULT_GOALS_BY_ROLE[narrativeRole] ?? 'survive';

  return {
    id: `${activity.id}-${narrativeRole}`,
    name: goalName,
    priority: narrativeRole === 'threat' ? 'high' : 'medium',
  };
}

// =============================================================================
// Step 4.3: NPC Generation
// =============================================================================

/**
 * Generates a name from a naming pattern.
 */
function generateNameFromPattern(naming: NamingPattern): string {
  const pattern = naming.patterns[Math.floor(Math.random() * naming.patterns.length)];

  let name = pattern;

  if (naming.prefixes && pattern.includes('{prefix}')) {
    const prefix = naming.prefixes[Math.floor(Math.random() * naming.prefixes.length)];
    name = name.replace('{prefix}', prefix);
  }

  if (naming.roots && pattern.includes('{root}')) {
    const root = naming.roots[Math.floor(Math.random() * naming.roots.length)];
    name = name.replace('{root}', root);
  }

  if (naming.suffixes && pattern.includes('{suffix}')) {
    const suffix = naming.suffixes[Math.floor(Math.random() * naming.suffixes.length)];
    name = name.replace('{suffix}', suffix);
  }

  // Capitalize first letter
  return name.charAt(0).toUpperCase() + name.slice(1);
}

/**
 * Picks n weighted random items from a list.
 */
function pickWeightedRandom<T extends { weight: number }>(items: T[], count: number): T[] {
  if (items.length === 0) return [];

  const result: T[] = [];
  const available = [...items];

  for (let i = 0; i < count && available.length > 0; i++) {
    const totalWeight = available.reduce((sum, item) => sum + item.weight, 0);
    let random = Math.random() * totalWeight;

    for (let j = 0; j < available.length; j++) {
      random -= available[j].weight;
      if (random <= 0) {
        result.push(available[j]);
        available.splice(j, 1);
        break;
      }
    }
  }

  return result;
}

/**
 * Step 4.3: Generate lead NPC for a group.
 */
function generateLeadNpc(
  group: CreatureGroup,
  goal: Goal,
  faction?: Faction
): GeneratedNpc {
  const culture = faction?.culture;
  const leadCreature = group.creatures[0];

  // Generate name
  let name: string;
  if (culture?.naming) {
    name = generateNameFromPattern(culture.naming);
  } else {
    name = `${leadCreature.name} Leader`;
  }

  // Pick 2 traits from personality.common
  let traits: string[] = ['cunning', 'aggressive'];
  if (culture?.personality?.common) {
    const selected = pickWeightedRandom(culture.personality.common, 2);
    if (selected.length > 0) {
      traits = selected.map((t: WeightedTrait) => t.trait);
    }
  }

  // Pick 1 quirk
  let quirkDescription: string | undefined;
  if (culture?.quirks && culture.quirks.length > 0) {
    const selectedQuirks = pickWeightedRandom(culture.quirks, 1);
    if (selectedQuirks.length > 0) {
      quirkDescription = (selectedQuirks[0] as WeightedQuirk).quirk;
    }
  }

  // Build personality string
  const personality = quirkDescription
    ? `${traits.join(', ')} (${quirkDescription})`
    : traits.join(', ');

  return {
    instanceId: leadCreature.instanceId,
    name,
    personality,
    motivation: goal.name,
    isPersisted: false, // Will be handled in #3277
  };
}

// =============================================================================
// Step 4.4: Loot Generation
// =============================================================================

/**
 * Loot budget state for tracking distribution.
 */
interface LootBudget {
  balance: number;
}

/**
 * Calculates the tag match score between item tags and loot tags.
 * Higher score = more matching tags.
 */
function calculateTagScore(itemTags: string[], lootTags: string[]): number {
  return itemTags.filter((t) => lootTags.includes(t)).length;
}

/**
 * Finds items that match the given loot tags, sorted by match score.
 */
function findMatchingItems(lootTags: string[], items: Item[]): Item[] {
  return items
    .filter((item) => calculateTagScore(item.tags, lootTags) > 0)
    .sort(
      (a, b) =>
        calculateTagScore(b.tags, lootTags) - calculateTagScore(a.tags, lootTags)
    );
}

/**
 * Calculates the encounter budget (10-50% of available balance).
 * Spec: Flavour.md lines 464-465
 */
function calculateEncounterBudget(balance: number): number {
  const percent = 0.1 + Math.random() * 0.4; // 10-50%
  return Math.max(0, balance * percent);
}

/**
 * Rolls quantity from a quantity spec (number or [min, max] range).
 */
function rollQuantity(quantity: number | [number, number] | undefined): number {
  if (quantity === undefined) return 1;
  if (typeof quantity === 'number') return quantity;
  const [min, max] = quantity;
  return min + Math.floor(Math.random() * (max - min + 1));
}

/**
 * Generates tag-based loot to fill remaining budget.
 * Spec: Flavour.md lines 536-547
 */
function generateTagBasedLoot(
  budget: number,
  lootTags: string[],
  items: Map<string, Item>
): GeneratedLoot {
  const selected: SelectedItem[] = [];
  let remaining = budget;

  // Find matching items within budget
  const matchingItems = findMatchingItems(lootTags, Array.from(items.values()))
    .filter((i) => i.value <= remaining && i.value > 0);

  // Select items up to budget
  while (remaining > 0 && matchingItems.length > 0) {
    // Weight by tag score (better matches preferred)
    const weights = matchingItems.map((item) => ({
      item,
      weight: calculateTagScore(item.tags, lootTags) + 1,
    }));

    const totalWeight = weights.reduce((sum, w) => sum + w.weight, 0);
    let random = Math.random() * totalWeight;

    let selectedItem: Item | undefined;
    for (const { item, weight } of weights) {
      random -= weight;
      if (random <= 0) {
        selectedItem = item;
        break;
      }
    }

    if (!selectedItem || selectedItem.value > remaining) break;

    selected.push({ item: selectedItem, quantity: 1 });
    remaining -= selectedItem.value;

    // Remove item from pool if not stackable, or if budget is nearly exhausted
    if (!selectedItem.stackable || remaining < selectedItem.value) {
      const idx = matchingItems.findIndex((i) => i.id === selectedItem.id);
      if (idx >= 0) matchingItems.splice(idx, 1);
    }
  }

  // Fill remainder with gold
  if (remaining >= 1) {
    const gold = items.get('gold-piece');
    if (gold) {
      const goldQty = Math.floor(remaining);
      selected.push({ item: gold, quantity: goldQty });
      remaining -= goldQty;
    }
  }

  return { items: selected, totalValue: budget - remaining };
}

/**
 * Determines encounter type based on template.
 * Used for hoard probability calculation.
 */
function determineEncounterType(template: EncounterTemplate): EncounterType {
  const id = template.id.toLowerCase();
  if (id.includes('boss') || id.includes('elite') || id.includes('solo')) {
    return 'boss';
  }
  if (id.includes('camp') || id.includes('lair') || id.includes('warband')) {
    return 'camp';
  }
  if (id.includes('patrol') || id.includes('hunting')) {
    return 'patrol';
  }
  return 'passing';
}

/**
 * Maybe generates a hoard based on encounter type probability.
 * Returns undefined if no hoard is generated.
 */
function maybeGenerateHoard(
  encounterType: EncounterType,
  budget: number,
  items: Map<string, Item>
): GeneratedLoot | undefined {
  if (Math.random() > HOARD_PROBABILITY[encounterType]) {
    return undefined;
  }

  // Hoards are worth 2x budget and use treasure/gem/currency tags
  const hoardBudget = budget * 2;
  return generateTagBasedLoot(hoardBudget, ['treasure', 'gem', 'currency'], items);
}

/**
 * Step 4.4: Generate loot for a group.
 * Orchestrates defaultLoot + tag-based loot generation.
 * Spec: Flavour.md lines 457-495
 */
function generateGroupLoot(
  group: CreatureGroup,
  lookups: PresetLookups,
  budget: LootBudget,
  encounterBudget: number
): GeneratedLoot {
  const selected: SelectedItem[] = [];
  let totalValue = 0;

  // 1. Process defaultLoot for each creature
  for (const creature of group.creatures) {
    const creatureDef = lookups.creatures.get(creature.definitionId);
    if (creatureDef?.defaultLoot) {
      for (const entry of creatureDef.defaultLoot) {
        // Roll chance
        if (Math.random() < entry.chance) {
          const item = lookups.items.get(entry.itemId);
          if (item) {
            const qty = rollQuantity(entry.quantity);
            const value = item.value * qty;

            // Soft-cap: Skip expensive items if budget is negative
            if (budget.balance < 0 && value > encounterBudget * 0.5) {
              continue;
            }

            selected.push({ item, quantity: qty });
            totalValue += value;
          }
        }
      }
    }
  }

  // 2. Calculate remaining budget for tag-based loot
  const restBudget = encounterBudget - totalValue;

  // 3. Generate tag-based loot for remainder
  if (restBudget > 0) {
    const seedCreature = group.creatures[0];
    const seedDef = lookups.creatures.get(seedCreature.definitionId);
    const lootTags = seedDef?.lootTags ?? ['currency'];

    const tagLoot = generateTagBasedLoot(restBudget, lootTags, lookups.items);
    selected.push(...tagLoot.items);
    totalValue += tagLoot.totalValue;
  }

  return { items: selected, totalValue };
}

// =============================================================================
// Group Flavouring
// =============================================================================

/**
 * Flavours a single group with activity, goal, NPC, and loot.
 */
function flavourGroup(
  group: CreatureGroup,
  context: EncounterContext,
  faction: Faction | undefined,
  lookups: PresetLookups,
  budget: LootBudget,
  groupBudget: number
): FlavouredGroup {
  // Step 4.1: Select activity (uses GENERIC + Creature.activities + Faction.activities)
  const activity = selectActivity(group, context, faction, lookups);

  // Step 4.2: Derive goal (uses Faction.activityGoals → DEFAULT_GOALS_BY_ROLE)
  const goal = deriveGoal(activity, group.narrativeRole, faction);

  // Step 4.3: Generate lead NPC
  const leadNpc = generateLeadNpc(group, goal, faction);

  // Step 4.4: Generate loot
  const loot = generateGroupLoot(group, lookups, budget, groupBudget);

  // Update budget balance
  budget.balance -= loot.totalValue;

  return {
    ...group,
    activity,
    goal,
    leadNpc,
    highlightNpcs: [], // Will be handled in #3277
    loot,
  };
}

// =============================================================================
// Main Entry Point
// =============================================================================

/**
 * Options for flavouring an encounter.
 */
export interface FlavourOptions {
  /** Loot budget in gold (default: 500) */
  budget?: number;
}

/**
 * Flavours an encounter draft with RP details.
 *
 * Orchestrates Steps 4.1 through 4.4 for each group.
 */
export function flavourEncounter(
  draft: EncounterDraft,
  lookups: PresetLookups,
  options: FlavourOptions = {}
): FlavourResult {
  try {
    const flavouredGroups: FlavouredGroup[] = [];

    // Initialize budget from options or default
    const budget: LootBudget = {
      balance: options.budget ?? DEFAULT_BUDGET_BALANCE,
    };

    // Calculate total encounter budget
    const totalEncounterBudget = calculateEncounterBudget(budget.balance);

    // Split budget evenly among groups
    const groupCount = draft.groups.length;
    const perGroupBudget = groupCount > 0 ? totalEncounterBudget / groupCount : 0;

    for (const group of draft.groups) {
      // Get faction for this group
      const faction = group.factionId
        ? lookups.factions.get(group.factionId)
        : undefined;

      const flavoured = flavourGroup(
        group,
        draft.context,
        faction,
        lookups,
        budget,
        perGroupBudget
      );
      flavouredGroups.push(flavoured);
    }

    // Maybe generate hoard based on encounter type
    const encounterType = determineEncounterType(draft.template);
    const hoard = maybeGenerateHoard(encounterType, perGroupBudget, lookups.items);

    // If hoard generated, add to first group's loot
    if (hoard && flavouredGroups.length > 0) {
      const firstGroup = flavouredGroups[0];
      firstGroup.loot = {
        items: [...firstGroup.loot.items, ...hoard.items],
        totalValue: firstGroup.loot.totalValue + hoard.totalValue,
      };
    }

    const encounter: FlavouredEncounter = {
      context: draft.context,
      seedCreature: draft.seedCreature,
      template: draft.template,
      groups: flavouredGroups,
      isMultiGroup: draft.isMultiGroup,
      encounterDistance: PLACEHOLDER_ENCOUNTER_DISTANCE, // Placeholder until #3276
    };

    return { success: true, encounter };
  } catch (error) {
    return {
      success: false,
      error: error instanceof Error ? error.message : 'Unknown error in flavourEncounter',
    };
  }
}
