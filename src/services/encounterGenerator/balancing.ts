// Ziel: Encounter-Gruppen an Ziel-Difficulty anpassen durch Umstände-Modifikation.
// Siehe: docs/services/encounter/balancing.md
//
// Pipeline-Übersicht (laut Dokumentation):
// 6.1.1 Ziel-WinProb aus targetDifficulty ableiten
// 6.1.2 Optionen sammeln (Distance, Disposition, Activity, Environment)
// 6.1.3 Beste Option wählen (kleinste Distanz zum Ziel-WinProb)
// 6.1.4 Option anwenden und iterieren bis Ziel erreicht

// ============================================================================
// HACK & TODO
// ============================================================================
//
// [HACK]: Geschätzte Win-Probability-Deltas statt echte Re-Simulation
// - estimatedWinProbDelta sind feste Schätzwerte pro Option
// - Keine echte simulatePMF() Aufrufe nach jeder Anpassung
//
// [HACK]: Feste Optionen pro Anpassungs-Typ
// - collectAdjustmentOptions() liefert statische Optionen
// - Keine dynamische Berechnung basierend auf Kontext
// - Distance: ±50ft, ±100ft mit festen Deltas
// - Disposition: hostile/indifferent ohne Range-Berechnung
// - Activity: nur sleeping/ambush/resting
// - Environment: generische Cover/Difficult-Terrain ohne terrain.features[]
//
// [HACK]: Disposition-Mapping von Zahl auf Enum
// - applyOption() mappt targetValue auf Disposition-Enum
// - Schwellwerte: <-10 = hostile, >10 = friendly, sonst indifferent
// - Keine Berücksichtigung von Creature-Base und Faction-Base Range
//
// [TODO]: Implementiere echte Re-Simulation nach jeder Anpassung
// - Spec: balancing.md#anpassungs-algorithmus
// - Ersetze currentWinProb += delta durch simulatePMF(workingGroups, party)
// - Benötigt: party-Parameter in adjust() Signatur
//
// [TODO]: Implementiere Multi-Group-Optionen
// - Spec: balancing.md#multi-group-algorithmus
// - collectMultiGroupOptions() für zweite Gruppe (threat/ally)
// - generateSecondGroup() vollständig implementieren
// - Maximal 2 Gruppen pro Encounter (MVP-Limit)
//
// [TODO]: Implementiere Creature-Slot-Anpassungen
// - Spec: balancing.md#creature-slot-anpassungen
// - Anzahl innerhalb Role-Range anpassen
// - Kreatur-Swap mit gleicher designRole
// - Gruppen-Verschiebung bei Multi-Group
//
// [TODO]: Implementiere Terrain-Features
// - Spec: balancing.md#optionen-sammeln
// - Features aus context.terrain.features[] laden
// - Hazard-Vulnerabilität berechnen (balancing.md#hazard-definition)
//
// [TODO]: Implementiere Activity-Pool
// - Spec: groupActivity.md#activity-pool-hierarchie
// - Pool aus GENERIC_ACTIVITY_IDS + creature.activities + faction.activities
//
// [TODO]: Implementiere Disposition-Range
// - Spec: balancing.md#optionen-sammeln (getDispositionRange)
// - Range aus Creature-Base und Faction-Base berechnen
//
// [TODO]: Implementiere calculateAllyStrengthModifier()
// - Spec: balancing.md#ally-staerke-formel
// - CR-zu-Level-Verhältnis berechnen
// - effectivePartyMultiplier aus strengthRatio

import type { EncounterGroup } from '@/types/encounterTypes';
import type { ThreatLevel } from '@/types/entities';
import type { DifficultyLabel } from '@/constants';
import type { Weather } from '#types/weather';
// TODO: import { simulatePMF } from './difficulty' wenn Re-Simulation implementiert wird

// ============================================================================
// TYPES (inline, service-intern)
// ============================================================================

type AdjustmentType = 'environment' | 'distance' | 'disposition' | 'activity';

interface AdjustmentOption {
  type: AdjustmentType;
  description: string;
  estimatedWinProbDelta: number; // HACK: siehe Header
  groupId?: string;
  targetValue?: number;
}

