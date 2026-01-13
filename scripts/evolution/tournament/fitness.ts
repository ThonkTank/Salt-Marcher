// Ziel: Fitness-Berechnung für NEAT Evolution
// Siehe: docs/services/combatantAI/algorithm-approaches.md

import type { FightResult } from './fight';

// ============================================================================
// TYPES
// ============================================================================

/**
 * Aggregierte Statistiken aus mehreren Kämpfen.
 */
export interface FightStatistics {
  /** Anzahl Siege */
  wins: number;
  /** Anzahl Niederlagen */
  losses: number;
  /** Anzahl Unentschieden */
  draws: number;
  /** Durchschnittliche Rundenzahl */
  avgRounds: number;
  /** Gesamtschaden zugefügt */
  totalDamageDealt: number;
  /** Gesamtschaden erhalten */
  totalDamageReceived: number;
  /** Durchschnittliche Überlebende */
  avgSurvivors: number;
  /** Anzahl Kämpfe */
  totalFights: number;

  // === Erweiterte Statistiken (für Diagnose) ===

  /** Anzahl Treffer */
  totalHits: number;
  /** Anzahl Fehlschläge */
  totalMisses: number;
  /** Trefferquote (0-1) */
  hitRate: number;
  /** Anzahl Kills */
  totalKills: number;
  /** Anzahl Deaths */
  totalDeaths: number;
  /** Durchschnittlicher HP-Verlust in Prozent (0-1) */
  avgHPLostPercent: number;
  /** Durchschnittlicher Enemy HP-Verlust in Prozent (0-1) */
  avgEnemyHPLostPercent: number;
}

// ============================================================================
// FITNESS WEIGHTS (konfigurierbar)
// ============================================================================

/**
 * Gewichtungsfaktoren für die Fitness-Berechnung.
 * Kann angepasst werden für unterschiedliche Trainings-Ziele.
 */
export interface FitnessWeights {
  /** Punkte pro Sieg (default: 100) */
  winPoints: number;
  /** Gewicht für Damage-Ratio (default: 20) */
  damageRatioWeight: number;
  /** Gewicht für Effizienz (1/avgRounds) (default: 10) */
  efficiencyWeight: number;
  /** Punkte pro überlebenden Verbündeten (default: 5) */
  survivorPoints: number;
}

/**
 * Standard-Gewichtungen laut Plan.
 */
export const DEFAULT_FITNESS_WEIGHTS: FitnessWeights = {
  winPoints: 100,
  damageRatioWeight: 20,
  efficiencyWeight: 10,
  survivorPoints: 5,
};

// ============================================================================
// MAIN FUNCTIONS
// ============================================================================

/**
 * Aggregiert FightResults zu FightStatistics.
 */
export function aggregateResults(results: FightResult[]): FightStatistics {
  if (results.length === 0) {
    return {
      wins: 0,
      losses: 0,
      draws: 0,
      avgRounds: 0,
      totalDamageDealt: 0,
      totalDamageReceived: 0,
      avgSurvivors: 0,
      totalFights: 0,
      // Erweiterte Statistiken
      totalHits: 0,
      totalMisses: 0,
      hitRate: 0,
      totalKills: 0,
      totalDeaths: 0,
      avgHPLostPercent: 0,
      avgEnemyHPLostPercent: 0,
    };
  }

  let wins = 0, losses = 0, draws = 0;
  let totalRounds = 0, totalDealt = 0, totalReceived = 0, totalSurvivors = 0;
  // Erweiterte Zähler
  let totalHits = 0, totalMisses = 0;
  let totalKills = 0, totalDeaths = 0;
  let totalHPLostPercent = 0, totalEnemyHPLostPercent = 0;

  for (const r of results) {
    if (r.winner === 'party') wins++;
    else if (r.winner === 'enemy') losses++;
    else draws++;

    totalRounds += r.rounds;
    totalDealt += r.partyDamageDealt;
    totalReceived += r.partyDamageReceived;
    totalSurvivors += r.partySurvivors;

    // Erweiterte Statistiken aggregieren
    totalHits += r.partyHits;
    totalMisses += r.partyMisses;
    totalKills += r.partyKills;
    totalDeaths += r.enemyKills;  // Enemy kills = Party deaths

    // HP-Lost Prozent (sicher gegen Division durch 0)
    if (r.partyStartHP > 0) {
      totalHPLostPercent += (r.partyStartHP - r.partyEndHP) / r.partyStartHP;
    }
    if (r.enemyStartHP > 0) {
      totalEnemyHPLostPercent += (r.enemyStartHP - r.enemyEndHP) / r.enemyStartHP;
    }
  }

  const n = results.length;
  const totalAttempts = totalHits + totalMisses;

  return {
    wins,
    losses,
    draws,
    avgRounds: totalRounds / n,
    totalDamageDealt: totalDealt,
    totalDamageReceived: totalReceived,
    avgSurvivors: totalSurvivors / n,
    totalFights: n,
    // Erweiterte Statistiken
    totalHits,
    totalMisses,
    hitRate: totalAttempts > 0 ? totalHits / totalAttempts : 0,
    totalKills,
    totalDeaths,
    avgHPLostPercent: totalHPLostPercent / n,
    avgEnemyHPLostPercent: totalEnemyHPLostPercent / n,
  };
}

