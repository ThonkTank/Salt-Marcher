// src/features/locations/building-production.ts
// Phase 9.2: Building types and production capabilities
//
// Buildings are special locations where NPCs work, produce resources, and maintain equipment.
// Each building type supports specific job types and production chains.

import type { LocationData } from "@services/domain";

/**
 * Building type categories
 */
export type BuildingCategory =
  | "military"      // Barracks, armory, training grounds
  | "economic"      // Workshop, smithy, market
  | "magical"       // Tower, shrine, ritual circle
  | "research"      // Library, laboratory, observatory
  | "logistic"      // Warehouse, stable, granary
  | "residential";  // Housing, inn, palace

/**
 * Job types that can be performed in buildings
 */
export type BuildingJobType =
  | "crafting"      // Create items/equipment
  | "gathering"     // Collect resources
  | "training"      // Train units
  | "summoning"     // Summon creatures
  | "guard"         // Defend location
  | "patrol"        // Patrol area
  | "research";     // Advance knowledge

/**
 * Building template defining capabilities
 */
export interface BuildingTemplate {
  /** Building name */
  name: string;
  /** Category */
  category: BuildingCategory;
  /** Description */
  description: string;
  /** Job types allowed in this building */
  allowedJobs: BuildingJobType[];
  /** Maximum workers simultaneously */
  maxWorkers: number;
  /** Base production rate multiplier (1.0 = normal) */
  productionMultiplier: number;
  /** Resource costs to maintain per day */
  maintenanceCost: {
    gold?: number;
    food?: number;
    equipment?: number;
    magic?: number;
  };
  /** Special bonuses */
  bonuses?: {
    /** Quality bonus for crafted items (0-1) */
    qualityBonus?: number;
    /** Training speed multiplier (1.0 = normal) */
    trainingSpeed?: number;
    /** Research progress bonus (0-1) */
    researchBonus?: number;
  };
}

/**
 * Pre-defined building templates
 */
