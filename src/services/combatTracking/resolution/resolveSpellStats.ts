// Ziel: Injiziert Spellcasting-Stats (attack bonus, save DC) in Spell-Actions
// Siehe: docs/services/combatTracking/actionResolution.md
//
// Wird als Step 0 der Resolution-Pipeline aufgerufen, BEVOR findTargets().
// Sucht den Spellcasting-Trait des Casters und ueberschreibt Platzhalter-Werte.

import type { CombatEvent, UnifiedCheck, LegacyCheck } from '@/types/entities/combatEvent';

/**
 * Type guard: Check ob Check ein UnifiedCheck ist (hat roller, roll, against).
 */
function isUnifiedCheck(check: unknown): check is UnifiedCheck {
  return (
    typeof check === 'object' &&
    check !== null &&
    'roller' in check &&
    'roll' in check &&
    'against' in check
  );
}

/**
 * Type guard: Check ob Check ein LegacyCheck mit type='attack' ist.
 */
function isLegacyAttackCheck(check: unknown): check is LegacyCheck & { type: 'attack' } {
  return (
    typeof check === 'object' &&
    check !== null &&
    'type' in check &&
    (check as { type: string }).type === 'attack'
  );
}

/**
 * Injiziert Spellcasting-Stats (attack bonus, save DC) in einen Spell.
 * Findet den Spellcasting-Trait des Casters und uebernimmt dessen Stats.
 *
 * Unterstuetzte Formate:
 * - Neues Format: `check.roll.bonus` (Unified Check Format)
 * - Legacy Format: `check.bonus` (type='attack'), `attack.bonus`
 * - Save DC in: `effects[].save.dc`, `effect.save.dc`, `save.dc`
 *
 * @param spell Die Spell-Action (mit isSpell: true)
 * @param combatantActions Alle Actions des Combatants (inkl. Spellcasting-Trait)
 * @returns Spell mit injizierten Stats
 */
export function resolveSpellWithCaster(
  spell: CombatEvent,
  combatantActions: CombatEvent[]
): CombatEvent {
  // Nur fuer Spells
  if (!spell.isSpell) return spell;

  // Finde Spellcasting-Trait des Casters
  const spellcastingTrait = combatantActions.find(a => a.spellcasting);
  if (!spellcastingTrait?.spellcasting) return spell;

  const sc = spellcastingTrait.spellcasting;
  let resolved: CombatEvent = { ...spell };

  // 1. Attack Bonus injizieren
  // Neues Format: check.roll.bonus (Unified Check Format)
  if (resolved.check && isUnifiedCheck(resolved.check)) {
    const unifiedCheck = resolved.check;
    // Check ob roll ein attack-roll ist (hat bonus)
    if ('bonus' in unifiedCheck.roll) {
      resolved = {
        ...resolved,
        check: {
          ...unifiedCheck,
          roll: {
            ...unifiedCheck.roll,
            bonus: sc.attackBonus,
          },
        },
      };
    }
  }

  // Legacy Format: check.bonus (type='attack')
  if (resolved.check && isLegacyAttackCheck(resolved.check)) {
    resolved = {
      ...resolved,
      check: {
        ...resolved.check,
        bonus: sc.attackBonus,
      },
    };
  }

  // Legacy Format: attack.bonus (separate field)
  if (resolved.attack) {
    resolved = {
      ...resolved,
      attack: {
        ...resolved.attack,
        bonus: sc.attackBonus,
      },
    };
  }

  // 2. Save DC injizieren (nur wenn saveDC definiert ist)
  if (sc.saveDC !== undefined) {
    // Format: effects[] array mit save.dc
    if (resolved.effects && Array.isArray(resolved.effects)) {
      resolved = {
        ...resolved,
        effects: resolved.effects.map(e =>
          e.save ? { ...e, save: { ...e.save, dc: sc.saveDC } } : e
        ) as typeof resolved.effects,
      };
    }

    // Format: einzelnes effect mit save.dc
    if (resolved.effect && typeof resolved.effect === 'object' && 'save' in resolved.effect) {
      const effectWithSave = resolved.effect as { save?: { dc: number; ability: string; onSave?: string } };
      if (effectWithSave.save) {
        resolved = {
          ...resolved,
          effect: {
            ...resolved.effect,
            save: { ...effectWithSave.save, dc: sc.saveDC },
          } as typeof resolved.effect,
        };
      }
    }

    // Format: top-level save (legacy)
    if (resolved.save) {
      resolved = {
        ...resolved,
        save: {
          ...resolved.save,
          dc: sc.saveDC,
        },
      };
    }
  }

  return resolved;
}
