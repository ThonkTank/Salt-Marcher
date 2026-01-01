// Zähl- und Gewichtungs-Typen für das Encounter-System
// Siehe: docs/entities/creature.md#countrange

import { z } from 'zod';

/**
 * Bereichs-Definition für Anzahlen (min/avg/max).
 * Verwendet für creature.groupSize und ähnliche Felder.
 */
export interface CountRange {
  min: number;
  avg: number;
  max: number;
}

/**
 * Item mit zugehöriger Gewichtung für gewichtete Zufallsauswahl.
 */
export interface WeightedItem<T> {
  item: T;
  randWeighting: number;
}

// ============================================================================
// Dice Expression Types
// ============================================================================

/**
 * Branded Type für validierte Dice-Expressions.
 * Verwendung: Loot-Tabellen, Damage-Rolls, etc.
 */
export type DiceExpression = string & { readonly __brand: 'DiceExpression' };

/**
 * Vergleichs-Operator für Explode/Reroll-Bedingungen.
 */
export type ComparisonOp = '=' | '>' | '<';

/**
 * Keep/Drop Modifikator für Würfelwürfe.
 * - kh: Keep Highest (z.B. 4d6kh3 für Ability Scores)
 * - kl: Keep Lowest (z.B. 2d20kl1 für Disadvantage)
 * - dh: Drop Highest
 * - dl: Drop Lowest
 */
export interface KeepDrop {
  mode: 'kh' | 'kl' | 'dh' | 'dl';
  count: number;
}

/**
 * Exploding Dice Modifikator.
 * - !: Explode (neue Würfel bei Treffer)
 * - !!: Compound (addiert zum selben Würfel)
 */
export interface Explode {
  mode: '!' | '!!';
  threshold?: { op: ComparisonOp; value: number }; // default: = max
}

/**
 * Reroll Modifikator.
 * - r: Reroll unbegrenzt bis Bedingung nicht mehr erfüllt
 * - ro: Reroll einmal
 */
export interface Reroll {
  once: boolean;
  condition: { op: ComparisonOp; value: number };
}

/**
 * AST-Node für Dice-Expressions.
 */
export type DiceNode =
  | { type: 'constant'; value: number }
  | {
      type: 'dice';
      count: number;
      sides: number;
      keep?: KeepDrop;
      explode?: Explode;
      reroll?: Reroll;
    }
  | { type: 'binary'; op: '+' | '-' | '*' | '/'; left: DiceNode; right: DiceNode }
  | { type: 'group'; expr: DiceNode };

/**
 * Zod-Schema für DiceExpression.
 * Validiert Syntax zur Laufzeit.
 */
export const diceExpressionSchema = z.string().refine(
  (val): val is DiceExpression => {
    // Import wird zirkulär vermieden - Validierung erfolgt via Parser
    // Basis-Regex für schnelle Vorab-Prüfung
    const dicePattern = /^[\d+\-*/()d!<>=khlro\s]+$/i;
    return dicePattern.test(val) && val.length > 0;
  },
  { message: 'Invalid dice expression' }
) as unknown as z.ZodType<DiceExpression>;