export const BUILDING_TEMPLATES: Record<string, BuildingTemplate> = {
  // Military buildings
  barracks: {
    name: "Barracks",
    category: "military",
    description: "Training facility for military units",
    allowedJobs: ["training", "guard"],
    maxWorkers: 20,
    productionMultiplier: 1.0,
    maintenanceCost: { gold: 5, food: 10 },
    bonuses: { trainingSpeed: 1.2 },
  },
  armory: {
    name: "Armory",
    category: "military",
    description: "Storage and maintenance for military equipment",
    allowedJobs: ["crafting", "guard"],
    maxWorkers: 10,
    productionMultiplier: 1.1,
    maintenanceCost: { gold: 8, equipment: 5 },
    bonuses: { qualityBonus: 0.15 },
  },
  training_grounds: {
    name: "Training Grounds",
    category: "military",
    description: "Large open area for combat training and drills",
    allowedJobs: ["training", "patrol"],
    maxWorkers: 30,
    productionMultiplier: 1.2,
    maintenanceCost: { gold: 3, food: 15 },
    bonuses: { trainingSpeed: 1.5 },
  },

  // Economic buildings
  smithy: {
    name: "Smithy",
    category: "economic",
    description: "Workshop for metalworking and equipment crafting",
    allowedJobs: ["crafting"],
    maxWorkers: 5,
    productionMultiplier: 1.3,
    maintenanceCost: { gold: 10, equipment: 8 },
    bonuses: { qualityBonus: 0.25 },
  },
  workshop: {
    name: "Workshop",
    category: "economic",
    description: "General crafting facility for tools and goods",
    allowedJobs: ["crafting", "gathering"],
    maxWorkers: 8,
    productionMultiplier: 1.0,
    maintenanceCost: { gold: 5, equipment: 3 },
  },
  market: {
    name: "Market",
    category: "economic",
    description: "Trading hub for goods and resources",
    allowedJobs: ["gathering"],
    maxWorkers: 15,
    productionMultiplier: 1.2,
    maintenanceCost: { gold: 8 },
  },

  // Magical buildings
  mage_tower: {
    name: "Mage Tower",
    category: "magical",
    description: "Arcane research and spellcasting facility",
    allowedJobs: ["research", "crafting", "summoning"],
    maxWorkers: 6,
    productionMultiplier: 1.4,
    maintenanceCost: { gold: 15, magic: 10 },
    bonuses: { qualityBonus: 0.3, researchBonus: 0.4 },
  },
  shrine: {
    name: "Shrine",
    category: "magical",
    description: "Sacred place for divine magic and healing",
    allowedJobs: ["summoning", "research"],
    maxWorkers: 8,
    productionMultiplier: 1.2,
    maintenanceCost: { gold: 10, magic: 5 },
    bonuses: { researchBonus: 0.25 },
  },
  ritual_circle: {
    name: "Ritual Circle",
    category: "magical",
    description: "Outdoor ceremonial site for powerful rituals",
    allowedJobs: ["summoning", "research"],
    maxWorkers: 4,
    productionMultiplier: 1.5,
    maintenanceCost: { gold: 5, magic: 15 },
    bonuses: { qualityBonus: 0.2 },
  },

  // Research buildings
  library: {
    name: "Library",
    category: "research",
    description: "Repository of knowledge and study",
    allowedJobs: ["research"],
    maxWorkers: 12,
    productionMultiplier: 1.3,
    maintenanceCost: { gold: 12 },
    bonuses: { researchBonus: 0.5 },
  },
  laboratory: {
    name: "Laboratory",
    category: "research",
    description: "Scientific experimentation facility",
    allowedJobs: ["research", "crafting"],
    maxWorkers: 6,
    productionMultiplier: 1.4,
    maintenanceCost: { gold: 18, magic: 8 },
    bonuses: { researchBonus: 0.45, qualityBonus: 0.2 },
  },

  // Logistic buildings
  warehouse: {
    name: "Warehouse",
    category: "logistic",
    description: "Storage facility for resources and goods",
    allowedJobs: ["gathering", "guard"],
    maxWorkers: 10,
    productionMultiplier: 1.0,
    maintenanceCost: { gold: 3 },
  },
  stable: {
    name: "Stable",
    category: "logistic",
    description: "Housing for mounts and beasts of burden",
    allowedJobs: ["gathering", "training"],
    maxWorkers: 8,
    productionMultiplier: 1.0,
    maintenanceCost: { gold: 5, food: 20 },
  },
  granary: {
    name: "Granary",
    category: "logistic",
    description: "Food storage and preservation facility",
    allowedJobs: ["gathering", "guard"],
    maxWorkers: 6,
    productionMultiplier: 1.1,
    maintenanceCost: { gold: 4 },
  },

  // Residential buildings
  inn: {
    name: "Inn",
    category: "residential",
    description: "Lodging for travelers and workers",
    allowedJobs: ["gathering"],
    maxWorkers: 12,
    productionMultiplier: 1.0,
    maintenanceCost: { gold: 6, food: 15 },
  },
  palace: {
    name: "Palace",
    category: "residential",
    description: "Grand residence for leadership",
    allowedJobs: ["guard", "research"],
    maxWorkers: 25,
    productionMultiplier: 1.3,
    maintenanceCost: { gold: 30, food: 20 },
    bonuses: { researchBonus: 0.2 },
  },
};

/**
 * Building production state
 */
export interface BuildingProduction {
  /** Building template key */
  buildingType: string;
  /** Current workers assigned */
  currentWorkers: number;
  /** Active jobs in progress */
  activeJobs: Array<{
    workerName: string;
    jobType: BuildingJobType;
    progress: number; // 0-100
    startedAt?: string; // ISO date
    estimatedCompletion?: string; // ISO date
  }>;
  /** Total resources produced this period */
  periodProduction: {
    gold?: number;
    food?: number;
    equipment?: number;
    magic?: number;
    influence?: number;
  };
  /** Building condition (0-100) */
  condition: number;
  /** Maintenance overdue days */
  maintenanceOverdue: number;
}

/**
 * Check if a job type is allowed in a building
 */
export function canPerformJob(buildingType: string, jobType: BuildingJobType): boolean {
  const template = BUILDING_TEMPLATES[buildingType];
  if (!template) return false;
  return template.allowedJobs.includes(jobType);
}

/**
 * Check if building has capacity for more workers
 */
export function hasWorkerCapacity(buildingType: string, currentWorkers: number): boolean {
  const template = BUILDING_TEMPLATES[buildingType];
  if (!template) return false;
  return currentWorkers < template.maxWorkers;
}

/**
 * Calculate effective production rate for a building
 * Takes into account condition and maintenance status
 */
export function calculateProductionRate(
  buildingType: string,
  condition: number,
  maintenanceOverdue: number
): number {
  const template = BUILDING_TEMPLATES[buildingType];
  if (!template) return 0;

  // Base rate from template
  let rate = template.productionMultiplier;

  // Condition penalty (0-100 condition → 0.5-1.0 multiplier)
  const conditionMultiplier = 0.5 + (condition / 200);
  rate *= conditionMultiplier;

  // Maintenance penalty (-5% per day overdue, max -50%)
  const maintenancePenalty = Math.min(0.5, maintenanceOverdue * 0.05);
  rate *= 1 - maintenancePenalty;

  return Math.max(0.1, rate); // Minimum 10% production
}

