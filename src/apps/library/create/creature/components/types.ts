// src/apps/library/create/creature/components/types.ts
// Type-safe component system for flexible D&D creature entry composition

import type { AbilityScoreKey } from "../../../core/creature-files";
import type { CreatureEntryCategory } from "../presets";

/**
 * Area of effect shape types
 */
export type AreaShape = "cone" | "sphere" | "cube" | "line" | "cylinder" | "emanation";

/**
 * Damage types from D&D 5e
 */
export type DamageType =
  | "acid"
  | "bludgeoning"
  | "cold"
  | "fire"
  | "force"
  | "lightning"
  | "necrotic"
  | "piercing"
  | "poison"
  | "psychic"
  | "radiant"
  | "slashing"
  | "thunder";

/**
 * Condition types from D&D 5e
 */
export type ConditionType =
  | "blinded"
  | "charmed"
  | "deafened"
  | "exhaustion"
  | "frightened"
  | "grappled"
  | "incapacitated"
  | "invisible"
  | "paralyzed"
  | "petrified"
  | "poisoned"
  | "prone"
  | "restrained"
  | "stunned"
  | "unconscious";

/**
 * Rest types for ability recharge
 */
export type RestType = "short" | "long" | "any";

/**
 * Time units for durations
 */
export type TimeUnit = "round" | "minute" | "hour" | "day" | "instant" | "permanent";

// ============================================================================
// COMPONENT TYPES
// ============================================================================

/**
 * Attack component - represents attack roll mechanics
 */
export interface AttackComponent {
  type: "attack";
  /** Attack bonus (e.g., "+5") - can be manual or auto-calculated */
  bonus?: string;
  /** Auto-calculation config for attack bonus */
  autoCalc?: {
    ability: AbilityScoreKey | "best_of_str_dex";
    proficient: boolean;
  };
  /** Reach (e.g., "5 ft.") or range (e.g., "range 80/320 ft.") */
  reach?: string;
  /** Target description (e.g., "one target", "one creature") */
  target?: string;
  /** Attack type description (e.g., "Melee Weapon Attack", "Ranged Spell Attack") */
  attackType?: string;
}

/**
 * Saving throw component - represents DC-based effects
 */
export interface SaveComponent {
  type: "save";
  /** Ability used for the save (e.g., "dex", "wis") */
  ability: AbilityScoreKey;
  /** Difficulty class for the save */
  dc: number;
  /** Effect on successful save (e.g., "half damage", "negates") */
  onSuccess?: string;
  /** Effect on failed save (optional, usually implied) */
  onFailure?: string;
}

/**
 * Damage component - represents damage dealt
 */
export interface DamageComponent {
  type: "damage";
  /** Dice notation (e.g., "2d6") */
  dice: string;
  /** Static bonus to add to damage */
  bonus?: number;
  /** Ability modifier to add (can be auto-calculated) */
  abilityMod?: {
    ability: AbilityScoreKey | "best_of_str_dex";
  };
  /** Type of damage (e.g., "fire", "slashing") */
  damageType?: DamageType;
  /** Additional damage type notes (e.g., "plus 2d6 fire on a critical hit") */
  notes?: string;
}

/**
 * Condition component - represents status conditions applied
 */
export interface ConditionComponent {
  type: "condition";
  /** The condition being applied */
  condition: ConditionType | string; // Allow custom conditions
  /** Duration of the condition */
  duration?: {
    amount: number;
    unit: TimeUnit;
  };
  /** How to escape/end the condition early */
  escape?: {
    type: "save" | "action" | "special";
    /** DC if escape requires a save */
    dc?: number;
    /** Ability if escape requires a save */
    ability?: AbilityScoreKey;
    /** Description of escape method */
    description?: string;
  };
  /** Additional notes about the condition */
  notes?: string;
}

/**
 * Area of effect component - represents spatial effects
 */
export interface AreaComponent {
  type: "area";
  /** Shape of the area */
  shape: AreaShape;
  /** Size of the area (e.g., "15", "20") - interpreted based on shape */
  size: string;
  /** Origin point description (e.g., "self", "a point within range") */
  origin?: string;
  /** Additional notes about the area */
  notes?: string;
}

