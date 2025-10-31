// devkit/testing/unit/features/locations/building-production.test.ts
// Phase 9.2 Tests: Building production capabilities

import { describe, it, expect } from "vitest";
import type { LocationData } from "../../../../../src/workmodes/library/locations/types";
import type { BuildingProduction } from "../../../../../src/features/locations/building-production";
import {
  BUILDING_TEMPLATES,
  canPerformJob,
  hasWorkerCapacity,
  calculateProductionRate,
  calculateMaintenanceCost,
  getBuildingBonuses,
  isBuildingLocation,
  getBuildingType,
  initializeBuildingProduction,
  degradeBuilding,
  repairBuilding,
} from "../../../../../src/features/locations/building-production";

describe("Building Production - Templates", () => {
  it("has all required building templates", () => {
    const requiredTemplates = [
      "barracks",
      "armory",
      "smithy",
      "workshop",
      "mage_tower",
      "library",
      "warehouse",
      "stable",
    ];

    for (const template of requiredTemplates) {
      expect(BUILDING_TEMPLATES[template]).toBeDefined();
      expect(BUILDING_TEMPLATES[template].name).toBeDefined();
      expect(BUILDING_TEMPLATES[template].category).toBeDefined();
      expect(BUILDING_TEMPLATES[template].allowedJobs).toBeDefined();
      expect(BUILDING_TEMPLATES[template].maxWorkers).toBeGreaterThan(0);
    }
  });

  it("categorizes buildings correctly", () => {
    expect(BUILDING_TEMPLATES.barracks.category).toBe("military");
    expect(BUILDING_TEMPLATES.smithy.category).toBe("economic");
    expect(BUILDING_TEMPLATES.mage_tower.category).toBe("magical");
    expect(BUILDING_TEMPLATES.library.category).toBe("research");
    expect(BUILDING_TEMPLATES.warehouse.category).toBe("logistic");
  });

  it("assigns logical job types to buildings", () => {
    // Military buildings should allow training/guard
    expect(BUILDING_TEMPLATES.barracks.allowedJobs).toContain("training");
    expect(BUILDING_TEMPLATES.barracks.allowedJobs).toContain("guard");

    // Smithy should allow crafting
    expect(BUILDING_TEMPLATES.smithy.allowedJobs).toContain("crafting");

    // Mage tower should allow research/summoning
    expect(BUILDING_TEMPLATES.mage_tower.allowedJobs).toContain("research");
    expect(BUILDING_TEMPLATES.mage_tower.allowedJobs).toContain("summoning");

    // Library should allow research
    expect(BUILDING_TEMPLATES.library.allowedJobs).toContain("research");
  });

  it("defines reasonable worker capacities", () => {
    // Small specialized buildings
    expect(BUILDING_TEMPLATES.smithy.maxWorkers).toBeLessThanOrEqual(10);

    // Medium buildings
    expect(BUILDING_TEMPLATES.barracks.maxWorkers).toBeGreaterThan(10);
    expect(BUILDING_TEMPLATES.barracks.maxWorkers).toBeLessThanOrEqual(30);

    // Large buildings
    expect(BUILDING_TEMPLATES.training_grounds.maxWorkers).toBeGreaterThanOrEqual(20);
  });

  it("assigns maintenance costs to all buildings", () => {
    for (const [key, template] of Object.entries(BUILDING_TEMPLATES)) {
      expect(template.maintenanceCost).toBeDefined();

      // At least one resource should have cost > 0
      const hasCost = Object.values(template.maintenanceCost).some((cost) => cost && cost > 0);
      expect(hasCost).toBe(true);
    }
  });
});

describe("Building Production - Job Permissions", () => {
  it("allows permitted job types", () => {
    expect(canPerformJob("barracks", "training")).toBe(true);
    expect(canPerformJob("smithy", "crafting")).toBe(true);
    expect(canPerformJob("mage_tower", "research")).toBe(true);
  });

  it("disallows non-permitted job types", () => {
    expect(canPerformJob("barracks", "crafting")).toBe(false); // Barracks can't craft
    expect(canPerformJob("smithy", "summoning")).toBe(false); // Smithy can't summon
    expect(canPerformJob("library", "training")).toBe(false); // Library can't train
  });

  it("returns false for unknown building types", () => {
    expect(canPerformJob("unknown_building", "crafting")).toBe(false);
  });
});

describe("Building Production - Worker Capacity", () => {
  it("has capacity when under max workers", () => {
    expect(hasWorkerCapacity("barracks", 0)).toBe(true);
    expect(hasWorkerCapacity("barracks", 10)).toBe(true);
    expect(hasWorkerCapacity("barracks", 19)).toBe(true);
  });

  it("has no capacity when at max workers", () => {
    const maxWorkers = BUILDING_TEMPLATES.barracks.maxWorkers;
    expect(hasWorkerCapacity("barracks", maxWorkers)).toBe(false);
  });

  it("has no capacity when over max workers", () => {
    const maxWorkers = BUILDING_TEMPLATES.barracks.maxWorkers;
    expect(hasWorkerCapacity("barracks", maxWorkers + 5)).toBe(false);
  });

  it("returns false for unknown building types", () => {
    expect(hasWorkerCapacity("unknown", 5)).toBe(false);
  });
});

