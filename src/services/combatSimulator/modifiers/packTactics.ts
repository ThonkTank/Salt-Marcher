// Ziel: Pack Tactics Modifier - Advantage wenn nicht-incapacitated Ally adjacent zum Target
// Siehe: docs/services/combatSimulator/actionScoring.md#situational-modifiers
//
// D&D 5e SRD Zeile 27303:
// "Advantage on attack roll if at least one of the creature's allies is within
//  5 feet of the target and the ally doesn't have the Incapacitated condition."
//
// WICHTIG: Ally darf NICHT Incapacitated sein!

import type { ModifierEvaluator } from '../situationalModifiers';
import { modifierRegistry } from '../situationalModifiers';
import { getDistance } from '@/utils';

/**
 * Pack Tactics Modifier
 *
 * Aktiv wenn:
 * - Mindestens ein Ally (gleiche GroupId oder alliierte Gruppe)
 * - Ally ist nicht Incapacitated
 * - Ally ist ≤5ft (1 Cell) vom Target entfernt
 *
 * Effekt: Advantage
 */
export const packTacticsModifier: ModifierEvaluator = {
  id: 'pack-tactics',
  name: 'Pack Tactics',
  description: 'Advantage if non-incapacitated ally within 5ft of target',

  isActive: (ctx) => {
    const attackerAlliances = ctx.state.alliances[ctx.attacker.groupId] ?? [];

    return ctx.state.profiles.some((profile) => {
      // Skip selbst
      if (profile.participantId === ctx.attacker.participantId) return false;

      // Ist es ein Ally? (gleiche Gruppe oder alliiert)
      const isAlly =
        profile.groupId === ctx.attacker.groupId ||
        attackerAlliances.includes(profile.groupId);
      if (!isAlly) return false;

      // Ally darf NICHT Incapacitated sein!
      const isIncapacitated =
        profile.conditions?.some(
          (c) => c.name === 'incapacitated' || c.effect === 'incapacitated'
        ) ?? false;
      if (isIncapacitated) return false;

      // Ist der Ally adjacent zum Target? (≤1 Cell = ≤5ft)
      const distToTarget = getDistance(profile.position, ctx.target.position);
      return distToTarget <= 1;
    });
  },

  getEffect: () => ({
    advantage: true,
  }),

  priority: 7,
};

// Auto-register beim Import
modifierRegistry.register(packTacticsModifier);
