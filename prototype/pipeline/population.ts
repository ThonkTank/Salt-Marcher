/**
 * Encounter Pipeline Steps 2-3: Population
 *
 * Handles creature selection and encounter group composition:
 * - Step 2.1: Tile-Eligibility (filter + weight)
 * - Step 2.2: Seed-Creature Selection (weighted random)
 * - Step 3.2a: Template-Matching (Faction → Generic → Solo)
 * - Step 3.3: Slot-Filling (companion pool)
 * - Step 3.4: Finalization (EncounterDraft)
 */

import type {
  Creature,
  EncounterContext,
  EncounterDraft,
  EncounterTemplate,
  Faction,
  FactionTemplateEntry,
  CreatureGroup,
  CreatureInstance,
  WeightedCreature,
  WeatherState,
} from '../types/encounter.js';
import type { PresetLookups } from '../loaders/index.js';

// =============================================================================
// Types
// =============================================================================

/**
 * Options for population step.
 */
export interface PopulationOptions {
  /** Optional: Force a specific creature as seed */
  seedId?: string;
}

/**
 * Result of population step.
 */
export type PopulationResult =
  | { success: true; draft: EncounterDraft }
  | { success: false; error: string };

/**
 * Selected template with source information.
 */
interface SelectedTemplate {
  template: EncounterTemplate | FactionTemplateEntry;
  source: 'faction' | 'generic';
  faction?: Faction;
}

// =============================================================================
// Constants
// =============================================================================

/** Minimum weight threshold for creature eligibility */
const MIN_WEIGHT_THRESHOLD = 0.01;

/** Default base weight for eligible creatures */
const BASE_WEIGHT = 1.0;

/** Weight multiplier for faction territory match */
const FACTION_TERRITORY_MULTIPLIER = 2.0;

/** Rarity-based weight multipliers (common=1.0, uncommon=0.3, rare=0.05) */
const RARITY_MULTIPLIER: Record<string, number> = {
  common: 1.0,
  uncommon: 0.3,
  rare: 0.05,
};

/** Weight multiplier when creature's preferred weather matches (×1.5) */
const WEATHER_PREFERENCE_MULTIPLIER = 1.5;

// =============================================================================
// Group Size Hierarchy
// =============================================================================

/**
 * Range for group sizes.
 */
export interface GroupSizeRange {
  min: number;
  max: number;
}

/**
 * Determines group size according to hierarchy: Template > Creature.
 *
 * 1. Template (Faction or Generic) - overrides everything
 * 2. Creature.groupSize - fallback when no template
 *
 * @param seed - The seed creature
 * @param template - Optional template (EncounterTemplate or FactionTemplateEntry)
 * @returns Group size range { min, max }
 */
export function getGroupSize(
  seed: Creature,
  template?: EncounterTemplate | FactionTemplateEntry
): GroupSizeRange {
  // 1. Template (overrides everything)
  if (template) {
    if ('slots' in template) {
      // Generic template - sum all slot counts
      let minTotal = 0;
      let maxTotal = 0;
      for (const slot of template.slots) {
        if (typeof slot.count === 'number') {
          minTotal += slot.count;
          maxTotal += slot.count;
        } else {
          minTotal += slot.count.min;
          maxTotal += slot.count.max;
        }
      }
      return { min: Math.max(1, minTotal), max: maxTotal };
    } else {
      // Faction template - sum composition counts
      let minTotal = 0;
      let maxTotal = 0;
      for (const comp of template.composition) {
        if (typeof comp.count === 'number') {
          minTotal += comp.count;
          maxTotal += comp.count;
        } else {
          minTotal += comp.count.min;
          maxTotal += comp.count.max;
        }
      }
      return { min: Math.max(1, minTotal), max: maxTotal };
    }
  }

  // 2. Creature.groupSize as fallback
  if (seed.groupSize) {
    return { min: seed.groupSize.min, max: seed.groupSize.max };
  }

  // Last fallback: Solo
  return { min: 1, max: 1 };
}