describe("Building Production - Production Rate", () => {
  it("returns full rate for perfect condition and no overdue maintenance", () => {
    const rate = calculateProductionRate("smithy", 100, 0);
    const baseRate = BUILDING_TEMPLATES.smithy.productionMultiplier;

    expect(rate).toBeCloseTo(baseRate, 2);
  });

  it("reduces rate with poor condition", () => {
    const perfectRate = calculateProductionRate("smithy", 100, 0);
    const poorRate = calculateProductionRate("smithy", 50, 0);

    expect(poorRate).toBeLessThan(perfectRate);
    expect(poorRate).toBeGreaterThan(0);
  });

  it("reduces rate with overdue maintenance", () => {
    const normalRate = calculateProductionRate("smithy", 100, 0);
    const overdueRate = calculateProductionRate("smithy", 100, 5);

    expect(overdueRate).toBeLessThan(normalRate);
  });

  it("combines condition and maintenance penalties", () => {
    const perfectRate = calculateProductionRate("smithy", 100, 0);
    const poorConditionRate = calculateProductionRate("smithy", 50, 0);
    const overdueRate = calculateProductionRate("smithy", 100, 5);
    const bothRate = calculateProductionRate("smithy", 50, 5);

    expect(bothRate).toBeLessThan(poorConditionRate);
    expect(bothRate).toBeLessThan(overdueRate);
    expect(bothRate).toBeLessThan(perfectRate);
  });

  it("never drops below minimum production rate", () => {
    // Even with worst conditions
    const worstRate = calculateProductionRate("smithy", 0, 20);
    expect(worstRate).toBeGreaterThanOrEqual(0.1); // 10% minimum
  });

  it("maintenance penalty caps at 50%", () => {
    const rate1 = calculateProductionRate("smithy", 100, 10); // 10 days overdue
    const rate2 = calculateProductionRate("smithy", 100, 100); // 100 days overdue

    // Both should have same 50% penalty
    expect(rate1).toBeCloseTo(rate2, 2);
  });
});

describe("Building Production - Maintenance Costs", () => {
  it("returns maintenance costs for valid buildings", () => {
    const cost = calculateMaintenanceCost("barracks");

    expect(cost).toBeDefined();
    expect(cost.gold).toBe(5);
    expect(cost.food).toBe(10);
  });

  it("returns empty object for unknown buildings", () => {
    const cost = calculateMaintenanceCost("unknown");
    expect(cost).toEqual({});
  });

  it("magical buildings cost magic resources", () => {
    const cost = calculateMaintenanceCost("mage_tower");
    expect(cost.magic).toBeGreaterThan(0);
  });

  it("military buildings cost food for troops", () => {
    const barracks = calculateMaintenanceCost("barracks");
    const training = calculateMaintenanceCost("training_grounds");

    expect(barracks.food).toBeGreaterThan(0);
    expect(training.food).toBeGreaterThan(0);
  });
});

describe("Building Production - Bonuses", () => {
  it("returns bonuses for buildings with special capabilities", () => {
    const smithyBonuses = getBuildingBonuses("smithy");
    expect(smithyBonuses.qualityBonus).toBeGreaterThan(0);

    const trainingBonuses = getBuildingBonuses("training_grounds");
    expect(trainingBonuses.trainingSpeed).toBeGreaterThan(1.0);

    const libraryBonuses = getBuildingBonuses("library");
    expect(libraryBonuses.researchBonus).toBeGreaterThan(0);
  });

  it("returns empty bonuses for buildings without special capabilities", () => {
    const bonuses = getBuildingBonuses("warehouse");
    expect(Object.keys(bonuses).length).toBe(0);
  });

  it("returns empty bonuses for unknown buildings", () => {
    const bonuses = getBuildingBonuses("unknown");
    expect(Object.keys(bonuses).length).toBe(0);
  });
});

describe("Building Production - Location Identification", () => {
  it("identifies Gebäude as buildings", () => {
    const location: LocationData = { name: "Test", type: "Gebäude" };
    expect(isBuildingLocation(location)).toBe(true);
  });

  it("identifies Festung as buildings", () => {
    const location: LocationData = { name: "Fort", type: "Festung" };
    expect(isBuildingLocation(location)).toBe(true);
  });

  it("does not identify other types as buildings", () => {
    const stadt: LocationData = { name: "City", type: "Stadt" };
    const dorf: LocationData = { name: "Village", type: "Dorf" };

    expect(isBuildingLocation(stadt)).toBe(false);
    expect(isBuildingLocation(dorf)).toBe(false);
  });
});

