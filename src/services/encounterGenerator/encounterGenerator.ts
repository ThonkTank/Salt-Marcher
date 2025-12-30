// Ziel: Encounter-Generierungs-Pipeline verwalten. Helper-Skripte nach Bedarf aufrufen.
// Siehe: docs/services/encounter/Encounter.md
//
// Pipeline:
// 1.: Multi-Group-Check
// 2.: groupSeed.ts - Seed-Kreatur auswählen
// 3.: groupPopulation.ts - Template → Slots → Kreaturen
// 4.: Flavouring (Activity, NPCs, Loot, Distance)
// 5.: difficulty.ts - Ziel-Difficulty bestimmen + Simulation
// 6.: balancing.ts - Balancing-Loop bis Ziel erreicht
// 7.: EncounterInstance zusammenbauen
//
// DISKREPANZEN (als [HACK] oder [TODO] markiert):
// ================================================
//
// [HACK: Encounter.md#orchestration] Doku zeigt Result-Handling für groupSeed
//   → Impl verwendet `| null`, Doku zeigt `isErr()/unwrap()`
//
// [HACK: Encounter.md#orchestration] exclude als Teil von context
//   → Doku zeigt separaten options-Parameter: selectSeed(context, { exclude })
//
// [HACK: Encounter.md#input-schema] PartyMember.maxHp nicht in Doku
//   → partySnapshot.ts hat maxHp, Doku definiert nur hp
//
// [TODO: Encounter.md#input-schema] EncounterConstraints nicht implementiert
//   → Post-MVP Feature für min/maxDifficulty, requiredTags, etc.
//
// RESOLVED:
// - [2025-12-29] terrain als vollständige TerrainDefinition (statt partieller Struktur)
// - [2025-12-29] weather an groupSeed übergeben (Weather-Präferenzen aktiviert)
// - [2025-12-29] crBudget in Doku ergänzt, position+thresholds in PartySnapshot
// - [2025-12-29] trigger bleibt string (MVP), Doku mit Post-MVP-Hinweis
// - [2025-12-29] position verwendet HexCoordinate statt inline { q, r }
// - [2025-12-30] NPCs auf Encounter-Ebene (1-3 NPCs), nicht mehr leadNPC pro Gruppe

// ============================================================================
// IMPORTS
// ============================================================================

import type { EncounterInstance } from '#types/encounterTypes';
import { type Result, ok, err } from '#types/common/Result';
import type { GameDateTime } from '#types/time';
import type { TerrainDefinition, CreatureDefinition, NPC, Faction } from '@/types/entities';
import type { PartySnapshot } from '#types/partySnapshot';
import type { HexCoordinate } from '#types/hexCoordinate';

// ============================================================================
// RESULT-TYP
// ============================================================================

/** Ergebnis von generateEncounter - Encounter + neu generierte NPCs */
export interface EncounterResult {
  encounter: EncounterInstance;
  generatedNPCs: NPC[];  // Neue NPCs die persistiert werden müssen
}

import { vault } from '@/infrastructure/vault/vaultInstance';
import * as groupSeed from './groupSeed';
import * as groupPopulation from './groupPopulation';
import * as groupActivity from './groupActivity';
import * as encounterNPCs from './encounterNPCs';
import * as encounterLoot from './encounterLoot';
import * as encounterDistance from './encounterDistance';
import * as difficulty from './difficulty';
import * as balancing from './balancing';

import {
  MULTI_GROUP_PROBABILITY,
  MAX_BALANCING_ITERATIONS,
  SECONDARY_ROLE_THRESHOLDS,
} from '@/constants/encounterConfig';

// ============================================================================
// PIPELINE-FUNKTION
// ============================================================================

/**
 * Generiert einen vollständigen Encounter basierend auf dem übergebenen Kontext.
 * Siehe: docs/services/encounter/Encounter.md
 */
