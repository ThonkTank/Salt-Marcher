// Ziel: sessionState für relevanten Kontext auslesen. Encounter-Generierungs-Pipeline verwalten. Helper-Skripte nach Bedarf aufrufen.
// Siehe: docs/services/encounter/Encounter.md
//
// Pipeline:
// 1.: Würfeln für Gruppen/Umgebungs-Features.
//     Siehe: docs/services/encounter/groupSeed.md
// 2.: groupGenerator.ts für jede zu generierende Gruppe aufrufen.
//     Siehe: docs/services/encounter/groupPopulation.md
// 3.: Bestimmen, welche Kreaturen zu NPCs befördert werden.
//     Siehe: docs/services/NPCs/NPC-Matching.md
// 4.: Passende NPCs suchen oder NPCs/npcGenerator.generateNPC() für jede zu befördernde Kreatur aufrufen.
//     Siehe: docs/services/NPCs/NPC-Generation.md
// 5.: loot/lootGenerator.generateLoot() für den gesamten Encounter aufrufen.
//     Siehe: docs/services/Loot.md
// 6.: In-line setDifficultyGoal() verwenden, um Schwierigkeitsziel des Encounters zu bestimmen.
//     Siehe: docs/services/encounter/Difficulty.md
// 7.: calcDifficulty.ts aufrufen, um aktuelle Schwierigkeit des Encounters zu berechnen.
//     Siehe: docs/services/encounter/Difficulty.md
// 8.: balanceEncounter.ts aufrufen, um eine Variable anzupassen und dem Schwierigkeitsziel näher zu kommen.
//     Siehe: docs/services/encounter/Balancing.md
// 9.: Schritte 7 & 8 wiederholen, bis Schwierigkeitsziel erreicht ist.

// ============================================================================
// IMPORTS
// ============================================================================

// Result-Pattern für fehlerbehandlung
import type { Result } from '@core/types/result';
import { isErr, isOk, ok, err, unwrap } from '@core/types/result';

// Helper-Module für Pipeline-Steps
import * as groupSeed from './groupSeed';           // Step 2: Seed-Auswahl (Terrain + Faction → Kreatur)
import * as groupPopulation from './groupPopulation'; // Step 3: Template → Slots → Kreaturen
import * as groupActivity from './groupActivity';     // Step 4.1-4.2: Activity + Goal zuweisen
import * as groupNPCs from './groupNPCs';             // Step 4.3: Lead-NPC pro Gruppe
import * as groupLoot from './groupLoot';             // Step 4.4: Loot generieren (→ LootService)
import * as encounterDistance from './encounterDistance'; // Step 4.5: Perception + Distanz berechnen
import * as difficulty from './difficulty';           // Step 5: PMF-Kampfsimulation
import * as balancing from './balancing';             // Step 6.1: Machbarkeits-Anpassung

// Typen für Pipeline-Datenfluss
import type { EncounterContext } from './types/EncounterContext';       // Input vom sessionState
import type { SeedSelection } from './types/SeedSelection';             // Output von groupSeed
import type { EncounterGroup } from './types/EncounterGroup';           // Output von groupPopulation
import type { FlavouredGroup } from './types/FlavouredGroup';           // Output von Step 4 (mit Activity, NPC, Loot, Perception)
import type { SimulationResult } from './types/SimulationResult';       // Output von difficulty
import type { EncounterInstance } from '@entities/encounter-instance';  // Finaler Output

// Enums und Union-Types
import type { NarrativeRole } from './types/NarrativeRole';             // 'threat' | 'victim' | 'neutral' | 'ally'

// Error-Typen
import type { EncounterError } from './types/EncounterError';

// Konfiguration (editierbar über Plugin-Optionen)
import {
  MULTI_GROUP_PROBABILITY,
  MAX_BALANCING_ITERATIONS,
  SECONDARY_ROLE_THRESHOLDS,
} from '@constants/EncounterConfig';

// ============================================================================
// PIPELINE-FUNKTION
// ============================================================================

/**
 * Generiert einen vollständigen Encounter basierend auf dem übergebenen Kontext.
 *
 * @param context - Encounter-Kontext vom sessionState
 *   - position: Aktuelle Hex-Position der Party
 *   - terrain: Terrain-Definition des aktuellen Hexes
 *   - timeSegment: Aktuelles Tages-Segment (dawn, morning, midday, afternoon, dusk, night)
 *   - weather: Aktuelles Wetter
 *   - party: Party-Daten (Level, Größe, Ressourcen)
 *   - factions: Aktive Factions in der Region
 *   - eligibleCreatures: Vorgefilterte Kreaturen für dieses Terrain
 *
 * @returns Result<EncounterInstance, EncounterError>
 *
 * Siehe: docs/services/encounter/Encounter.md
 */