/**
 * Recharge component - represents dice-based recharge mechanics
 */
export interface RechargeComponent {
  type: "recharge";
  /** Minimum roll needed (e.g., 5 for "Recharge 5-6") */
  min: number;
  /** Maximum roll (usually 6) */
  max?: number;
  /** When the recharge roll happens (e.g., "start of turn") */
  timing?: string;
}

/**
 * Limited uses component - represents daily/rest-based uses
 */
export interface UsesComponent {
  type: "uses";
  /** Number of uses available */
  count: number;
  /** When uses reset */
  per: "day" | "rest" | RestType | string; // Support custom periods
  /** Whether uses are shared with other abilities */
  shared?: {
    /** Name of the shared pool */
    poolName: string;
  };
  /** Additional notes */
  notes?: string;
}

/**
 * Trigger component - references other actions (e.g., Multiattack)
 */
export interface TriggerComponent {
  type: "trigger";
  /** Type of trigger */
  triggerType: "multiattack" | "reaction" | "special";
  /** List of actions that can be taken */
  actions: Array<{
    /** Name of the action being referenced */
    name: string;
    /** Number of times this action can be used (default: 1) */
    count?: number;
    /** Conditions for using this action */
    condition?: string;
  }>;
  /** Additional restrictions or conditions */
  restrictions?: string;
}

/**
 * Healing component - represents healing effects
 */
export interface HealComponent {
  type: "heal";
  /** Dice notation for healing (e.g., "2d8") */
  dice?: string;
  /** Static healing amount (if not using dice) */
  amount?: number;
  /** Ability modifier to add to healing */
  abilityMod?: {
    ability: AbilityScoreKey;
  };
  /** What is being healed (default: hit points) */
  target?: "hp" | "temp-hp" | string;
  /** Additional notes about the healing */
  notes?: string;
}

/**
 * Effect component - freeform special effects
 */
export interface EffectComponent {
  type: "effect";
  /** Name/title of the effect */
  name?: string;
  /** Description of the effect */
  description: string;
  /** Duration of the effect */
  duration?: {
    amount: number;
    unit: TimeUnit;
  };
  /** Concentration required (for spell-like effects) */
  concentration?: boolean;
}

/**
 * Union type of all component types
 */
export type EntryComponent =
  | AttackComponent
  | SaveComponent
  | DamageComponent
  | ConditionComponent
  | AreaComponent
  | RechargeComponent
  | UsesComponent
  | TriggerComponent
  | HealComponent
  | EffectComponent;

/**
 * Discriminated union for component type narrowing
 */
export type ComponentType = EntryComponent["type"];

// ============================================================================
// ENTRY STRUCTURE
// ============================================================================

/**
 * A creature entry using the flexible component system
 */
export interface ComponentBasedEntry {
  /** Entry category (trait, action, bonus, reaction, legendary) */
  category: CreatureEntryCategory;
  /** Entry name (e.g., "Claw", "Fire Breath", "Multiattack") */
  name: string;
  /** Ordered list of components that make up this entry */
  components: EntryComponent[];
  /** Freeform description text (Markdown) */
  description?: string;
  /** Whether this entry is currently enabled/active */
  enabled?: boolean;
}

// ============================================================================
// TYPE GUARDS
// ============================================================================

/**
 * Type guard for AttackComponent
 */
export function isAttackComponent(component: EntryComponent): component is AttackComponent {
  return component.type === "attack";
}

/**
 * Type guard for SaveComponent
 */
export function isSaveComponent(component: EntryComponent): component is SaveComponent {
  return component.type === "save";
}

/**
 * Type guard for DamageComponent
 */
export function isDamageComponent(component: EntryComponent): component is DamageComponent {
  return component.type === "damage";
}

/**
 * Type guard for ConditionComponent
 */
export function isConditionComponent(component: EntryComponent): component is ConditionComponent {
  return component.type === "condition";
}

/**
 * Type guard for AreaComponent
 */
export function isAreaComponent(component: EntryComponent): component is AreaComponent {
  return component.type === "area";
}

/**
 * Type guard for RechargeComponent
 */
export function isRechargeComponent(component: EntryComponent): component is RechargeComponent {
  return component.type === "recharge";
}

