// Vault-persistierte Action-Definition
// Siehe: docs/types/action.md
//
// Einheitliches Schema für alle Kampf-Aktionen (Creature und Character).
// Deckt ab: Weapon-Attacks, Spell-Attacks, AoE, Buffs/Debuffs, Healing,
// Summoning, Transformation.

import { z } from 'zod';
import { validateDiceExpression } from '@/utils';
import { schemaModifierSchema } from './conditionExpression';
import { sizeSchema } from '../../constants/creature';
import {
  ACTION_TYPES,
  ACTION_SOURCES,
  DAMAGE_TYPES,
  ABILITY_TYPES,
  CONDITION_TYPES,
  DURATION_TYPES,
  ACTION_TIMING_TYPES,
  TRIGGER_EVENTS,
  RANGE_TYPES,
  AOE_SHAPES,
  AOE_ORIGINS,
  TARGETING_TYPES,
  VALID_TARGETS,
  SAVE_ON_SAVE_EFFECTS,
  ADVANTAGE_CONDITIONS,
  ADVANTAGE_STATES,
  MODIFIABLE_STATS,
  ROLL_TARGETS,
  STAT_MODIFIER_TYPES,
  ROLL_MODIFIER_TYPES,
  DAMAGE_MODIFIER_TYPES,
  MOVEMENT_MODIFIER_TYPES,
  MOVEMENT_MODES,
  GRANT_MOVEMENT_TYPES,
  FORCED_MOVEMENT_TYPES,
  FORCED_MOVEMENT_DIRECTIONS,
  AFFECTS_TARGETS,
  TERRAIN_EFFECTS,
  COUNTER_TARGETS,
  SUMMON_CONTROLS,
  TRANSFORM_TARGETS,
  HP_THRESHOLD_COMPARISONS,
  SKILL_TYPES,
  REST_TYPES,
} from '../../constants/action';

// ============================================================================
// LAYER 1: ENUM SCHEMAS
// ============================================================================

export const actionTypeSchema = z.enum(ACTION_TYPES);
export const actionSourceSchema = z.enum(ACTION_SOURCES);
export const damageTypeSchema = z.enum(DAMAGE_TYPES);
export const abilityTypeSchema = z.enum(ABILITY_TYPES);
export const conditionTypeSchema = z.enum(CONDITION_TYPES);
export const durationTypeSchema = z.enum(DURATION_TYPES);
export const actionTimingTypeSchema = z.enum(ACTION_TIMING_TYPES);
export const triggerEventSchema = z.enum(TRIGGER_EVENTS);
export const rangeTypeSchema = z.enum(RANGE_TYPES);
export const aoeShapeSchema = z.enum(AOE_SHAPES);
export const aoeOriginSchema = z.enum(AOE_ORIGINS);
export const targetingTypeSchema = z.enum(TARGETING_TYPES);
export const validTargetsSchema = z.enum(VALID_TARGETS);
export const saveOnSaveEffectSchema = z.enum(SAVE_ON_SAVE_EFFECTS);
export const advantageConditionSchema = z.enum(ADVANTAGE_CONDITIONS);
export const modifiableStatSchema = z.enum(MODIFIABLE_STATS);
export const rollTargetSchema = z.enum(ROLL_TARGETS);
export const statModifierTypeSchema = z.enum(STAT_MODIFIER_TYPES);
export const rollModifierTypeSchema = z.enum(ROLL_MODIFIER_TYPES);
export const damageModifierTypeSchema = z.enum(DAMAGE_MODIFIER_TYPES);
export const movementModifierTypeSchema = z.enum(MOVEMENT_MODIFIER_TYPES);
export const movementModeSchema = z.enum(MOVEMENT_MODES);
export const grantMovementTypeSchema = z.enum(GRANT_MOVEMENT_TYPES);
export const advantageStateSchema = z.enum(ADVANTAGE_STATES);
export const forcedMovementTypeSchema = z.enum(FORCED_MOVEMENT_TYPES);
export const forcedMovementDirectionSchema = z.enum(FORCED_MOVEMENT_DIRECTIONS);
export const affectsTargetSchema = z.enum(AFFECTS_TARGETS);
export const terrainEffectSchema = z.enum(TERRAIN_EFFECTS);
export const counterTargetSchema = z.enum(COUNTER_TARGETS);
export const summonControlSchema = z.enum(SUMMON_CONTROLS);
export const transformTargetSchema = z.enum(TRANSFORM_TARGETS);
export const hpThresholdComparisonSchema = z.enum(HP_THRESHOLD_COMPARISONS);
export const skillTypeSchema = z.enum(SKILL_TYPES);
export const restTypeSchema = z.enum(REST_TYPES);

