/**
 * Template Matcher - Match creatures to encounter templates.
 *
 * Implements the Template-Auswahl Hierarchie from Encounter-System.md:
 * 1. Fraktion-spezifische Templates (passend zur Seed-Kreatur)
 * 2. Fallback: Generische Templates (Horde, Leader+Minions, Squad, etc.)
 *
 * CR beeinflusst Template-Wahrscheinlichkeit:
 * - Hoher CR (relativ zum Budget) → Solo/Leader wahrscheinlicher
 * - Niedriger CR → Pack/Horde wahrscheinlicher
 * - Aber nur wenn mit Creature-Tags kompatibel
 *
 * @see docs/features/Encounter-System.md#template-auswahl-hierarchie
 */

import type { CreatureDefinition, EncounterTemplate, Faction } from '@core/schemas';
import type { EncounterTemplateRegistry } from './template-loader';

// ============================================================================
// Types
// ============================================================================

/**
 * Result of template matching with source information.
 */
export interface TemplateMatchResult {
  /** Matched template, or null if no match found */
  template: EncounterTemplate | null;
  /** Where the template came from */
  source: 'faction' | 'generic' | 'none';
  /** All candidate templates that were considered */
  candidates: EncounterTemplate[];
}

/**
 * Weighted template for probabilistic selection.
 */
interface WeightedTemplate {
  template: EncounterTemplate;
  weight: number;
}

// ============================================================================
// Constants
// ============================================================================

/**
 * Templates preferred for high-CR creatures (CR uses >50% of budget).
 * These are single-creature or leader-focused compositions.
 */
const HIGH_CR_TEMPLATE_IDS = ['solo', 'leader-minions'];

/**
 * Templates preferred for mid-CR creatures (CR uses 25-50% of budget).
 * These are medium-sized groups with tactical variety.
 */
const MID_CR_TEMPLATE_IDS = ['pack', 'squad', 'pair'];

/**
 * Templates preferred for low-CR creatures (CR uses <25% of budget).
 * These are large swarm-like groups.
 */
const LOW_CR_TEMPLATE_IDS = ['horde', 'pack'];

/**
 * Weight multiplier for CR-matching templates.
 */
const CR_WEIGHT_MULTIPLIER = 3.0;

/**
 * Base weight for all templates.
 */
const BASE_TEMPLATE_WEIGHT = 1.0;

// ============================================================================
// CR to XP Conversion (D&D 5e)
// ============================================================================

/**
 * D&D 5e CR to XP mapping.
 */
const CR_TO_XP: Record<number, number> = {
  0: 10,
  0.125: 25,
  0.25: 50,
  0.5: 100,
  1: 200,
  2: 450,
  3: 700,
  4: 1100,
  5: 1800,
  6: 2300,
  7: 2900,
  8: 3900,
  9: 5000,
  10: 5900,
  11: 7200,
  12: 8400,
  13: 10000,
  14: 11500,
  15: 13000,
  16: 15000,
  17: 18000,
  18: 20000,
  19: 22000,
  20: 25000,
  21: 33000,
  22: 41000,
  23: 50000,
  24: 62000,
  25: 75000,
  26: 90000,
  27: 105000,
  28: 120000,
  29: 135000,
  30: 155000,
};

/**
 * Get XP value for a creature's CR.
 */
function getCreatureXP(cr: number): number {
  return CR_TO_XP[cr] ?? Math.floor(cr * 1000);
}

// ============================================================================
// Template Matching
// ============================================================================

/**
 * Match a creature to an encounter template.
 *
 * Implements Template-Auswahl Hierarchie:
 * 1. Fraktion-spezifische Templates (wenn Faction.encounterTemplates existiert)
 * 2. Fallback: Generische Templates via Creature-Tags
 *
 * CR-basierte Gewichtung:
 * - Hoher CR → Solo/Leader bevorzugt
 * - Niedriger CR → Horde/Pack bevorzugt
 *
 * @param creature - The seed creature for the encounter
 * @param faction - The faction the creature belongs to (if any)
 * @param xpBudget - Available XP budget for the encounter
 * @param registry - Template registry to search (for generic fallback)
 * @returns TemplateMatchResult with matched template and source
 */
export function matchTemplate(
  creature: CreatureDefinition,
  faction: Faction | null,
  xpBudget: number,
  registry: EncounterTemplateRegistry
): TemplateMatchResult {
  const creatureXP = getCreatureXP(creature.cr);
  const tags = collectMatchingTags(creature, faction);

  // Step 1: Try faction-specific templates first (Hierarchie: Faction > Generic)
  const factionResult = matchFactionTemplates(
    faction,
    tags,
    creatureXP,
    xpBudget
  );

  if (factionResult.template) {
    return factionResult;
  }

  // Step 2: Fallback to generic templates via registry
  const genericCandidates = registry.findByTags(tags);

  if (genericCandidates.length === 0) {
    return {
      template: null,
      source: 'none',
      candidates: [],
    };
  }

  // Step 3: Calculate CR-based weights and select
  const weightedTemplates = calculateTemplateWeights(
    genericCandidates,
    creatureXP,
    xpBudget
  );
  const selected = selectWeightedTemplate(weightedTemplates);

  return {
    template: selected,
    source: selected ? 'generic' : 'none',
    candidates: genericCandidates,
  };
}

