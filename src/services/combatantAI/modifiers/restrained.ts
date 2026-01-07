// Ziel: Restrained Modifier - Advantage auf alle Angriffe gegen Restrained Target
// Siehe: docs/services/combatantAI/actionScoring.md#situational-modifiers
//
// D&D 5e SRD Zeile 14486:
// "Attack rolls against you have Advantage"

import type { ModifierEvaluator } from '../situationalModifiers';
import { modifierRegistry } from '../situationalModifiers';

/**
 * Restrained Modifier
 *
 * Aktiv wenn: Target hat die Condition 'restrained'
 * Effekt: Advantage auf alle Angriffe
 */
export const restrainedModifier: ModifierEvaluator = {
  id: 'restrained',
  name: 'Restrained Target',
  description: 'Advantage on all attack rolls against restrained target',

  isActive: (ctx) => {
    return ctx.target.conditions?.some((c) => c.name === 'restrained') ?? false;
  },

  getEffect: () => ({
    advantage: true,
  }),

  priority: 8,
};

// Auto-register beim Import
modifierRegistry.register(restrainedModifier);
