import type { CombatView } from './combat-contracts';
import type { SceneCheck } from './scene-check-contracts';
import type { CreatureRollPreset } from '../shared/dice-formula';
import type { Creature } from '../../features/catalog/creature-catalog';
export const editableCombat = (combat: CombatView['combat']) =>
  !!combat && ['preparing', 'running'].includes(combat.phase);
export type PendingDamage = {
  check: SceneCheck;
  combatId: string;
  attackerId: string;
  targetId?: string;
  appliedTargets?: string[];
};
export function enqueuePendingDamage(
  queue: readonly PendingDamage[],
  next: PendingDamage,
  currentCombatId: string,
) {
  return next.combatId !== currentCombatId ||
    queue.some((damage) => damage.check.id === next.check.id)
    ? [...queue]
    : [...queue, next];
}
export function retainPendingAttack<T>(current: T | null, next: T) {
  return current ?? next;
}
export function pendingRollStillValid(
  pending: { combatId: string; attackerId: string } | null,
  combat: CombatView['combat'],
) {
  return (
    !!pending &&
    !!combat &&
    editableCombat(combat) &&
    pending.combatId === combat.id &&
    combat.participants.some((participant) => participant.id === pending.attackerId)
  );
}
export function creatureConstitutionSave(
  source: Pick<Creature, 'abilities' | 'savingThrows'> | undefined,
): number | null {
  if (!source) return null;
  const explicit = source.savingThrows.match(/(?:^|[,;])\s*CON\s+([+-]?\d+)\s*(?=$|[,;])/i);
  if (explicit) {
    const bonus = Number(explicit[1]);
    return Number.isSafeInteger(bonus) && Math.abs(bonus) <= 1000 ? bonus : null;
  }
  if (/\bCON\b/i.test(source.savingThrows)) return null;
  return Number.isFinite(source.abilities.con) ? Math.floor((source.abilities.con - 10) / 2) : null;
}
export const deferLegendaryCost = (kind: CreatureRollPreset['kind']) =>
  kind === 'attack' || kind === 'save' || kind === 'check';
