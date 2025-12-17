/**
 * Combat schema definitions.
 *
 * CombatState manages initiative tracking, HP, conditions, and effects
 * during active combat encounters.
 *
 * @see docs/features/Combat-System.md
 */

import { z } from 'zod';
import { entityIdSchema } from './common';

// ============================================================================
// Ability Keys (for saves)
// ============================================================================

/**
 * Ability score keys for saving throws.
 */
export const abilityKeySchema = z.enum(['str', 'dex', 'con', 'int', 'wis', 'cha']);

export type AbilityKey = z.infer<typeof abilityKeySchema>;

// ============================================================================
// Conditions (D&D 5e Standard)
// ============================================================================

/**
 * D&D 5e standard condition types.
 */
export const conditionTypeSchema = z.enum([
  'blinded',
  'charmed',
  'deafened',
  'frightened',
  'grappled',
  'incapacitated',
  'invisible',
  'paralyzed',
  'petrified',
  'poisoned',
  'prone',
  'restrained',
  'stunned',
  'unconscious',
  'exhaustion',
]);

export type ConditionType = z.infer<typeof conditionTypeSchema>;

/**
 * Condition reminder text for each D&D 5e condition.
 */
export const CONDITION_REMINDERS: Record<ConditionType, string> = {
  blinded: "Can't see. Attack rolls have disadvantage. Attacks against have advantage.",
  charmed: "Can't attack charmer. Charmer has advantage on social checks.",
  deafened: "Can't hear. Auto-fail hearing-based checks.",
  frightened: "Disadvantage on checks/attacks while source visible. Can't move closer.",
  grappled: 'Speed becomes 0. Ends if grappler incapacitated or forced apart.',
  incapacitated: "Can't take actions or reactions.",
  invisible: "Can't be seen. Attack rolls have advantage. Attacks against have disadvantage.",
  paralyzed: 'Incapacitated. Auto-fail STR/DEX saves. Attacks have advantage, auto-crit within 5ft.',
  petrified: 'Turned to stone. Resistant to all damage. Auto-fail STR/DEX saves.',
  poisoned: 'Disadvantage on attack rolls and ability checks.',
  prone: 'Disadvantage on attacks. Melee attacks have advantage, ranged disadvantage.',
  restrained: 'Speed 0. Attack rolls have disadvantage. DEX saves have disadvantage.',
  stunned: "Incapacitated. Can't move. Auto-fail STR/DEX saves.",
  unconscious:
    'Incapacitated, drops items, falls prone. Auto-fail STR/DEX saves. Auto-crit within 5ft.',
  exhaustion: 'Levels 1-6 with cumulative effects. Level 6 = death.',
};

/**
 * Condition instance applied to a participant.
 */
export const conditionSchema = z.object({
  /** Condition type */
  type: conditionTypeSchema,

  /** Who caused this condition (participant ID) */
  sourceId: z.string().optional(),

  /** Remaining duration in rounds (undefined = permanent until removed) */
  duration: z.number().int().positive().optional(),

  /** Reminder text for GM */
  reminder: z.string(),
});

export type Condition = z.infer<typeof conditionSchema>;

// ============================================================================
// Combat Effects (Start/End-of-Turn)
// ============================================================================

/**
 * When the effect triggers.
 */
export const effectTriggerSchema = z.enum(['start-of-turn', 'end-of-turn']);

export type EffectTrigger = z.infer<typeof effectTriggerSchema>;

/**
 * Effect type categories.
 */
export const effectTypeSchema = z.enum(['damage', 'save', 'condition-end', 'custom']);

export type EffectType = z.infer<typeof effectTypeSchema>;

/**
 * Save effect details (for save-based effects).
 */
export const saveEffectSchema = z.object({
  ability: abilityKeySchema,
  dc: z.number().int().positive(),
  onSuccess: z.enum(['end', 'half-damage']),
});

export type SaveEffect = z.infer<typeof saveEffectSchema>;

/**
 * Damage effect details (for damage-based effects).
 */
export const damageEffectSchema = z.object({
  dice: z.string(), // e.g., "2d4"
  type: z.string(), // e.g., "acid", "fire"
});

export type DamageEffect = z.infer<typeof damageEffectSchema>;

/**
 * Effect details union.
 */
