/**
 * Encounter Pipeline Types
 *
 * Lokale Typen fuer den CLI-Prototyp, basierend auf der Spezifikation
 * in docs/prototypes/encounter.md.
 *
 * Diese Typen sind isoliert vom Hauptprojekt (src/core/schemas) um den
 * Prototyp unabhaengig iterieren zu koennen.
 */

// =============================================================================
// Base Types
// =============================================================================

/**
 * Time segments for encounter filtering.
 * Creatures have activeTime preferences.
 */
export type TimeSegment =
  | 'dawn'
  | 'morning'
  | 'midday'
  | 'afternoon'
  | 'dusk'
  | 'night';

/**
 * Creature size categories (D&D 5e).
 */
export type CreatureSize =
  | 'tiny'
  | 'small'
  | 'medium'
  | 'large'
  | 'huge'
  | 'gargantuan';

/**
 * Creature disposition toward party.
 */
export type CreatureDisposition = 'hostile' | 'neutral' | 'friendly';

/**
 * Difficulty classification for encounters.
 */
export type DifficultyLevel =
  | 'trivial'
  | 'easy'
  | 'moderate'
  | 'hard'
  | 'deadly';

/**
 * Narrative role in multi-group encounters.
 * - threat: Primary hostile group (attackers, predators)
 * - victim: Group being attacked or in danger
 * - neutral: Group continuing their task, not involved
 * - ally: Group assisting the party
 */
export type NarrativeRole = 'threat' | 'victim' | 'neutral' | 'ally';

/**
 * Creature properties affected by environment features.
 * Used for Difficulty calculation modifiers.
 */
export type CreatureProperty =
  // Movement types
  | 'fly'
  | 'swim'
  | 'climb'
  | 'burrow'
  | 'walk-only'
  // Senses
  | 'darkvision'
  | 'blindsight'
  | 'tremorsense'
  | 'trueSight'
  | 'no-special-sense'
  // Design roles (MCDM)
  | DesignRole;

/**
 * MCDM-basierte Design-Rollen für Kreaturen.
 * Bestimmen die taktische Funktion einer Kreatur im Encounter.
 */
export type DesignRole =
  | 'ambusher'
  | 'artillery'
  | 'brute'
  | 'controller'
  | 'leader'
  | 'minion'
  | 'skirmisher'
  | 'soldier'
  | 'solo'
  | 'support';

/**
 * Modifier applied by environment features.
 * Affects difficulty calculation for creatures with matching properties.
 */
export interface FeatureModifier {
  target: CreatureProperty;
  value: number; // z.B. -0.30, +0.15
}

/**
 * D&D 5e damage types.
 */
export type DamageType =
  | 'acid'
  | 'bludgeoning'
  | 'cold'
  | 'fire'
  | 'force'
  | 'lightning'
  | 'necrotic'
  | 'piercing'
  | 'poison'
  | 'psychic'
  | 'radiant'
  | 'slashing'
  | 'thunder';

/**
 * D&D 5e conditions.
 */
export type Condition =
  | 'blinded'
  | 'charmed'
  | 'deafened'
  | 'frightened'
  | 'grappled'
  | 'incapacitated'
  | 'invisible'
  | 'paralyzed'
  | 'petrified'
  | 'poisoned'
  | 'prone'
  | 'restrained'
  | 'stunned'
  | 'unconscious';

/**
 * D&D 5e ability scores.
 */
export type AbilityScore = 'str' | 'dex' | 'con' | 'int' | 'wis' | 'cha';

/**
 * Hazard trigger conditions.
 * - enter: When entering the space
 * - start-turn: At the start of a turn in the space
 * - end-turn: At the end of a turn in the space
 * - move-through: When moving through the space
 */
export type HazardTrigger = 'enter' | 'start-turn' | 'end-turn' | 'move-through';

/**
 * Effect applied by a hazard.
 */
export interface HazardEffect {
  type: 'damage' | 'condition' | 'difficult-terrain' | 'forced-movement';
  // For 'damage':
  damage?: { dice: string; damageType: DamageType };
  // For 'condition':
  condition?: Condition;
  duration?: 'instant' | 'until-saved' | 'until-end-of-turn';
  // For 'difficult-terrain':
  movementCost?: number; // 2.0 = double cost
  // For 'forced-movement':
  direction?: 'away' | 'toward' | 'random';
  distance?: number; // in feet
}

/**
 * Saving throw requirement (target rolls against DC).
 */
export interface SaveRequirement {
  ability: AbilityScore;
  dc: number;
  onSuccess: 'negate' | 'half';
}

/**
 * Attack roll requirement (hazard rolls against AC).
 */
export interface AttackRequirement {
  attackBonus: number;
  attackType: 'melee' | 'ranged';
  onMiss?: 'negate' | 'half'; // default: negate
}