// =============================================================================
// Step 2.1: Tile-Eligibility
// =============================================================================

/**
 * Extracts weather condition tags from WeatherState.
 * Maps precipitation and visibility to searchable tags.
 */
function getWeatherConditions(weather: WeatherState): string[] {
  const conditions: string[] = [];

  // Precipitation-based
  if (weather.precipitation !== 'none') {
    conditions.push(weather.precipitation); // 'light', 'moderate', 'heavy'
    conditions.push('rain'); // Generic rain tag
  }

  // Visibility-based
  if (weather.visibility === 'poor') {
    conditions.push('fog');
    conditions.push('poor-visibility');
  } else if (weather.visibility === 'reduced') {
    conditions.push('reduced-visibility');
  }

  // Temperature-based
  if (weather.temperature !== undefined) {
    if (weather.temperature <= 0) {
      conditions.push('cold');
      conditions.push('freezing');
    }
    if (weather.temperature <= -10) {
      conditions.push('snow');
    }
    if (weather.temperature >= 35) {
      conditions.push('hot');
    }
  }

  return conditions;
}

/**
 * Filters creatures by terrain and time (hard requirements).
 */
function filterByTerrainAndTime(
  creatures: Creature[],
  terrainId: string,
  time: string
): Creature[] {
  return creatures.filter((c) =>
    c.terrainAffinities.includes(terrainId) &&
    c.activeTime.includes(time as Creature['activeTime'][number])
  );
}

/**
 * Calculates weight for a creature based on soft factors.
 * - Faction territory: ×2.0 if faction controls this terrain
 * - Rarity: common ×1.0, uncommon ×0.3, rare ×0.05
 * - Weather preference: ×1.5 if creature.preferredWeather matches current weather
 */
function calculateWeight(
  creature: Creature,
  terrainId: string,
  factions: Map<string, Faction>,
  weather?: WeatherState
): number {
  let weight = BASE_WEIGHT;

  // Faction territory bonus
  if (creature.defaultFactionId) {
    const faction = factions.get(creature.defaultFactionId);
    if (faction?.territoryTerrains.includes(terrainId)) {
      weight *= FACTION_TERRITORY_MULTIPLIER;
    }
  }

  // Rarity multiplier
  weight *= RARITY_MULTIPLIER[creature.rarity] ?? 1.0;

  // Weather preference bonus
  if (creature.preferredWeather && weather) {
    const weatherConditions = getWeatherConditions(weather);
    if (creature.preferredWeather.some((pref) => weatherConditions.includes(pref))) {
      weight *= WEATHER_PREFERENCE_MULTIPLIER;
    }
  }

  return weight;
}

/**
 * Step 2.1: Get eligible creatures with weights.
 *
 * Filters by terrain + time, then applies weight factors.
 */
export function getEligibleCreatures(
  context: EncounterContext,
  creatures: Creature[],
  factions: Map<string, Faction>
): WeightedCreature[] {
  // Filter by hard requirements
  const filtered = filterByTerrainAndTime(
    creatures,
    context.terrain.id,
    context.time
  );

  // Calculate weights
  const weighted = filtered.map((creature) => ({
    creature,
    weight: calculateWeight(creature, context.terrain.id, factions, context.weather),
  }));

  // Filter by minimum threshold
  return weighted.filter((wc) => wc.weight >= MIN_WEIGHT_THRESHOLD);
}

// =============================================================================
// Step 2.2: Seed-Creature Selection
// =============================================================================

/**
 * Weighted random selection from a list of weighted items.
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

  // Fallback to last item (shouldn't happen with valid weights)
  return items[items.length - 1].item;
}

/**
 * Step 2.2: Select seed creature via weighted random.
 */
