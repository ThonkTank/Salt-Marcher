// Ziel: Long Range Disadvantage Modifier
// Siehe: docs/services/combatantAI/actionScoring.md#situational-modifiers
//
// D&D 5e Regel: Angriffe jenseits der Normal Range aber innerhalb
// der Long Range haben Disadvantage.

import type { ModifierEvaluator } from '../situationalModifiers';
import { modifierRegistry } from '../situationalModifiers';
import { getDistance } from '@/utils';

/**
 * Long Range Modifier - Disadvantage für Angriffe in Long Range.
 *
 * Aktiv wenn:
 * - Action hat range.long definiert
 * - Distanz > range.normal UND <= range.long
 */
export const longRangeModifier: ModifierEvaluator = {
  id: 'long-range',
  name: 'Long Range',
  description: 'Ranged attack beyond normal range but within long range',

  isActive: (ctx) => {
    // Nur relevant wenn Action eine Long Range hat
    if (!ctx.action.range?.long) return false;

    // Distanz in Feet berechnen (1 Cell = 5ft)
    const distanceCells = getDistance(ctx.attacker.position, ctx.target.position);
    const distanceFeet = distanceCells * 5;

    const normalRange = ctx.action.range.normal;
    const longRange = ctx.action.range.long;

    // Aktiv wenn: normalRange < distanz <= longRange
    return distanceFeet > normalRange && distanceFeet <= longRange;
  },

  getEffect: () => ({
    disadvantage: true,
  }),

  priority: 10, // Höhere Priorität für grundlegende Range-Checks
};

// Auto-register beim Import
modifierRegistry.register(longRangeModifier);
