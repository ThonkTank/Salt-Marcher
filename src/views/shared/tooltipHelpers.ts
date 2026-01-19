// Ziel: Schema-Generierungs-Funktionen fuer Tooltips
// Siehe: docs/views/Tooltip.md#schema-generierte-beschreibungen
//
// ============================================================================
// TODO
// ============================================================================
//
// [TODO]: Implementiere vollstaendige Action-Beschreibung
// - Spec: Tooltip.md#schema-generierte-beschreibungen
// - Alle Action-Felder beruecksichtigen
//
// [TODO]: Implementiere Condition-Beschreibung
// - Spec: Tooltip.md
// - Blinded, Poisoned, etc.
//
// [TODO]: Implementiere Modifier-Beschreibung
// - Spec: Tooltip.md
// - Woher kommt der Modifier
//
// ============================================================================

import type { CombatEvent } from '@/types/entities/combatEvent';

/**
 * Extracts attack type from action check field.
 * Supports both legacy format ({ type: 'attack', attackType: ... }) and
 * unified check format ({ roll: { type: 'attack', attackType: ... } }).
 */
function getCheckAttackType(action: CombatEvent): string | undefined {
  if (!action.check) return undefined;

  // Legacy format: { type: 'attack', attackType: ... }
  if ('type' in action.check && action.check.type === 'attack') {
    return (action.check as { attackType?: string }).attackType;
  }

  // Unified format: { roll: { type: 'attack', attackType: ... } }
  if ('roll' in action.check && action.check.roll?.type === 'attack') {
    return action.check.roll.attackType;
  }

  return undefined;
}

/**
 * Generiert eine Beschreibung fuer eine Action.
 * Uses new 7-component CombatEvent schema.
 */
export function generateActionDescription(action: CombatEvent): string {
  const parts: string[] = [];

  // Action Type aus check oder trigger (neues Schema)
  const actionType = getCheckAttackType(action) ?? action.trigger?.type ?? 'unknown';
  const timing = action.cost?.type === 'action-economy'
    ? action.cost.economy
    : 'free';
  parts.push(`${actionType} (${timing})`);

  // Range aus targeting.range (neues Schema)
  // Only 'single' and 'multi' targeting types have range
  const targeting = action.targeting;
  if (targeting && (targeting.type === 'single' || targeting.type === 'multi')) {
    const range = targeting.range;
    if (range) {
      if (range.type === 'reach') {
        parts.push(`Reach ${range.distance}ft`);
      } else if (range.type === 'ranged') {
        parts.push(`Range ${range.normal}/${range.long ?? '-'}ft`);
      }
    }
  }

  // Damage aus effect (neues Schema)
  if (action.effect?.type === 'damage') {
    parts.push(`${action.effect.damage} ${action.effect.damageType}`);
  }

  // Effects aus effects Array (legacy conditions)
  if (action.effects && action.effects.length > 0) {
    const effectNames = action.effects
      .filter(e => e.type === 'apply-condition' || e.condition)
      .map(e => e.condition ?? 'effect')
      .join(', ');
    if (effectNames) parts.push(`Effects: ${effectNames}`);
  }

  return parts.join(' · ');
}

/**
 * Generiert eine Beschreibung fuer eine Condition.
 * TODO: siehe Header - nicht implementiert
 */
export function generateConditionDescription(_conditionType: string): string {
  // Placeholder
  return 'Condition description not implemented';
}

/**
 * Generiert eine Beschreibung fuer einen Modifier.
 * TODO: siehe Header - nicht implementiert
 */
export function generateModifierDescription(_modifierName: string): string {
  // Placeholder
  return 'Modifier description not implemented';
}
