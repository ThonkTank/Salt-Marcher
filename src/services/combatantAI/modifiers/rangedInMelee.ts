// Ziel: Ranged in Melee Disadvantage Modifier
// Siehe: docs/services/combatantAI/actionScoring.md#situational-modifiers
//
// D&D 5e Regel (PHB p.195): Ranged attacks have disadvantage when a hostile
// creature who can see you and isn't incapacitated is within 5 feet of you.

import type { ModifierEvaluator } from '../situationalModifiers';
import { modifierRegistry } from '../situationalModifiers';
import { getDistance, isHostile } from '../combatHelpers';

/**
 * Ranged in Melee Modifier - Disadvantage fuer Ranged-Angriffe wenn
 * ein feindlicher Combatant innerhalb 5ft (1 cell) ist.
 *
 * Aktiv wenn:
 * - Action ist ein Ranged-Angriff (range.type === 'ranged')
 * - Mindestens ein feindlicher Combatant ist innerhalb 1 cell
 *
 * HACK: Ignoriert "can see you" und "isn't incapacitated" Checks - siehe Header
 */
export const rangedInMeleeModifier: ModifierEvaluator = {
  id: 'ranged-in-melee',
  name: 'Ranged in Melee',
  description: 'Ranged attack while hostile creature within 5ft',

  isActive: (ctx) => {
    // Nur fuer Ranged Actions
    if (ctx.action.range?.type !== 'ranged') return false;

    // Pruefe ob feindlicher Combatant innerhalb 1 cell (5ft)
    return ctx.state.profiles.some(p => {
      // Nicht sich selbst pruefen
      if (p.participantId === ctx.attacker.participantId) return false;

      // Nur Feinde zaehlen
      if (!isHostile(ctx.attacker.groupId, p.groupId, ctx.state.alliances)) return false;

      // TODO: Check if enemy is incapacitated (unconscious, paralyzed, etc.)
      // TODO: Check if enemy can see attacker

      // Distanz <= 1 cell = 5ft
      return getDistance(ctx.attacker.position, p.position) <= 1;
    });
  },

  getEffect: () => ({
    disadvantage: true,
  }),

  priority: 10, // Gleiche Prioritaet wie Long Range
};

// Auto-register beim Import
modifierRegistry.register(rangedInMeleeModifier);
