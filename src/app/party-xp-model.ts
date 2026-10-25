import { xpLevel, xpShare, type Progress } from './progression';

/** Current Party window policy: preview/writer share XP calculation; confirmed rest facts are independent. */
export function changeCharacterXp(
  before: Progress,
  mode: 'add' | 'subtract' | 'set',
  amount: number,
) {
  if (!Number.isSafeInteger(amount) || amount < 0 || !['add', 'subtract', 'set'].includes(mode))
    throw new Error('Nichtnegative ganze XP und eine gültige Änderung wählen.');
  if (mode === 'subtract' && before.xp === null)
    throw new Error('Vor einer negativen Korrektur den bisherigen XP-Stand eintragen.');
  const after = structuredClone(before),
    old = before.xp ?? 0,
    removed = mode === 'subtract' ? Math.min(amount, old) : 0;
  after.xp = mode === 'set' ? amount : mode === 'subtract' ? old - removed : old + amount;
  xpLevel(after.xp);
  return { after, delta: after.xp - old, removed };
}
export function partyAwardShares(
  poolXp: number,
  loadXp: number,
  xpCount: number,
  loadCount: number,
) {
  if (
    !Number.isSafeInteger(poolXp) ||
    poolXp < 0 ||
    !Number.isSafeInteger(loadXp) ||
    loadXp < 0 ||
    poolXp + loadXp === 0
  )
    throw new Error('XP-Verdienst oder Tagesbelastung als positive ganze Zahl eintragen.');
  if ((poolXp > 0 && !xpCount) || (loadXp > 0 && !loadCount))
    throw new Error('Empfänger für XP und Tagesbelastung auswählen.');
  return { xp: xpShare(poolXp, xpCount), load: xpShare(loadXp, loadCount) };
}
