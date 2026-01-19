// Ziel: Base Trigger Templates für TriggerExpression
// Siehe: docs/plans/shimmering-orbiting-hopper.md
//
// Vordefinierte Trigger-Templates die via 'ref' oder 'extends' referenziert werden können.
// Ermöglicht DRY-Definition von Actions - nur abweichende Werte überschreiben.

import type { TriggerExpression } from '../../src/types/entities/triggerExpression';

// ============================================================================
// MELEE ATTACK BASES
// ============================================================================

/** Standard melee weapon attack (5ft reach) */
export const meleeAttackBase: TriggerExpression = {
  type: 'compose',
  triggers: [
    { type: 'action-cost', actionType: 'action' },
    { type: 'reach', distance: 5 },
    { type: 'attack-roll', bonus: 0 }, // Override with actual bonus
    { type: 'instant' },
  ],
};

/** Reach weapon attack (10ft reach - Glaive, Halberd, Pike) */
export const meleeReach10Base: TriggerExpression = {
  type: 'extends',
  base: 'melee-attack-base',
  override: [{ type: 'reach', distance: 10 }],
};

/** Unarmed strike base */
export const unarmedStrikeBase: TriggerExpression = {
  type: 'compose',
  triggers: [
    { type: 'action-cost', actionType: 'action' },
    { type: 'reach', distance: 5 },
    { type: 'attack-roll', bonus: 0 },
    { type: 'instant' },
  ],
};

// ============================================================================
// RANGED ATTACK BASES
// ============================================================================

/** Standard ranged weapon attack */
export const rangedAttackBase: TriggerExpression = {
  type: 'compose',
  triggers: [
    { type: 'action-cost', actionType: 'action' },
    { type: 'ranged', normal: 80, long: 320, targetFilter: 'enemies' },
    { type: 'attack-roll', bonus: 0 },
    { type: 'instant' },
  ],
};

/** Longbow (150/600) */
export const longbowBase: TriggerExpression = {
  type: 'extends',
  base: 'ranged-attack-base',
  override: [{ type: 'ranged', normal: 150, long: 600, targetFilter: 'enemies' }],
};

/** Hand crossbow (30/120) */
export const handCrossbowBase: TriggerExpression = {
  type: 'extends',
  base: 'ranged-attack-base',
  override: [{ type: 'ranged', normal: 30, long: 120, targetFilter: 'enemies' }],
};

/** Thrown weapon (20/60 - Dagger, Handaxe) */
export const thrownWeaponBase: TriggerExpression = {
  type: 'extends',
  base: 'ranged-attack-base',
  override: [{ type: 'ranged', normal: 20, long: 60, targetFilter: 'enemies' }],
};

// ============================================================================
// SPELL ATTACK BASES
// ============================================================================

/** Ranged spell attack (Firebolt, Eldritch Blast) */
export const spellAttackBase: TriggerExpression = {
  type: 'compose',
  triggers: [
    { type: 'action-cost', actionType: 'action' },
    { type: 'spell-attack' },
    { type: 'instant' },
  ],
};

/** Melee spell attack (Shocking Grasp, Inflict Wounds) */
export const meleeSpellAttackBase: TriggerExpression = {
  type: 'compose',
  triggers: [
    { type: 'action-cost', actionType: 'action' },
    { type: 'touch' },
    { type: 'spell-attack' },
    { type: 'instant' },
  ],
};

// ============================================================================
// SAVE SPELL BASES
// ============================================================================

/** Save spell base (DEX half damage - Fireball pattern) */
export const saveSpellDexHalfBase: TriggerExpression = {
  type: 'compose',
  triggers: [
    { type: 'action-cost', actionType: 'action' },
    { type: 'save-dc', ability: 'dex', dc: 0, onSave: 'half', isSpell: true },
    { type: 'instant' },
  ],
};

/** Save spell base (WIS negate - Hold Person pattern) */
export const saveSpellWisNegateBase: TriggerExpression = {
  type: 'compose',
  triggers: [
    { type: 'action-cost', actionType: 'action' },
    { type: 'save-dc', ability: 'wis', dc: 0, onSave: 'none', isSpell: true },
    { type: 'instant' },
  ],
};

/** Save spell base (CON half - Poison pattern) */
export const saveSpellConHalfBase: TriggerExpression = {
  type: 'compose',
  triggers: [
    { type: 'action-cost', actionType: 'action' },
    { type: 'save-dc', ability: 'con', dc: 0, onSave: 'half', isSpell: true },
    { type: 'instant' },
  ],
};

// ============================================================================
// AOE BASES
// ============================================================================

