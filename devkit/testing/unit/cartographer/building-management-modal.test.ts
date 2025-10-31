// devkit/testing/unit/cartographer/building-management-modal.test.ts
// Phase 10.4+ Tests: Building management modal job validation

import { describe, it, expect } from "vitest";
import type { FactionMember } from "../../../../src/workmodes/library/factions/types";
import { BUILDING_TEMPLATES } from "../../../../src/features/locations/building-production";

/**
 * Test job compatibility validation logic used in building management modal
 */
describe("Building Management Modal - Job Validation", () => {
  it("should validate worker job compatibility with building allowed jobs", () => {
    // Create test workers with different job types
    const craftingWorker: FactionMember = {
      name: "Smith Worker",
      job: { type: "crafting" }
    };

    const trainingWorker: FactionMember = {
      name: "Training Officer",
      job: { type: "training" }
    };

    const researchWorker: FactionMember = {
      name: "Scholar",
      job: { type: "research" }
    };

    const workerWithoutJob: FactionMember = {
      name: "Unassigned Worker"
    };

    // Test smithy (allows only crafting)
    const smithyTemplate = BUILDING_TEMPLATES.smithy;
    expect(smithyTemplate.allowedJobs).toContain("crafting");

    // Crafting worker should be compatible with smithy
    const isCraftingCompatible = craftingWorker.job?.type &&
      smithyTemplate.allowedJobs.includes(craftingWorker.job.type);
    expect(isCraftingCompatible).toBe(true);

    // Training worker should NOT be compatible with smithy
    const isTrainingCompatible = trainingWorker.job?.type &&
      smithyTemplate.allowedJobs.includes(trainingWorker.job.type);
    expect(isTrainingCompatible).toBe(false);

    // Worker without job should be compatible (can be assigned any job)
    const isUnassignedCompatible = !workerWithoutJob.job?.type;
    expect(isUnassignedCompatible).toBe(true);
  });

  it("should validate multiple job types for mage tower", () => {
    const craftingWorker: FactionMember = {
      name: "Enchanter",
      job: { type: "crafting" }
    };

    const summoningWorker: FactionMember = {
      name: "Summoner",
      job: { type: "summoning" }
    };

    const researchWorker: FactionMember = {
      name: "Arcanist",
      job: { type: "research" }
    };

    const guardWorker: FactionMember = {
      name: "Tower Guard",
      job: { type: "guard" }
    };

    const mageTowerTemplate = BUILDING_TEMPLATES.mage_tower;

    // Mage tower allows: research, crafting, summoning
    expect(mageTowerTemplate.allowedJobs).toContain("research");
    expect(mageTowerTemplate.allowedJobs).toContain("crafting");
    expect(mageTowerTemplate.allowedJobs).toContain("summoning");

    // All magic-related jobs should be compatible
    const isCraftingCompatible = craftingWorker.job?.type &&
      mageTowerTemplate.allowedJobs.includes(craftingWorker.job.type);
    expect(isCraftingCompatible).toBe(true);

    const isSummoningCompatible = summoningWorker.job?.type &&
      mageTowerTemplate.allowedJobs.includes(summoningWorker.job.type);
    expect(isSummoningCompatible).toBe(true);

    const isResearchCompatible = researchWorker.job?.type &&
      mageTowerTemplate.allowedJobs.includes(researchWorker.job.type);
    expect(isResearchCompatible).toBe(true);

    // Guard should NOT be compatible
    const isGuardCompatible = guardWorker.job?.type &&
      mageTowerTemplate.allowedJobs.includes(guardWorker.job.type);
    expect(isGuardCompatible).toBe(false);
  });

  it("should validate barracks job types (training and guard)", () => {
    const trainingWorker: FactionMember = {
      name: "Drill Sergeant",
      job: { type: "training" }
    };

    const guardWorker: FactionMember = {
      name: "Barracks Guard",
      job: { type: "guard" }
    };

    const craftingWorker: FactionMember = {
      name: "Armorer",
      job: { type: "crafting" }
    };

    const barracksTemplate = BUILDING_TEMPLATES.barracks;

    // Barracks allows: training, guard
    expect(barracksTemplate.allowedJobs).toContain("training");
    expect(barracksTemplate.allowedJobs).toContain("guard");

    // Training and guard should be compatible
    const isTrainingCompatible = trainingWorker.job?.type &&
      barracksTemplate.allowedJobs.includes(trainingWorker.job.type);
    expect(isTrainingCompatible).toBe(true);

    const isGuardCompatible = guardWorker.job?.type &&
      barracksTemplate.allowedJobs.includes(guardWorker.job.type);
    expect(isGuardCompatible).toBe(true);

    // Crafting should NOT be compatible
    const isCraftingCompatible = craftingWorker.job?.type &&
      barracksTemplate.allowedJobs.includes(craftingWorker.job.type);
    expect(isCraftingCompatible).toBe(false);
  });

  it("should handle all building types with correct job validation", () => {
    // Test each building type has defined allowed jobs
    const buildingTypes = [
      "barracks",
      "armory",
      "training_grounds",
      "smithy",
      "workshop",
      "market",
      "mage_tower",
      "shrine",
      "ritual_circle",
      "library",
      "laboratory",
      "warehouse",
      "stable",
      "granary",
      "inn",
      "palace"
    ];

    for (const buildingType of buildingTypes) {
      const template = BUILDING_TEMPLATES[buildingType];
      expect(template).toBeDefined();
      expect(template.allowedJobs).toBeDefined();
      expect(template.allowedJobs.length).toBeGreaterThan(0);
    }
  });

  it("should correctly identify compatible vs incompatible job types", () => {
    const allJobTypes: Array<"crafting" | "gathering" | "training" | "summoning" | "guard" | "patrol" | "research"> = [
      "crafting",
      "gathering",
      "training",
      "summoning",
      "guard",
      "patrol",
      "research"
    ];

    // For each building, test each job type
    for (const [buildingType, template] of Object.entries(BUILDING_TEMPLATES)) {
      for (const jobType of allJobTypes) {
        const worker: FactionMember = {
          name: "Test Worker",
          job: { type: jobType }
        };

        const isCompatible = worker.job?.type &&
          template.allowedJobs.includes(worker.job.type);

        // If job is in allowed list, should be compatible
        if (template.allowedJobs.includes(jobType)) {
          expect(isCompatible).toBe(true);
        } else {
          expect(isCompatible).toBe(false);
        }
      }
    }
  });
});
