// Ziel: Perception + Distanz für Encounter berechnen
// Siehe: docs/services/encounter/encounterDistance.md
//
// Pipeline:
//   1. calculateDistanceModifier() - maxDistance aus Terrain/Weather/Size
//   2. calculatePerceptionDistances() - bidirektionale Wahrnehmung
//   3. calculate() - Gruppe mit Perception-Daten anreichern

// ============================================================================
// HACK & TODO
// ============================================================================
//
// [TODO]: Integriere Overland-Sightline-System
// - Spec: Map-Feature.md#visibility-system-post-mvp
// - Fuer offene Terrains ohne visibilityRange: Berechne aus Elevation + Horizont
// - getTerrainVisibility() koennte calculateHorizonDistance() aus visibility.ts nutzen
// - Konvertierung: hexesToFeet(sichtbareHexes) statt DEFAULT_HORIZON_VISIBILITY

import type { EncounterGroup } from '@/types/encounterTypes';
import type { NPC, CreatureDefinition, TerrainDefinition, Character } from '@/types/entities';
import type { Activity } from '@/types/entities/activity';
import type { Weather } from '#types/weather';
import { DEFAULT_PERCEPTION_DISTANCE } from '@/constants/encounterConfig';
import { ACTIVITY_DEFINITIONS } from '@/constants';
import { vault } from '@/infrastructure/vault/vaultInstance';
import { randomBetween } from '@/utils';

// ============================================================================
// CONSTANTS
// ============================================================================

const GROUP_SIZE_MOD = [
  { max: 5, mod: 1.0 },
  { max: 20, mod: 2.0 },
  { max: 100, mod: 5.0 },
  { max: Infinity, mod: 10.0 },
] as const;

const CREATURE_SIZE_MOD: Record<string, number> = {
  tiny: 1.0,
  small: 1.0,
  medium: 1.0,
  large: 1.5,
  huge: 2.0,
  gargantuan: 3.0,
};

// 10 Punkte Überschuss = 100% maxDistance
const SCALING_FACTOR = 10;

/** Default-Sichtweite für offene Terrains ohne visibilityRange (Horizont-basiert) */
const DEFAULT_HORIZON_VISIBILITY = 8000;

// ============================================================================
// HELPER FUNCTIONS
// ============================================================================

function roundTo5ft(distance: number): number {
  return Math.round(distance / 5) * 5;
}

function getTotalCreatureCount(group: EncounterGroup): number {
  return Object.values(group.slots).flat().length;
}

function getLargestCreatureSize(group: EncounterGroup): string {
  const npcs = Object.values(group.slots).flat() as NPC[];
  if (npcs.length === 0) return 'medium';

  const sizes = ['tiny', 'small', 'medium', 'large', 'huge', 'gargantuan'];
  let maxIndex = 2; // default: medium

  for (const npc of npcs) {
    const def = vault.getEntity<CreatureDefinition>('creature', npc.creature.id);
    if (def?.size) {
      const idx = sizes.indexOf(def.size);
      if (idx > maxIndex) maxIndex = idx;
    }
  }

  return sizes[maxIndex];
}

/**
 * Lädt Terrain-Visibility aus Vault.
 * Verwendet visibilityRange wenn gesetzt, sonst DEFAULT_HORIZON_VISIBILITY.
 */
function getTerrainVisibility(terrainId: string): number {
  const terrain = vault.getEntity<TerrainDefinition>('terrain', terrainId);
  return terrain?.visibilityRange ?? DEFAULT_HORIZON_VISIBILITY;
}

function getGroupSizeModifier(count: number): number {
  for (const tier of GROUP_SIZE_MOD) {
    if (count <= tier.max) return tier.mod;
  }
  return 10.0;
}

function getCreatureSizeModifier(size: string): number {
  return CREATURE_SIZE_MOD[size] ?? 1.0;
}

/**
 * Lädt Party-Characters und berechnet beste Perception-Werte.
 * Fallback auf Defaults wenn keine Characters gefunden.
 */
function getPartyPerceptionStats(memberIds: string[]): {
  bestPassivePerception: number;
  bestPassiveStealth: number;
} {
  const characters = memberIds
    .map(id => vault.getEntity<Character>('character', id))
    .filter((c): c is Character => c !== null && c !== undefined);

  if (characters.length === 0) {
    // Fallback für CLI-Testing ohne Party
    return { bestPassivePerception: 12, bestPassiveStealth: 10 };
  }

  return {
    bestPassivePerception: Math.max(...characters.map(c => c.passivePerception)),
    bestPassiveStealth: Math.max(...characters.map(c => c.passiveStealth)),
  };
}

// ============================================================================
// DISTANCE MODIFIER CALCULATION
// ============================================================================

interface DistanceModifier {
  maxDistance: number;
  weatherMod: number;
  groupMod: number;
  sizeMod: number;
}

