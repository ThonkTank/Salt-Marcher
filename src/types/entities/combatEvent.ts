// Ziel: Unified CombatEvent Schema - ersetzt alle separaten Expression-Schemas
// Siehe: docs/types/combatEvent.md
//
// CombatEvent ist das einheitliche Schema fuer ALLE Combat-relevanten Faehigkeiten:
// - Aktionen: Angriffe, Zauber, Spezialfaehigkeiten
// - Reaktionen: Opportunity Attacks, Shield, Counterspell
// - Traits: Pack Tactics, Magic Resistance
// - Auras: Paladin Aura of Protection, Spirit Guardians
// - Conditions: Grappled, Prone, Frightened (als CombatEvents!)
// - Zones: Cloudkill, Wall of Fire
//
// Jedes CombatEvent besteht aus 7 Komponenten:
// 1. Precondition - Was muss wahr sein?
// 2. Trigger - Wie wird es ausgeloest?
// 3. Check - Wie wird Erfolg bestimmt?
// 4. Cost - Was kostet es?
// 5. Targeting - Wer/Was/Wo?
// 6. Effect - Was passiert?
// 7. Duration - Wie lange / wann endet es?

// ============================================================================
// HACK & TODO
// ============================================================================
//
// [TODO]: Effect Stacking/Timing/Rider Fields
// - Spec: docs/types/combatEvent.md#stacking-policies
// - Effect Type fehlt: stacking?: { policy, maxStacks, stackEffect }
// - Effect Type fehlt: timing?: 'on-apply' | 'on-interval' | 'on-stack' | 'on-remove'
// - Effect Type fehlt: interval?: Duration
// - Effect Type fehlt: rider?: boolean

import { z } from 'zod';
import {
  ABILITY_TYPES,
  SKILL_TYPES,
  DAMAGE_TYPES,
  CONDITION_TYPES,
} from '@/constants/action';

// ============================================================================
// HELPER TYPES
// ============================================================================

/** Distance in feet (standard D&D measurement) */
export type Distance = number;

/** Dice expression string (e.g., "2d6", "1d8+3", "4d6kh3") */
export const diceExpressionSchema = z.string();
export type DiceExpression = z.infer<typeof diceExpressionSchema>;

/** Entity reference for expression evaluation */
export const entityRefSchema = z.enum([
  'self',
  'target',
  'attacker',
  'source',
  'ally',
  'enemy',
]);
export type EntityRef = z.infer<typeof entityRefSchema>;

/** Ability type reference from constants */
export const abilityTypeSchema = z.enum(ABILITY_TYPES);
export type AbilityType = z.infer<typeof abilityTypeSchema>;

/** Skill type reference from constants */
export const skillTypeSchema = z.enum(SKILL_TYPES);
export type SkillType = z.infer<typeof skillTypeSchema>;

/** Skill or Ability (for contested checks) */
export const skillOrAbilitySchema = z.union([abilityTypeSchema, skillTypeSchema]);
export type SkillOrAbility = z.infer<typeof skillOrAbilitySchema>;

/** Damage type reference from constants */
export const damageTypeSchema = z.enum(DAMAGE_TYPES);
export type DamageType = z.infer<typeof damageTypeSchema>;

/** Condition ID reference from constants */
export const conditionIdSchema = z.enum(CONDITION_TYPES);
export type ConditionId = z.infer<typeof conditionIdSchema>;

/** Condition reference (string for flexibility) */
export const conditionRefSchema = z.string();

/** Size category for D&D creatures */
export const sizeCategorySchema = z.enum([
  'tiny',
  'small',
  'medium',
  'large',
  'huge',
  'gargantuan',
]);
export type SizeCategory = z.infer<typeof sizeCategorySchema>;

/** Creature type for type-based targeting */
export const creatureTypeSchema = z.enum([
  'aberration',
  'beast',
  'celestial',
  'construct',
  'dragon',
  'elemental',
  'fey',
  'fiend',
  'giant',
  'humanoid',
  'monstrosity',
  'ooze',
  'plant',
  'undead',
]);
export type CreatureType = z.infer<typeof creatureTypeSchema>;

/** Weapon property for is-wielding checks */
export const weaponPropertySchema = z.enum([
  'ammunition',
  'finesse',
  'heavy',
  'light',
  'loading',
  'range',
  'reach',
  'special',
  'thrown',
  'two-handed',
  'versatile',
  'melee',
  'ranged',
]);
export type WeaponProperty = z.infer<typeof weaponPropertySchema>;

/** Resource type for resource-based preconditions */
export const resourceTypeSchema = z.enum([
  'spell-slot',
  'reaction',
  'bonus-action',
  'action',
  'ki',
  'superiority-dice',
  'sorcery-points',
  'channel-divinity',
  'wild-shape',
  'rage',
  'lay-on-hands',
  'legendary-action',
]);
export type ResourceType = z.infer<typeof resourceTypeSchema>;

/** Resource ID (string for flexibility) */
export const resourceIdSchema = z.string();

// ============================================================================
// 1. PRECONDITION SCHEMA
// ============================================================================

/** Quantified entity for exists expressions */
export const quantifiedEntitySchema = z.object({
  type: z.literal('quantified'),
  quantifier: z.enum(['any', 'all', 'count-gte']),
  count: z.number().optional(),
  filter: z.enum(['ally', 'enemy', 'any-creature']),
  relativeTo: entityRefSchema.optional(),
});
export type QuantifiedEntity = z.infer<typeof quantifiedEntitySchema>;

// Explicit Precondition type for recursive schema
export type Precondition =
  | { type: 'and'; conditions: Precondition[] }
  | { type: 'or'; conditions: Precondition[] }
  | { type: 'not'; condition: Precondition }
  | { type: 'exists'; entity: QuantifiedEntity; where?: Precondition }
  | { type: 'has-condition'; target?: EntityRef; entity?: EntityRef; condition: string; negate?: boolean }
  | { type: 'has-no-condition'; target: EntityRef; condition: string }
  | { type: 'has-resource'; resource: ResourceType; amount: number }
  | { type: 'is-wielding'; weaponProperty: WeaponProperty[] }
  | { type: 'has-free-hand' }
  | { type: 'has-free-hands'; count: number }
  | { type: 'hp-threshold'; target?: EntityRef; entity?: EntityRef; comparison: '<' | '<=' | '>' | '>=' | 'below' | 'above' | 'equal-or-below' | 'equal-or-above'; threshold: number; value?: number | 'half' }
  | { type: 'is-ally'; a?: EntityRef; b?: EntityRef; entity?: EntityRef; relativeTo?: EntityRef }
  | { type: 'is-enemy'; a?: EntityRef; b?: EntityRef; entity?: EntityRef; relativeTo?: EntityRef }
  | { type: 'within-range'; target?: EntityRef; subject?: EntityRef; object?: EntityRef; range: number }
  | { type: 'beyond-range'; target?: EntityRef; subject?: EntityRef; object?: EntityRef; range: number }
  | { type: 'has-line-of-sight'; from: EntityRef; to: EntityRef }
  | { type: 'can-see'; target: EntityRef }
  | { type: 'adjacent-to'; subject: EntityRef; object: EntityRef }
  | { type: 'opposite-side'; subject: EntityRef; center: EntityRef; of: EntityRef; angle?: number }
  | { type: 'in-line-between'; entity: EntityRef; from: EntityRef; to: EntityRef }
  | { type: 'size-category'; entity?: EntityRef; max: SizeCategory | 'one-larger' }
  | { type: 'is-creature-type'; entity: EntityRef; creatureId: string }
  | { type: 'is-incapacitated'; entity: EntityRef; negate?: boolean }
  | { type: 'action-has-property'; property: string }
  | { type: 'action-is-type'; actionType: string }
  | { type: 'action-range-type'; rangeType: string }
  | { type: 'action-is-id'; actionId: string | string[] }
  | { type: 'target-in-long-range' }
  | { type: 'target-beyond-normal-range' }
  | { type: 'has-advantage' }
  | { type: 'always' }
  | { type: 'never' };

