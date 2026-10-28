import type { CombatState, Combatant } from './combat-state-contracts';

export type InitiativeBasis = Pick<CombatState, 'phase' | 'round' | 'turnId'> & {
  participants: Pick<Combatant, 'id' | 'groupId' | 'initiative'>[];
};
