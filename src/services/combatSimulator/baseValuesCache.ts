// Ziel: Combat-Level Caching-Infrastruktur fuer Base-Values und Attack-Patterns
// Siehe: docs/services/combatSimulator/actionScoring.md#caching-strategie
//
// Cache-Lebensdauer: Combat-weit (nicht pro Runde)
// - baseValuesCache: Pro Caster-Action-Target-Kombination
// - attackPatternCache: Pro Range (Geometrie konstant)

// ============================================================================
// HACK & TODO
// ============================================================================
//
// [HACK]: Stat-Hash nur fuer 3 Modifier-Typen
// - computeRelevantStatHash() trackt nur attack-bonus, damage-bonus, spell-dc
// - Ignoriert: resistance/immunity-Aenderungen, Speed-Modifikationen
// - Ideal: Alle relevanten Stat-Aenderungen hashen (erfordert Condition-Katalog)
//
// [HACK]: Stat-Hash ignoriert Action-spezifische Relevanz
// - _action Parameter wird nicht genutzt (z.B. spell-dc irrelevant fuer Melee)
// - Alle Modifiers werden immer gehasht, auch wenn sie die Action nicht betreffen
// - Ideal: Filter basierend auf Action-Typ (attack vs save vs healing)
//
// [HACK]: Attack-Pattern Cache nur 2D (z=0)
// - getRelativeAttackCells() erzeugt nur Cells mit z=0
// - Fliegende Kreaturen koennen nicht vertikal angreifen
// - Ideal: 3D-Patterns fuer Fly, Climb, Burrow
//
// [HACK]: participantId Suffix-Stripping via Regex
// - Nutzt replace(/-\d+$/, '') um "goblin-1" → "goblin" zu mappen
// - Annahme: Suffix ist immer -N Format
// - Ideal: Explizites creatureType-Feld statt String-Manipulation
//
// [TODO]: Implementiere Cache-Invalidierung bei Buff-Aenderung
// - Wenn Caster gebufft/debufft wird, sollte Cache invalide werden
// - Aktuell: Stat-Hash aendert sich, aber alter Eintrag bleibt im Cache
// - Ideal: Cache-Entry loeschen wenn Conditions sich aendern
//

import type { GridPosition, CombatProfile, ActionBaseValues } from '@/types/combat';
import type { Action } from '@/types/entities';
import { getDistance } from './combatHelpers';

// ============================================================================
// DEBUG HELPER
// ============================================================================

const debug = (...args: unknown[]) => {
  if (process.env.DEBUG_SERVICES === 'true') {
    console.log('[baseValuesCache]', ...args);
  }
};

// ============================================================================
// ATTACK PATTERN CACHE
// ============================================================================

/**
 * Cache fuer relative Attack-Cell-Patterns pro Action-Range.
 * Geometrie ist konstant - nur einmal berechnen.
 */
const attackPatternCache = new Map<number, GridPosition[]>();

/**
 * Gibt relative Attack-Cells fuer eine gegebene Range zurueck (gecached).
 * Relative Cells sind zentriert auf Origin (0,0,0).
 */
export function getRelativeAttackCells(rangeCells: number): GridPosition[] {
  const cached = attackPatternCache.get(rangeCells);
  if (cached) return cached;

  const cells: GridPosition[] = [];
  for (let dx = -rangeCells; dx <= rangeCells; dx++) {
    for (let dy = -rangeCells; dy <= rangeCells; dy++) {
      const cell = { x: dx, y: dy, z: 0 };
      // Nur Cells die tatsaechlich in Reichweite sind (PHB-Variant Distanz)
      if (getDistance({ x: 0, y: 0, z: 0 }, cell) <= rangeCells) {
        cells.push(cell);
      }
    }
  }

  attackPatternCache.set(rangeCells, cells);
  return cells;
}

// ============================================================================
// BASE VALUES CACHE (Combat-Level)
// ============================================================================

/**
 * Cache fuer Base-Values pro Caster-Action-Target-Kombination.
 * Combat-weit persistent (nicht pro Runde zurueckgesetzt).
 * Ermoeglicht Trennung von stabilen Werten und situativen Modifiern.
 */
let baseValuesCache: Map<string, ActionBaseValues> = new Map();

/**
 * Generiert Cache-Key fuer Base-Values.
 * Format: {casterBaseName}[-{statHash}]-{actionId}:{targetId}
 *
 * @example "goblin-scimitar:fighter"
 * @example "goblin[ab2]-scimitar:fighter" (mit Magic Weapon +2)
 */
export function getBaseValuesCacheKey(
  caster: CombatProfile,
  action: Action,
  target: CombatProfile
): string {
  // Base-Name ohne Suffix (z.B. "goblin" statt "goblin-1")
  const baseName = caster.participantId.replace(/-\d+$/, '');
  const statHash = computeRelevantStatHash(caster, action);

  return statHash
    ? `${baseName}[${statHash}]-${action.id}:${target.participantId.replace(/-\d+$/, '')}`
    : `${baseName}-${action.id}:${target.participantId.replace(/-\d+$/, '')}`;
}

/**
 * Berechnet Hash fuer relevante Stat-Modifikationen.
 * Nur Stats die Base-Values beeinflussen werden einbezogen.
 */
export function computeRelevantStatHash(caster: CombatProfile, _action: Action): string | null {
  const modifiers: string[] = [];

  for (const condition of caster.conditions ?? []) {
    // Attack Bonus Modifikationen (Magic Weapon, Bless)
    if (condition.effect === 'attack-bonus' && condition.value !== undefined) {
      modifiers.push(`ab${condition.value}`);
    }
    // Damage Bonus Modifikationen (Magic Weapon, Hex)
    if (condition.effect === 'damage-bonus' && condition.value !== undefined) {
      modifiers.push(`db${condition.value}`);
    }
    // Spell DC Modifikationen (selten)
    if (condition.effect === 'spell-dc' && condition.value !== undefined) {
      modifiers.push(`dc${condition.value}`);
    }
  }

  return modifiers.length > 0 ? modifiers.join(',') : null;
}

/**
 * Holt gecachte Base-Values oder undefined.
 */
export function getCachedBaseValues(
  caster: CombatProfile,
  action: Action,
  target: CombatProfile
): ActionBaseValues | undefined {
  return baseValuesCache.get(getBaseValuesCacheKey(caster, action, target));
}

/**
 * Setzt Base-Values im Cache.
 */
export function setCachedBaseValues(
  caster: CombatProfile,
  action: Action,
  target: CombatProfile,
  values: ActionBaseValues
): void {
  baseValuesCache.set(getBaseValuesCacheKey(caster, action, target), values);
  debug('setCachedBaseValues:', {
    key: getBaseValuesCacheKey(caster, action, target),
    values,
  });
}

/** Setzt den Base-Values-Cache zurueck (Combat-Ende). */
export function resetBaseValuesCache(): void {
  baseValuesCache = new Map();
  debug('resetBaseValuesCache: cache cleared');
}

/** Setzt alle Combat-Caches zurueck (Combat-Ende). */
export function resetCombatCaches(): void {
  resetBaseValuesCache();
  // attackPatternCache wird NICHT zurueckgesetzt (Geometrie bleibt gleich)
  debug('resetCombatCaches: all caches cleared');
}
