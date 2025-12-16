// src/features/locations/location-faction-integration.ts
// Phase 9.3: Integration between locations and faction system
//
// Bidirectional linking between locations and factions:
// - Locations reference owners (faction/NPC)
// - Factions reference locations (POIs, buildings)
// - Jobs performed in buildings affect location state

import {
  canPerformJob,
  hasWorkerCapacity,
  calculateProductionRate,
  getBuildingType,
} from "./building-production";
import type { BuildingProduction, BuildingJobType } from "./building-production";
import type { LocationData , FactionData, FactionMember } from "@services/domain";

/**
 * Location-faction link for bidirectional navigation
 */
export interface LocationFactionLink {
  locationName: string;
  factionName?: string;
  npcName?: string;
  workerCount: number;
  activeJobs: BuildingJobType[];
}

/**
 * Get all locations owned by a faction
 */
export function getFactionLocations(
  faction: FactionData,
  allLocations: LocationData[]
): LocationData[] {
  return allLocations.filter(
    (loc) => loc.owner_type === "faction" && loc.owner_name === faction.name
  );
}

/**
 * Get all locations owned by an NPC
 */
export function getNPCLocations(npcName: string, allLocations: LocationData[]): LocationData[] {
  return allLocations.filter((loc) => loc.owner_type === "npc" && loc.owner_name === npcName);
}

/**
 * Get all faction members working at a location
 */
export function getMembersAtLocation(
  faction: FactionData,
  locationName: string
): FactionMember[] {
  if (!faction.members) return [];

  return faction.members.filter(
    (member) =>
      member.position?.type === "poi" &&
      member.position.location_name === locationName &&
      member.job !== undefined
  );
}

/**
 * Check if a location can support a specific job type
 */
export function locationSupportsJob(location: LocationData, jobType: BuildingJobType): boolean {
  const buildingType = getBuildingType(location);
  if (!buildingType) return false;

  return canPerformJob(buildingType, jobType);
}

/**
 * Check if a location has worker capacity
 */
export function locationHasCapacity(
  location: LocationData,
  faction: FactionData
): { hasCapacity: boolean; current: number; max: number } {
  const buildingType = getBuildingType(location);
  if (!buildingType) {
    return { hasCapacity: false, current: 0, max: 0 };
  }

  const workers = getMembersAtLocation(faction, location.name);
  const current = workers.length;

  const hasCapacity = hasWorkerCapacity(buildingType, current);

  // Get max from building template
  const { BUILDING_TEMPLATES } = require("./building-production");
  const max = BUILDING_TEMPLATES[buildingType]?.maxWorkers || 0;

  return { hasCapacity, current, max };
}

/**
 * Assign a faction member to work at a location
 */
export function assignMemberToLocation(
  member: FactionMember,
  location: LocationData,
  jobType: BuildingJobType
): { success: boolean; error?: string } {
  // Validate location supports job type
  if (!locationSupportsJob(location, jobType)) {
    return {
      success: false,
      error: `Location "${location.name}" does not support ${jobType} jobs`,
    };
  }

  // Update member position
  member.position = {
    type: "poi",
    location_name: location.name,
  };

  // Update member job
  member.job = {
    type: jobType as "crafting" | "gathering" | "training" | "summoning" | "guard" | "patrol" | "research",
    building: location.name,
    progress: 0,
    resources: {},
  };

  return { success: true };
}

/**
 * Remove a faction member from a location
 */
export function removeMemberFromLocation(member: FactionMember): void {
  // Clear position
  if (member.position?.type === "poi") {
    member.position = {
      type: "unassigned",
    };
  }

  // Clear job
  member.job = undefined;
}

/**
 * Calculate production output for all workers at a location
 */
export function calculateLocationProduction(
  location: LocationData,
  faction: FactionData,
  production: BuildingProduction,
  days: number
): {
  gold: number;
  food: number;
  equipment: number;
  magic: number;
  influence: number;
} {
  const buildingType = getBuildingType(location);
  if (!buildingType) {
    return { gold: 0, food: 0, equipment: 0, magic: 0, influence: 0 };
  }

  const workers = getMembersAtLocation(faction, location.name);
  const productionRate = calculateProductionRate(
    buildingType,
    production.condition,
    production.maintenanceOverdue
  );

  // Base production per worker per day
  const baseProduction = {
    crafting: { equipment: 5, gold: 2 },
    gathering: { gold: 3, food: 10 },
    training: { influence: 2 },
    summoning: { magic: 3 },
    guard: { influence: 1 },
    patrol: { influence: 1 },
    research: { magic: 2, influence: 1 },
  };

  const output = { gold: 0, food: 0, equipment: 0, magic: 0, influence: 0 };

  // Sum production from all workers
  for (const worker of workers) {
    if (!worker.job) continue;

    const jobProduction = baseProduction[worker.job.type] || {};

    for (const [resource, amount] of Object.entries(jobProduction)) {
      output[resource as keyof typeof output] += amount * days * productionRate;
    }
  }

  return output;
}