/**
 * Berechnet die Fitness aus aggregierten Statistiken.
 *
 * Formel:
 * fitness = (wins × winPoints)
 *         + (damageDealt / max(1, damageReceived) × damageRatioWeight)
 *         + (1 / max(1, avgRounds) × efficiencyWeight)
 *         + (avgSurvivors × survivorPoints)
 *
 * @param stats - Aggregierte Kampf-Statistiken
 * @param weights - Gewichtungsfaktoren (optional, default = DEFAULT_FITNESS_WEIGHTS)
 * @returns Fitness-Wert (höher = besser)
 */
export function calculateFitness(
  stats: FightStatistics,
  weights: FitnessWeights = DEFAULT_FITNESS_WEIGHTS
): number {
  const {
    winPoints,
    damageRatioWeight,
    efficiencyWeight,
    survivorPoints,
  } = weights;

  // Komponenten berechnen
  const winComponent = stats.wins * winPoints;

  const damageRatio = stats.totalDamageDealt / Math.max(1, stats.totalDamageReceived);
  const damageComponent = damageRatio * damageRatioWeight;

  const efficiency = 1 / Math.max(1, stats.avgRounds);
  const efficiencyComponent = efficiency * efficiencyWeight;

  const survivorComponent = stats.avgSurvivors * survivorPoints;

  return winComponent + damageComponent + efficiencyComponent + survivorComponent;
}

/**
 * Berechnet Fitness direkt aus FightResults.
 * Convenience-Funktion die aggregation + calculation kombiniert.
 */
export function calculateFitnessFromResults(
  results: FightResult[],
  weights: FitnessWeights = DEFAULT_FITNESS_WEIGHTS
): number {
  const stats = aggregateResults(results);
  return calculateFitness(stats, weights);
}

/**
 * Normalisiert Fitness-Werte auf einen Bereich [0, 1].
 * Nützlich für vergleichbare Fitness-Werte über Generationen.
 *
 * @param fitnessValues - Array von Fitness-Werten
 * @returns Normalisierte Werte im Bereich [0, 1]
 */
export function normalizeFitness(fitnessValues: number[]): number[] {
  if (fitnessValues.length === 0) return [];

  const min = Math.min(...fitnessValues);
  const max = Math.max(...fitnessValues);
  const range = max - min;

  if (range === 0) {
    // Alle Werte gleich → alle auf 0.5 setzen
    return fitnessValues.map(() => 0.5);
  }

  return fitnessValues.map(v => (v - min) / range);
}

/**
 * Berechnet den Fitness-Rang innerhalb einer Population.
 * Gibt für jeden Fitness-Wert den Rang zurück (0 = bester).
 */
export function rankFitness(fitnessValues: number[]): number[] {
  const indexed = fitnessValues.map((v, i) => ({ value: v, index: i }));
  indexed.sort((a, b) => b.value - a.value);  // Absteigend sortieren

  const ranks = new Array<number>(fitnessValues.length);
  for (let rank = 0; rank < indexed.length; rank++) {
    ranks[indexed[rank].index] = rank;
  }
  return ranks;
}