/**
 * Hazard definition for environment features.
 * Hazards cause damage, conditions, or movement effects when triggered.
 */
export interface HazardDefinition {
  trigger: HazardTrigger;
  effect: HazardEffect;
  // All combinations possible:
  // - Neither: Automatic effect (e.g., 6d10 fire when entering lava)
  // - Only save: Target rolls against DC
  // - Only attack: Hazard rolls against AC
  // - Both: Attack roll, on hit additional save
  save?: SaveRequirement;
  attack?: AttackRequirement;
}

// =============================================================================
// Loot Types
// =============================================================================

/**
 * Item definition from presets/items/base-items.json.
 */
export interface Item {
  id: string;
  name: string;
  category: string;
  tags: string[];
  value: number;
  rarity: string;
  weight?: number;
  stackable?: boolean;
}

/**
 * Default loot entry for creatures (chance-based drops).
 */
export interface DefaultLootEntry {
  itemId: string;
  chance: number; // 0.0-1.0
  quantity?: number | [number, number]; // fixed or [min, max] range
}

/**
 * Selected item with quantity.
 */
export interface SelectedItem {
  item: Item;
  quantity: number;
}

/**
 * Result of loot generation.
 */
export interface GeneratedLoot {
  items: SelectedItem[];
  totalValue: number;
}

/**
 * Loot budget state for tracking gold distribution.
 */
export interface LootBudgetState {
  accumulated: number;
  distributed: number;
  balance: number;
  debt: number;
}

/**
 * Encounter type for hoard probability calculation.
 */
export type EncounterType = 'boss' | 'camp' | 'patrol' | 'passing';

// =============================================================================
// Entity Types (Simplified for Prototype)
// =============================================================================

/**
 * Simplified terrain definition for prototype.
 * Full definition in src/core/schemas/terrain.ts.
 */
export interface Terrain {
  id: string;
  name: string;
  movementCost: number;
  encounterModifier: number;
  threatLevel: number;
  threatRange: number;
}

/**
 * Simplified creature definition for prototype.
 * Full definition in src/core/schemas/creature.ts.
 */
export interface Creature {
  id: string;
  name: string;
  cr: number;
  maxHp: number;
  ac: number;
  size: CreatureSize;
  disposition: CreatureDisposition;
  terrainAffinities: string[];
  activeTime: TimeSegment[];
  tags: string[];
  lootTags: string[];
  groupSize?: {
    min: number;
    avg: number;
    max: number;
  };
  defaultFactionId?: string;
  /** Creature-type specific activities (e.g., hunting for Wolf) */
  activities?: WeightedActivityRef[];
  /** Default loot entries with chance-based drops */
  defaultLoot?: DefaultLootEntry[];
  /** Creature rarity affects spawn weight (common=1.0, uncommon=0.3, rare=0.05) */
  rarity: 'common' | 'uncommon' | 'rare';
  /** Preferred weather conditions for weight bonus (×1.5 when matched) */
  preferredWeather?: string[];
  /** MCDM-basierte Design-Rollen (aus Statblock abgeleitet) */
  designRoles?: DesignRole[];
}

/**
 * Simplified weather state for prototype.
 */
export interface WeatherState {
  temperature: number;
  windSpeed: number;
  precipitation: 'none' | 'light' | 'moderate' | 'heavy';
  visibility: 'clear' | 'reduced' | 'poor';
}

/**
 * Character snapshot for encounter balancing.
 */
export interface CharacterSnapshot {
  id: string;
  name: string;
  level: number;
  class: string;
  maxHp: number;
  currentHp: number;
  ac: number;
  passivePerception: number;
}

/**
 * Party snapshot aggregating character data.
 */
export interface PartySnapshot {
  characters: CharacterSnapshot[];
  averageLevel: number;
  totalHp: number;
  size: number;
}

/**
 * Terrain/environment feature with modifiers.
 * Features affect Difficulty calculation for creatures with matching properties.
 */
export interface Feature {
  id: string;
  name: string;
  modifiers?: FeatureModifier[];
  hazard?: HazardDefinition;
  description?: string;
}

/**
 * Composition entry in a faction-specific encounter template.
 */
export interface FactionTemplateComposition {
  creatureId: string;
  count: number | { min: number; max: number };
  role: 'regular' | 'elite' | 'leader' | 'support';
}

/**
 * Faction-specific encounter template (from base-factions.json).
 * More specific than generic EncounterTemplate - specifies exact creatures.
 */
export interface FactionTemplateEntry {
  id: string;
  name: string;
  composition: FactionTemplateComposition[];
  triggers?: {
    minXPBudget?: number;
    maxXPBudget?: number;
  };
  weight: number;
}

