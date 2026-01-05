// Ziel: Prone Target Modifier - Advantage/Disadvantage basierend auf Distanz
// Siehe: docs/services/combatSimulator/actionScoring.md#situational-modifiers
//
// D&D 5e SRD Zeile 14456:
// "An attack roll against you has Advantage if the attacker is within 5 feet
//  of you. Otherwise, that attack roll has Disadvantage."
//
// WICHTIG: Rein Distanz-basiert, NICHT melee vs ranged!

import type { ModifierEvaluator } from '../situationalModifiers';
import { modifierRegistry } from '../situationalModifiers';
import { getDistance } from '@/utils';

/**
 * Prone Target Modifier
 *
 * Aktiv wenn: Target hat die Condition 'prone'
 * Effekt:
 * - Attacker ≤5ft (1 Cell) → Advantage
 * - Attacker >5ft → Disadvantage
 */
export const proneTargetModifier: ModifierEvaluator = {
  id: 'prone-target',
  name: 'Prone Target',
  description: 'Advantage if attacker within 5ft, disadvantage otherwise',

  isActive: (ctx) => {
    return ctx.target.conditions?.some((c) => c.name === 'prone') ?? false;
  },

  getEffect: (ctx) => {
    const distanceCells = getDistance(ctx.attacker.position, ctx.target.position);

    // ≤5ft (1 Cell) = Advantage, >5ft = Disadvantage
    // NICHT melee vs ranged - reine Distanz!
    if (distanceCells <= 1) {
      return { advantage: true };
    }
    return { disadvantage: true };
  },

  priority: 8,
};

// Auto-register beim Import
modifierRegistry.register(proneTargetModifier);