// ============================================================================
// LAYER 2: SIMPLE SUB-SCHEMAS
// ============================================================================

/** Reichweite einer Aktion */
export const actionRangeSchema = z.object({
  type: rangeTypeSchema,
  normal: z.number().min(0),
  long: z.number().min(0).optional(),
});
export type ActionRange = z.infer<typeof actionRangeSchema>;

/** Area of Effect Definition */
export const aoeSchema = z.object({
  shape: aoeShapeSchema,
  size: z.number().positive(),
  width: z.number().positive().optional(),
  height: z.number().positive().optional(),
  origin: aoeOriginSchema,
});
export type Aoe = z.infer<typeof aoeSchema>;

/** Schadens-Definition */
export const actionDamageSchema = z.object({
  dice: z.string().refine(validateDiceExpression, { message: 'Invalid dice expression' }),
  modifier: z.number(),
  type: damageTypeSchema,
  versatileDice: z.string().refine(validateDiceExpression, { message: 'Invalid dice expression' }).optional(),
  scalingDice: z.string().refine(validateDiceExpression, { message: 'Invalid dice expression' }).optional(),
});
export type ActionDamage = z.infer<typeof actionDamageSchema>;

/** Angriffswurf */
export const attackRollSchema = z.object({
  bonus: z.number(),
  advantage: advantageConditionSchema.optional(),
});
export type AttackRoll = z.infer<typeof attackRollSchema>;

/** Rettungswurf-DC */
export const saveDCSchema = z.object({
  ability: abilityTypeSchema,
  dc: z.number().int().min(1),
  onSave: saveOnSaveEffectSchema,
});
export type SaveDC = z.infer<typeof saveDCSchema>;

/** Escape-Timing für Condition-Beendigung */
export const escapeTimingSchema = z.enum(['action', 'bonus', 'movement']);
export type EscapeTiming = z.infer<typeof escapeTimingSchema>;

/**
 * Escape-Check Definition für Conditions mit 'until-escape' Duration.
 * Discriminated Union für verschiedene Escape-Mechanismen (D&D 5e RAW).
 */
export const escapeCheckSchema = z.discriminatedUnion('type', [
  // Contested Check (Grapple): Athletics vs Athletics/Acrobatics
  z.object({
    type: z.literal('contested'),
    timing: escapeTimingSchema,
    defenderSkill: skillTypeSchema,  // Skill des Grapplers (z.B. athletics)
    escaperChoice: z.array(skillTypeSchema),  // Optionen für den Gefangenen
  }),
  // Simple DC Check (Net, Web): Strength DC
  z.object({
    type: z.literal('dc'),
    timing: escapeTimingSchema,
    dc: z.number().int().positive(),
    ability: abilityTypeSchema,
  }),
  // Automatic (Prone): Kostet nur Movement, kein Check
  z.object({
    type: z.literal('automatic'),
    timing: escapeTimingSchema,
    movementCost: z.number().min(0).max(1).optional(),  // 0.5 = "half movement"
  }),
]);
export type EscapeCheck = z.infer<typeof escapeCheckSchema>;

/** Timing für Save-basierte Condition-Beendigung */
export const saveTimingSchema = z.enum(['start', 'end']);
export type SaveTiming = z.infer<typeof saveTimingSchema>;

