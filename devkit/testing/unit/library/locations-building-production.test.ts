// devkit/testing/unit/library/locations-building-production.test.ts
// Phase 9.2A: Tests for building production integration in locations

import { describe, it, expect } from "vitest";
import type { LocationData } from "../../../../src/workmodes/library/locations/types";
import { isBuildingLocation } from "../../../../src/workmodes/library/locations/types";
import { locationToMarkdown } from "../../../../src/workmodes/library/locations/serializer";
import type { BuildingProduction } from "../../../../src/features/locations/building-production";

describe("isBuildingLocation", () => {
    it("returns true for Gebäude with building_production", () => {
        const location: LocationData = {
            name: "Test Smithy",
            type: "Gebäude",
            building_production: {
                buildingType: "smithy",
                currentWorkers: 3,
                activeJobs: [],
                periodProduction: {},
                condition: 100,
                maintenanceOverdue: 0,
            },
        };

        expect(isBuildingLocation(location)).toBe(true);
    });

    it("returns false for Gebäude without building_production", () => {
        const location: LocationData = {
            name: "Generic Building",
            type: "Gebäude",
        };

        expect(isBuildingLocation(location)).toBe(false);
    });

    it("returns false for non-Gebäude location types", () => {
        const location: LocationData = {
            name: "Test City",
            type: "Stadt",
            building_production: {
                buildingType: "smithy",
                currentWorkers: 0,
                activeJobs: [],
                periodProduction: {},
                condition: 100,
                maintenanceOverdue: 0,
            },
        };

        expect(isBuildingLocation(location)).toBe(false);
    });

    it("returns false when building_production is null", () => {
        const location: LocationData = {
            name: "Test Building",
            type: "Gebäude",
            building_production: null as any,
        };

        expect(isBuildingLocation(location)).toBe(false);
    });
});

describe("locationToMarkdown - Building Production", () => {
    it("serializes building production section correctly", () => {
        const production: BuildingProduction = {
            buildingType: "smithy",
            currentWorkers: 3,
            activeJobs: [
                {
                    workerName: "Thorin Ironforge",
                    jobType: "crafting",
                    progress: 75,
                    startedAt: "2025-01-01",
                    estimatedCompletion: "2025-01-03",
                },
            ],
            periodProduction: {
                equipment: 5,
                gold: 10,
            },
            condition: 85,
            maintenanceOverdue: 2,
        };

        const location: LocationData = {
            name: "Ironforge Smithy",
            type: "Gebäude",
            description: "A bustling smithy",
            building_production: production,
        };

        const markdown = locationToMarkdown(location);

        expect(markdown).toContain("# Ironforge Smithy");
        expect(markdown).toContain("## Building Production");
        expect(markdown).toContain("**Building Type:** Smithy");
        expect(markdown).toContain("**Category:** economic");
        expect(markdown).toContain("**Condition:** 85%");
        expect(markdown).toContain("**Maintenance Overdue:** 2 days");
        expect(markdown).toContain("**Workers:** 3/5");
        expect(markdown).toContain("**Active Jobs:**");
        expect(markdown).toContain("- Thorin Ironforge: crafting (75%)");
        expect(markdown).toContain("**Period Production:**");
        expect(markdown).toContain("- Equipment: 5");
        expect(markdown).toContain("- Gold: 10");
    });

    it("handles building production with no active jobs", () => {
        const location: LocationData = {
            name: "Empty Workshop",
            type: "Gebäude",
            building_production: {
                buildingType: "workshop",
                currentWorkers: 0,
                activeJobs: [],
                periodProduction: {},
                condition: 100,
                maintenanceOverdue: 0,
            },
        };

        const markdown = locationToMarkdown(location);

        expect(markdown).toContain("## Building Production");
        expect(markdown).toContain("**Workers:** 0/8");
        expect(markdown).not.toContain("**Active Jobs:**");
        expect(markdown).not.toContain("**Period Production:**");
    });

    it("handles building production with partial period production", () => {
        const location: LocationData = {
            name: "Training Grounds",
            type: "Gebäude",
            building_production: {
                buildingType: "training_grounds",
                currentWorkers: 10,
                activeJobs: [],
                periodProduction: {
                    influence: 3,
                },
                condition: 95,
                maintenanceOverdue: 0,
            },
        };

        const markdown = locationToMarkdown(location);

        expect(markdown).toContain("**Period Production:**");
        expect(markdown).toContain("- Influence: 3");
        expect(markdown).not.toContain("- Gold:");
        expect(markdown).not.toContain("- Food:");
    });

    it("omits building production section for non-building locations", () => {
        const location: LocationData = {
            name: "Test City",
            type: "Stadt",
            description: "A large city",
        };

        const markdown = locationToMarkdown(location);

        expect(markdown).not.toContain("## Building Production");
    });

    it("handles invalid building types gracefully", () => {
        const location: LocationData = {
            name: "Invalid Building",
            type: "Gebäude",
            building_production: {
                buildingType: "nonexistent_building",
                currentWorkers: 0,
                activeJobs: [],
                periodProduction: {},
                condition: 100,
                maintenanceOverdue: 0,
            },
        };

        const markdown = locationToMarkdown(location);

        // Should not crash, but won't have building production section
        expect(markdown).toContain("# Invalid Building");
    });
});

describe("LocationData type integration", () => {
    it("allows building_production field on LocationData", () => {
        const location: LocationData = {
            name: "Test Building",
            type: "Gebäude",
            building_production: {
                buildingType: "barracks",
                currentWorkers: 15,
                activeJobs: [],
                periodProduction: {},
                condition: 80,
                maintenanceOverdue: 5,
            },
        };

        expect(location.building_production).toBeDefined();
        expect(location.building_production?.buildingType).toBe("barracks");
        expect(location.building_production?.currentWorkers).toBe(15);
    });

    it("allows LocationData without building_production", () => {
        const location: LocationData = {
            name: "Test City",
            type: "Stadt",
        };

        expect(location.building_production).toBeUndefined();
    });
});
