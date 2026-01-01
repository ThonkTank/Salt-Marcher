// Ziel: Encounter-Generierungs-Pipeline verwalten. Helper-Skripte nach Bedarf aufrufen.
// Siehe: docs/services/encounter/Encounter.md
//
// TASKS:
// | # | Status | Domain | Layer | Beschreibung | Prio | MVP? | Deps | Spec | Imp. |
// |--:|:------:|--------|-------|--------------|:----:|:----:|------|------|------|
// | 13 | ⬜ | Encounter | services | Flavour-Service fuer Encounter-Beschreibung implementieren | niedrig | Nein | - | encounter.md#Pipeline | - |
// | 27 | ⬜ | Encounter | services | EncounterConstraints implementieren (min/maxDifficulty, requiredTags) - Post-MVP | niedrig | Nein | - | encounter.md#Input-Schema | - |
// | 30 | ✅ | Encounter | services | terrain als vollstaendige TerrainDefinition (statt partieller Struktur) | mittel | Ja | - | encounter.md#Input-Schema | - |
// | 31 | ✅ | Encounter | services | weather an groupSeed uebergeben (Weather-Praeferenzen aktiviert) | mittel | Ja | - | encounter.md#Pipeline | - |
// | 34 | ✅ | Encounter | services | position verwendet HexCoordinate statt inline { q, r } | mittel | Ja | - | encounter.md#Input-Schema | - |
// | 35 | ✅ | Encounter | services | NPCs auf Encounter-Ebene (1-3 NPCs), nicht mehr leadNPC pro Gruppe | mittel | Ja | - | encounter.md#Pipeline | - |
//
// Pipeline:
// 1.: Multi-Group-Check
// 2.: groupSeed.ts - Seed-Kreatur auswählen
// 3.: groupPopulation.ts - Template → Slots → Kreaturen
// 4.: Flavouring (NPCs → Activity → Loot → Distance)
//     - NPCs VOR Activity, damit NPC-Reputation in Disposition einfließt
// 5.: difficulty.ts - Ziel-Difficulty bestimmen + Simulation
// 6.: balancing.ts - Balancing-Loop bis Ziel erreicht
// 7.: EncounterInstance zusammenbauen

// ============================================================================
// IMPORTS
// ============================================================================

import type { EncounterInstance } from '#types/encounterTypes';
import { type Result, ok, err } from '#types/common/Result';
import type { GameDateTime } from '#types/time';
import type { TerrainDefinition, CreatureDefinition, NPC, Faction } from '@/types/entities';
import type { PartySnapshot } from '#types/partySnapshot';
import type { HexCoordinate } from '#types/hexCoordinate';
import type { NarrativeRole } from '@/constants';

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
  DEFAULT_PERCEPTION_DISTANCE,
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
  time: GameDateTime;  // Volles Zeit-Objekt für NPC-Generierung
  weather: { type: string; severity: number };
  party: PartySnapshot;
  factions: { factionId: string; randWeighting: number }[];
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
  let secondaryRole: NarrativeRole = 'neutral';

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
  // Step 5: Flavouring (NPCs, Activity, Loot, Distance)
  // -------------------------------------------------------------------------

  // Step 5.1: NPCs für ALLE Gruppen zuweisen (VOR Activity für NPC-Reputation!)
  const npcResult = encounterNPCs.assignEncounterNPCs(populatedGroups, {
    position: context.position,
    time: context.time,
  });
  // Alle NPC-IDs (matched + generated) für die EncounterInstance
  const allNPCs = [...npcResult.matchedNPCs, ...npcResult.generatedNPCs];
  const encounterNpcIds = allNPCs.map(npc => npc.id);

  // Step 5.2: Activity + Goal + Disposition für alle Gruppen zuweisen
  // NPC-Reputation wird jetzt korrekt berücksichtigt
  const groupsWithActivity = npcResult.groups.map((group) => {
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

  // Step 5.3: Loot für ALLE Gruppen generieren (Budget-basiert)
  const groupsWithLoot = encounterLoot.generateEncounterLoot(groupsWithActivity, {
    terrain: context.terrain,
    partyLevel: context.party.level,
  });

  // Step 5.4: Perception + Distanz pro Gruppe berechnen
  const flavouredGroups: encounterDistance.GroupWithPerception[] = [];
  for (const group of groupsWithLoot) {
    const withDistance = encounterDistance.calculate(group, {
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
    description: '',
  };

  return ok({
    encounter: encounterInstance,
    generatedNPCs: npcResult.generatedNPCs,
  });
}

// ============================================================================
// HELPER-FUNKTIONEN
// ============================================================================

function rollSecondaryRole(): NarrativeRole {
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
    partyDetectsEncounter: minPartyDetects === Infinity ? DEFAULT_PERCEPTION_DISTANCE : minPartyDetects,
    encounterDetectsParty: minEncounterDetects === Infinity ? DEFAULT_PERCEPTION_DISTANCE : minEncounterDetects,
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