/** Dauer eines Effekts */
export const durationSchema = z.object({
  type: durationTypeSchema,
  value: z.number().positive().optional(),
  escapeCheck: escapeCheckSchema.optional(),  // Für until-escape: Wie kann man entkommen?
  saveAt: saveTimingSchema.optional(),  // Für until-save: Wann wird gesaved? (start/end of turn)
  saveDC: z.number().int().positive().optional(),  // DC für den Save (überschreibt Action.save.dc)
  saveAbility: abilityTypeSchema.optional(),  // Ability für den Save (überschreibt Action.save.ability)
});
export type Duration = z.infer<typeof durationSchema>;

/** Heilung */
export const healingSchema = z.object({
  dice: z.string().refine(validateDiceExpression, { message: 'Invalid dice expression' }),
  modifier: z.number(),
});
export type Healing = z.infer<typeof healingSchema>;

/** Auslöser-Bedingung für Reaktionen */
export const triggerConditionSchema = z.object({
  event: triggerEventSchema,
  filter: z.string().optional(),
});
export type TriggerCondition = z.infer<typeof triggerConditionSchema>;

// ============================================================================
// LAYER 3: MEDIUM COMPLEXITY SUB-SCHEMAS
// ============================================================================

/** Stat-Modifikator */
export const statModifierSchema = z.object({
  stat: modifiableStatSchema,
  value: z.number(),
  dice: z.string().refine(validateDiceExpression, { message: 'Invalid dice expression' }).optional(),
  type: statModifierTypeSchema,
});
export type StatModifier = z.infer<typeof statModifierSchema>;

/** Wurf-Modifikator */
export const rollModifierSchema = z.object({
  on: rollTargetSchema,
  type: rollModifierTypeSchema,
  against: z.string().optional(),
});
export type RollModifier = z.infer<typeof rollModifierSchema>;

/** Schadensmodifikator (Resistenz/Immunität/Vulnerabilität) */
export const damageModifierSchema = z.object({
  type: damageModifierTypeSchema,
  damageTypes: z.array(damageTypeSchema),
});
export type DamageModifier = z.infer<typeof damageModifierSchema>;

/** Bewegungsmodifikator */
export const movementModifierSchema = z.object({
  type: movementModifierTypeSchema,
  value: z.number(),
  mode: movementModeSchema,
});
export type MovementModifier = z.infer<typeof movementModifierSchema>;

// ============================================================================
// BUDGET COSTS (Movement, Action, Bonus Action, Reaction)
// ============================================================================

/** Budget-Ressourcen die eine Action verbrauchen kann */
export const BUDGET_RESOURCES = ['movement', 'action', 'bonusAction', 'reaction'] as const;
export type BudgetResource = (typeof BUDGET_RESOURCES)[number];

/** Kosten-Typ: fixed, toTarget, oder all */
export const budgetCostTypeSchema = z.discriminatedUnion('type', [
  z.object({
    type: z.literal('fixed'),
    value: z.number().int().min(0),  // Fester Wert (z.B. 1 für Action, Cells für Movement)
  }),
  z.object({
    type: z.literal('toTarget'),     // Distanz zu targetCell (für Movement-Actions)
  }),
  z.object({
    type: z.literal('all'),          // Verbraucht gesamtes Budget (z.B. Steady Aim)
  }),
]);
export type BudgetCostType = z.infer<typeof budgetCostTypeSchema>;

/** Einzelne Ressourcen-Kosten */
export const resourceCostSchema = z.object({
  resource: z.enum(BUDGET_RESOURCES),
  cost: budgetCostTypeSchema,
});
export type ResourceCost = z.infer<typeof resourceCostSchema>;

/** Erzwungene Bewegung */
export const forcedMovementSchema = z.object({
  type: forcedMovementTypeSchema,
  distance: z.number().min(0),
  direction: forcedMovementDirectionSchema.optional(),
  save: saveDCSchema.optional(),
});
export type ForcedMovement = z.infer<typeof forcedMovementSchema>;