/** Base precondition schemas (non-recursive) */
const basePreconditionSchemas = {
  // Entity checks
  'has-condition': z.object({
    type: z.literal('has-condition'),
    target: entityRefSchema.optional(),
    entity: entityRefSchema.optional(), // Alias for target
    condition: conditionRefSchema,
    negate: z.boolean().optional(),
  }),
  'has-no-condition': z.object({
    type: z.literal('has-no-condition'),
    target: entityRefSchema,
    condition: conditionRefSchema,
  }),
  'has-resource': z.object({
    type: z.literal('has-resource'),
    resource: resourceTypeSchema,
    amount: z.number(),
  }),
  'is-wielding': z.object({
    type: z.literal('is-wielding'),
    weaponProperty: z.array(weaponPropertySchema),
  }),
  'has-free-hand': z.object({
    type: z.literal('has-free-hand'),
  }),
  'has-free-hands': z.object({
    type: z.literal('has-free-hands'),
    count: z.number().min(1).max(2),
  }),
  'hp-threshold': z.object({
    type: z.literal('hp-threshold'),
    target: entityRefSchema.optional(),
    entity: entityRefSchema.optional(), // Alias for target
    comparison: z.enum(['<', '<=', '>', '>=', 'below', 'above', 'equal-or-below', 'equal-or-above']),
    threshold: z.number(),
    value: z.union([z.number(), z.literal('half')]).optional(), // Alias for threshold
  }),
  'is-ally': z.object({
    type: z.literal('is-ally'),
    a: entityRefSchema.optional(),
    b: entityRefSchema.optional(),
    entity: entityRefSchema.optional(),
    relativeTo: entityRefSchema.optional(),
  }),
  'is-enemy': z.object({
    type: z.literal('is-enemy'),
    a: entityRefSchema.optional(),
    b: entityRefSchema.optional(),
    entity: entityRefSchema.optional(),
    relativeTo: entityRefSchema.optional(),
  }),

  // Spatial predicates
  'within-range': z.object({
    type: z.literal('within-range'),
    target: entityRefSchema.optional(),
    subject: entityRefSchema.optional(),
    object: entityRefSchema.optional(),
    range: z.number(),
  }),
  'beyond-range': z.object({
    type: z.literal('beyond-range'),
    target: entityRefSchema.optional(),
    subject: entityRefSchema.optional(),
    object: entityRefSchema.optional(),
    range: z.number(),
  }),
  'has-line-of-sight': z.object({
    type: z.literal('has-line-of-sight'),
    from: entityRefSchema,
    to: entityRefSchema,
  }),
  'can-see': z.object({
    type: z.literal('can-see'),
    target: entityRefSchema,
  }),
  'adjacent-to': z.object({
    type: z.literal('adjacent-to'),
    subject: entityRefSchema,
    object: entityRefSchema,
  }),
  'opposite-side': z.object({
    type: z.literal('opposite-side'),
    subject: entityRefSchema,
    center: entityRefSchema,
    of: entityRefSchema,
    angle: z.number().optional(),
  }),
  'in-line-between': z.object({
    type: z.literal('in-line-between'),
    entity: entityRefSchema,
    from: entityRefSchema,
    to: entityRefSchema,
  }),

  // Size checks
  'size-category': z.object({
    type: z.literal('size-category'),
    entity: entityRefSchema.optional(),
    max: z.union([sizeCategorySchema, z.literal('one-larger')]),
  }),

  // Creature type checks
  'is-creature-type': z.object({
    type: z.literal('is-creature-type'),
    entity: entityRefSchema,
    creatureId: z.string(),
  }),

  // Incapacitation check
  'is-incapacitated': z.object({
    type: z.literal('is-incapacitated'),
    entity: entityRefSchema,
    negate: z.boolean().optional(),
  }),

  // Action predicates (for expressionEvaluator)
  'action-has-property': z.object({
    type: z.literal('action-has-property'),
    property: z.string(),
  }),
  'action-is-type': z.object({
    type: z.literal('action-is-type'),
    actionType: z.string(),
  }),
  'action-range-type': z.object({
    type: z.literal('action-range-type'),
    rangeType: z.string(),
  }),
  'action-is-id': z.object({
    type: z.literal('action-is-id'),
    actionId: z.union([z.string(), z.array(z.string())]),
  }),
  'target-in-long-range': z.object({
    type: z.literal('target-in-long-range'),
  }),
  'target-beyond-normal-range': z.object({
    type: z.literal('target-beyond-normal-range'),
  }),
  'has-advantage': z.object({
    type: z.literal('has-advantage'),
  }),

  // Base cases
  'always': z.object({
    type: z.literal('always'),
  }),
  'never': z.object({
    type: z.literal('never'),
  }),
};

/** Precondition schema with recursive types */
export const preconditionSchema: z.ZodType<Precondition> = z.lazy(() =>
  z.discriminatedUnion('type', [
    // Logical operators (recursive)
    z.object({
      type: z.literal('and'),
      conditions: z.array(preconditionSchema),
    }),
    z.object({
      type: z.literal('or'),
      conditions: z.array(preconditionSchema),
    }),
    z.object({
      type: z.literal('not'),
      condition: preconditionSchema,
    }),
    // Exists with optional where clause
    z.object({
      type: z.literal('exists'),
      entity: quantifiedEntitySchema,
      where: preconditionSchema.optional(),
    }),
    // All base preconditions
    ...Object.values(basePreconditionSchemas),
  ])
);

/** Alias for backwards compatibility */
export type ConditionExpression = Precondition;

/** Exists expression type for direct access */
export type ExistsExpression = {
  type: 'exists';
  entity: QuantifiedEntity;
  where?: Precondition;
};

// ============================================================================
// 2. TRIGGER SCHEMA
// ============================================================================