/**
 * Try to match faction-specific templates.
 *
 * Faction templates take priority over generic templates.
 * They are matched against creature tags and weighted by CR.
 *
 * @param faction - The faction to check for templates
 * @param creatureTags - Tags from the seed creature
 * @param creatureXP - XP value of the seed creature
 * @param xpBudget - Available XP budget
 * @returns TemplateMatchResult with source 'faction' or 'none'
 */
function matchFactionTemplates(
  faction: Faction | null,
  creatureTags: string[],
  creatureXP: number,
  xpBudget: number
): TemplateMatchResult {
  // No faction or no faction templates → no match
  if (!faction?.encounterTemplates || faction.encounterTemplates.length === 0) {
    return {
      template: null,
      source: 'none',
      candidates: [],
    };
  }

  // Find faction templates matching creature tags
  const matchingTemplates = faction.encounterTemplates.filter((template) =>
    template.compatibleTags.some((tag) => creatureTags.includes(tag))
  );

  if (matchingTemplates.length === 0) {
    return {
      template: null,
      source: 'none',
      candidates: faction.encounterTemplates,
    };
  }

  // Apply CR-based weighting
  const weightedTemplates = calculateTemplateWeights(
    matchingTemplates,
    creatureXP,
    xpBudget
  );
  const selected = selectWeightedTemplate(weightedTemplates);

  return {
    template: selected,
    source: selected ? 'faction' : 'none',
    candidates: matchingTemplates,
  };
}

/**
 * Collect tags for template matching.
 *
 * Uses creature tags as primary source.
 * Faction templates are matched separately in matchFactionTemplates().
 *
 * @param creature - The seed creature
 * @param _faction - The faction (reserved for future tag inheritance)
 * @returns Array of tags for template matching
 */
function collectMatchingTags(
  creature: CreatureDefinition,
  _faction: Faction | null
): string[] {
  // Creature tags are the primary source for generic template matching
  return [...creature.tags];
}

/**
 * Calculate CR-based weights for templates.
 *
 * Gewichtung basiert auf CR-zu-Budget-Verhältnis:
 * - CR > 50% Budget → Solo/Leader ×3
 * - CR 25-50% Budget → Pack/Squad ×3
 * - CR < 25% Budget → Horde/Pack ×3
 *
 * @param templates - Candidate templates
 * @param creatureXP - XP of the seed creature
 * @param xpBudget - Total XP budget
 * @returns Weighted templates
 */
function calculateTemplateWeights(
  templates: EncounterTemplate[],
  creatureXP: number,
  xpBudget: number
): WeightedTemplate[] {
  // Determine CR category based on budget ratio
  const budgetRatio = xpBudget > 0 ? creatureXP / xpBudget : 0;

  let preferredIds: string[];
  if (budgetRatio > 0.5) {
    // High CR: creature takes more than half the budget → solo/leader
    preferredIds = HIGH_CR_TEMPLATE_IDS;
  } else if (budgetRatio > 0.25) {
    // Mid CR: creature takes 25-50% → pack/squad
    preferredIds = MID_CR_TEMPLATE_IDS;
  } else {
    // Low CR: creature takes <25% → horde/pack
    preferredIds = LOW_CR_TEMPLATE_IDS;
  }

  return templates.map((template) => ({
    template,
    weight: preferredIds.includes(template.id)
      ? BASE_TEMPLATE_WEIGHT * CR_WEIGHT_MULTIPLIER
      : BASE_TEMPLATE_WEIGHT,
  }));
}

/**
 * Select a template using weighted random selection.
 *
 * @param weighted - Array of weighted templates
 * @returns Selected template, or null if array is empty
 */
function selectWeightedTemplate(
  weighted: WeightedTemplate[]
): EncounterTemplate | null {
  if (weighted.length === 0) {
    return null;
  }

  // Calculate total weight
  const totalWeight = weighted.reduce((sum, w) => sum + w.weight, 0);

  if (totalWeight <= 0) {
    return null;
  }

  // Random selection
  let roll = Math.random() * totalWeight;

  for (const entry of weighted) {
    roll -= entry.weight;
    if (roll <= 0) {
      return entry.template;
    }
  }

  // Fallback: return last template
  return weighted[weighted.length - 1].template;
}

// ============================================================================
// Utility Exports (for testing)
// ============================================================================

export {
  calculateTemplateWeights,
  selectWeightedTemplate,
  collectMatchingTags,
  getCreatureXP,
  HIGH_CR_TEMPLATE_IDS,
  MID_CR_TEMPLATE_IDS,
  LOW_CR_TEMPLATE_IDS,
  CR_WEIGHT_MULTIPLIER,
};

// Export matchFactionTemplates for testing
export { matchFactionTemplates };
