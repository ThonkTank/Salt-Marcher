// Single Source of Truth für alle Zufallsfunktionen.
// Siehe: docs/services/encounter/groupSeed.md

import type { WeightedItem, DiceExpression, DiceNode } from '#types/common/counting';
import { parseDice } from './diceParser';

/**
 * Generiert eine zufällige Ganzzahl im Bereich [min, max] (inklusive).
 */
export function randomBetween(min: number, max: number): number {
  return Math.floor(Math.random() * (max - min + 1)) + min;
}

/**
 * Wählt ein Element basierend auf Gewichtung aus.
 * Höhere Gewichtung = höhere Wahrscheinlichkeit.
 *
 * @param items - Array mit gewichteten Items
 * @param debugLabel - Optional: Label für Debug-Ausgabe (nur bei DEBUG_SERVICES=true)
 * @returns Das ausgewählte Item oder null bei leerem Array
 */
export function weightedRandomSelect<T>(
  items: WeightedItem<T>[],
  debugLabel?: string
): T | null {
  if (items.length === 0) return null;

  const totalWeight = items.reduce((sum, entry) => sum + entry.randWeighting, 0);
  if (totalWeight <= 0) return null;

  let roll = Math.random() * totalWeight;

  for (const entry of items) {
    roll -= entry.randWeighting;
    if (roll <= 0) {
      if (debugLabel && process.env.DEBUG_SERVICES === 'true') {
        console.log(`[${debugLabel}] Picked item with randWeighting ${entry.randWeighting} from total ${totalWeight}`);
      }
      return entry.item;
    }
  }

  // Fallback (sollte nie erreicht werden)
  return items[items.length - 1].item;
}

/**
 * Wählt ein zufälliges Element aus einem Array (uniforme Verteilung).
 *
 * @returns Das ausgewählte Element oder null bei leerem Array
 */
export function randomSelect<T>(items: T[]): T | null {
  if (items.length === 0) return null;
  return items[randomBetween(0, items.length - 1)];
}

/**
 * Generiert eine normalverteilte Zufallszahl im Bereich [min, max].
 * Werte haeufen sich um avg (Glockenform), Extrema sind seltener.
 * stdDev = (max - min) / 4 -> ~95% der Werte in [min, max]
 */
export function randomNormal(min: number, avg: number, max: number): number {
  // Box-Muller Transform
  const u1 = Math.random();
  const u2 = Math.random();
  const z = Math.sqrt(-2 * Math.log(u1)) * Math.cos(2 * Math.PI * u2);

  const stdDev = (max - min) / 4;
  const value = avg + z * stdDev;

  return Math.round(Math.max(min, Math.min(max, value)));
}

// ============================================================================
// Pool Aggregation
// ============================================================================

/**
 * Aggregiert mehrere gewichtete Pools zu einem.
 * Duplikate werden summiert (keine Kaskade).
 *
 * @param pools - Array von gewichteten Pools
 * @param getKey - Optionale Funktion um Key für Duplikat-Erkennung zu generieren
 * @returns Aggregierter Pool mit summierten randWeightings
 */
export function aggregateWeightedPools<T>(
  pools: Array<Array<{ item: T; randWeighting: number }>>,
  getKey?: (item: T) => string
): Array<{ item: T; randWeighting: number }> {
  const merged = new Map<string, { item: T; randWeighting: number }>();

  for (const pool of pools) {
    for (const entry of pool) {
      const key = getKey?.(entry.item)
        ?? (typeof entry.item === 'string' ? entry.item : JSON.stringify(entry.item));

      const existing = merged.get(key);
      if (existing) {
        existing.randWeighting += entry.randWeighting;
      } else {
        merged.set(key, { item: entry.item, randWeighting: entry.randWeighting });
      }
    }
  }

  return Array.from(merged.values());
}

// ============================================================================
// Dice Expression Evaluation
// ============================================================================

/** Maximum explosions per dice pool to prevent infinite loops */
const MAX_EXPLOSIONS = 100;

/** Detail info for a single dice roll */
export interface DiceRollDetail {
  dice: string;
  values: number[];
  kept: number[];
}