/** Reaction event types */
export const reactionEventSchema = z.enum([
  // Combat phase triggers (for Shield, Counterspell, etc.)
  'on-attack-declared',
  'on-spell-declared',
  'on-attack-rolled',
  'on-save-rolled',
  // Standard reaction events
  'on-attacked',
  'on-hit',
  'on-damaged',
  'on-ally-attacked',
  'on-ally-damaged',
  'on-enemy-casts-spell',
  'on-enemy-leaves-reach',
  'on-enemy-enters-reach',
  'on-forced-movement',
  'on-condition-applied',
  'on-condition-removed',
]);
export type ReactionEvent = z.infer<typeof reactionEventSchema>;

export const triggerSchema = z.discriminatedUnion('type', [
  // Active
  z.object({ type: z.literal('active') }),

  // Reactive
  z.object({
    type: z.literal('reaction'),
    event: reactionEventSchema,
  }),

  // Passive
  z.object({ type: z.literal('passive') }),
  z.object({
    type: z.literal('aura'),
    radius: z.number(),
  }),

  // Temporal
  z.object({
    type: z.literal('on-turn-start'),
    whose: z.enum(['self', 'any', 'ally', 'enemy']),
  }),
  z.object({
    type: z.literal('on-turn-end'),
    whose: z.enum(['self', 'any', 'ally', 'enemy']),
  }),
  z.object({ type: z.literal('on-round-start') }),
  z.object({ type: z.literal('on-round-end') }),
  z.object({
    type: z.literal('on-initiative'),
    initiative: z.number(),
    timing: z.enum(['wins-ties', 'loses-ties']),
  }),

  // Zone
  z.object({
    type: z.literal('on-zone-enter'),
    zoneId: z.string(),
  }),
  z.object({
    type: z.literal('on-zone-exit'),
    zoneId: z.string(),
  }),
  z.object({
    type: z.literal('on-zone-start-turn'),
    zoneId: z.string(),
  }),
]);

export type Trigger = z.infer<typeof triggerSchema>;

// ============================================================================
// 3. CHECK SCHEMA
// ============================================================================

/** Attack type */
export const attackTypeSchema = z.enum([
  'melee-weapon',
  'ranged-weapon',
  'melee-spell',
  'ranged-spell',
]);
export type AttackType = z.infer<typeof attackTypeSchema>;

/** DC (Difficulty Class) schema */
export const dcSchema = z.discriminatedUnion('type', [
  z.object({
    type: z.literal('fixed'),
    value: z.number(),
  }),
  z.object({
    type: z.literal('ability-based'),
    ability: abilityTypeSchema,
    proficient: z.boolean(),
  }),
  z.object({ type: z.literal('spell-dc') }),
  z.object({
    type: z.literal('formula'),
    formula: z.string(),
  }),
]);
export type DC = z.infer<typeof dcSchema>;

/** Alias for SaveDC (backwards compatibility with combat.ts) */
export type SaveDC = DC;
export const saveDCSchema = dcSchema;

/** Skill choice for contested checks */
export const skillChoiceSchema = z.object({
  choice: z.array(skillOrAbilitySchema),
});

// ============================================================================
// UNIFIED CHECK SCHEMA
// ============================================================================
// Ein einheitlicher Check-Typ für alle Würfelmechaniken:
// - Attack: roller=actor, roll=attack, against=ac
// - Save: roller=target, roll=ability, against=ability-dc
// - Contested: roller=actor, roll=skill, against=contested
// - Ability Check: roller=actor/target, roll=ability, against=fixed

/** What is being rolled */
export const rollSchema = z.discriminatedUnion('type', [
  z.object({
    type: z.literal('ability'),
    ability: abilityTypeSchema,
  }),
  z.object({
    type: z.literal('skill'),
    skill: skillTypeSchema,
  }),
  z.object({
    type: z.literal('attack'),
    attackType: attackTypeSchema,
    bonus: z.number().optional(),
  }),
]);
export type Roll = z.infer<typeof rollSchema>;

/** What the roll is compared against */
export const againstSchema = z.discriminatedUnion('type', [
  z.object({
    type: z.literal('fixed'),
    dc: z.number(),
  }),
  z.object({
    type: z.literal('ac'),
  }),
  z.object({
    type: z.literal('ability-dc'),  // 8 + prof + ability mod
    ability: abilityTypeSchema,
  }),
  z.object({
    type: z.literal('contested'),
    choice: z.array(skillOrAbilitySchema),
  }),
]);
export type Against = z.infer<typeof againstSchema>;

/** Unified check schema */
export const unifiedCheckSchema = z.object({
  roller: z.enum(['actor', 'target']),
  roll: rollSchema,
  against: againstSchema,
  onSuccess: z.enum(['effect-applies', 'half-effect']).default('effect-applies'),
  onFailure: z.enum(['no-effect', 'half-effect']).default('no-effect'),
});
export type UnifiedCheck = z.infer<typeof unifiedCheckSchema>;

// Legacy check schema for backwards compatibility
export const legacyCheckSchema = z.discriminatedUnion('type', [
  z.object({
    type: z.literal('attack'),
    attackType: attackTypeSchema,
    bonus: z.number().optional(),
  }),
  z.object({
    type: z.literal('save'),
    save: abilityTypeSchema,
    dc: dcSchema,
    onSave: z.enum(['none', 'half', 'special']).optional(),
  }),
  z.object({
    type: z.literal('contested'),
    self: skillOrAbilitySchema,
    target: z.union([skillOrAbilitySchema, skillChoiceSchema]),
  }),
  z.object({ type: z.literal('auto') }),
  z.object({ type: z.literal('none') }),
]);
export type LegacyCheck = z.infer<typeof legacyCheckSchema>;

/** Check can be unified or legacy (for backwards compatibility) */
export const checkSchema = z.union([
  unifiedCheckSchema,
  legacyCheckSchema,
]);
export type Check = z.infer<typeof checkSchema>;

/** Check result types */
export const checkResultSchema = z.enum([
  'critical-success',
  'success',
  'failure',
  'critical-failure',
]);
export type CheckResult = z.infer<typeof checkResultSchema>;

// ============================================================================
// 4. COST SCHEMA
// ============================================================================

/** Action economy types */
export const actionEconomySchema = z.enum([
  'action',
  'bonus-action',
  'reaction',
  'free',
  'legendary',
  'lair',
]);
export type ActionEconomy = z.infer<typeof actionEconomySchema>;

// Explicit Cost type for recursive schema (avoids circular reference)
export type Cost =
  | { type: 'action-economy'; economy: ActionEconomy }
  | { type: 'spell-slot'; level: number | 'any' }
  | { type: 'resource'; resource: string; amount: number }
  | { type: 'consume-item'; itemId?: string; itemTag?: string; quantity: number }
  | { type: 'movement'; amount: number | 'all' }
  | { type: 'recharge'; range: [number, number] }
  | { type: 'per-rest'; restType: 'short' | 'long'; uses: number }
  | { type: 'per-day'; uses: number }
  | { type: 'material'; gp: number; consumed: boolean }
  | { type: 'hp'; amount: number }
  | { type: 'legendary'; points: number }
  | { type: 'composite'; costs: Cost[] }
  | { type: 'choice'; options: Cost[] }
  | { type: 'free' };