/** Zauberplatz */
export const spellSlotSchema = z.object({
  level: z.number().int().min(1).max(9),
  upcastDice: z.string().refine(validateDiceExpression, { message: 'Invalid dice expression' }).optional(),
  upcastEffect: z.string().optional(),
});
export type SpellSlot = z.infer<typeof spellSlotSchema>;

/** Zauberkomponenten */
export const spellComponentsSchema = z.object({
  verbal: z.boolean(),
  somatic: z.boolean(),
  material: z.string().optional(),
  materialCost: z.number().optional(),
  consumed: z.boolean().optional(),
});
export type SpellComponents = z.infer<typeof spellComponentsSchema>;

/** Kritische Treffer */
export const criticalSchema = z.object({
  range: z.tuple([z.number().int().min(1).max(20), z.number().int().min(1).max(20)]),
  autoCrit: z.string().optional(),
  bonusDice: z.string().refine(validateDiceExpression, { message: 'Invalid dice expression' }).optional(),
});
export type Critical = z.infer<typeof criticalSchema>;

/** Multi-Angriff Referenz */
export const multiattackEntrySchema = z.object({
  actionRef: z.string().min(1),
  count: z.number().int().positive(),
});
export type MultiattackEntry = z.infer<typeof multiattackEntrySchema>;

/** Multi-Angriff */
export const multiattackSchema = z.object({
  attacks: z.array(multiattackEntrySchema).min(1),
  description: z.string().optional(),
});
export type Multiattack = z.infer<typeof multiattackSchema>;

/** Counter-Check */
export const counterCheckSchema = z.object({
  ability: abilityTypeSchema,
  dc: z.union([z.number().int().min(1), z.literal('spell-level')]),
});
export type CounterCheck = z.infer<typeof counterCheckSchema>;

/** Movement-Gewährung (für Dash, Expeditious Retreat, etc.) */
export const grantMovementSchema = z.object({
  type: grantMovementTypeSchema,  // 'dash' = base speed, 'extra' = fixed value
  value: z.number().positive().optional(),  // Nur für 'extra'
});
export type GrantMovement = z.infer<typeof grantMovementSchema>;

/** Bewegungsverhalten-Modifikator (für Disengage, Freedom of Movement, etc.) */
export const movementBehaviorSchema = z.object({
  noOpportunityAttacks: z.boolean().optional(),
  ignoresDifficultTerrain: z.boolean().optional(),
});
export type MovementBehavior = z.infer<typeof movementBehaviorSchema>;

/** Voraussetzung für Bonus Actions (TWF, Flurry) */
export const actionRequirementSchema = z.object({
  actionType: z.array(actionTypeSchema).optional(),  // z.B. ['melee-weapon']
  properties: z.array(z.string()).optional(),        // z.B. ['light']
  sameTarget: z.boolean().optional(),                // Gleiches Target? (für zukünftige Features)
});
export type ActionRequirement = z.infer<typeof actionRequirementSchema>;

/** Action-Voraussetzungen (z.B. TWF erfordert vorherigen Light-Melee-Attack) */
export const actionRequiresSchema = z.object({
  priorAction: actionRequirementSchema.optional(),
  // NEU: Verfügbarkeitsprüfung - hat der Combatant eine passende Action?
  // Für OA: { hasAction: { actionType: ['melee-weapon'] } }
  hasAction: actionRequirementSchema.optional(),
});
export type ActionRequires = z.infer<typeof actionRequiresSchema>;

/** Basis-Action Selektion (für OA: inherit beste Melee-Action Stats) */
export const BASE_ACTION_SELECT_MODES = ['best-damage', 'best-attack', 'first'] as const;
export type BaseActionSelectMode = (typeof BASE_ACTION_SELECT_MODES)[number];

export const BASE_ACTION_USAGE_MODES = ['inherit'] as const;
export type BaseActionUsageMode = (typeof BASE_ACTION_USAGE_MODES)[number];