/** Detailed result of a dice roll */
export interface DiceRollResult {
  total: number;
  rolls: DiceRollDetail[];
}

/**
 * Würfelt eine Dice-Expression und gibt das Ergebnis zurück.
 * @example rollDice('4d6kh3') // z.B. 14
 * @example rollDice('1d20+5') // z.B. 18
 */
export function rollDice(expr: DiceExpression | string): number {
  const ast = parseDice(expr);
  return evaluateNode(ast);
}

/**
 * Berechnet den minimalen Wert einer Dice-Expression.
 * @example diceMin('2d6+3') // 5
 */
export function diceMin(expr: DiceExpression | string): number {
  const ast = parseDice(expr);
  return evaluateNodeStats(ast, 'min');
}

/**
 * Berechnet den maximalen Wert einer Dice-Expression.
 * Bei Exploding Dice: Infinity
 * @example diceMax('2d6+3') // 15
 */
export function diceMax(expr: DiceExpression | string): number {
  const ast = parseDice(expr);
  return evaluateNodeStats(ast, 'max');
}

/**
 * Berechnet den Erwartungswert einer Dice-Expression.
 * @example diceAvg('2d6+3') // 10
 */
export function diceAvg(expr: DiceExpression | string): number {
  const ast = parseDice(expr);
  return evaluateNodeStats(ast, 'avg');
}

/**
 * Würfelt eine Dice-Expression mit detaillierten Ergebnissen.
 * @example rollDiceDetailed('4d6kh3')
 * // { total: 14, rolls: [{ dice: '4d6kh3', values: [6,4,3,1], kept: [6,4,3] }] }
 */
export function rollDiceDetailed(expr: DiceExpression | string): DiceRollResult {
  const ast = parseDice(expr);
  const rolls: DiceRollDetail[] = [];
  const total = evaluateNodeDetailed(ast, rolls);
  return { total, rolls };
}

// ============================================================================
// Internal Evaluation
// ============================================================================

function evaluateNode(node: DiceNode): number {
  switch (node.type) {
    case 'constant':
      return node.value;

    case 'dice':
      return rollDiceNode(node).reduce((a, b) => a + b, 0);

    case 'binary': {
      const left = evaluateNode(node.left);
      const right = evaluateNode(node.right);
      return applyBinaryOp(node.op, left, right);
    }

    case 'group':
      return evaluateNode(node.expr);
  }
}

function applyBinaryOp(op: '+' | '-' | '*' | '/', left: number, right: number): number {
  switch (op) {
    case '+': return left + right;
    case '-': return left - right;
    case '*': return left * right;
    case '/': return Math.floor(left / right);
  }
}

function evaluateNodeDetailed(node: DiceNode, rolls: DiceRollDetail[]): number {
  switch (node.type) {
    case 'constant':
      return node.value;

    case 'dice': {
      const allValues = rollDiceNodeWithHistory(node);
      const kept = applyKeepDrop(allValues, node);
      rolls.push({
        dice: formatDiceNode(node),
        values: allValues,
        kept,
      });
      return kept.reduce((a, b) => a + b, 0);
    }

    case 'binary': {
      const left = evaluateNodeDetailed(node.left, rolls);
      const right = evaluateNodeDetailed(node.right, rolls);
      return applyBinaryOp(node.op, left, right);
    }

    case 'group':
      return evaluateNodeDetailed(node.expr, rolls);
  }
}

function evaluateNodeStats(node: DiceNode, mode: 'min' | 'max' | 'avg'): number {
  switch (node.type) {
    case 'constant':
      return node.value;

    case 'dice':
      return calculateDiceStats(node, mode);

    case 'binary':
      return evaluateBinaryStats(node, mode);

    case 'group':
      return evaluateNodeStats(node.expr, mode);
  }
}