/** Sphere AoE base (Fireball pattern - 20ft radius) */
export const sphereAoeBase: TriggerExpression = {
  type: 'compose',
  triggers: [
    { type: 'action-cost', actionType: 'action' },
    { type: 'sphere', radius: 20, origin: 'point', placementRange: 150 },
    { type: 'save-dc', ability: 'dex', dc: 0, onSave: 'half', isSpell: true },
    { type: 'instant' },
  ],
};

/** Cone AoE base (Burning Hands pattern - 15ft) */
export const coneAoeBase: TriggerExpression = {
  type: 'compose',
  triggers: [
    { type: 'action-cost', actionType: 'action' },
    { type: 'cone', length: 15 },
    { type: 'save-dc', ability: 'dex', dc: 0, onSave: 'half', isSpell: true },
    { type: 'instant' },
  ],
};

/** Line AoE base (Lightning Bolt pattern - 100ft x 5ft) */
export const lineAoeBase: TriggerExpression = {
  type: 'compose',
  triggers: [
    { type: 'action-cost', actionType: 'action' },
    { type: 'line', length: 100, width: 5 },
    { type: 'save-dc', ability: 'dex', dc: 0, onSave: 'half', isSpell: true },
    { type: 'instant' },
  ],
};

/** Cube AoE base (Thunderwave pattern - 15ft) */
export const cubeAoeBase: TriggerExpression = {
  type: 'compose',
  triggers: [
    { type: 'action-cost', actionType: 'action' },
    { type: 'cube', size: 15, origin: 'self' },
    { type: 'save-dc', ability: 'con', dc: 0, onSave: 'half', isSpell: true },
    { type: 'instant' },
  ],
};

// ============================================================================
// REACTION BASES
// ============================================================================

/** Opportunity Attack base */
export const opportunityAttackBase: TriggerExpression = {
  type: 'compose',
  triggers: [
    { type: 'reaction-cost', event: 'on-leaves-reach' },
    { type: 'reach', distance: 5 },
    { type: 'attack-roll', bonus: 0 }, // Inherited from chosen melee action
    { type: 'instant' },
  ],
};

/** Shield spell base (+5 AC reaction) */
export const shieldSpellBase: TriggerExpression = {
  type: 'compose',
  triggers: [
    { type: 'reaction-cost', event: 'on-attacked' },
    { type: 'self-only' },
    { type: 'auto-success' },
    { type: 'rounds', count: 1 },
    { type: 'spell-slot', level: 1 },
  ],
};

/** Counterspell base */
export const counterspellBase: TriggerExpression = {
  type: 'compose',
  triggers: [
    { type: 'reaction-cost', event: 'on-spell-cast', triggerRange: 60 },
    { type: 'ranged', normal: 60, targetFilter: 'enemies' },
    { type: 'auto-success' },
    { type: 'instant' },
    { type: 'spell-slot', level: 3 },
  ],
};

/** Hellish Rebuke base */
export const hellishRebukeBase: TriggerExpression = {
  type: 'compose',
  triggers: [
    { type: 'reaction-cost', event: 'on-damaged' },
    { type: 'ranged', normal: 60, targetFilter: 'enemies' },
    { type: 'save-dc', ability: 'dex', dc: 0, onSave: 'half', isSpell: true },
    { type: 'instant' },
    { type: 'spell-slot', level: 1 },
  ],
};

// ============================================================================
// CONCENTRATION SPELL BASES
// ============================================================================

/** Concentration spell base (10 min default) */
export const concentrationSpellBase: TriggerExpression = {
  type: 'compose',
  triggers: [
    { type: 'action-cost', actionType: 'action' },
    { type: 'auto-success' },
    { type: 'concentration', maxDuration: 10 },
  ],
};

/** Spirit Guardians base (15ft self-centered zone) */
export const spiritGuardiansBase: TriggerExpression = {
  type: 'compose',
  triggers: [
    { type: 'action-cost', actionType: 'action' },
    { type: 'sphere', radius: 15, origin: 'self' },
    { type: 'auto-success' },
    { type: 'concentration', maxDuration: 10 },
    { type: 'spell-slot', level: 3 },
  ],
};

/** Zone trigger for Spirit Guardians (on-enter + on-start-turn) */
export const spiritGuardiansZoneTrigger: TriggerExpression = {
  type: 'compose',
  triggers: [
    { type: 'on-start-turn' },
    { type: 'save-dc', ability: 'wis', dc: 0, onSave: 'half', isSpell: true },
  ],
};

// ============================================================================
// CONTESTED CHECK BASES
// ============================================================================