/** Referenz auf eine Basis-Action deren Stats übernommen werden */
export const baseActionRefSchema = z.object({
  // Selektion: Welche Action(s) kommen in Frage?
  actionType: z.array(actionTypeSchema).optional(),
  properties: z.array(z.string()).optional(),
  // Auswahl bei mehreren Matches
  select: z.enum(BASE_ACTION_SELECT_MODES).default('best-damage'),
  // Verwendungsart: 'inherit' = übernimm attack/damage/properties
  usage: z.enum(BASE_ACTION_USAGE_MODES).default('inherit'),
});
export type BaseActionRef = z.infer<typeof baseActionRefSchema>;

/** Eingehende Angriffs-Modifikatoren (für Dodge, Blur, etc.) */
export const incomingModifiersSchema = z.object({
  attacks: advantageStateSchema.optional(),  // 'advantage' | 'disadvantage'
  spells: advantageStateSchema.optional(),
});
export type IncomingModifiers = z.infer<typeof incomingModifiersSchema>;

// ============================================================================
// LAYER 4: COMPLEX SUB-SCHEMAS
// ============================================================================

/** Zielauswahl */
export const targetingSchema = z.object({
  type: targetingTypeSchema,
  validTargets: validTargetsSchema,
  count: z.number().int().positive().optional(),
  aoe: aoeSchema.optional(),
  friendlyFire: z.boolean().optional(),
});
export type Targeting = z.infer<typeof targetingSchema>;

/** Aktions-Timing */
export const actionTimingSchema = z.object({
  type: actionTimingTypeSchema,
  trigger: z.string().optional(),
  triggerCondition: triggerConditionSchema.optional(),
});
export type ActionTiming = z.infer<typeof actionTimingSchema>;

/** Aktions-Effekt */
export const actionEffectSchema = z.object({
  condition: conditionTypeSchema.optional(),
  statModifiers: z.array(statModifierSchema).optional(),
  rollModifiers: z.array(rollModifierSchema).optional(),
  damageModifiers: z.array(damageModifierSchema).optional(),
  movementModifiers: z.array(movementModifierSchema).optional(),
  // Standard-Action Effects (Dash, Disengage, Dodge, etc.)
  grantMovement: grantMovementSchema.optional(),
  movementBehavior: movementBehaviorSchema.optional(),
  incomingModifiers: incomingModifiersSchema.optional(),
  // HP & Duration
  tempHp: healingSchema.optional(),
  duration: durationSchema.optional(),
  endingSave: saveDCSchema.optional(),
  affectsTarget: affectsTargetSchema,
  terrain: terrainEffectSchema.optional(),
  description: z.string().optional(),
  // Size-Limit: Effekt gilt nur für Targets dieser Größe oder kleiner
  // Beispiel: Wolf Bite → Prone nur bei Medium oder kleiner
  targetSizeMax: sizeSchema.optional(),
});
export type ActionEffect = z.infer<typeof actionEffectSchema>;

/** Vergleichender Wurf */
export const contestedCheckSchema = z.object({
  attackerSkill: skillTypeSchema,
  defenderChoice: z.array(skillTypeSchema),
  onSuccess: actionEffectSchema,
  sizeLimit: z.number().int().optional(),
});
export type ContestedCheck = z.infer<typeof contestedCheckSchema>;

/** HP-Schwellwert-Effekt */
export const hpThresholdSchema = z.object({
  threshold: z.number().int(),
  comparison: hpThresholdComparisonSchema,
  effect: actionEffectSchema,
  failEffect: actionEffectSchema.optional(),
});
export type HpThreshold = z.infer<typeof hpThresholdSchema>;

/** Beschwörung */
export const summonSchema = z.object({
  creatureType: z.string().min(1),
  crLimit: z.number().optional(),
  count: z.union([
    z.object({ dice: z.string().refine(validateDiceExpression, { message: 'Invalid dice expression' }) }),
    z.number().int().positive(),
  ]).optional(),
  duration: durationSchema,
  control: summonControlSchema,
  statBlock: z.string().optional(),
});
export type Summon = z.infer<typeof summonSchema>;

/** Verwandlung */
export const transformSchema = z.object({
  into: transformTargetSchema,
  crLimit: z.number().optional(),
  specificForm: z.string().optional(),
  duration: durationSchema,
  retainMind: z.boolean(),
  retainHp: z.boolean(),
});
export type Transform = z.infer<typeof transformSchema>;