/**
 * Type guard for UsesComponent
 */
export function isUsesComponent(component: EntryComponent): component is UsesComponent {
  return component.type === "uses";
}

/**
 * Type guard for TriggerComponent
 */
export function isTriggerComponent(component: EntryComponent): component is TriggerComponent {
  return component.type === "trigger";
}

/**
 * Type guard for HealComponent
 */
export function isHealComponent(component: EntryComponent): component is HealComponent {
  return component.type === "heal";
}

/**
 * Type guard for EffectComponent
 */
export function isEffectComponent(component: EntryComponent): component is EffectComponent {
  return component.type === "effect";
}

// ============================================================================
// COMPONENT FACTORY FUNCTIONS
// ============================================================================

/**
 * Creates a new attack component with default values
 */
export function createAttackComponent(overrides?: Partial<AttackComponent>): AttackComponent {
  return {
    type: "attack",
    ...overrides,
  };
}

/**
 * Creates a new save component with default values
 */
export function createSaveComponent(
  ability: AbilityScoreKey,
  dc: number,
  overrides?: Partial<Omit<SaveComponent, "type" | "ability" | "dc">>
): SaveComponent {
  return {
    type: "save",
    ability,
    dc,
    ...overrides,
  };
}

/**
 * Creates a new damage component with default values
 */
export function createDamageComponent(
  dice: string,
  overrides?: Partial<Omit<DamageComponent, "type" | "dice">>
): DamageComponent {
  return {
    type: "damage",
    dice,
    ...overrides,
  };
}

/**
 * Creates a new condition component with default values
 */
export function createConditionComponent(
  condition: ConditionType | string,
  overrides?: Partial<Omit<ConditionComponent, "type" | "condition">>
): ConditionComponent {
  return {
    type: "condition",
    condition,
    ...overrides,
  };
}

/**
 * Creates a new area component with default values
 */
export function createAreaComponent(
  shape: AreaShape,
  size: string,
  overrides?: Partial<Omit<AreaComponent, "type" | "shape" | "size">>
): AreaComponent {
  return {
    type: "area",
    shape,
    size,
    ...overrides,
  };
}

/**
 * Creates a new recharge component with default values
 */
export function createRechargeComponent(
  min: number,
  overrides?: Partial<Omit<RechargeComponent, "type" | "min">>
): RechargeComponent {
  return {
    type: "recharge",
    min,
    max: 6,
    ...overrides,
  };
}

/**
 * Creates a new uses component with default values
 */
export function createUsesComponent(
  count: number,
  per: UsesComponent["per"],
  overrides?: Partial<Omit<UsesComponent, "type" | "count" | "per">>
): UsesComponent {
  return {
    type: "uses",
    count,
    per,
    ...overrides,
  };
}

/**
 * Creates a new trigger component with default values
 */
export function createTriggerComponent(
  triggerType: TriggerComponent["triggerType"],
  actions: TriggerComponent["actions"],
  overrides?: Partial<Omit<TriggerComponent, "type" | "triggerType" | "actions">>
): TriggerComponent {
  return {
    type: "trigger",
    triggerType,
    actions,
    ...overrides,
  };
}

/**
 * Creates a new heal component with default values
 */
export function createHealComponent(overrides?: Partial<HealComponent>): HealComponent {
  return {
    type: "heal",
    ...overrides,
  };
}

/**
 * Creates a new effect component with default values
 */
export function createEffectComponent(
  description: string,
  overrides?: Partial<Omit<EffectComponent, "type" | "description">>
): EffectComponent {
  return {
    type: "effect",
    description,
    ...overrides,
  };
}

// ============================================================================
// COMPONENT UTILITIES
// ============================================================================

/**
 * Finds components of a specific type within an entry
 */
export function findComponentsByType<T extends ComponentType>(
  entry: ComponentBasedEntry,
  type: T
): Array<Extract<EntryComponent, { type: T }>> {
  return entry.components.filter((c) => c.type === type) as Array<
    Extract<EntryComponent, { type: T }>
  >;
}

/**
 * Checks if an entry has a component of a specific type
 */
export function hasComponentType(entry: ComponentBasedEntry, type: ComponentType): boolean {
  return entry.components.some((c) => c.type === type);
}