export const costSchema: z.ZodType<Cost> = z.lazy(() =>
  z.discriminatedUnion('type', [
    z.object({
      type: z.literal('action-economy'),
      economy: actionEconomySchema,
    }),
    z.object({
      type: z.literal('spell-slot'),
      level: z.union([z.number(), z.literal('any')]),
    }),
    z.object({
      type: z.literal('resource'),
      resource: resourceIdSchema,
      amount: z.number(),
    }),
    z.object({
      type: z.literal('consume-item'),
      itemId: z.string().optional(),
      itemTag: z.string().optional(),
      quantity: z.number().default(1),
    }),
    z.object({
      type: z.literal('movement'),
      amount: z.union([z.number(), z.literal('all')]),
    }),
    z.object({
      type: z.literal('recharge'),
      range: z.tuple([z.number(), z.number()]),
    }),
    z.object({
      type: z.literal('per-rest'),
      restType: z.enum(['short', 'long']),
      uses: z.number(),
    }),
    z.object({
      type: z.literal('per-day'),
      uses: z.number(),
    }),
    z.object({
      type: z.literal('material'),
      gp: z.number(),
      consumed: z.boolean(),
    }),
    z.object({
      type: z.literal('hp'),
      amount: z.number(),
    }),
    z.object({
      type: z.literal('legendary'),
      points: z.number(),
    }),
    // Recursive
    z.object({
      type: z.literal('composite'),
      costs: z.array(costSchema),
    }),
    z.object({
      type: z.literal('choice'),
      options: z.array(costSchema),
    }),
    z.object({ type: z.literal('free') }),
  ])
);

// ============================================================================
// 5. TARGETING SCHEMA
// ============================================================================

/** Range schema */
export const rangeSchema = z.discriminatedUnion('type', [
  z.object({ type: z.literal('self') }),
  z.object({ type: z.literal('touch') }),
  z.object({
    type: z.literal('reach'),
    distance: z.number(),
  }),
  z.object({
    type: z.literal('ranged'),
    normal: z.number(),
    disadvantage: z.number().optional(),
    long: z.number().optional(), // Alias for disadvantage
  }),
]);
export type Range = z.infer<typeof rangeSchema>;

/** Area shape schema */
export const areaShapeSchema = z.discriminatedUnion('shape', [
  z.object({
    shape: z.literal('sphere'),
    radius: z.number(),
  }),
  z.object({
    shape: z.literal('cube'),
    size: z.number(),
  }),
  z.object({
    shape: z.literal('cone'),
    length: z.number(),
  }),
  z.object({
    shape: z.literal('line'),
    length: z.number(),
    width: z.number(),
  }),
  z.object({
    shape: z.literal('cylinder'),
    radius: z.number(),
    height: z.number(),
  }),
]);
export type AreaShape = z.infer<typeof areaShapeSchema>;

/** Area origin schema */
export const areaOriginSchema = z.discriminatedUnion('type', [
  z.object({ type: z.literal('self') }),
  z.object({
    type: z.literal('point'),
    range: z.number(),
  }),
  z.object({
    type: z.literal('target'),
    range: z.number(),
  }),
]);
export type AreaOrigin = z.infer<typeof areaOriginSchema>;

/** Target filter schema */
// Explicit TargetFilter type for recursive schema
export type TargetFilter =
  | 'any' | 'ally' | 'enemy' | 'self' | 'other' | 'willing' | 'creature' | 'object'
  | { type: 'creature-type'; types: CreatureType[] }
  | { type: 'condition'; has?: string; lacks?: string }
  | { type: 'and'; filters: TargetFilter[] }
  | { type: 'or'; filters: TargetFilter[] };

const baseTargetFilters = z.enum([
  'any',
  'ally',
  'enemy',
  'self',
  'other',
  'willing',
  'creature',
  'object',
]);

export const targetFilterSchema: z.ZodType<TargetFilter> = z.lazy(() =>
  z.union([
    baseTargetFilters,
    z.object({
      type: z.literal('creature-type'),
      types: z.array(creatureTypeSchema),
    }),
    z.object({
      type: z.literal('condition'),
      has: conditionRefSchema.optional(),
      lacks: conditionRefSchema.optional(),
    }),
    z.object({
      type: z.literal('and'),
      filters: z.array(targetFilterSchema),
    }),
    z.object({
      type: z.literal('or'),
      filters: z.array(targetFilterSchema),
    }),
  ])
);

/** Targeting schema */
// Explicit type definition for recursive Targeting
// filter uses singular values: 'enemy' | 'ally' | 'self' | 'any'
export type Targeting =
  | { type: 'single'; range?: Range; filter?: TargetFilter; aoe?: { shape: string; size: number } }
  | { type: 'multi'; count: number | 'all'; range?: Range; filter?: TargetFilter; unique?: boolean; aoe?: { shape: string; size: number } }
  | { type: 'area'; shape?: AreaShape; aoe?: { shape: string; size: number }; origin?: AreaOrigin; filter?: TargetFilter }
  | { type: 'self'; aoe?: { shape: string; size: number } }
  | { type: 'chain'; primary: Targeting; secondary: { count: number; range: number; filter?: TargetFilter }; aoe?: { shape: string; size: number } };

// eslint-disable-next-line @typescript-eslint/no-explicit-any
export const targetingSchema: z.ZodType<any> = z.lazy(() =>
  z.discriminatedUnion('type', [
    z.object({
      type: z.literal('single'),
      range: rangeSchema,
      filter: targetFilterSchema,
    }),
    z.object({
      type: z.literal('multi'),
      count: z.union([z.number(), z.literal('all')]),
      range: rangeSchema,
      filter: targetFilterSchema,
      unique: z.boolean(),
    }),
    z.object({
      type: z.literal('area'),
      shape: areaShapeSchema.optional(),
      aoe: z.object({
        shape: z.string(),
        size: z.number(),
      }).optional(),
      origin: areaOriginSchema.optional(),
      filter: targetFilterSchema.optional(),
    }),
    z.object({ type: z.literal('self') }),
    z.object({
      type: z.literal('chain'),
      primary: targetingSchema,
      secondary: z.object({
        count: z.number(),
        range: z.number(),
        filter: targetFilterSchema,
      }),
    }),
  ])
);

// ============================================================================
// 6. EFFECT SCHEMA
// ============================================================================

/** Direction for forced movement */
export const directionSchema = z.enum(['north', 'south', 'east', 'west', 'up', 'down']);
export type Direction = z.infer<typeof directionSchema>;