/** Aufhebung */
export const counterSchema = z.object({
  counters: counterTargetSchema,
  autoSuccess: z.boolean().optional(),
  check: counterCheckSchema.optional(),
});
export type Counter = z.infer<typeof counterSchema>;

// ============================================================================
// RECHARGE (Discriminated Union)
// ============================================================================

const rechargeAtWillSchema = z.object({
  type: z.literal('at-will'),
});

const rechargeRechargeSchema = z.object({
  type: z.literal('recharge'),
  range: z.tuple([z.number().int().min(1).max(6), z.number().int().min(1).max(6)]),
});

const rechargePerDaySchema = z.object({
  type: z.literal('per-day'),
  uses: z.number().int().positive(),
});

const rechargePerRestSchema = z.object({
  type: z.literal('per-rest'),
  uses: z.number().int().positive(),
  rest: z.enum(REST_TYPES),
});

const rechargeLegendarySchema = z.object({
  type: z.literal('legendary'),
  cost: z.number().int().positive(),
});

const rechargeLairSchema = z.object({
  type: z.literal('lair'),
});

const rechargeMythicSchema = z.object({
  type: z.literal('mythic'),
});

export const actionRechargeSchema = z.discriminatedUnion('type', [
  rechargeAtWillSchema,
  rechargeRechargeSchema,
  rechargePerDaySchema,
  rechargePerRestSchema,
  rechargeLegendarySchema,
  rechargeLairSchema,
  rechargeMythicSchema,
]);
export type ActionRecharge = z.infer<typeof actionRechargeSchema>;

// ============================================================================
// LAYER 5: MAIN ACTION SCHEMA
// ============================================================================