/**
 * Gets the first component of a specific type
 */
export function getFirstComponent<T extends ComponentType>(
  entry: ComponentBasedEntry,
  type: T
): Extract<EntryComponent, { type: T }> | undefined {
  return entry.components.find((c) => c.type === type) as
    | Extract<EntryComponent, { type: T }>
    | undefined;
}

/**
 * Removes all components of a specific type
 */
export function removeComponentsByType(
  entry: ComponentBasedEntry,
  type: ComponentType
): ComponentBasedEntry {
  return {
    ...entry,
    components: entry.components.filter((c) => c.type !== type),
  };
}

/**
 * Replaces the first component of a specific type
 */
export function replaceComponent(
  entry: ComponentBasedEntry,
  component: EntryComponent
): ComponentBasedEntry {
  const index = entry.components.findIndex((c) => c.type === component.type);
  if (index === -1) {
    // Component type doesn't exist, add it
    return {
      ...entry,
      components: [...entry.components, component],
    };
  }
  const newComponents = [...entry.components];
  newComponents[index] = component;
  return {
    ...entry,
    components: newComponents,
  };
}

/**
 * Validates a component-based entry
 */
export function validateEntry(entry: ComponentBasedEntry): string[] {
  const errors: string[] = [];

  if (!entry.name?.trim()) {
    errors.push("Entry name is required");
  }

  if (entry.components.length === 0) {
    errors.push("Entry must have at least one component or description");
  }

  // Validate individual components
  entry.components.forEach((component, index) => {
    const componentErrors = validateComponent(component);
    componentErrors.forEach((error) => {
      errors.push(`Component ${index + 1} (${component.type}): ${error}`);
    });
  });

  return errors;
}

/**
 * Validates a single component
 */
export function validateComponent(component: EntryComponent): string[] {
  const errors: string[] = [];

  switch (component.type) {
    case "save":
      if (!component.ability) {
        errors.push("Save ability is required");
      }
      if (component.dc == null || component.dc < 1) {
        errors.push("Save DC must be at least 1");
      }
      break;

    case "damage":
      if (!component.dice?.trim()) {
        errors.push("Damage dice notation is required");
      }
      break;

    case "condition":
      if (!component.condition?.trim()) {
        errors.push("Condition type is required");
      }
      break;

    case "area":
      if (!component.shape) {
        errors.push("Area shape is required");
      }
      if (!component.size?.trim()) {
        errors.push("Area size is required");
      }
      break;

    case "recharge":
      if (component.min < 1 || component.min > 6) {
        errors.push("Recharge minimum must be between 1 and 6");
      }
      if (component.max != null && component.max < component.min) {
        errors.push("Recharge maximum must be greater than or equal to minimum");
      }
      break;

    case "uses":
      if (component.count < 1) {
        errors.push("Uses count must be at least 1");
      }
      if (!component.per) {
        errors.push("Uses period (per) is required");
      }
      break;

    case "trigger":
      if (!component.actions || component.actions.length === 0) {
        errors.push("Trigger must reference at least one action");
      }
      component.actions.forEach((action, idx) => {
        if (!action.name?.trim()) {
          errors.push(`Action ${idx + 1} must have a name`);
        }
      });
      break;

    case "heal":
      if (!component.dice && component.amount == null) {
        errors.push("Healing must specify either dice or amount");
      }
      break;

    case "effect":
      if (!component.description?.trim()) {
        errors.push("Effect description is required");
      }
      break;

    case "attack":
      // Attack components are flexible - no required fields
      break;
  }

  return errors;
}

// ============================================================================
// MIGRATION HELPERS - Backward Compatibility
// ============================================================================

/**
 * Legacy entry format (from entry-model.ts)
 */
export interface LegacyCreatureEntry {
  category: CreatureEntryCategory;
  entryType?: string;
  name?: string;
  kind?: string;
  range?: string;
  target?: string;
  to_hit?: string;
  to_hit_from?: {
    ability: string;
    proficient: boolean;
  };
  damage?: string;
  damage_from?: {
    dice: string;
    ability?: string;
    bonus?: string;
  };
  save_ability?: string;
  save_dc?: number;
  save_effect?: string;
  recharge?: string;
  text?: string;
  spellAbility?: AbilityScoreKey;
  spellDcOverride?: number;
  spellAttackOverride?: number;
  spellGroups?: Array<{
    type: "at-will" | "per-day" | "level";
    label?: string;
    level?: number;
    slots?: number;
    spells: string[];
  }>;
}