export const effectDetailsSchema = z.object({
  type: effectTypeSchema,
  damage: damageEffectSchema.optional(),
  save: saveEffectSchema.optional(),
  description: z.string(),
});

export type EffectDetails = z.infer<typeof effectDetailsSchema>;

/**
 * Combat effect that triggers at start or end of turn.
 */
export const combatEffectSchema = z.object({
  /** Unique effect ID */
  id: z.string().min(1),

  /** Effect name (e.g., "Tasha's Caustic Brew") */
  name: z.string().min(1),

  /** Target participant ID */
  targetId: z.string().min(1),

  /** When this effect triggers */
  trigger: effectTriggerSchema,

  /** Effect details */
  effect: effectDetailsSchema,

  /** Remaining duration in rounds */
  duration: z.number().int().positive().optional(),

  /** Who caused this effect (participant ID) */
  sourceId: z.string().optional(),
});

export type CombatEffect = z.infer<typeof combatEffectSchema>;

// ============================================================================
// Combat Participants
// ============================================================================

/**
 * Participant type: character (PC) or creature (NPC/monster).
 */
export const participantTypeSchema = z.enum(['character', 'creature']);

export type ParticipantType = z.infer<typeof participantTypeSchema>;

/**
 * Combat participant (PC or creature).
 */
export const combatParticipantSchema = z.object({
  /** Unique participant ID */
  id: z.string().min(1),

  /** Participant type */
  type: participantTypeSchema,

  /** Reference to entity (character or creature instance ID) */
  entityId: z.string().min(1),

  /** Display name */
  name: z.string().min(1),

  /** Initiative value (entered by GM) */
  initiative: z.number(),

  // === HP Tracking ===

  /** Maximum hit points */
  maxHp: z.number().int().positive(),

  /** Current hit points */
  currentHp: z.number().int(),

  // === Status ===

  /** Active conditions */
  conditions: z.array(conditionSchema).default([]),

  /** Active effects (start/end-of-turn) */
  effects: z.array(combatEffectSchema).default([]),

  /** Spell being concentrated on (if any) */
  concentratingOn: z.string().optional(),

  /** Challenge Rating (only for creatures, used for XP calculation) */
  cr: z.number().optional(),
});

export type CombatParticipant = z.infer<typeof combatParticipantSchema>;

// ============================================================================
// Combat State
// ============================================================================

/**
 * Combat status.
 */
export const combatStatusSchema = z.enum(['idle', 'active']);

export type CombatStatus = z.infer<typeof combatStatusSchema>;

/**
 * Combat outcome when combat ends.
 */
export const combatOutcomeSchema = z.enum(['victory', 'defeat', 'fled', 'negotiated']);

export type CombatOutcome = z.infer<typeof combatOutcomeSchema>;

/**
 * Main combat state.
 */
export const combatStateSchema = z.object({
  /** Combat status */
  status: combatStatusSchema,

  /** Associated encounter ID (if from encounter) */
  encounterId: entityIdSchema('encounter').optional(),

  /** All combat participants */
  participants: z.array(combatParticipantSchema).default([]),

  /** Sorted participant IDs by initiative */
  initiativeOrder: z.array(z.string()).default([]),

  /** Current turn index in initiativeOrder */
  currentTurnIndex: z.number().int().nonnegative().default(0),

  /** Current round number */
  roundNumber: z.number().int().positive().default(1),
});

export type CombatState = z.infer<typeof combatStateSchema>;

// ============================================================================
// Constants
// ============================================================================

/**
 * Seconds per combat round (D&D 5e).
 */
export const SECONDS_PER_ROUND = 6;

/**
 * Creates initial idle combat state.
 */
export function createInitialCombatState(): CombatState {
  return {
    status: 'idle',
    participants: [],
    initiativeOrder: [],
    currentTurnIndex: 0,
    roundNumber: 1,
  };
}

/**
 * Create a condition with default reminder text.
 */
export function createCondition(
  type: ConditionType,
  options?: {
    sourceId?: string;
    duration?: number;
    customReminder?: string;
  }
): Condition {
  return {
    type,
    sourceId: options?.sourceId,
    duration: options?.duration,
    reminder: options?.customReminder ?? CONDITION_REMINDERS[type],
  };
}