/** Vollständiges Action-Schema mit Invarianten-Validierung */
export const actionSchema = z.object({
  id: z.string().min(1),
  name: z.string().min(1),
  actionType: actionTypeSchema,
  timing: actionTimingSchema,
  range: actionRangeSchema,
  targeting: targetingSchema,

  // Resolution: Genau einer dieser vier muss gesetzt sein
  attack: attackRollSchema.optional(),
  save: saveDCSchema.optional(),
  contested: contestedCheckSchema.optional(),
  autoHit: z.boolean().optional(),

  // Damage & Healing
  damage: actionDamageSchema.optional(),
  extraDamage: z.array(actionDamageSchema).optional(),
  healing: healingSchema.optional(),

  // Effects
  effects: z.array(actionEffectSchema).optional(),
  forcedMovement: forcedMovementSchema.optional(),

  // Special Action Types
  multiattack: multiattackSchema.optional(),
  summon: summonSchema.optional(),
  transform: transformSchema.optional(),
  counter: counterSchema.optional(),

  // Critical
  critical: criticalSchema.optional(),
  hpThreshold: hpThresholdSchema.optional(),

  // Resource Management
  recharge: actionRechargeSchema.optional(),
  spellSlot: spellSlotSchema.optional(),
  components: spellComponentsSchema.optional(),
  concentration: z.boolean().optional(),

  // Budget Costs (Movement, Action, Bonus Action, Reaction verbrauch)
  // Beispiel Move: [{ resource: 'movement', cost: { type: 'toTarget' } }]
  // Beispiel Steady Aim: [{ resource: 'movement', cost: { type: 'all' } }]
  budgetCosts: z.array(resourceCostSchema).optional(),

  // Metadata
  description: z.string().optional(),
  properties: z.array(z.string()).optional(),
  source: actionSourceSchema.optional(),

  // Bonus Action Requirements (TWF, Flurry, etc.)
  requires: actionRequiresSchema.optional(),

  // Basis-Action Referenz (für OA: inherit Stats von bester Melee-Action)
  // Wird bei Execution aufgelöst - attack/damage/properties von Basis übernommen
  baseAction: baseActionRefSchema.optional(),

  // Schema-driven Modifiers (replaces hardcoded ModifierEvaluators)
  // Allows defining creature traits, spell effects, item properties via schema
  schemaModifiers: z.array(schemaModifierSchema).optional(),

  // ID-Referenzen auf Modifier-Presets (Alternative zu inline schemaModifiers)
  // z.B. ['long-range', 'pack-tactics'] referenziert presets/modifiers/
  modifierRefs: z.array(z.string().min(1)).optional(),

  // Meta-Felder für dynamisch generierte Escape-Actions
  // Diese werden NICHT in Presets definiert, sondern zur Laufzeit von
  // getEscapeActionsForCombatant() generiert
  _escapeCondition: z.string().optional(),
  _escapeCheck: escapeCheckSchema.optional(),
}).superRefine((data, ctx) => {
  // Invariante 1: Resolution-Mechanik Validierung
  // Erlaubt:
  // - attack (pure attack)
  // - save (save-only spell wie Fireball)
  // - contested (grapple etc.)
  // - autoHit (Magic Missile etc.)
  // - attack + save (attack mit sekundärem Save-Effect, z.B. Wolf Bite)
  // Verboten:
  // - contested + attack/save (contested ist eigenständig)
  // - autoHit + attack/save (autoHit ist eigenständig)
  // - Keine Resolution bei non-passive Actions
  // Ausnahmen:
  // - passive Actions (Traits) brauchen keine Resolution
  // - baseAction.usage='inherit' Actions erben Stats zur Laufzeit
  const isPassive = data.timing?.type === 'passive';
  const inheritsFromBase = data.baseAction?.usage === 'inherit';

  const hasAttack = data.attack !== undefined;
  const hasSave = data.save !== undefined;
  const hasContested = data.contested !== undefined;
  const hasAutoHit = data.autoHit === true;

  // Contested und autoHit sind eigenständig - dürfen nicht kombiniert werden
  if (hasContested && (hasAttack || hasSave || hasAutoHit)) {
    ctx.addIssue({
      code: z.ZodIssueCode.custom,
      message: 'contested cannot be combined with attack, save, or autoHit',
      path: [],
    });
  }

  if (hasAutoHit && (hasAttack || hasSave || hasContested)) {
    ctx.addIssue({
      code: z.ZodIssueCode.custom,
      message: 'autoHit cannot be combined with attack, save, or contested',
      path: [],
    });
  }

  // Mindestens eine Resolution-Mechanik muss gesetzt sein (außer passive/inherit)
  const hasAnyResolution = hasAttack || hasSave || hasContested || hasAutoHit;
  if (!isPassive && !inheritsFromBase && !hasAnyResolution) {
    ctx.addIssue({
      code: z.ZodIssueCode.custom,
      message: 'At least one of attack, save, contested, or autoHit must be set (except for passive timing or baseAction inherit)',
      path: [],
    });
  }

  // Invariante 2: AoE-Typ erfordert targeting.aoe
  if (data.actionType === 'aoe' && !data.targeting?.aoe) {
    ctx.addIssue({
      code: z.ZodIssueCode.custom,
      message: 'Action type "aoe" requires targeting.aoe to be set',
      path: ['targeting', 'aoe'],
    });
  }

  // Invariante 3: Multiattack-Typ erfordert multiattack-Feld
  if (data.actionType === 'multiattack' && !data.multiattack) {
    ctx.addIssue({
      code: z.ZodIssueCode.custom,
      message: 'Action type "multiattack" requires multiattack field to be set',
      path: ['multiattack'],
    });
  }

  // Invariante 4: Concentration erfordert duration type 'concentration' in mindestens einem Effekt
  if (data.concentration === true) {
    const hasConcentrationDuration = data.effects?.some(
      (effect) => effect.duration?.type === 'concentration'
    );
    if (!hasConcentrationDuration) {
      ctx.addIssue({
        code: z.ZodIssueCode.custom,
        message: 'concentration: true requires at least one effect with duration.type = "concentration"',
        path: ['concentration'],
      });
    }
  }
});

export type Action = z.infer<typeof actionSchema>;