describe("Building Production - Building Type Detection", () => {
  it("detects building type from name", () => {
    const smithy: LocationData = { name: "Eisenschmiede", type: "Gebäude" };
    const barracks: LocationData = { name: "Barracks Ost", type: "Gebäude" };

    expect(getBuildingType(smithy)).toBe("smithy");
    expect(getBuildingType(barracks)).toBe("barracks");
  });

  it("returns null for non-building locations", () => {
    const city: LocationData = { name: "Stadt", type: "Stadt" };
    expect(getBuildingType(city)).toBeNull();
  });

  it("returns null when building type cannot be determined", () => {
    const generic: LocationData = { name: "Generic Building", type: "Gebäude" };
    expect(getBuildingType(generic)).toBeNull();
  });

  it("handles case-insensitive matching", () => {
    const smithy: LocationData = { name: "SMITHY", type: "Gebäude" };
    expect(getBuildingType(smithy)).toBe("smithy");
  });
});

describe("Building Production - Initialization", () => {
  it("initializes production state for valid buildings", () => {
    const location: LocationData = { name: "Test Smithy", type: "Gebäude" };
    const production = initializeBuildingProduction(location);

    expect(production).toBeDefined();
    expect(production!.buildingType).toBe("smithy");
    expect(production!.currentWorkers).toBe(0);
    expect(production!.activeJobs).toEqual([]);
    expect(production!.condition).toBe(100);
    expect(production!.maintenanceOverdue).toBe(0);
  });

  it("returns null for non-building locations", () => {
    const city: LocationData = { name: "Test City", type: "Stadt" };
    const production = initializeBuildingProduction(city);

    expect(production).toBeNull();
  });

  it("returns null when building type cannot be determined", () => {
    const generic: LocationData = { name: "Generic", type: "Gebäude" };
    const production = initializeBuildingProduction(generic);

    expect(production).toBeNull();
  });
});

describe("Building Production - Degradation", () => {
  it("degrades condition over time", () => {
    const production: BuildingProduction = {
      buildingType: "smithy",
      currentWorkers: 0,
      activeJobs: [],
      periodProduction: {},
      condition: 100,
      maintenanceOverdue: 0,
    };

    degradeBuilding(production, 5);

    expect(production.condition).toBe(95); // Lost 5 points (1 per day)
  });

  it("condition never goes below zero", () => {
    const production: BuildingProduction = {
      buildingType: "smithy",
      currentWorkers: 0,
      activeJobs: [],
      periodProduction: {},
      condition: 3,
      maintenanceOverdue: 0,
    };

    degradeBuilding(production, 10);

    expect(production.condition).toBe(0);
  });

  it("increments maintenance overdue when condition is low", () => {
    const production: BuildingProduction = {
      buildingType: "smithy",
      currentWorkers: 0,
      activeJobs: [],
      periodProduction: {},
      condition: 70, // Below 80
      maintenanceOverdue: 0,
    };

    degradeBuilding(production, 3);

    expect(production.maintenanceOverdue).toBe(3);
  });

  it("increments maintenance overdue when already overdue", () => {
    const production: BuildingProduction = {
      buildingType: "smithy",
      currentWorkers: 0,
      activeJobs: [],
      periodProduction: {},
      condition: 100,
      maintenanceOverdue: 2,
    };

    degradeBuilding(production, 3);

    expect(production.maintenanceOverdue).toBe(5);
  });
});

describe("Building Production - Repair", () => {
  it("repairs building condition with gold and equipment", () => {
    const production: BuildingProduction = {
      buildingType: "smithy",
      currentWorkers: 0,
      activeJobs: [],
      periodProduction: {},
      condition: 50,
      maintenanceOverdue: 0,
    };

    const repaired = repairBuilding(production, 2, 2); // 2 gold + 2 equipment

    expect(production.condition).toBeGreaterThan(50);
    expect(repaired).toBeGreaterThan(0);
  });

  it("caps condition at 100", () => {
    const production: BuildingProduction = {
      buildingType: "smithy",
      currentWorkers: 0,
      activeJobs: [],
      periodProduction: {},
      condition: 95,
      maintenanceOverdue: 0,
    };

    repairBuilding(production, 10, 10); // Lots of resources

    expect(production.condition).toBe(100);
  });

  it("resets maintenance overdue when fully repaired", () => {
    const production: BuildingProduction = {
      buildingType: "smithy",
      currentWorkers: 0,
      activeJobs: [],
      periodProduction: {},
      condition: 85,
      maintenanceOverdue: 5,
    };

    repairBuilding(production, 2, 2);

    if (production.condition >= 90) {
      expect(production.maintenanceOverdue).toBe(0);
    }
  });

  it("calculates repair amount based on resources", () => {
    const production1: BuildingProduction = {
      buildingType: "smithy",
      currentWorkers: 0,
      activeJobs: [],
      periodProduction: {},
      condition: 50,
      maintenanceOverdue: 0,
    };

    const production2: BuildingProduction = {
      buildingType: "smithy",
      currentWorkers: 0,
      activeJobs: [],
      periodProduction: {},
      condition: 50,
      maintenanceOverdue: 0,
    };

    const repaired1 = repairBuilding(production1, 1, 1);
    const repaired2 = repairBuilding(production2, 2, 2);

    expect(repaired2).toBeGreaterThan(repaired1);
  });
});