/**
 * Migrates a legacy entry to the new component-based format
 */
export function migrateFromLegacy(legacy: LegacyCreatureEntry): ComponentBasedEntry {
  const components: EntryComponent[] = [];

  // Migrate attack data
  if (legacy.to_hit !== undefined || legacy.to_hit_from) {
    const attackComponent: AttackComponent = {
      type: "attack",
      bonus: legacy.to_hit,
      reach: legacy.range,
      target: legacy.target,
      attackType: legacy.kind,
    };

    if (legacy.to_hit_from) {
      attackComponent.autoCalc = {
        ability: legacy.to_hit_from.ability as AbilityScoreKey | "best_of_str_dex",
        proficient: legacy.to_hit_from.proficient ?? false,
      };
    }

    components.push(attackComponent);
  }

  // Migrate damage data
  if (legacy.damage || legacy.damage_from) {
    const damageComponent: DamageComponent = {
      type: "damage",
      dice: legacy.damage_from?.dice || legacy.damage || "1d6",
    };

    if (legacy.damage_from?.ability) {
      damageComponent.abilityMod = {
        ability: legacy.damage_from.ability as AbilityScoreKey | "best_of_str_dex",
      };
    }

    // Parse damage type from bonus string if present
    if (legacy.damage_from?.bonus) {
      const maybeDamageType = legacy.damage_from.bonus.toLowerCase();
      if (isDamageTypeString(maybeDamageType)) {
        damageComponent.damageType = maybeDamageType as DamageType;
      } else {
        damageComponent.notes = legacy.damage_from.bonus;
      }
    }

    components.push(damageComponent);
  }

  // Migrate save data
  if (legacy.save_ability && legacy.save_dc != null) {
    const saveComponent: SaveComponent = {
      type: "save",
      ability: legacy.save_ability.toLowerCase() as AbilityScoreKey,
      dc: legacy.save_dc,
      onSuccess: legacy.save_effect,
    };
    components.push(saveComponent);
  }

  // Migrate recharge data
  if (legacy.recharge) {
    const rechargeMatch = legacy.recharge.match(/recharge\s+(\d+)(?:-(\d+))?/i);
    if (rechargeMatch) {
      const min = parseInt(rechargeMatch[1], 10);
      const max = rechargeMatch[2] ? parseInt(rechargeMatch[2], 10) : 6;
      components.push(createRechargeComponent(min, { max }));
    } else {
      // Try to parse uses format (e.g., "1/Day", "3/Rest")
      const usesMatch = legacy.recharge.match(/(\d+)\s*\/\s*(\w+)/i);
      if (usesMatch) {
        const count = parseInt(usesMatch[1], 10);
        const per = usesMatch[2].toLowerCase();
        components.push(createUsesComponent(count, per));
      }
    }
  }

  return {
    category: legacy.category,
    name: legacy.name || "",
    components,
    description: legacy.text,
    enabled: true,
  };
}

/**
 * Migrates a component-based entry back to legacy format
 * (for backward compatibility with existing rendering code)
 */