export function selectSeedCreature(
  eligibleCreatures: WeightedCreature[]
): Creature {
  const items = eligibleCreatures.map((wc) => ({
    item: wc.creature,
    weight: wc.weight,
  }));
  return weightedRandomSelect(items);
}

// =============================================================================
// Step 3.2a: Template-Matching
// =============================================================================

/**
 * Checks if a faction template contains the seed creature.
 * A template is compatible if the seed creature appears in its composition.
 */
function templateContainsSeedCreature(
  template: FactionTemplateEntry,
  seedId: string
): boolean {
  return template.composition.some((comp) => comp.creatureId === seedId);
}

/**
 * Finds a faction template for the seed creature.
 * Only selects templates that contain the seed creature in their composition.
 * Selects based on weight (weighted random).
 */
function findFactionTemplate(
  seed: Creature,
  factions: Map<string, Faction>
): { template: FactionTemplateEntry; faction: Faction } | undefined {
  if (!seed.defaultFactionId) {
    return undefined;
  }

  const faction = factions.get(seed.defaultFactionId);
  if (!faction?.encounterTemplates?.length) {
    return undefined;
  }

  // Filter templates that contain the seed creature
  const compatibleTemplates = faction.encounterTemplates.filter((t) =>
    templateContainsSeedCreature(t, seed.id)
  );

  if (compatibleTemplates.length === 0) {
    // No compatible faction templates - fall back to generic
    return undefined;
  }

  // Weighted random selection from compatible faction templates
  const items = compatibleTemplates.map((t) => ({
    item: t,
    weight: t.weight,
  }));

  const template = weightedRandomSelect(items);
  return { template, faction };
}

/**
 * Finds a generic template matching creature tags.
 *
 * Priority order (b21 fix: humanoid before groupSize):
 * 1. Solo for solitary creatures (groupSize.max <= 1)
 * 2. Leader-minions for organized humanoids/goblinoids
 * 3. Pack for large groups (groupSize.avg >= 3)
 * 4. Default: pack or solo
 */
function findGenericTemplate(
  seed: Creature,
  templates: EncounterTemplate[]
): EncounterTemplate | undefined {
  // Solo template for creatures with max groupSize of 1
  if (seed.groupSize && seed.groupSize.max <= 1) {
    const solo = templates.find((t) => t.id === 'solo');
    if (solo) return solo;
  }

  // Leader-minions for organized creatures (BEFORE groupSize check - b21 fix)
  if (seed.tags.includes('humanoid') || seed.tags.includes('goblinoid')) {
    const leaderMinions = templates.find((t) => t.id === 'leader-minions');
    if (leaderMinions) return leaderMinions;
  }

  // Pack template for pack-like creatures (AFTER humanoid check)
  if (seed.groupSize && seed.groupSize.avg >= 3) {
    const pack = templates.find((t) => t.id === 'pack');
    if (pack) return pack;
  }

  // Default to pack or solo
  return templates.find((t) => t.id === 'pack') ?? templates.find((t) => t.id === 'solo');
}

/**
 * Step 3.2a: Select template for seed creature.
 * Priority: Faction → Generic → Solo
 */
export function selectTemplate(
  seed: Creature,
  factions: Map<string, Faction>,
  templates: EncounterTemplate[]
): SelectedTemplate {
  // Try faction template first
  const factionResult = findFactionTemplate(seed, factions);
  if (factionResult) {
    return {
      template: factionResult.template,
      source: 'faction',
      faction: factionResult.faction,
    };
  }

  // Fall back to generic template
  const genericTemplate = findGenericTemplate(seed, templates);
  if (genericTemplate) {
    return {
      template: genericTemplate,
      source: 'generic',
    };
  }

  // Last resort: solo template
  const soloTemplate = templates.find((t) => t.id === 'solo');
  if (!soloTemplate) {
    throw new Error('No solo template found - presets may be missing');
  }

  return {
    template: soloTemplate,
    source: 'generic',
  };
}

// =============================================================================
// Step 3.3: Slot-Filling
// =============================================================================