interface SimulationResult {
  label: DifficultyLabel;
  winProbability: number;
  tpkRisk: number;
}

// ============================================================================
// CONSTANTS
// ============================================================================

const MAX_ITERATIONS = 10;

/** Ziel-Win-Probability pro Difficulty-Stufe. Spec: balancing.md#anpassungs-algorithmus */
const TARGET_WIN_PROBABILITY: Record<DifficultyLabel, number> = {
  trivial: 0.97,
  easy: 0.90,
  moderate: 0.77,
  hard: 0.60,
  deadly: 0.40,
};

/** Difficulty-Label aus Win-Probability ableiten. Inverse von TARGET_WIN_PROBABILITY. */
function getDifficultyFromWinProb(winProb: number): DifficultyLabel {
  if (winProb >= 0.95) return 'trivial';
  if (winProb >= 0.85) return 'easy';
  if (winProb >= 0.70) return 'moderate';
  if (winProb >= 0.50) return 'hard';
  return 'deadly';
}

// ============================================================================
// MAIN FUNCTION
// ============================================================================

/**
 * Passt Encounter-Gruppen an die Ziel-Difficulty an.
 * Gibt null zurück wenn keine Anpassung möglich ist.
 */
export function adjust(
  groups: EncounterGroup[],
  simulation: SimulationResult,
  targetDifficulty: DifficultyLabel,
  context: {
    terrain: { id: string; threatLevel: ThreatLevel };
    weather: Weather;
    timeSegment: string;
  }
): EncounterGroup[] | null {
  const targetWinProb = TARGET_WIN_PROBABILITY[targetDifficulty];

  if (simulation.label === targetDifficulty) {
    return groups;
  }

  let workingGroups = structuredClone(groups);
  let currentWinProb = simulation.winProbability;
  let iterations = 0;

  while (iterations < MAX_ITERATIONS) {
    const currentDifficulty = getDifficultyFromWinProb(currentWinProb);
    if (currentDifficulty === targetDifficulty) {
      break;
    }

    const options = collectAdjustmentOptions(workingGroups, currentWinProb, targetWinProb, context);

    if (options.length === 0) {
      // TODO: Multi-Group als Fallback (siehe Header)
      return null;
    }

    const bestOption = selectBestOption(options, currentWinProb, targetWinProb);
    workingGroups = applyOption(workingGroups, bestOption);

    // HACK: siehe Header - geschätzte Deltas statt Re-Simulation
    currentWinProb = clamp(currentWinProb + bestOption.estimatedWinProbDelta, 0, 1);

    iterations++;
  }

  const finalDifficulty = getDifficultyFromWinProb(currentWinProb);
  if (finalDifficulty !== targetDifficulty) {
    return null;
  }

  return workingGroups;
}

// ============================================================================
// OPTION COLLECTION
// ============================================================================

/** Sammelt verfügbare Anpassungs-Optionen. HACK: siehe Header - feste Optionen */
function collectAdjustmentOptions(
  groups: EncounterGroup[],
  currentWinProb: number,
  targetWinProb: number,
  context: {
    terrain: { id: string; threatLevel: ThreatLevel };
    weather: Weather;
    timeSegment: string;
  }
): AdjustmentOption[] {
  const options: AdjustmentOption[] = [];
  const needHarder = currentWinProb > targetWinProb;

  // Distance Options - HACK: siehe Header
  if (needHarder) {
    options.push({ type: 'distance', description: 'Reduce distance by 50ft', estimatedWinProbDelta: -0.08 });
    options.push({ type: 'distance', description: 'Reduce distance by 100ft', estimatedWinProbDelta: -0.15 });
  } else {
    options.push({ type: 'distance', description: 'Increase distance by 50ft', estimatedWinProbDelta: +0.08 });
    options.push({ type: 'distance', description: 'Increase distance by 100ft', estimatedWinProbDelta: +0.15 });
  }

  // Disposition Options - HACK: siehe Header
  for (const group of groups) {
    if (needHarder) {
      options.push({
        type: 'disposition',
        description: `Make ${group.groupId} more hostile`,
        groupId: group.groupId,
        targetValue: -20,
        estimatedWinProbDelta: -0.10,
      });
    } else {
      options.push({
        type: 'disposition',
        description: `Make ${group.groupId} more indifferent`,
        groupId: group.groupId,
        targetValue: 0,
        estimatedWinProbDelta: +0.12,
      });
    }
  }

  // Activity Options - HACK: siehe Header
  if (needHarder) {
    options.push({ type: 'activity', description: 'Set activity to ambush (high awareness)', estimatedWinProbDelta: -0.12 });
  } else {
    options.push({ type: 'activity', description: 'Set activity to sleeping (low awareness)', estimatedWinProbDelta: +0.18 });
    options.push({ type: 'activity', description: 'Set activity to resting', estimatedWinProbDelta: +0.10 });
  }

  // Environment Options - HACK: siehe Header
  if (needHarder) {
    options.push({ type: 'environment', description: 'Add cover for creatures', estimatedWinProbDelta: -0.08 });
  } else {
    options.push({ type: 'environment', description: 'Add difficult terrain (slows creatures)', estimatedWinProbDelta: +0.06 });
  }

  void context;
  return options;
}