/** Modifier target for advantage/disadvantage effects */
export const modifierTargetSchema = z.union([
  z.enum([
    'attack-rolls',
    'saving-throws',
    'ability-checks',
    'damage-rolls',
    'ac',
    'speed',
  ]),
  z.object({
    type: z.literal('specific-save'),
    ability: abilityTypeSchema,
  }),
  z.object({
    type: z.literal('specific-skill'),
    skill: skillTypeSchema,
  }),
]);
export type ModifierTarget = z.infer<typeof modifierTargetSchema>;

/** Movement restriction types */
export const movementRestrictionSchema = z.enum([
  'cannot-move-closer',
  'cannot-move-away',
  'cannot-move',
]);
export type MovementRestriction = z.infer<typeof movementRestrictionSchema>;

/** Damage roll schema */
export const damageRollSchema = z.union([
  diceExpressionSchema,
  z.object({
    base: diceExpressionSchema,
    bonus: z.number().optional(),
  }),
]);
export type DamageRoll = z.infer<typeof damageRollSchema>;

/** Zone trigger events */
export const zoneTriggerEventSchema = z.enum([
  'on-enter',
  'on-leave',
  'on-start-turn',
  'on-end-turn',
]);
export type ZoneTriggerEvent = z.infer<typeof zoneTriggerEventSchema>;

/** Zone movement types (Spirit Guardians, Moonbeam, Cloudkill, etc.) */
export const zoneMovementSchema = z.discriminatedUnion('type', [
  z.object({ type: z.literal('static') }), // Default: zone doesn't move
  z.object({
    type: z.literal('attached'),
    to: entityRefSchema, // Zone moves with this entity (Spirit Guardians)
  }),
  z.object({
    type: z.literal('movable'),
    cost: costSchema, // Action cost to move (Moonbeam: bonus action)
    distance: z.number(), // Max distance per move in feet
  }),
  z.object({
    type: z.literal('drift'),
    direction: z.union([z.literal('wind'), directionSchema]), // Cloudkill drifts with wind
    distance: z.number(), // Distance per round
  }),
]);
export type ZoneMovement = z.infer<typeof zoneMovementSchema>;

/** Zone triggered effect pair - flexible trigger/effect combinations */
export const zoneTriggeredEffectSchema = z.object({
  triggers: z.union([
    zoneTriggerEventSchema,
    z.array(zoneTriggerEventSchema),
  ]),
  effect: z.lazy(() => effectSchema),
});
export type ZoneTriggeredEffect = z.infer<typeof zoneTriggeredEffectSchema>;

/** Zone definition for create-zone effect */
export const zoneDefinitionSchema = z.object({
  id: z.string(),
  shape: areaShapeSchema.optional(),
  origin: areaOriginSchema.optional(),
  movement: zoneMovementSchema.optional(), // Default: static
  filter: z.enum(['enemies', 'allies', 'all', 'any']).optional(),
  // New: Flexible trigger-effect pairs
  effects: z.array(zoneTriggeredEffectSchema).optional(),
  // Legacy fields (deprecated, use effects array)
  trigger: zoneTriggerEventSchema.optional(),
  targetFilter: z.enum(['enemies', 'allies', 'all']).optional(),
  radius: z.number().optional(),
  speedModifier: z.number().optional(), // e.g., 0.5 for difficult terrain
  damage: z.object({
    dice: z.string(),
    type: damageTypeSchema,
  }).optional(),
  save: z.object({
    ability: abilityTypeSchema,
    dc: z.number(),
    onSave: z.enum(['none', 'half', 'special']).optional(),
  }).optional(),
});
export type ZoneDefinition = z.infer<typeof zoneDefinitionSchema>;

/** Creature reference for summon/transform */
export const creatureRefSchema = z.string();

/** Condition reference for linked conditions */
export const conditionRefExtSchema = z.string();

// Explicit Duration type for recursive schema
export type Duration =
  | { type: 'instant' }
  | { type: 'rounds'; value: number; until?: 'start' | 'end' }
  | { type: 'minutes'; value: number }
  | { type: 'hours'; value: number }
  | { type: 'concentration'; maxDuration?: Duration; repeatSave?: { frequency: 'start-of-turn' | 'end-of-turn' | 'on-damage'; whose: 'self' | 'target'; saveAbility?: AbilityType; saveDC?: number | DC; onSuccess: 'end-effect' | 'reduce-effect' | 'custom' }; saveAt?: 'start-of-turn' | 'end-of-turn' }
  | { type: 'until-save'; saveAbility: AbilityType; saveDC: number | DC; saveAt?: 'end-of-turn' | 'start-of-turn' | 'on-damage' | 'start' | 'end'; frequency?: 'end-of-turn' | 'start-of-turn' | 'on-damage' }
  | { type: 'until-escape'; escapeCheck: {
      type: 'dc' | 'contested' | 'automatic';
      timing: 'action' | 'bonus' | 'movement';
      dc?: number;
      ability?: SkillOrAbility;
      defenderSkill?: SkillType;
      escaperChoice?: SkillType[];
    }
  }
  | { type: 'until-condition'; condition: Precondition }
  | { type: 'until-dispelled' }
  | { type: 'permanent' }
  | { type: 'linked'; linkedTo: EntityRef | string; on?: EntityRef }
  | { type: 'from-source' }
  | { type: 'special'; description: string };

// Legacy damage structure for backwards compatibility
interface LegacyDamageFields {
  dice?: string;  // Legacy: damage dice string
  modifier?: number;  // Legacy: damage modifier
  damageType?: DamageType;  // Legacy: explicitly on damage object
}