function evaluateBinaryStats(
  node: Extract<DiceNode, { type: 'binary' }>,
  mode: 'min' | 'max' | 'avg'
): number {
  const left = evaluateNodeStats(node.left, mode);
  const right = evaluateNodeStats(node.right, mode);

  switch (node.op) {
    case '+':
      return left + right;

    case '-':
      // For min/max of subtraction, we need opposite extremes
      if (mode === 'max') return left - evaluateNodeStats(node.right, 'min');
      if (mode === 'min') return left - evaluateNodeStats(node.right, 'max');
      return left - right;

    case '*': {
      // For multiplication, consider sign combinations
      if (mode === 'avg') return left * right;
      const vals = [
        evaluateNodeStats(node.left, 'min') * evaluateNodeStats(node.right, 'min'),
        evaluateNodeStats(node.left, 'min') * evaluateNodeStats(node.right, 'max'),
        evaluateNodeStats(node.left, 'max') * evaluateNodeStats(node.right, 'min'),
        evaluateNodeStats(node.left, 'max') * evaluateNodeStats(node.right, 'max'),
      ];
      return mode === 'min' ? Math.min(...vals) : Math.max(...vals);
    }

    case '/':
      return Math.floor(left / right);
  }
}

// ============================================================================
// Dice Rolling Logic
// ============================================================================

function rollDiceNode(node: Extract<DiceNode, { type: 'dice' }>): number[] {
  const values = rollDiceNodeWithHistory(node);
  return applyKeepDrop(values, node);
}

function rollDiceNodeWithHistory(node: Extract<DiceNode, { type: 'dice' }>): number[] {
  const values: number[] = [];

  for (let i = 0; i < node.count; i++) {
    let value = rollSingleDie(node.sides);

    // Apply reroll
    if (node.reroll) {
      value = applyReroll(value, node.sides, node.reroll);
    }

    // Apply exploding
    if (node.explode) {
      value = applyExplode(value, node.sides, node.explode);
    }

    values.push(value);
  }

  return values;
}

function rollSingleDie(sides: number): number {
  return randomBetween(1, sides);
}

function applyReroll(
  value: number,
  sides: number,
  reroll: NonNullable<Extract<DiceNode, { type: 'dice' }>['reroll']>
): number {
  const maxRerolls = reroll.once ? 1 : MAX_EXPLOSIONS;
  let rerolls = 0;

  while (matchesCondition(value, reroll.condition) && rerolls < maxRerolls) {
    value = rollSingleDie(sides);
    rerolls++;
  }

  return value;
}

function applyExplode(
  value: number,
  sides: number,
  explode: NonNullable<Extract<DiceNode, { type: 'dice' }>['explode']>
): number {
  const threshold = explode.threshold ?? { op: '=' as const, value: sides };
  let explosions = 0;
  let total = value;

  while (matchesCondition(value, threshold) && explosions < MAX_EXPLOSIONS) {
    value = rollSingleDie(sides);
    if (explode.mode === '!!') {
      // Compound: add to same die
      total += value;
    } else {
      // Regular explode: add as separate value
      total += value;
    }
    explosions++;
  }

  return total;
}

function matchesCondition(value: number, condition: { op: '=' | '>' | '<'; value: number }): boolean {
  switch (condition.op) {
    case '=': return value === condition.value;
    case '>': return value > condition.value;
    case '<': return value < condition.value;
  }
}

function applyKeepDrop(
  values: number[],
  node: Extract<DiceNode, { type: 'dice' }>
): number[] {
  if (!node.keep) return values;

  const sorted = [...values].sort((a, b) => b - a); // Descending
  const { mode, count } = node.keep;

  switch (mode) {
    case 'kh': return sorted.slice(0, count);
    case 'kl': return sorted.slice(-count);
    case 'dh': return sorted.slice(count);
    case 'dl': return sorted.slice(0, -count);
  }
}

// ============================================================================
// Statistics Calculation
// ============================================================================