export function generateEncounter(
  context: EncounterContext
): Result<EncounterInstance, EncounterError> {

  // -------------------------------------------------------------------------
  // Step 1: Multi-Group-Check
  // -------------------------------------------------------------------------
  const isMultiGroup = Math.random() < MULTI_GROUP_PROBABILITY;

  // -------------------------------------------------------------------------
  // Step 2: Primäre Seed-Auswahl
  // Siehe: docs/services/encounter/groupSeed.md
  // -------------------------------------------------------------------------
  const primarySeedResult = groupSeed.selectSeed(context);
  if (isErr(primarySeedResult)) return primarySeedResult;
  const primarySeed = unwrap(primarySeedResult);

  // -------------------------------------------------------------------------
  // Step 3: Sekundäre Seed (nur bei Multi-Group)
  // -------------------------------------------------------------------------
  let secondarySeed: SeedSelection | null = null;
  let secondaryRole: NarrativeRole = 'neutral';

  if (isMultiGroup) {
    const secondarySeedResult = groupSeed.selectSeed(context, {
      exclude: [primarySeed.seed.id],
    });
    if (isOk(secondarySeedResult)) {
      secondarySeed = unwrap(secondarySeedResult);
      secondaryRole = rollSecondaryRole();
    }
  }

  // -------------------------------------------------------------------------
  // Step 4: Gruppen-Population
  // Siehe: docs/services/encounter/groupPopulation.md
  // -------------------------------------------------------------------------
  const groups: EncounterGroup[] = [];

  const primaryGroupResult = groupPopulation.populate(primarySeed, context, 'threat');
  if (isErr(primaryGroupResult)) return primaryGroupResult;
  groups.push(unwrap(primaryGroupResult));

  if (secondarySeed) {
    const secondaryGroupResult = groupPopulation.populate(secondarySeed, context, secondaryRole);
    if (isErr(secondaryGroupResult)) return secondaryGroupResult;
    groups.push(unwrap(secondaryGroupResult));
  }

  // -------------------------------------------------------------------------
  // Step 5: Flavouring (Activity, NPCs, Loot, Distance)
  // Siehe: docs/services/encounter/groupActivity.md
  // Siehe: docs/services/NPCs/NPC-Matching.md, NPC-Generation.md
  // Siehe: docs/services/Loot.md
  // Siehe: docs/services/encounter/encounterDistance.md
  // -------------------------------------------------------------------------
  const flavouredGroups: FlavouredGroup[] = [];

  for (const group of groups) {
    // Step 5.1: Activity + Goal zuweisen
    const activityResult = groupActivity.assignActivity(group, context);
    if (isErr(activityResult)) return activityResult;

    // Step 5.2: NPCs zuweisen/generieren
    const npcsResult = groupNPCs.assignNPCs(unwrap(activityResult), context);
    if (isErr(npcsResult)) return npcsResult;

    // Step 5.3: Loot generieren
    const lootResult = groupLoot.generateLoot(unwrap(npcsResult), context);
    if (isErr(lootResult)) return lootResult;

    // Step 5.4: Perception + Distanz berechnen
    const distanceResult = encounterDistance.calculate(unwrap(lootResult), context);
    if (isErr(distanceResult)) return distanceResult;

    flavouredGroups.push(unwrap(distanceResult));
  }

  // -------------------------------------------------------------------------
  // Step 6: Ziel-Difficulty bestimmen
  // Siehe: docs/services/encounter/Difficulty.md
  // -------------------------------------------------------------------------
  const targetDifficulty = difficulty.rollTargetDifficulty(context.terrain.threat);

  // -------------------------------------------------------------------------
  // Step 7-9: Balancing-Loop
  // Siehe: docs/services/encounter/Balancing.md
  // -------------------------------------------------------------------------
  let currentGroups = flavouredGroups;
  let simulationResult: SimulationResult;
  let iterations = 0;

  do {
    // Step 7: Schwierigkeit berechnen
    simulationResult = difficulty.simulate(currentGroups, context.party);

    // Ziel erreicht?
    if (simulationResult.difficulty === targetDifficulty) {
      break;
    }

    // Step 8: Balancieren
    const balanceResult = balancing.adjust(currentGroups, simulationResult, targetDifficulty, context);
    if (isErr(balanceResult)) {
      // Balancing nicht möglich → aktuelle Gruppen akzeptieren
      break;
    }
    currentGroups = unwrap(balanceResult);
    iterations++;

  } while (iterations < MAX_BALANCING_ITERATIONS);

  // -------------------------------------------------------------------------
  // Step 10: EncounterInstance zusammenbauen
  // -------------------------------------------------------------------------
  const encounterInstance: EncounterInstance = {
    id: crypto.randomUUID(),
    groups: currentGroups,
    targetDifficulty,
    actualDifficulty: simulationResult.difficulty,
    simulation: simulationResult,
    context: {
      position: context.position,
      terrain: context.terrain.id,
      timeSegment: context.timeSegment,
      weather: context.weather,
    },
    balancingIterations: iterations,
    createdAt: Date.now(),
  };

  return ok(encounterInstance);
}

// ============================================================================
// HELPER-FUNKTIONEN
// ============================================================================

/**
 * Würfelt die narrative Rolle für eine sekundäre Gruppe.
 * Siehe: SECONDARY_ROLE_THRESHOLDS für Gewichtung
 */
function rollSecondaryRole(): NarrativeRole {
  const roll = Math.random();

  if (roll < SECONDARY_ROLE_THRESHOLDS.victim) return 'victim';
  if (roll < SECONDARY_ROLE_THRESHOLDS.neutral) return 'neutral';
  if (roll < SECONDARY_ROLE_THRESHOLDS.ally) return 'ally';
  return 'threat';
}