/**
 * Calculate daily maintenance cost for a building
 */
export function calculateMaintenanceCost(buildingType: string): {
  gold?: number;
  food?: number;
  equipment?: number;
  magic?: number;
} {
  const template = BUILDING_TEMPLATES[buildingType];
  return template?.maintenanceCost || {};
}

/**
 * Get building bonuses
 */
export function getBuildingBonuses(buildingType: string) {
  const template = BUILDING_TEMPLATES[buildingType];
  return template?.bonuses || {};
}

/**
 * Check if a location is a building with production capabilities
 */
export function isBuildingLocation(location: LocationData): boolean {
  return location.type === "Gebäude" || location.type === "Festung";
}

/**
 * Keywords for building type detection (English + German)
 */
const BUILDING_KEYWORDS: Record<string, string[]> = {
  smithy: ["smithy", "schmiede", "forge", "esse"],
  barracks: ["barracks", "kaserne"],
  armory: ["armory", "waffenkammer", "arsenal"],
  training_grounds: ["training", "übungsplatz", "drill"],
  workshop: ["workshop", "werkstatt"],
  market: ["market", "markt", "marketplace"],
  mage_tower: ["mage", "magier", "tower", "turm", "wizard"],
  shrine: ["shrine", "schrein", "chapel", "kapelle"],
  ritual_circle: ["ritual", "circle", "kreis"],
  library: ["library", "bibliothek"],
  laboratory: ["laboratory", "labor"],
  warehouse: ["warehouse", "lagerhaus", "storage"],
  stable: ["stable", "stall"],
  granary: ["granary", "kornspeicher", "grain"],
  inn: ["inn", "tavern", "taverne", "gasthaus"],
  palace: ["palace", "palast", "castle", "schloss"],
};

/**
 * Get building template key from location
 * This would typically be stored in location.notes or a custom field
 * For now, we infer from location name
 */
export function getBuildingType(location: LocationData): string | null {
  if (!isBuildingLocation(location)) return null;

  const name = location.name.toLowerCase();

  // Try to match building template by keywords
  for (const [key, keywords] of Object.entries(BUILDING_KEYWORDS)) {
    for (const keyword of keywords) {
      if (name.includes(keyword)) {
        return key;
      }
    }
  }

  return null;
}

/**
 * Initialize building production state for a location
 */
export function initializeBuildingProduction(location: LocationData): BuildingProduction | null {
  const buildingType = getBuildingType(location);
  if (!buildingType) return null;

  return {
    buildingType,
    currentWorkers: 0,
    activeJobs: [],
    periodProduction: {},
    condition: 100,
    maintenanceOverdue: 0,
  };
}

/**
 * Degrade building condition over time
 * Buildings lose condition without proper maintenance
 */
export function degradeBuilding(production: BuildingProduction, days: number): void {
  // Condition degrades 1 point per day without maintenance
  production.condition = Math.max(0, production.condition - days);

  // If maintenance was due, increment overdue counter
  if (production.maintenanceOverdue > 0 || production.condition < 80) {
    production.maintenanceOverdue += days;
  }
}

/**
 * Calculate repair costs for a building
 * Returns the gold and equipment needed to repair by the specified amount
 */
export function calculateRepairCosts(
  currentCondition: number,
  repairAmount: number
): { gold: number; equipment: number } {
  // Repair formula: 1 gold + 0.5 equipment = 10 condition points
  // Default repair amount of 10 condition points costs 1 gold + 0.5 equipment
  const costMultiplier = repairAmount / 10;

  return {
    gold: Math.ceil(1 * costMultiplier),
    equipment: Math.ceil(0.5 * costMultiplier)
  };
}

/**
 * Repair building condition
 */
export function repairBuilding(
  production: BuildingProduction,
  goldSpent: number,
  equipmentSpent: number
): number {
  // Calculate repair amount based on resources spent
  // 1 gold + 0.5 equipment = 10 condition points
  const repairAmount = (goldSpent + equipmentSpent * 0.5) * 10;

  const oldCondition = production.condition;
  production.condition = Math.min(100, production.condition + repairAmount);

  // Reset maintenance overdue if fully repaired
  if (production.condition >= 90) {
    production.maintenanceOverdue = 0;
  }

  return production.condition - oldCondition;
}