/**
 * Weighted trait for personality generation.
 */
export interface WeightedTrait {
  trait: string;
  weight: number;
}

/**
 * Weighted quirk for NPC generation.
 */
export interface WeightedQuirk {
  quirk: string;
  weight: number;
  description?: string;
}

/**
 * Naming pattern for NPC name generation.
 */
export interface NamingPattern {
  patterns: string[];
  prefixes?: string[];
  roots?: string[];
  suffixes?: string[];
}

/**
 * Faction culture for NPC generation and activities.
 */
export interface FactionCulture {
  naming?: NamingPattern;
  personality?: {
    common: WeightedTrait[];
    rare?: WeightedTrait[];
  };
  quirks?: WeightedQuirk[];
  activities?: WeightedActivityRef[];
  /** Faction-specific goal mapping: activity.id -> goal name */
  activityGoals?: Record<string, string>;
}

/**
 * Faction definition for encounter templates.
 */
export interface Faction {
  id: string;
  name: string;
  disposition: CreatureDisposition;
  territoryTerrains: string[];
  encounterTemplates?: FactionTemplateEntry[];
  culture?: FactionCulture;
}

/**
 * Creature with eligibility weight for population selection.
 */
export interface WeightedCreature {
  creature: Creature;
  weight: number;
}

// =============================================================================
// Template Types
// =============================================================================

/**
 * Slot in an encounter template.
 */
export interface TemplateSlot {
  role: 'leader' | 'elite' | 'soldier' | 'minion' | 'support';
  tags: string[];
  count: number | { min: number; max: number };
  optional?: boolean;
  /** MCDM Design-Rolle für Kreatur-Matching */
  designRole?: DesignRole;
}

/**
 * Encounter template for group composition.
 */
export interface EncounterTemplate {
  id: string;
  name: string;
  factionId?: string;
  slots: TemplateSlot[];
  minCr?: number;
  maxCr?: number;
}

// =============================================================================
// Group Types
// =============================================================================

/**
 * Creature instance in an encounter group.
 */
export interface CreatureInstance {
  instanceId: string;
  definitionId: string;
  name: string;
  currentHp: number;
  maxHp: number;
  ac: number;
}

/**
 * Creature group in an encounter.
 */
export interface CreatureGroup {
  id: string;
  creatures: CreatureInstance[];
  templateId: string;
  factionId?: string;
  narrativeRole: NarrativeRole;
}

/**
 * Activity for a creature group.
 * awareness: 0-100 (higher = more alert, harder to surprise)
 * detectability: 0-100 (higher = easier to detect from distance)
 */
export interface Activity {
  id: string;
  name: string;
  awareness: number;
  detectability: number;
  contextTags: string[];
}

/**
 * Weighted activity reference (used in Faction.culture.activities).
 */
export interface WeightedActivityRef {
  activityId: string;
  weight: number;
}

/**
 * Goal derived from activity and narrative role.
 */
export interface Goal {
  id: string;
  name: string;
  priority: 'low' | 'medium' | 'high';
}

/**
 * Loot item assigned to creature.
 */
export interface LootItem {
  itemId: string;
  name: string;
  quantity: number;
  assignedTo: string; // instanceId
}

/**
 * NPC generated for lead creature.
 */
export interface GeneratedNpc {
  instanceId: string;
  name: string;
  personality: string;
  motivation: string;
  isPersisted: boolean;
}

/**
 * Flavoured group with RP details.
 */
export interface FlavouredGroup extends CreatureGroup {
  activity: Activity;
  goal: Goal;
  leadNpc?: GeneratedNpc;
  highlightNpcs: GeneratedNpc[];
  loot: GeneratedLoot;
}

// =============================================================================
// Pipeline Output Types
// =============================================================================

/**
 * Step 1 Output: Encounter Context.
 * Context from external systems (Travel, Party, Weather, Map).
 */
export interface EncounterContext {
  terrain: Terrain;
  time: TimeSegment;
  weather?: WeatherState;
  party: PartySnapshot;
  features: Feature[];
  triggeredBy: 'travel' | 'location' | 'quest' | 'manual' | 'time';
}

/**
 * Steps 2-3 Output: Encounter Draft.
 * Populated with creatures from template matching.
 */
export interface EncounterDraft {
  context: EncounterContext;
  seedCreature: Creature;
  template: EncounterTemplate;
  groups: CreatureGroup[];
  isMultiGroup: boolean;
}

/**
 * Step 4 Output: Flavoured Encounter.
 * Enriched with RP details (activity, goals, NPCs, loot, distance).
 */
export interface FlavouredEncounter {
  context: EncounterContext;
  seedCreature: Creature;
  template: EncounterTemplate;
  groups: FlavouredGroup[];
  isMultiGroup: boolean;
  encounterDistance: number;
}