// Explicit Effect type for recursive schema
export type Effect =
  | { type: 'damage'; damage: DamageRoll & LegacyDamageFields; damageType: DamageType; save?: { ability: AbilityType; dc: number; onSave?: 'none' | 'half' | 'special' }; trigger?: 'on-enter' | 'on-leave' | 'on-start-turn' | 'on-end-turn' }
  | { type: 'healing'; healing: DiceExpression }
  | { type: 'temp-hp'; amount: DiceExpression }
  | { type: 'max-hp-change'; amount: number; permanent: boolean }
  | { type: 'apply-condition'; condition: string; to?: EntityRef; source?: EntityRef; linkedTo?: EntityRef; duration?: Duration; affectsTarget?: 'self' | 'ally' | 'enemy' | 'any'; save?: { ability: AbilityType; dc: number; onSave?: 'none' | 'half' | 'special' } }
  | { type: 'remove-condition'; condition: string }
  | { type: 'remove-condition-type'; conditionType: string }
  | { type: 'push'; distance: number; direction: 'away' | 'toward' | Direction }
  | { type: 'pull'; distance: number; direction?: 'toward' | 'away' | Direction }
  | { type: 'teleport'; distance: number; destination: 'choice' | 'swap' | 'random' }
  | { type: 'prone' }
  | { type: 'grapple'; escape: DC }
  | { type: 'set-speed'; speed: number | 'half' | 'zero' }
  | { type: 'grant-advantage'; target: ModifierTarget; duration?: Duration }
  | { type: 'impose-disadvantage'; target: ModifierTarget; duration?: Duration }
  | { type: 'grant-bonus'; target: ModifierTarget; bonus: number; duration?: Duration }
  | { type: 'impose-penalty'; target: ModifierTarget; penalty: number; duration?: Duration }
  | { type: 'grant-resistance'; damageType: DamageType; duration?: Duration }
  | { type: 'grant-immunity'; damageType: DamageType; duration?: Duration }
  | { type: 'grant-vulnerability'; damageType: DamageType; duration?: Duration }
  | { type: 'restrict-movement'; restriction: MovementRestriction; relativeTo?: EntityRef; duration?: Duration }
  | { type: 'create-zone'; zone: ZoneDefinition; trigger?: 'on-enter' | 'on-leave' | 'on-start-turn' | 'on-end-turn' }
  | { type: 'end-zone'; zoneId: string }
  | { type: 'summon'; creatureRef: string; count?: number; duration?: Duration }
  | { type: 'counter'; eventType?: string }
  | { type: 'trigger-event'; eventId: string; target?: EntityRef }
  | { type: 'modify-property'; property: string; value?: any }
  | { type: 'execute-events'; events: string[]; mode: 'all' | 'choice' }
  | { type: 'modify-action-economy'; attacksPerAction: number }
  | { type: 'grant-movement'; amount: number | 'double' } // Dash-like effects
  | { type: 'all'; effects: Effect[] }
  | { type: 'choice'; effects: Effect[] }
  | { type: 'conditional'; condition: Precondition; then: Effect; else?: Effect }
  | { type: 'on-check-result'; 'critical-success'?: Effect; 'success'?: Effect; 'failure'?: Effect; 'critical-failure'?: Effect }
  | { type: 'on-event'; event: ReactionEvent; effect: Effect }
  | { type: 'scaled'; base: Effect; perLevel?: Effect }
  | { type: 'repeated'; effect: Effect; times: number | DiceExpression }
  | { type: 'none' }
  // Legacy buff/debuff effect types
  | { type: 'stat-modifier'; statModifiers: Array<{ stat: string; bonus: number }>; duration?: Duration }
  | { type: 'roll-modifier'; rollModifiers: Array<{ on: string; type: 'advantage' | 'disadvantage' }>; duration?: Duration };

// Duration schema (defined here because Effect references it)
export const durationSchema: z.ZodType<Duration> = z.lazy(() =>
  z.discriminatedUnion('type', [
    z.object({ type: z.literal('instant') }),
    z.object({
      type: z.literal('rounds'),
      value: z.number(),
      until: z.enum(['start', 'end']).optional(),
    }),
    z.object({
      type: z.literal('minutes'),
      value: z.number(),
    }),
    z.object({
      type: z.literal('hours'),
      value: z.number(),
    }),
    z.object({
      type: z.literal('concentration'),
      maxDuration: durationSchema.optional(),
      repeatSave: z.object({
        frequency: z.enum(['start-of-turn', 'end-of-turn', 'on-damage']),
        whose: z.enum(['self', 'target']),
        saveAbility: abilityTypeSchema.optional(),
        saveDC: z.union([z.number(), dcSchema]).optional(),
        onSuccess: z.enum(['end-effect', 'reduce-effect', 'custom']),
      }).optional(),
      saveAt: z.enum(['start-of-turn', 'end-of-turn']).optional(),
    }),
    z.object({
      type: z.literal('until-save'),
      saveAbility: abilityTypeSchema,
      saveDC: z.union([z.number(), dcSchema]),
      saveAt: z.enum(['end-of-turn', 'start-of-turn', 'on-damage']).optional(),
      frequency: z.enum(['end-of-turn', 'start-of-turn', 'on-damage']).optional(),
    }),
    z.object({
      type: z.literal('until-escape'),
      escapeCheck: z.object({
        type: z.enum(['dc', 'contested', 'automatic']),
        timing: z.enum(['action', 'bonus', 'movement']),
        dc: z.number().optional(),
        ability: skillOrAbilitySchema.optional(),
        defenderSkill: skillTypeSchema.optional(),
        escaperChoice: z.array(skillTypeSchema).optional(),
      }),
    }),
    z.object({
      type: z.literal('until-condition'),
      condition: preconditionSchema,
    }),
    z.object({ type: z.literal('until-dispelled') }),
    z.object({ type: z.literal('permanent') }),
    z.object({
      type: z.literal('linked'),
      linkedTo: z.union([entityRefSchema, conditionRefExtSchema]),
      on: entityRefSchema.optional(),
    }),
    z.object({ type: z.literal('from-source') }),
    z.object({
      type: z.literal('special'),
      description: z.string(),
    }),
  ])
);