/** Grapple base */
export const grappleBase: TriggerExpression = {
  type: 'compose',
  triggers: [
    { type: 'action-cost', actionType: 'action' },
    { type: 'reach', distance: 5 },
    {
      type: 'contested-check',
      attackerSkill: 'athletics',
      defenderChoice: ['athletics', 'acrobatics'],
      sizeLimit: 1,
    },
    {
      type: 'until-escape',
      escapeType: 'contested',
      timing: 'action',
      defenderSkill: 'athletics',
      escaperChoice: ['athletics', 'acrobatics'],
    },
  ],
};

/** Shove base */
export const shoveBase: TriggerExpression = {
  type: 'compose',
  triggers: [
    { type: 'action-cost', actionType: 'action' },
    { type: 'reach', distance: 5 },
    {
      type: 'contested-check',
      attackerSkill: 'athletics',
      defenderChoice: ['athletics', 'acrobatics'],
      sizeLimit: 1,
    },
    { type: 'instant' },
  ],
};

// ============================================================================
// LEGENDARY/LAIR BASES
// ============================================================================

/** Legendary action base (1 cost) */
export const legendaryAction1Base: TriggerExpression = {
  type: 'compose',
  triggers: [{ type: 'legendary-cost', cost: 1 }, { type: 'instant' }],
};

/** Legendary action base (2 cost) */
export const legendaryAction2Base: TriggerExpression = {
  type: 'compose',
  triggers: [{ type: 'legendary-cost', cost: 2 }, { type: 'instant' }],
};

/** Legendary action base (3 cost) */
export const legendaryAction3Base: TriggerExpression = {
  type: 'compose',
  triggers: [{ type: 'legendary-cost', cost: 3 }, { type: 'instant' }],
};

/** Lair action base */
export const lairActionBase: TriggerExpression = {
  type: 'compose',
  triggers: [{ type: 'lair-action' }, { type: 'instant' }],
};

// ============================================================================
// RECHARGE ABILITY BASES
// ============================================================================

/** Recharge 5-6 base (Dragon Breath pattern) */
export const recharge56Base: TriggerExpression = {
  type: 'compose',
  triggers: [
    { type: 'action-cost', actionType: 'action' },
    { type: 'recharge', range: [5, 6] },
    { type: 'instant' },
  ],
};

/** Recharge 6 base */
export const recharge6Base: TriggerExpression = {
  type: 'compose',
  triggers: [
    { type: 'action-cost', actionType: 'action' },
    { type: 'recharge', range: [6, 6] },
    { type: 'instant' },
  ],
};

// ============================================================================
// PASSIVE TRAIT BASES
// ============================================================================

/** Passive trait base (always active, permanent) */
export const passiveTraitBase: TriggerExpression = {
  type: 'compose',
  triggers: [
    { type: 'passive' },
    { type: 'self-only' },
    { type: 'auto-success' },
    { type: 'permanent' },
  ],
};

/** Aura trait base (10ft radius, always active) */
export const auraTraitBase: TriggerExpression = {
  type: 'compose',
  triggers: [
    { type: 'passive' },
    { type: 'sphere', radius: 10, origin: 'self' },
    { type: 'auto-success' },
    { type: 'permanent' },
  ],
};

/** Aura trait base (30ft radius - Paladin auras at higher levels) */
export const aura30TraitBase: TriggerExpression = {
  type: 'extends',
  base: 'aura-trait-base',
  override: [{ type: 'sphere', radius: 30, origin: 'self' }],
};

// ============================================================================
// BONUS ACTION BASES
// ============================================================================

/** Bonus action attack base (Two-Weapon Fighting, Martial Arts) */
export const bonusActionAttackBase: TriggerExpression = {
  type: 'compose',
  triggers: [
    { type: 'action-cost', actionType: 'bonus' },
    { type: 'reach', distance: 5 },
    { type: 'attack-roll', bonus: 0 },
    { type: 'instant' },
  ],
};

/** Bonus action spell base (Healing Word, Misty Step) */
export const bonusActionSpellBase: TriggerExpression = {
  type: 'compose',
  triggers: [
    { type: 'action-cost', actionType: 'bonus' },
    { type: 'auto-success' },
    { type: 'instant' },
  ],
};

// ============================================================================
// MULTI-TARGET BASES
// ============================================================================

/** Multi-target spell base (Bless - up to 3 targets) */
export const multiTarget3Base: TriggerExpression = {
  type: 'compose',
  triggers: [
    { type: 'action-cost', actionType: 'action' },
    { type: 'multi-target', count: 3, range: 30, targetFilter: 'allies', sameTarget: false },
    { type: 'auto-success' },
  ],
};

