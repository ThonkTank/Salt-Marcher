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

import type { Action } from '#entities/action';

/**
 * Generiert eine Beschreibung fuer eine Action.
 * HACK: siehe Header - vereinfachte Implementierung
 */
export function generateActionDescription(action: Action): string {
  const parts: string[] = [];

  // Action Type
  parts.push(`${action.actionType} (${action.timing.type})`);

  // Range
  if (action.range) {
    if (action.range.type === 'reach') {
      parts.push(`Reach ${action.range.normal}ft`);
    } else if (action.range.type === 'ranged') {
      parts.push(`Range ${action.range.normal}/${action.range.long ?? '-'}ft`);
    }
  }

  // Damage
  if (action.damage) {
    const mod = action.damage.modifier ?? 0;
    const sign = mod >= 0 ? '+' : '';
    parts.push(`${action.damage.dice}${mod !== 0 ? sign + mod : ''} ${action.damage.type}`);
  }

  // Effects (simplified)
  if (action.effects && action.effects.length > 0) {
    const effectNames = action.effects
      .map(e => e.condition ?? 'effect')
      .join(', ');
    parts.push(`Effects: ${effectNames}`);
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