// Effect schema
// eslint-disable-next-line @typescript-eslint/no-explicit-any
export const effectSchema: z.ZodType<any> = z.lazy(() =>
  z.discriminatedUnion('type', [
    // HP Effects
    z.object({
      type: z.literal('damage'),
      damage: damageRollSchema,
      damageType: damageTypeSchema,
    }),
    z.object({
      type: z.literal('healing'),
      healing: diceExpressionSchema,
    }),
    z.object({
      type: z.literal('temp-hp'),
      amount: diceExpressionSchema,
    }),
    z.object({
      type: z.literal('max-hp-change'),
      amount: z.number(),
      permanent: z.boolean(),
    }),

    // Condition Effects
    z.object({
      type: z.literal('apply-condition'),
      condition: conditionRefExtSchema,
      to: entityRefSchema.optional(),
      source: entityRefSchema.optional(),
      linkedTo: entityRefSchema.optional(),
      duration: durationSchema.optional(),
      affectsTarget: z.enum(['self', 'ally', 'enemy', 'any']).optional(),
      save: z.object({
        ability: abilityTypeSchema,
        dc: z.number(),
        onSave: z.enum(['none', 'half', 'special']).optional(),
      }).optional(),
    }),
    z.object({
      type: z.literal('remove-condition'),
      condition: conditionRefExtSchema,
    }),
    z.object({
      type: z.literal('remove-condition-type'),
      conditionType: z.string(),
    }),

    // Movement Effects
    z.object({
      type: z.literal('push'),
      distance: z.number(),
      direction: z.union([z.literal('away'), z.literal('toward'), directionSchema]),
    }),
    z.object({
      type: z.literal('pull'),
      distance: z.number(),
    }),
    z.object({
      type: z.literal('teleport'),
      distance: z.number(),
      destination: z.enum(['choice', 'swap', 'random']),
    }),
    z.object({
      type: z.literal('move-to'),
      destination: z.object({ x: z.number(), y: z.number() }),
    }),
    z.object({ type: z.literal('prone') }),
    z.object({
      type: z.literal('set-speed'),
      value: z.number(),
    }),
    z.object({ type: z.literal('block-speed-bonus') }),
    z.object({
      type: z.literal('movement-restriction'),
      restriction: movementRestrictionSchema,
      to: entityRefSchema.optional(),
    }),

    // Modifier Effects
    z.object({
      type: z.literal('grant-advantage'),
      on: modifierTargetSchema,
      to: entityRefSchema.optional(),
      condition: preconditionSchema.optional(),
      duration: durationSchema.optional(),
    }),
    z.object({
      type: z.literal('impose-disadvantage'),
      on: modifierTargetSchema,
      to: entityRefSchema.optional(),
      condition: preconditionSchema.optional(),
      duration: durationSchema.optional(),
    }),
    z.object({
      type: z.literal('grant-bonus'),
      on: modifierTargetSchema,
      bonus: z.union([z.number(), diceExpressionSchema]),
    }),
    z.object({
      type: z.literal('impose-penalty'),
      on: modifierTargetSchema,
      penalty: z.union([z.number(), diceExpressionSchema]),
    }),
    z.object({
      type: z.literal('grant-resistance'),
      damageType: damageTypeSchema,
      duration: durationSchema.optional(),
    }),
    z.object({
      type: z.literal('grant-immunity'),
      damageType: z.union([damageTypeSchema, conditionRefExtSchema]),
      duration: durationSchema.optional(),
    }),
    z.object({
      type: z.literal('grant-vulnerability'),
      damageType: damageTypeSchema,
      duration: durationSchema.optional(),
    }),

    // Resource Effects
    z.object({
      type: z.literal('consume-resource'),
      resource: resourceIdSchema,
      amount: z.number(),
    }),
    z.object({
      type: z.literal('restore-resource'),
      resource: resourceIdSchema,
      amount: z.union([z.number(), z.literal('all')]),
    }),

    // Special Effects
    z.object({
      type: z.literal('create-zone'),
      zone: zoneDefinitionSchema,
      trigger: z.enum(['on-enter', 'on-leave', 'on-start-turn', 'on-end-turn']).optional(),
    }),
    z.object({
      type: z.literal('summon'),
      creature: creatureRefSchema,
      count: z.union([z.number(), diceExpressionSchema]),
    }),
    z.object({
      type: z.literal('transform'),
      into: creatureRefSchema,
      duration: durationSchema.optional(),
    }),
    z.object({
      type: z.literal('counter'),
      targetType: z.enum(['spell', 'attack', 'ability']),
    }),
    z.object({ type: z.literal('break-concentration') }),
    z.object({ type: z.literal('end-concentration') }),
    z.object({
      type: z.literal('grant-ability'),
      ability: z.string(),
    }),
    z.object({
      type: z.literal('occupy-hand'),
      hands: z.number(),
    }),
    z.object({
      type: z.literal('tag'),
      tag: z.string(),
      value: z.any().optional(),
    }),
    z.object({
      type: z.literal('execute-events'),
      events: z.array(z.string()),
      mode: z.enum(['all', 'choice']),
    }),
    z.object({
      type: z.literal('modify-action-economy'),
      attacksPerAction: z.number(),
    }),
    z.object({
      type: z.literal('grant-movement'),
      amount: z.union([z.number(), z.literal('double')]),
    }),

    // Composition
    z.object({
      type: z.literal('all'),
      effects: z.array(effectSchema),
    }),
    z.object({
      type: z.literal('choice'),
      effects: z.array(effectSchema),
    }),
    z.object({
      type: z.literal('conditional'),
      condition: preconditionSchema,
      then: effectSchema,
      else: effectSchema.optional(),
    }),
    z.object({
      type: z.literal('on-check-result'),
      'critical-success': effectSchema.optional(),
      'success': effectSchema.optional(),
      'failure': effectSchema.optional(),
      'critical-failure': effectSchema.optional(),
    }),
    z.object({
      type: z.literal('on-event'),
      event: reactionEventSchema,
      effect: effectSchema,
    }),
    z.object({
      type: z.literal('scaled'),
      base: effectSchema,
      perLevel: effectSchema.optional(),
    }),
    z.object({
      type: z.literal('repeated'),
      effect: effectSchema,
      times: z.union([z.number(), diceExpressionSchema]),
    }),
    z.object({ type: z.literal('none') }),
  ])
);

/** Alias for backwards compatibility */
export type ActionEffect = Effect;
export type CombatEventEffect = LegacyEffect;
export const actionEffectSchema = effectSchema;

// ============================================================================
// 7. COMBATEVENT MAIN SCHEMA
// ============================================================================

export const combatEventSchema = z.object({
  id: z.string(),
  name: z.string(),
  description: z.string().optional(),

  // Core components
  precondition: preconditionSchema,
  trigger: triggerSchema,
  cost: costSchema,
  targeting: targetingSchema,
  check: checkSchema.optional(),
  effect: effectSchema,
  duration: durationSchema.optional(),

  // Metadata
  tags: z.array(z.string()).optional(),
  source: z.string().optional(),

  // Legacy fields for backwards compatibility with existing Action usage
  actionType: z.string().optional(),
  timing: z.object({
    type: z.string(),
    triggerCondition: z.object({
      event: z.string().optional(),
      condition: z.string().optional(),
    }).optional(),
  }).optional(),
  range: z.object({
    type: z.string(),
    normal: z.number().optional(),
    long: z.number().optional(),
  }).optional(),
  damage: z.object({
    dice: z.string(),
    modifier: z.number().optional(),
    type: z.string(),
  }).optional(),
  healing: z.object({
    dice: z.string(),
    modifier: z.number().optional(),
  }).optional(),
  effects: z.array(z.any()).optional(), // Legacy effects array
  extraDamage: z.array(z.object({
    dice: z.string(),
    type: z.string(),
  })).optional(),
  forcedMovement: z.object({
    type: z.string(),
    distance: z.number(),
  }).optional(),
  multiattack: z.object({
    attacks: z.array(z.object({
      actionRef: z.string(),
      orRef: z.string().optional(),
      count: z.number(),
    })),
  }).optional(),
  properties: z.array(z.string()).optional(),
  modifierRefs: z.array(z.string()).optional(),
  schemaModifiers: z.array(z.any()).optional(),
}).passthrough(); // Allow unknown fields for backwards compatibility with legacy presets

// Legacy effect format from presets (different from new schema Effect)
export interface LegacyEffect {
  // Type discriminator (optional for backwards compatibility, but allows effect-like usage)
  type?: 'damage' | 'healing' | 'apply-condition' | 'remove-condition' | 'push' | 'pull'
    | 'teleport' | 'prone' | 'grapple' | 'create-zone' | 'summon' | 'counter' | 'none'
    | 'stat-modifier' | 'roll-modifier' | string; // string for unknown types

  // Movement effects
  grantMovement?: { type: 'dash' | 'extra' | 'teleport'; value?: number };
  movementBehavior?: { noOpportunityAttacks?: boolean };

