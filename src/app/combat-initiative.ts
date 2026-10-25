import type { CombatState, Combatant } from './combat-contracts';
export function initiativeBasis(c: CombatState) {
  return {
    phase: c.phase,
    round: c.round,
    turnId: c.turnId,
    participants: c.participants.map((p) => ({
      id: p.id,
      groupId: p.groupId,
      initiative: p.initiative,
    })),
  };
}
export type InitiativeBasis = ReturnType<typeof initiativeBasis>;
export function initiativeBasisMatches(b: InitiativeBasis, c: CombatState) {
  return JSON.stringify(b) === JSON.stringify(initiativeBasis(c));
}
export function initiativeGroups(c: CombatState) {
  const groups = new Map<string, Combatant[]>();
  for (const p of c.participants) {
    const group = groups.get(p.groupId) ?? [];
    group.push(p);
    groups.set(p.groupId, group);
  }
  return [...groups.values()].sort(
    (a, b) => Number(!a[0]!.characterId) - Number(!b[0]!.characterId),
  );
}
export function initiativeNumber(raw: string) {
  if (!/^[+-]?\d+$/.test(raw.trim())) throw new Error('Initiative als ganze Zahl eingeben.');
  const n = Number(raw);
  if (!Number.isSafeInteger(n) || Math.abs(n) > 1000000)
    throw new Error('Initiative muss zwischen −1.000.000 und 1.000.000 liegen.');
  return n;
}
export function initiativeD20() {
  const a = new Uint32Array(1),
    limit = Math.floor(0x100000000 / 20) * 20;
  do {
    crypto.getRandomValues(a);
  } while (a[0]! >= limit);
  return (a[0]! % 20) + 1;
}
export function rolledMonsterInitiatives(
  c: CombatState,
  mode: 'normal' | 'advantage' | 'disadvantage',
  die = initiativeD20,
) {
  return initiativeGroups(c)
    .filter((g) => !g[0]!.characterId)
    .map((g) => {
      const p = g[0]!,
        a = die(),
        b = mode === 'normal' ? a : die();
      return {
        participantId: p.id,
        initiative:
          (mode === 'advantage' ? Math.max(a, b) : mode === 'disadvantage' ? Math.min(a, b) : a) +
          p.initiativeBonus,
      };
    });
}
