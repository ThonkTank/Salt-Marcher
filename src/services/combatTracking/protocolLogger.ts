// Ziel: Einheitliches Logging-Format für CombatProtocolEntry
// Siehe: docs/services/combatTracking.md

import type { CombatProtocolEntry, TurnBudget } from '@/types/combat';

/**
 * Formatiert einen Protocol-Entry als Log-String.
 * Identisches Format wie test-selectors.ts [TURN] Ausgabe.
 *
 * @param entry - Der zu formatierende Protocol-Eintrag
 * @param options - Optionale Formatierungsoptionen
 * @returns Formatierter Log-String
 */
export function formatProtocolEntry(
  entry: CombatProtocolEntry,
  options?: {
    selectorName?: string;
    elapsedMs?: number;
  }
): string {
  const { selectorName = '???', elapsedMs } = options ?? {};
  const selectorTag = selectorName.slice(0, 3).toUpperCase();

  // Position Info
  const startPos = entry.positionBefore;
  const endPos = entry.positionAfter;
  const posInfo = startPos.x === endPos.x && startPos.y === endPos.y
    ? `@(${startPos.x},${startPos.y})`
    : `(${startPos.x},${startPos.y})→(${endPos.x},${endPos.y})`;

  // Action Info
  if (entry.action.type === 'pass') {
    const hpInfo = formatHpChanges(entry);
    return `[TURN] R${entry.round} ${selectorTag} ${entry.combatantName}: PASS${hpInfo}`;
  }

  const actionName = entry.action.action?.name ?? '?';
  const targetInfo = entry.action.target
    ? `→ ${entry.action.target.name} [${((entry.targetDeathProbability ?? 0) * 100).toFixed(0)}%☠]`
    : '';
  const scoreInfo = entry.action.score !== undefined
    ? ` [Score: ${entry.action.score.toFixed(1)}]`
    : '';
  const hpInfo = formatHpChanges(entry);
  const timeInfo = elapsedMs !== undefined ? ` (${elapsedMs.toFixed(1)}ms)` : '';

  return `[TURN] R${entry.round} ${selectorTag} ${entry.combatantName} ${posInfo}: ${actionName} ${targetInfo}${scoreInfo}${hpInfo}${timeInfo}`;
}

/**
 * Formatiert HP-Changes als kompakten String.
 */
function formatHpChanges(entry: CombatProtocolEntry): string {
  if (!entry.hpChanges?.length) return '';

  const changes = entry.hpChanges
    .filter(c => c.delta !== 0)
    .map(c => {
      const sign = c.delta > 0 ? '+' : '';
      const source = c.sourceDetail ?? c.source;
      return `${c.combatantName} ${sign}${c.delta}HP (${source})`;
    });

  return changes.length > 0 ? ` [${changes.join(', ')}]` : '';
}

/**
 * Formatiert Budget-Status als kompakten String.
 *
 * @param budget - Das TurnBudget
 * @returns Formatierter Budget-String z.B. "[Budget] A:Y B:N M:6"
 */
export function formatBudget(budget: TurnBudget): string {
  return `[Budget] A:${budget.hasAction ? 'Y' : 'N'} B:${budget.hasBonusAction ? 'Y' : 'N'} M:${budget.movementCells}`;
}