  // Condition effects
  condition?: string;
  conditionRef?: string;
  removeCondition?: string;

  // Modifier effects
  incomingModifiers?: { attacks?: 'disadvantage' | 'advantage' };
  rollModifiers?: Array<{ on: string; type: 'advantage' | 'disadvantage' }>;
  statModifiers?: Array<{ stat: string; bonus: number }>;

  // Zone effects
  zone?: { radius?: number; targetFilter?: string };

  // Common properties
  duration?: Duration;
  affectsTarget?: 'self' | 'ally' | 'enemy' | 'any';
  save?: { ability: AbilityType; dc: number; onSave?: 'none' | 'half' | 'special' };
  endingSave?: { dc: number; ability: AbilityType };

  // Damage effects (for zone damage etc.)
  damage?: { dice: string; modifier?: number; type: string };
  damageType?: DamageType;
  healing?: { dice: string; modifier?: number };

  // Allow additional properties
  [key: string]: unknown;
}

// Explicit CombatEvent type to avoid z.lazy() inference issues
// Core components are optional to support legacy preset format
export interface CombatEvent {
  id: string;
  name: string;
  description?: string;

  // Core components (optional for legacy compatibility)
  precondition?: Precondition;
  trigger?: Trigger;
  cost?: Cost;
  targeting?: Targeting;
  check?: Check;
  effect?: Effect;
  duration?: Duration;

  // Metadata
  tags?: string[];
  source?: string;

  // Legacy fields for backwards compatibility with existing Action usage
  actionType?: string;
  timing?: {
    type: string;
    triggerCondition?: {
      event?: string;
      condition?: string;
    };
  };
  range?: { type: string; normal?: number; long?: number };
  damage?: { dice: string; modifier?: number; type: string };
  healing?: { dice: string; modifier?: number };
  effects?: LegacyEffect[];
  extraDamage?: { dice: string; modifier?: number; type: string }[];
  forcedMovement?: { type: string; distance: number };
  multiattack?: { attacks: { actionRef: string; orRef?: string; count: number }[] };
  properties?: string[];
  modifierRefs?: string[];
  schemaModifiers?: SchemaModifier[];

  // Resource cost shortcuts (extracted from Cost for legacy compatibility)
  // recharge can be any of these resource types
  recharge?:
    | { type: 'recharge'; range: [number, number] }
    | { type: 'per-day'; uses: number }
    | { type: 'per-rest'; uses: number };
  spellSlot?: { level: number }; // Spell slot level required
  budgetCosts?: Array<{
    resource: string;
    cost: { type: string; value?: number };
  }>;

  // Check shortcuts (extracted from Check for legacy compatibility)
  attack?: {
    bonus?: number;
    type?: string; // 'melee-weapon', 'ranged-weapon', etc.
  };
  save?: {
    ability: AbilityType;
    dc: number;
    onSave?: 'none' | 'half' | 'special';
  };
  contested?: {
    self: string;
    target: string;
    attackerSkill?: string;
    defenderChoice?: string[];
    sizeLimit?: number;
    onSuccess?: unknown; // Legacy format
  };

  // Additional legacy fields from presets
  autoHit?: boolean;
  isSpell?: boolean;
  concentration?: boolean;
  requires?: Record<string, unknown>;
  baseAction?: {
    ref: string;
    count?: number;
    timing?: { type: string };
  };
  spellcasting?: {
    slots?: Record<string, number>;
    knownSpells?: string[];
    attackBonus?: number;
    saveDC?: number;
    pools?: Record<string, { uses: number; rechargeOn: string }>;
  };

  // Escape action meta-fields (generated by actionAvailability)
  _escapeCondition?: string;
  _escapeCheck?: {
    type: 'dc' | 'contested' | 'automatic';
    timing: 'action' | 'bonus' | 'movement';
    dc?: number;
    ability?: string;
    defenderSkill?: string;
    escaperChoice?: string[];
  };

  // Counterspell reference
  counter?: unknown;

  // Allow any additional properties for full legacy compatibility
  [key: string]: unknown;
}

// ============================================================================
// SCHEMAMODIFIER TYPES (for presets/modifiers and combat-tracking)
// ============================================================================

/** Property modifier for action modifications */
export const propertyModifierSchema = z.object({
  property: z.string().optional(), // Legacy field
  path: z.string().optional(), // Dot-notation path to property (e.g. 'attack.bonus')
  operation: z.enum(['add', 'multiply', 'set', 'min', 'max']).optional(),
  value: z.any(),
});
export type PropertyModifier = z.infer<typeof propertyModifierSchema>;

/** Schema modifier effect - what happens when a modifier is active */
export const schemaModifierEffectSchema = z.object({
  advantage: z.boolean().optional(),
  disadvantage: z.boolean().optional(),
  attackBonus: z.number().optional(),
  acBonus: z.number().optional(),
  damageBonus: z.union([z.number(), z.string()]).optional(),
  autoCrit: z.boolean().optional(),
  autoMiss: z.boolean().optional(),
  speedOverride: z.number().optional(),
  speedMultiplier: z.number().optional(),
  propertyModifiers: z.array(propertyModifierSchema).optional(),
});
export type SchemaModifierEffect = z.infer<typeof schemaModifierEffectSchema>;

/** Contextual effects - when modifier effects apply */
export const contextualEffectsSchema = z.object({
  passive: schemaModifierEffectSchema.optional(),
  whenAttacking: schemaModifierEffectSchema.optional(),
  whenDefending: schemaModifierEffectSchema.optional(),
  whenDefendingMelee: schemaModifierEffectSchema.optional(),
  whenDefendingRanged: schemaModifierEffectSchema.optional(),
});
export type ContextualEffects = z.infer<typeof contextualEffectsSchema>;

/** Condition lifecycle configuration */
export const conditionLifecycleSchema = z.object({
  linkedToSource: z.object({
    conditionId: z.string(),
    onlyIfNew: z.boolean().optional(),
    removeWhenNoTargets: z.boolean().optional(),
  }).optional(),
  onSourceDeath: z.enum(['remove-from-targets', 'persist']).optional(),
  positionSync: z.object({
    followSource: z.boolean(),
    requiresSourceCondition: z.string().optional(),
  }).optional(),
});
export type ConditionLifecycle = z.infer<typeof conditionLifecycleSchema>;

/** Schema modifier - unified modifier definition */
export const schemaModifierSchema = z.object({
  id: z.string(),
  name: z.string(),
  description: z.string(),
  condition: preconditionSchema,
  contextualEffects: contextualEffectsSchema,
  priority: z.number(),
  lifecycle: conditionLifecycleSchema.optional(),
});
export type SchemaModifier = z.infer<typeof schemaModifierSchema>;

// ============================================================================
// ADDITIONAL HELPER TYPES
// ============================================================================

/** Base action reference for multiattack */
export type BaseActionRef = string;