export function generateEncounter(context: {
  position: HexCoordinate;
  terrain: TerrainDefinition;
  crBudget: number;
  timeSegment: GameDateTime['segment'];
  weather: { type: string; severity: number };
  party: PartySnapshot;
  factions: { factionId: string; weight: number }[];
  trigger: string;
}): Result<EncounterResult, { code: string; message?: string }> {

  // -------------------------------------------------------------------------
  // Step 1: Multi-Group-Check
  // -------------------------------------------------------------------------
  const isMultiGroup = Math.random() < MULTI_GROUP_PROBABILITY;

  // -------------------------------------------------------------------------
  // Step 2: Primäre Seed-Auswahl
  // Siehe: docs/services/encounter/groupSeed.md
  // -------------------------------------------------------------------------
  const primarySeed = groupSeed.selectSeed({
    terrain: { id: context.terrain.id },
    crBudget: context.crBudget,
    timeSegment: context.timeSegment,
    factions: context.factions,
    weather: context.weather,
  });
  if (!primarySeed) {
    return err({ code: 'NO_ELIGIBLE_CREATURES' });
  }

  // -------------------------------------------------------------------------
  // Step 3: Sekundäre Seed (nur bei Multi-Group)
  // -------------------------------------------------------------------------
  let secondarySeed: { creatureId: string; factionId: string | null } | null = null;
  let secondaryRole: 'threat' | 'victim' | 'neutral' | 'ally' = 'neutral';

  if (isMultiGroup) {
    secondarySeed = groupSeed.selectSeed({
      terrain: { id: context.terrain.id },
      crBudget: context.crBudget,
      timeSegment: context.timeSegment,
      factions: context.factions,
      exclude: [primarySeed.creatureId],
      weather: context.weather,
    });
    if (secondarySeed) {
      secondaryRole = rollSecondaryRole();
    }
  }

  // -------------------------------------------------------------------------
  // Step 4: Gruppen-Population
  // Siehe: docs/services/encounter/groupPopulation.md
  // -------------------------------------------------------------------------

  // Eligible Creatures für fraktionslose Gruppen laden (einmalig)
  const eligibleCreatures = loadEligibleCreatures(context.terrain.id, context.timeSegment);

  const populatedGroups: groupPopulation.PopulatedGroup[] = [];

  const primaryResult = groupPopulation.generateEncounterGroup(
    { creatureId: primarySeed.creatureId, factionId: primarySeed.factionId },
    { terrain: context.terrain, timeSegment: context.timeSegment, eligibleCreatures },
    'threat'
  );
  if (!primaryResult.ok) {
    return err(primaryResult.error);
  }
  populatedGroups.push(primaryResult.value);

  if (secondarySeed) {
    const secondaryResult = groupPopulation.generateEncounterGroup(
      { creatureId: secondarySeed.creatureId, factionId: secondarySeed.factionId },
      { terrain: context.terrain, timeSegment: context.timeSegment, eligibleCreatures },
      secondaryRole
    );
    if (secondaryResult.ok) {
      populatedGroups.push(secondaryResult.value);
    }
  }

  // -------------------------------------------------------------------------
  // Step 5: Flavouring (Activity, NPCs, Loot, Distance)
  // -------------------------------------------------------------------------

  // Step 5.1: Activity + Goal für alle Gruppen zuweisen
  const groupsWithActivity = populatedGroups.map((group) => {
    // Faction für Pool-Hierarchie laden (falls vorhanden)
    const faction = group.factionId
      ? vault.getEntity<Faction>('faction', group.factionId)
      : undefined;

    return groupActivity.assignActivity(
      group,
      { terrain: context.terrain, timeSegment: context.timeSegment },
      faction
    );
  });

  // Step 5.2: NPCs für ALLE Gruppen zuweisen (1-3 NPCs pro Encounter)
  const npcResult = encounterNPCs.assignEncounterNPCs(groupsWithActivity, {
    position: context.position,
  });
  // Alle NPC-IDs (matched + generated) für die EncounterInstance
  const allNPCs = [...npcResult.matchedNPCs, ...npcResult.generatedNPCs];
  const encounterNpcIds = allNPCs.map(npc => npc.id);

  // Step 5.3-5.4: Loot und Distance pro Gruppe
  const flavouredGroups: encounterDistance.GroupWithPerception[] = [];

  for (const group of npcResult.groups) {
    // Step 5.3: Loot generieren
    const withLoot = encounterLoot.generateEncounterLoot(group, {
      terrain: context.terrain,
    });

    // Step 5.4: Perception + Distanz berechnen
    const withDistance = encounterDistance.calculate(withLoot, {
      terrain: context.terrain,
      weather: context.weather,
      timeSegment: context.timeSegment,
    });

    flavouredGroups.push(withDistance);
  }

  // -------------------------------------------------------------------------
  // Step 6: Ziel-Difficulty bestimmen
  // Siehe: docs/services/encounter/Difficulty.md
  // -------------------------------------------------------------------------
  const targetDifficulty = difficulty.rollTargetDifficulty(context.terrain.threatLevel);

  // -------------------------------------------------------------------------
  // Step 7-9: Balancing-Loop
  // Siehe: docs/services/encounter/Balancing.md
  // -------------------------------------------------------------------------
  let currentGroups = flavouredGroups;
  let simulationResult = difficulty.simulate(currentGroups, context.party);
  let iterations = 0;

  while (simulationResult.label !== targetDifficulty && iterations < MAX_BALANCING_ITERATIONS) {
    const adjusted = balancing.adjust(currentGroups, simulationResult, targetDifficulty, context);
    if (!adjusted) {
      break; // Balancing nicht möglich → aktuelle Gruppen akzeptieren
    }
    currentGroups = adjusted;
    simulationResult = difficulty.simulate(currentGroups, context.party);
    iterations++;
  }

  // -------------------------------------------------------------------------
  // Step 10: EncounterInstance zusammenbauen
  // -------------------------------------------------------------------------
  const encounterInstance: EncounterInstance = {
    id: crypto.randomUUID(),
    groups: currentGroups.map(g => ({
      creatures: g.creatures,
      activity: g.activity,
      goal: g.goal,
      disposition: g.disposition,
      narrativeRole: g.narrativeRole,
    })),
    npcs: encounterNpcIds, // 1-3 NPC-IDs pro Encounter
    loot: aggregateLoot(currentGroups),
    perception: aggregatePerception(currentGroups),
    difficulty: {
      label: simulationResult.label,
      winProbability: simulationResult.winProbability,
      tpkRisk: simulationResult.tpkRisk,
    },
    context: {
      position: context.position,
      terrain: context.terrain.id,
      timeSegment: context.timeSegment,
      weather: context.weather,
    },
    description: '', // TODO: Flavour-Service
  };

  return ok({
    encounter: encounterInstance,
    generatedNPCs: npcResult.generatedNPCs,
  });
}