/**
 * Gets companion pool for slot filling.
 * - Faction-based: same defaultFactionId
 * - Tag-based: at least one shared tag
 * - Terrain+Time filter: only creatures eligible for current tile (b20 fix)
 */
export function getCompanionPool(
  seed: Creature,
  allCreatures: Creature[],
  terrainId: string,
  time: string
): Creature[] {
  // Step 1: Filter by Faction or Tags
  let pool: Creature[];
  if (seed.defaultFactionId) {
    pool = allCreatures.filter(
      (c) => c.defaultFactionId === seed.defaultFactionId
    );
    // Fallback to tag-based if no faction matches
    if (pool.length === 0) {
      pool = allCreatures.filter((c) =>
        c.tags.some((tag) => seed.tags.includes(tag))
      );
    }
  } else {
    // Tag-based for factionless creatures
    pool = allCreatures.filter((c) =>
      c.tags.some((tag) => seed.tags.includes(tag))
    );
  }

  // Step 2: Filter by Terrain + Time (b20 fix)
  return pool.filter((c) =>
    c.terrainAffinities.includes(terrainId) &&
    c.activeTime.includes(time as Creature['activeTime'][number])
  );
}

/**
 * Generates a unique instance ID.
 */
function generateInstanceId(): string {
  return `inst-${Date.now()}-${Math.random().toString(36).slice(2, 8)}`;
}

/**
 * Creates a creature instance from a creature definition.
 */
function createCreatureInstance(creature: Creature): CreatureInstance {
  return {
    instanceId: generateInstanceId(),
    definitionId: creature.id,
    name: creature.name,
    currentHp: creature.maxHp,
    maxHp: creature.maxHp,
    ac: creature.ac,
  };
}

/**
 * Resolves a count value (number or range) to a concrete number.
 */
function resolveCount(count: number | { min: number; max: number }): number {
  if (typeof count === 'number') {
    return count;
  }
  return Math.floor(Math.random() * (count.max - count.min + 1)) + count.min;
}

/**
 * Fills slots for a faction template (has specific creature IDs).
 */
function fillFactionTemplateSlots(
  template: FactionTemplateEntry,
  creatureLookup: Map<string, Creature>
): CreatureInstance[] {
  const instances: CreatureInstance[] = [];

  for (const comp of template.composition) {
    const creature = creatureLookup.get(comp.creatureId);
    if (!creature) {
      console.warn(`Creature not found: ${comp.creatureId}`);
      continue;
    }

    const count = resolveCount(comp.count);
    for (let i = 0; i < count; i++) {
      instances.push(createCreatureInstance(creature));
    }
  }

  return instances;
}

/**
 * Fills slots for a generic template (uses companion pool with design role matching).
 *
 * Matching priority (from Population.md:555-596):
 * 1. If slot.designRole is set, filter companionPool by matching designRoles
 * 2. Fall back to seed creature if no matching creatures found
 */
function fillGenericTemplateSlots(
  template: EncounterTemplate,
  seed: Creature,
  companionPool: Creature[]
): CreatureInstance[] {
  const instances: CreatureInstance[] = [];

  for (const slot of template.slots) {
    const count = resolveCount(slot.count);

    // Build candidate pool
    let candidates = companionPool;

    // Design-Rolle matchen (falls gesetzt)
    if (slot.designRole) {
      const roleMatches = companionPool.filter((c) =>
        c.designRoles?.includes(slot.designRole!)
      );
      if (roleMatches.length > 0) {
        candidates = roleMatches;
      }
    }

    // Select creatures from candidates (or use seed as fallback)
    for (let i = 0; i < count; i++) {
      if (candidates.length > 0) {
        const selected = weightedRandomSelect(
          candidates.map((c) => ({ item: c, weight: 1.0 }))
        );
        instances.push(createCreatureInstance(selected));
      } else {
        instances.push(createCreatureInstance(seed));
      }
    }
  }

  return instances;
}