/**
 * Step 5 Output: Difficulty Result.
 * Simulation result with win probability and classification.
 */
export interface DifficultyResult {
  difficulty: DifficultyLevel;
  partyWinProbability: number;
  tpkRisk: number;
  xpReward: number;
  simulationMethod: 'cr-based' | 'pmf-simulation';
}

/**
 * Adjustment option evaluated during feasibility adjustment.
 * Each option is simulated to determine its effect on difficulty.
 * Spec: Adjustments.md lines 80-94
 */
export interface AdjustmentOption {
  type: 'environment' | 'distance' | 'disposition' | 'activity' | 'multi-group' | 'creature-slot';
  description: string;
  /** Win probability after applying this option */
  resultingWinProbability: number;
  /** TPK risk after applying this option */
  resultingTPKRisk: number;
  /** Difficulty classification after applying this option */
  resultingDifficulty: DifficultyLevel;
  /** Absolute difference between resulting Win% and target Win% */
  distanceToTarget: number;
  /** Group ID for disposition adjustments */
  groupId?: string;
  /** Faction ID for multi-group adjustments */
  factionId?: string;
  /** Template ID for multi-group adjustments */
  templateId?: string;
  /** Role for multi-group adjustments */
  role?: 'threat' | 'ally';
}

/**
 * Balance info from adjustment step.
 * Spec: Adjustments.md lines 917-933
 */
export interface BalanceInfo {
  targetDifficulty: DifficultyLevel;
  actualDifficulty: DifficultyLevel;
  /** Party win probability after adjustments (0.0-1.0) */
  partyWinProbability: number;
  /** TPK risk after adjustments (0.0-1.0) */
  tpkRisk: number;
  /** Combat probability based on disposition */
  combatProbability: number;
  /** Base XP reward (sum of creature XP) */
  xpReward: number;
  /** Adjusted XP with group multiplier */
  adjustedXP: number;
  /** Number of adjustments applied */
  adjustmentsMade: number;
}

/**
 * Step 6 Output: Balanced Encounter.
 * Final encounter with applied adjustments.
 */
export interface BalancedEncounter extends FlavouredEncounter {
  balance: BalanceInfo;
  difficulty: DifficultyResult;
}

// =============================================================================
// Pipeline State
// =============================================================================

/**
 * Pipeline state maintained between REPL commands.
 * Each step fills its corresponding field.
 */
export interface PipelineState {
  context?: EncounterContext;
  draft?: EncounterDraft;
  flavoured?: FlavouredEncounter;
  difficulty?: DifficultyResult;
  balanced?: BalancedEncounter;
}

/**
 * Output mode for formatting results.
 */
export type OutputMode = 'json' | 'text';

/**
 * REPL configuration.
 */
export interface ReplConfig {
  outputMode: OutputMode;
  verbose: boolean;
}

// =============================================================================
// Publishing Types (Step 7)
// =============================================================================

/**
 * Simplified GameDateTime for prototype.
 * Full definition in src/core/schemas/time.ts.
 */
export interface GameDateTime {
  year: number;
  month: number;
  day: number;
  hour: number;
  minute: number;
}

/**
 * Encounter state machine states.
 * pending → active → resolved
 */
export type EncounterState = 'pending' | 'active' | 'resolved';

/**
 * Outcome type for encounter resolution.
 */
export type OutcomeType =
  | 'combat-victory'
  | 'combat-defeat'
  | 'fled'
  | 'negotiated'
  | 'ignored'
  | 'dismissed';

/**
 * Creature kill record for attrition tracking.
 */
export interface CreatureKill {
  creatureId: string;
  factionId?: string;
  count: number;
}

/**
 * Encounter outcome with resolution details.
 */
export interface EncounterOutcome {
  type: OutcomeType;
  creaturesKilled?: CreatureKill[];
  npcKilled?: string[]; // EntityId<'npc'>[]
  lootClaimed?: boolean;
  xpAwarded?: number;
}

/**
 * Creature instance in an encounter for publishing.
 */
export interface EncounterCreature {
  creatureId: string;
  npcId?: string;
  count: number;
  loot?: LootItem[];
}

/**
 * Final pipeline output: Published encounter instance.
 * Extends BalancedEncounter with instance-specific fields.
 */
export interface EncounterInstance extends BalancedEncounter {
  // === Instance-specific fields ===
  id: string;
  state: EncounterState;
  description: string;

  // === Trace-relevant fields (at trivial difficulty) ===
  traceAge?: 'fresh' | 'recent' | 'old';
  trackingDC?: number;

  // === Timing & Resolution ===
  generatedAt: GameDateTime;
  resolvedAt?: GameDateTime;
  outcome?: EncounterOutcome;
  xpAwarded?: number;
}