/** Berechnet maximale Sichtdistanz. */
function calculateDistanceModifier(
  group: EncounterGroup,
  context: {
    terrain: { id: string };
    weather: Weather;
  }
): DistanceModifier {
  const terrainVisibility = getTerrainVisibility(context.terrain.id);

  const weatherMod = context.weather.visibilityModifier;
  const groupMod = getGroupSizeModifier(getTotalCreatureCount(group));
  const sizeMod = getCreatureSizeModifier(getLargestCreatureSize(group));

  const maxDistance = terrainVisibility * weatherMod * groupMod * sizeMod;

  return { maxDistance, weatherMod, groupMod, sizeMod };
}

// ============================================================================
// PERCEPTION CALCULATION
// ============================================================================

interface PerceptionResult {
  encounterAwareDistance: number;
  partyAwareDistance: number;
  encounterAware: boolean;
  partyAware: boolean;
}

/** Berechnet bidirektionale Wahrnehmungs-Distanzen. */
function calculatePerceptionDistances(
  group: EncounterGroup,
  context: {
    terrain: { id: string };
    weather: Weather;
    partyMemberIds: string[];
  },
  activity: Activity
): PerceptionResult {
  const distMod = calculateDistanceModifier(group, context);

  // Party-Werte aus Characters laden
  const partyStats = getPartyPerceptionStats(context.partyMemberIds);
  const partyPassiveStealth = partyStats.bestPassiveStealth;
  const partyBestPassivePerception = partyStats.bestPassivePerception;

  // Encounter-Gruppe: beste PP und Stealth
  const npcs = Object.values(group.slots).flat() as NPC[];

  let bestPPBonus = 0;
  let bestStealthBonus = 0;

  for (const npc of npcs) {
    const def = vault.getEntity<CreatureDefinition>('creature', npc.creature.id);
    if (def?.senses?.passivePerception) {
      const ppBonus = def.senses.passivePerception - 10;
      if (ppBonus > bestPPBonus) bestPPBonus = ppBonus;
    }
    if (def) {
      // skills.stealth wenn vorhanden, sonst Fallback auf DEX-Mod
      const stealthBonus = def.skills?.stealth
        ?? Math.floor((def.abilities.dex - 10) / 2);
      if (stealthBonus > bestStealthBonus) bestStealthBonus = stealthBonus;
    }
  }

  // --- Perception-Check: Encounter sieht Party ---
  const perceptionRoll = randomBetween(1, 20) + bestPPBonus;
  const effectivePerception = perceptionRoll * (activity.awareness / 100);
  const perceptionExcess = effectivePerception - partyPassiveStealth;

  // --- Stealth-Check: Encounter versteckt sich ---
  const stealthRoll = randomBetween(1, 20) + bestStealthBonus;
  const effectiveStealth = stealthRoll * ((100 - activity.detectability) / 100);
  const stealthExcess = effectiveStealth - partyBestPassivePerception;

  // --- Distanzen aus Überschuss berechnen ---
  const encounterAwareDistance = perceptionExcess > 0
    ? distMod.maxDistance * Math.min(perceptionExcess / SCALING_FACTOR, 1)
    : 0;

  const partyAwareDistance = stealthExcess > 0
    ? distMod.maxDistance * Math.max(1 - (stealthExcess / SCALING_FACTOR), 0.05)
    : distMod.maxDistance;

  return {
    encounterAwareDistance: roundTo5ft(encounterAwareDistance),
    partyAwareDistance: roundTo5ft(partyAwareDistance),
    encounterAware: encounterAwareDistance > 0,
    partyAware: true, // Party sieht immer (bei irgendeiner Distanz)
  };
}

// ============================================================================
// MAIN EXPORT
// ============================================================================

/**
 * Berechnet Wahrnehmungs-Distanzen für eine Encounter-Gruppe.
 */
export function calculate(
  group: EncounterGroup,
  context: {
    terrain: { id: string };
    weather: Weather;
    timeSegment: string;
    partyMemberIds: string[];
  }
): EncounterGroup {
  const activityId = group.activity ?? 'wandering';
  const activity: Activity = ACTIVITY_DEFINITIONS[activityId] ?? {
    id: 'wandering',
    name: 'Umherziehen',
    awareness: 50,
    detectability: 50,
    contextTags: ['active', 'resting'],
  };

  const perception = calculatePerceptionDistances(group, context, activity);

  // Surprise: Wenn Encounter Party früher sieht als umgekehrt
  const isSurprise = perception.encounterAwareDistance > perception.partyAwareDistance;

  return {
    ...group,
    perception: {
      partyDetectsEncounter: perception.partyAwareDistance || DEFAULT_PERCEPTION_DISTANCE,
      encounterDetectsParty: perception.encounterAwareDistance,
      isSurprise,
    },
  };
}