/**
 * Step 3.3: Fill template slots with creatures.
 */
export function fillTemplateSlots(
  selectedTemplate: SelectedTemplate,
  seed: Creature,
  companionPool: Creature[],
  creatureLookup: Map<string, Creature>
): CreatureInstance[] {
  if (selectedTemplate.source === 'faction') {
    return fillFactionTemplateSlots(
      selectedTemplate.template as FactionTemplateEntry,
      creatureLookup
    );
  }

  return fillGenericTemplateSlots(
    selectedTemplate.template as EncounterTemplate,
    seed,
    companionPool
  );
}

// =============================================================================
// Step 3.4: Finalization
// =============================================================================

/**
 * Generates a unique group ID.
 */
function generateGroupId(): string {
  return `group-${Date.now()}-${Math.random().toString(36).slice(2, 8)}`;
}

/**
 * Converts selected template to EncounterTemplate for storage.
 */
function toEncounterTemplate(selected: SelectedTemplate): EncounterTemplate {
  if (selected.source === 'generic') {
    return selected.template as EncounterTemplate;
  }

  // Convert faction template to generic format for storage
  const factionTemplate = selected.template as FactionTemplateEntry;
  return {
    id: factionTemplate.id,
    name: factionTemplate.name,
    factionId: selected.faction?.id,
    slots: factionTemplate.composition.map((comp) => ({
      role: comp.role as 'leader' | 'elite' | 'soldier' | 'minion' | 'support',
      tags: [],
      count: comp.count,
      optional: false,
    })),
  };
}

/**
 * Step 3.4: Create EncounterDraft from populated data.
 */
export function createEncounterDraft(
  context: EncounterContext,
  seed: Creature,
  selectedTemplate: SelectedTemplate,
  creatures: CreatureInstance[]
): EncounterDraft {
  const group: CreatureGroup = {
    id: generateGroupId(),
    creatures,
    templateId: selectedTemplate.template.id,
    factionId: seed.defaultFactionId,
    narrativeRole: 'threat',
  };

  return {
    context,
    seedCreature: seed,
    template: toEncounterTemplate(selectedTemplate),
    groups: [group],
    isMultiGroup: false,
  };
}

// =============================================================================
// Main Entry Point
// =============================================================================

/**
 * Populates an encounter from context.
 *
 * Orchestrates Steps 2.1 through 3.4.
 */
export function populateEncounter(
  context: EncounterContext,
  lookups: PresetLookups,
  options?: PopulationOptions
): PopulationResult {
  const creatures = Array.from(lookups.creatures.values());
  const templates = Array.from(lookups.templates.values());

  // Step 2.1: Get eligible creatures
  const eligible = getEligibleCreatures(context, creatures, lookups.factions);

  if (eligible.length === 0) {
    return {
      success: false,
      error: `No eligible creatures for terrain "${context.terrain.id}" at time "${context.time}"`,
    };
  }

  // Step 2.2: Select seed creature
  let seed: Creature;
  if (options?.seedId) {
    const manualSeed = lookups.creatures.get(options.seedId);
    if (!manualSeed) {
      return {
        success: false,
        error: `Creature not found: "${options.seedId}"`,
      };
    }
    seed = manualSeed;
  } else {
    seed = selectSeedCreature(eligible);
  }

  // Step 3.2a: Select template
  const selectedTemplate = selectTemplate(seed, lookups.factions, templates);

  // Step 3.3: Get companion pool and fill slots (b20 fix: pass terrain+time)
  const companionPool = getCompanionPool(
    seed,
    creatures,
    context.terrain.id,
    context.time
  );
  const instances = fillTemplateSlots(
    selectedTemplate,
    seed,
    companionPool,
    lookups.creatures
  );

  // Step 3.4: Create draft
  const draft = createEncounterDraft(context, seed, selectedTemplate, instances);

  return { success: true, draft };
}