// ============================================================================
// HELPER-FUNKTIONEN
// ============================================================================

function rollSecondaryRole(): 'threat' | 'victim' | 'neutral' | 'ally' {
  const roll = Math.random();
  if (roll < SECONDARY_ROLE_THRESHOLDS.victim) return 'victim';
  if (roll < SECONDARY_ROLE_THRESHOLDS.neutral) return 'neutral';
  if (roll < SECONDARY_ROLE_THRESHOLDS.ally) return 'ally';
  return 'threat';
}

function aggregateLoot(
  groups: { loot: { items: { id: string; quantity: number }[]; totalValue: number } }[]
): { items: { id: string; quantity: number }[]; totalValue: number } {
  const allItems: { id: string; quantity: number }[] = [];
  let totalValue = 0;
  for (const g of groups) {
    allItems.push(...g.loot.items);
    totalValue += g.loot.totalValue;
  }
  return { items: allItems, totalValue };
}

function aggregatePerception(
  groups: { perception: { partyDetectsEncounter: number; encounterDetectsParty: number; isSurprise: boolean } }[]
): { partyDetectsEncounter: number; encounterDetectsParty: number; isSurprise: boolean } {
  // Nächste Distanz gewinnt
  let minPartyDetects = Infinity;
  let minEncounterDetects = Infinity;
  let anySurprise = false;
  for (const g of groups) {
    minPartyDetects = Math.min(minPartyDetects, g.perception.partyDetectsEncounter);
    minEncounterDetects = Math.min(minEncounterDetects, g.perception.encounterDetectsParty);
    anySurprise = anySurprise || g.perception.isSurprise;
  }
  return {
    partyDetectsEncounter: minPartyDetects === Infinity ? 60 : minPartyDetects,
    encounterDetectsParty: minEncounterDetects === Infinity ? 60 : minEncounterDetects,
    isSurprise: anySurprise,
  };
}

/**
 * Lädt eligible Creatures für fraktionslose Gruppen.
 * Gefiltert nach Terrain-Affinität und aktiver Tageszeit.
 */
function loadEligibleCreatures(
  terrainId: string,
  timeSegment: GameDateTime['segment']
): CreatureDefinition[] {
  const allCreatures = vault.getAllEntities<CreatureDefinition>('creature');
  return allCreatures.filter(c =>
    c.terrainAffinities.includes(terrainId) &&
    c.activeTime.includes(timeSegment)
  );
}