/** Scorching Ray base (3 rays, can target same) */
export const scorchingRayBase: TriggerExpression = {
  type: 'compose',
  triggers: [
    { type: 'action-cost', actionType: 'action' },
    { type: 'multi-target', count: 3, range: 120, targetFilter: 'enemies', sameTarget: true },
    { type: 'spell-attack' },
    { type: 'instant' },
    { type: 'spell-slot', level: 2 },
  ],
};

// ============================================================================
// REGISTRY
// ============================================================================

/**
 * All base triggers indexed by ID for ref/extends lookup.
 */
export const baseTriggers: Record<string, TriggerExpression> = {
  // Melee
  'melee-attack-base': meleeAttackBase,
  'melee-reach-10-base': meleeReach10Base,
  'unarmed-strike-base': unarmedStrikeBase,

  // Ranged
  'ranged-attack-base': rangedAttackBase,
  'longbow-base': longbowBase,
  'hand-crossbow-base': handCrossbowBase,
  'thrown-weapon-base': thrownWeaponBase,

  // Spell Attacks
  'spell-attack-base': spellAttackBase,
  'melee-spell-attack-base': meleeSpellAttackBase,

  // Save Spells
  'save-spell-dex-half-base': saveSpellDexHalfBase,
  'save-spell-wis-negate-base': saveSpellWisNegateBase,
  'save-spell-con-half-base': saveSpellConHalfBase,

  // AoE
  'sphere-aoe-base': sphereAoeBase,
  'cone-aoe-base': coneAoeBase,
  'line-aoe-base': lineAoeBase,
  'cube-aoe-base': cubeAoeBase,

  // Reactions
  'opportunity-attack-base': opportunityAttackBase,
  'shield-spell-base': shieldSpellBase,
  'counterspell-base': counterspellBase,
  'hellish-rebuke-base': hellishRebukeBase,

  // Concentration
  'concentration-spell-base': concentrationSpellBase,
  'spirit-guardians-base': spiritGuardiansBase,
  'spirit-guardians-zone-trigger': spiritGuardiansZoneTrigger,

  // Contested Checks
  'grapple-base': grappleBase,
  'shove-base': shoveBase,

  // Legendary/Lair
  'legendary-action-1-base': legendaryAction1Base,
  'legendary-action-2-base': legendaryAction2Base,
  'legendary-action-3-base': legendaryAction3Base,
  'lair-action-base': lairActionBase,

  // Recharge
  'recharge-5-6-base': recharge56Base,
  'recharge-6-base': recharge6Base,

  // Passive/Aura
  'passive-trait-base': passiveTraitBase,
  'aura-trait-base': auraTraitBase,
  'aura-30-trait-base': aura30TraitBase,

  // Bonus Action
  'bonus-action-attack-base': bonusActionAttackBase,
  'bonus-action-spell-base': bonusActionSpellBase,

  // Multi-target
  'multi-target-3-base': multiTarget3Base,
  'scorching-ray-base': scorchingRayBase,
};

/**
 * Resolves a trigger reference to its full definition.
 * Handles 'ref' and 'extends' composition.
 */
export function resolveTrigger(trigger: TriggerExpression): TriggerExpression {
  if (trigger.type === 'ref') {
    const base = baseTriggers[trigger.triggerId];
    if (!base) {
      throw new Error(`Unknown trigger ID: ${trigger.triggerId}`);
    }
    return resolveTrigger(base);
  }

  if (trigger.type === 'extends') {
    const base = baseTriggers[trigger.base];
    if (!base) {
      throw new Error(`Unknown base trigger ID: ${trigger.base}`);
    }

    const resolvedBase = resolveTrigger(base);
    if (resolvedBase.type !== 'compose') {
      throw new Error(`Cannot extend non-compose trigger: ${trigger.base}`);
    }

    // Build new triggers array with overrides
    let newTriggers = [...resolvedBase.triggers];

    // Apply overrides (replace matching types)
    if (trigger.override) {
      for (const override of trigger.override) {
        const overrideType = override.type;
        const existingIndex = newTriggers.findIndex((t) => t.type === overrideType);
        if (existingIndex >= 0) {
          newTriggers[existingIndex] = override;
        } else {
          newTriggers.push(override);
        }
      }
    }

    // Add new triggers
    if (trigger.add) {
      newTriggers = [...newTriggers, ...trigger.add];
    }

    return {
      type: 'compose',
      triggers: newTriggers,
    };
  }

  return trigger;
}
