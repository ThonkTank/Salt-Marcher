/**
 * Combat feature - Public API
 *
 * @see docs/features/Combat-System.md
 */

// Types
export type { CombatFeaturePort, CombatServiceDeps, CombatResult } from './types';

// Service factory
export { createCombatService } from './combat-service';

// Utilities (for external use)
export {
  calculateConcentrationDc,
  calculateCombatDuration,
  createParticipantFromCreature,
  createParticipantFromCharacter,
  getXpForCr,
  CR_TO_XP,
} from './combat-utils';