/**
 * Apply building bonuses to job results
 */
export function applyBuildingBonuses(
  location: LocationData,
  jobType: BuildingJobType,
  baseOutput: Record<string, number>
): Record<string, number> {
  const buildingType = getBuildingType(location);
  if (!buildingType) return baseOutput;

  const { BUILDING_TEMPLATES } = require("./building-production");
  const bonuses = BUILDING_TEMPLATES[buildingType]?.bonuses || {};

  const output = { ...baseOutput };

  // Apply quality bonus to equipment/magic production
  if (bonuses.qualityBonus) {
    if (output.equipment) {
      output.equipment *= 1 + bonuses.qualityBonus;
    }
    if (output.magic) {
      output.magic *= 1 + bonuses.qualityBonus;
    }
  }

  // Apply training speed bonus to influence from training
  if (bonuses.trainingSpeed && jobType === "training") {
    if (output.influence) {
      output.influence *= bonuses.trainingSpeed;
    }
  }

  // Apply research bonus to magic from research
  if (bonuses.researchBonus && jobType === "research") {
    if (output.magic) {
      output.magic *= 1 + bonuses.researchBonus;
    }
  }

  return output;
}

/**
 * Get summary of all faction activities at locations
 */
export function getFactionLocationSummary(
  faction: FactionData,
  allLocations: LocationData[]
): Array<{
  location: LocationData;
  workerCount: number;
  jobs: Array<{ type: BuildingJobType; count: number }>;
}> {
  const ownedLocations = getFactionLocations(faction, allLocations);
  const summary: Array<{
    location: LocationData;
    workerCount: number;
    jobs: Array<{ type: BuildingJobType; count: number }>;
  }> = [];

  for (const location of ownedLocations) {
    const workers = getMembersAtLocation(faction, location.name);

    // Count jobs by type
    const jobCounts = new Map<BuildingJobType, number>();
    for (const worker of workers) {
      if (worker.job) {
        const jobType = worker.job.type as BuildingJobType;
        jobCounts.set(jobType, (jobCounts.get(jobType) || 0) + 1);
      }
    }

    const jobs = Array.from(jobCounts.entries()).map(([type, count]) => ({ type, count }));

    summary.push({
      location,
      workerCount: workers.length,
      jobs,
    });
  }

  return summary;
}

/**
 * Validate location-faction consistency
 * Checks that all location references in faction members exist
 */
export function validateLocationReferences(
  faction: FactionData,
  allLocations: LocationData[]
): Array<{ memberName: string; locationName: string; error: string }> {
  const errors: Array<{ memberName: string; locationName: string; error: string }> = [];

  if (!faction.members) return errors;

  const locationNames = new Set(allLocations.map((loc) => loc.name));

  for (const member of faction.members) {
    if (member.position?.type === "poi" && member.position.location_name) {
      const locName = member.position.location_name;

      // Check location exists
      if (!locationNames.has(locName)) {
        errors.push({
          memberName: member.name,
          locationName: locName,
          error: `Location "${locName}" not found`,
        });
        continue;
      }

      // Check faction owns location
      const location = allLocations.find((loc) => loc.name === locName);
      if (location && location.owner_type === "faction" && location.owner_name !== faction.name) {
        errors.push({
          memberName: member.name,
          locationName: locName,
          error: `Location "${locName}" owned by different faction: ${location.owner_name}`,
        });
      }

      // Check job is valid for building
      if (member.job && location) {
        const jobType = member.job.type as BuildingJobType;
        if (!locationSupportsJob(location, jobType)) {
          errors.push({
            memberName: member.name,
            locationName: locName,
            error: `Location "${locName}" does not support ${jobType} jobs`,
          });
        }
      }
    }
  }

  return errors;
}