function calculateDiceStats(
  node: Extract<DiceNode, { type: 'dice' }>,
  mode: 'min' | 'max' | 'avg'
): number {
  const { count, sides, keep, explode } = node;

  // Exploding dice have infinite max
  if (explode && mode === 'max') {
    return Infinity;
  }

  // Base stats for a single die
  const singleMin = 1;
  const singleMax = sides;
  const singleAvg = (1 + sides) / 2;

  // Adjust for exploding (average)
  let adjustedAvg = singleAvg;
  if (explode && mode === 'avg') {
    // Geometric series for exploding dice
    // E[exploding d6] = E[d6] + (1/6) * E[exploding d6]
    // Solving: E = avg + (prob) * E => E = avg / (1 - prob)
    const explodeProb = calculateExplodeProbability(sides, explode);
    if (explodeProb < 1) {
      adjustedAvg = singleAvg / (1 - explodeProb);
    }
  }

  // Simple case: no keep/drop
  if (!keep) {
    switch (mode) {
      case 'min': return count * singleMin;
      case 'max': return explode ? Infinity : count * singleMax;
      case 'avg': return count * adjustedAvg;
    }
  }

  // With keep/drop: approximate using expected values
  // This is a simplification - exact calculation is complex
  const keptCount = keep.mode.startsWith('k') ? keep.count : count - keep.count;

  switch (mode) {
    case 'min':
      return keptCount * singleMin;
    case 'max':
      return explode ? Infinity : keptCount * singleMax;
    case 'avg':
      // Rough approximation: kept dice tend to be above average for kh, below for kl
      if (keep.mode === 'kh' || keep.mode === 'dl') {
        // Keeping high values
        return keptCount * adjustedAvg * (1 + (count - keptCount) / (count + 1) * 0.3);
      } else {
        // Keeping low values
        return keptCount * adjustedAvg * (1 - (count - keptCount) / (count + 1) * 0.3);
      }
  }
}

function calculateExplodeProbability(
  sides: number,
  explode: NonNullable<Extract<DiceNode, { type: 'dice' }>['explode']>
): number {
  const threshold = explode.threshold ?? { op: '=' as const, value: sides };

  switch (threshold.op) {
    case '=': return 1 / sides;
    case '>': return Math.max(0, sides - threshold.value) / sides;
    case '<': return Math.max(0, threshold.value - 1) / sides;
  }
}

// ============================================================================
// Formatting
// ============================================================================

function formatDiceNode(node: Extract<DiceNode, { type: 'dice' }>): string {
  let str = `${node.count}d${node.sides}`;

  if (node.reroll) {
    str += node.reroll.once ? 'ro' : 'r';
    str += `${node.reroll.condition.op === '=' ? '' : node.reroll.condition.op}${node.reroll.condition.value}`;
  }

  if (node.explode) {
    str += node.explode.mode;
    if (node.explode.threshold) {
      str += `${node.explode.threshold.op === '=' ? '' : node.explode.threshold.op}${node.explode.threshold.value}`;
    }
  }

  if (node.keep) {
    str += `${node.keep.mode}${node.keep.count}`;
  }

  return str;
}

// ============================================================================
// Weather Range Sampling
// ============================================================================

import type { WeatherRange } from '#types/entities/terrainDefinition';

/**
 * Samplet einen Wert aus einem WeatherRange.
 * Gleichverteilung um average, mit linearer Interpolation zu min/max.
 */
export function sampleFromRange(range: WeatherRange, seed?: number): number {
  const random = seed !== undefined ? seededRandom(seed) : Math.random();
  const deviation = (random - 0.5) * 2; // -1 bis +1

  if (deviation >= 0) {
    return lerp(range.average, range.max, deviation);
  } else {
    return lerp(range.average, range.min, -deviation);
  }
}

/**
 * Einfacher Seeded Random Generator (xorshift).
 * Gibt einen Wert zwischen 0 und 1 zurück.
 * HACK: Single xorshift step - ausreichend für Weather-Sampling,
 * aber nicht für kryptographische oder statistische Zwecke.
 */
function seededRandom(seed: number): number {
  let x = seed;
  x ^= x << 13;
  x ^= x >> 17;
  x ^= x << 5;
  return (x >>> 0) / 0xFFFFFFFF;
}

/**
 * Lineare Interpolation zwischen a und b.
 */
function lerp(a: number, b: number, t: number): number {
  return a + (b - a) * t;
}
