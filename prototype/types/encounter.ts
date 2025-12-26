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
 */
export type NarrativeRole = 'primary' | 'ally' | 'rival' | 'bystander';

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
 */
export interface Feature {
  id: string;
  name: string;
  type: 'terrain' | 'weather' | 'indoor';
  modifiers: {
    cover?: 'half' | 'three-quarters' | 'full';
    difficult?: boolean;
    obscured?: 'lightly' | 'heavily';
  };
}

/**
 * Faction definition for encounter templates.
 */
export interface Faction {
  id: string;
  name: string;
  disposition: CreatureDisposition;
  territoryTerrains: string[];
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
 */
export interface Activity {
  id: string;
  name: string;
  awareness: 'unaware' | 'alert' | 'vigilant';
  mobility: 'stationary' | 'slow' | 'normal' | 'fast';
  focus: 'distracted' | 'focused' | 'engaged';
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
  loot: LootItem[];
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
 * Balance info from adjustment step.
 */
export interface BalanceInfo {
  targetDifficulty: DifficultyLevel;
  actualDifficulty: DifficultyLevel;
  adjustmentsMade: string[];
  adjustmentOptions: string[];
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