// ============================================================================
// OPTION SELECTION
// ============================================================================

/** Wählt die beste Option basierend auf kleinster Distanz zum Ziel. */
function selectBestOption(
  options: AdjustmentOption[],
  currentWinProb: number,
  targetWinProb: number
): AdjustmentOption {
  const scored = options.map(opt => {
    const resultingWinProb = clamp(currentWinProb + opt.estimatedWinProbDelta, 0, 1);
    const distanceToTarget = Math.abs(resultingWinProb - targetWinProb);
    return { option: opt, distanceToTarget };
  });

  scored.sort((a, b) => a.distanceToTarget - b.distanceToTarget);
  return scored[0].option;
}

// ============================================================================
// OPTION APPLICATION
// ============================================================================

/** Wendet eine Anpassungs-Option auf die Gruppen an. HACK: siehe Header */
function applyOption(groups: EncounterGroup[], option: AdjustmentOption): EncounterGroup[] {
  const result = structuredClone(groups);

  switch (option.type) {
    case 'disposition': {
      // HACK: siehe Header - Mapping von Zahl auf Enum
      if (option.groupId) {
        const group = result.find(g => g.groupId === option.groupId);
        if (group && option.targetValue !== undefined) {
          if (option.targetValue < -10) {
            group.disposition = 'hostile';
          } else if (option.targetValue > 10) {
            group.disposition = 'friendly';
          } else {
            group.disposition = 'indifferent';
          }
        }
      }
      break;
    }

    case 'activity': {
      if (result.length > 0) {
        if (option.description.includes('sleeping')) {
          result[0].activity = 'sleeping';
        } else if (option.description.includes('ambush')) {
          result[0].activity = 'ambush';
        } else if (option.description.includes('resting')) {
          result[0].activity = 'resting';
        }
      }
      break;
    }

    case 'distance':
    case 'environment':
      // HACK: siehe Header - keine echte Änderung
      break;
  }

  return result;
}

// ============================================================================
// UTILITIES
// ============================================================================

function clamp(value: number, min: number, max: number): number {
  return Math.max(min, Math.min(max, value));
}

// ============================================================================
// FUTURE EXPORTS (Stubs)
// ============================================================================

/** Berechnet Ally-Stärke-Modifikator für Party. TODO: siehe Header */
export function calculateAllyStrengthModifier(
  _allyGroup: EncounterGroup,
  _party: { avgLevel: number }
): { effectivePartyMultiplier: number; reason: 'strong_ally' | 'weak_ally' | 'balanced' } {
  return { effectivePartyMultiplier: 1.0, reason: 'balanced' };
}

/** Generiert eine zweite Gruppe für Multi-Group-Anpassung. TODO: siehe Header */
export function generateSecondGroup(
  _context: { terrain: { id: string }; factions: { id: string; defaultDisposition: number }[] },
  _role: 'threat' | 'ally'
): EncounterGroup | null {
  return null;
}