export function migrateToLegacy(entry: ComponentBasedEntry): LegacyCreatureEntry {
  const legacy: LegacyCreatureEntry = {
    category: entry.category,
    name: entry.name,
    text: entry.description,
  };

  // Extract attack component
  const attack = getFirstComponent(entry, "attack");
  if (attack) {
    legacy.to_hit = attack.bonus;
    legacy.range = attack.reach;
    legacy.target = attack.target;
    legacy.kind = attack.attackType;
    if (attack.autoCalc) {
      legacy.to_hit_from = attack.autoCalc;
    }
  }

  // Extract damage component
  const damage = getFirstComponent(entry, "damage");
  if (damage) {
    // Reconstruct damage string
    let damageStr = damage.dice;
    if (damage.bonus) {
      damageStr += ` ${damage.bonus > 0 ? "+" : ""}${damage.bonus}`;
    }
    if (damage.damageType) {
      damageStr += ` ${damage.damageType}`;
    }
    legacy.damage = damageStr;

    // Set damage_from for auto-calculation
    if (damage.abilityMod) {
      legacy.damage_from = {
        dice: damage.dice,
        ability: damage.abilityMod.ability,
        bonus: damage.damageType,
      };
    }
  }

  // Extract save component
  const save = getFirstComponent(entry, "save");
  if (save) {
    legacy.save_ability = save.ability.toUpperCase();
    legacy.save_dc = save.dc;
    legacy.save_effect = save.onSuccess;
  }

  // Extract recharge or uses component
  const recharge = getFirstComponent(entry, "recharge");
  if (recharge) {
    legacy.recharge = `Recharge ${recharge.min}${recharge.max && recharge.max !== 6 ? `-${recharge.max}` : recharge.min < 6 ? "-6" : ""}`;
  } else {
    const uses = getFirstComponent(entry, "uses");
    if (uses) {
      legacy.recharge = `${uses.count}/${uses.per.charAt(0).toUpperCase() + uses.per.slice(1)}`;
    }
  }

  return legacy;
}

/**
 * Helper to check if a string is a valid damage type
 */
function isDamageTypeString(str: string): boolean {
  const damageTypes: DamageType[] = [
    "acid",
    "bludgeoning",
    "cold",
    "fire",
    "force",
    "lightning",
    "necrotic",
    "piercing",
    "poison",
    "psychic",
    "radiant",
    "slashing",
    "thunder",
  ];
  return damageTypes.includes(str as DamageType);
}

// ============================================================================
// PRESET BUILDERS - Common Entry Patterns
// ============================================================================

/**
 * Creates a basic melee attack entry
 */
export function createMeleeAttackEntry(
  name: string,
  damage: string,
  damageType: DamageType,
  overrides?: Partial<ComponentBasedEntry>
): ComponentBasedEntry {
  return {
    category: "action",
    name,
    components: [
      createAttackComponent({
        reach: "5 ft.",
        target: "one target",
        attackType: "Melee Weapon Attack",
        autoCalc: {
          ability: "str",
          proficient: true,
        },
      }),
      createDamageComponent(damage, {
        damageType,
        abilityMod: { ability: "str" },
      }),
    ],
    enabled: true,
    ...overrides,
  };
}

/**
 * Creates a ranged attack entry
 */
export function createRangedAttackEntry(
  name: string,
  range: string,
  damage: string,
  damageType: DamageType,
  overrides?: Partial<ComponentBasedEntry>
): ComponentBasedEntry {
  return {
    category: "action",
    name,
    components: [
      createAttackComponent({
        reach: `range ${range}`,
        target: "one target",
        attackType: "Ranged Weapon Attack",
        autoCalc: {
          ability: "dex",
          proficient: true,
        },
      }),
      createDamageComponent(damage, {
        damageType,
        abilityMod: { ability: "dex" },
      }),
    ],
    enabled: true,
    ...overrides,
  };
}

/**
 * Creates a breath weapon entry (common dragon ability)
 */
export function createBreathWeaponEntry(
  name: string,
  shape: AreaShape,
  size: string,
  saveAbility: AbilityScoreKey,
  saveDC: number,
  damage: string,
  damageType: DamageType,
  overrides?: Partial<ComponentBasedEntry>
): ComponentBasedEntry {
  return {
    category: "action",
    name,
    components: [
      createRechargeComponent(5),
      createAreaComponent(shape, size),
      createSaveComponent(saveAbility, saveDC, {
        onSuccess: "half damage",
      }),
      createDamageComponent(damage, {
        damageType,
      }),
    ],
    enabled: true,
    ...overrides,
  };
}

/**
 * Creates a multiattack entry
 */
export function createMultiattackEntry(
  actions: TriggerComponent["actions"],
  overrides?: Partial<ComponentBasedEntry>
): ComponentBasedEntry {
  return {
    category: "action",
    name: "Multiattack",
    components: [
      createTriggerComponent("multiattack", actions),
    ],
    enabled: true,
    ...overrides,
  };
}
