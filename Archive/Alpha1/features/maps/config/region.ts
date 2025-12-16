// src/features/maps/config/region.ts
// Domain types and validation for regions

export type Region = {
    name: string;
    terrain: string;
    encounterOdds?: number;
};

const REGION_NAME_MAX_LENGTH = 120;
const REGION_TERRAIN_MAX_LENGTH = 64;
const ENCOUNTER_ODDS_MIN = 1;
const ENCOUNTER_ODDS_MAX = 100;

export class RegionValidationError extends Error {
    constructor(public readonly issues: string[]) {
        super(`Invalid region schema: ${issues.join(", ")}`);
        this.name = "RegionValidationError";
    }
}

export function validateRegion(region: Region): Region {
    const issues: string[] = [];
    const name = typeof region.name === "string" ? region.name.trim() : "";
    const terrain = typeof region.terrain === "string" ? region.terrain.trim() : "";

    if (!name) {
        issues.push("Region name must not be empty");
    }
    if (name.length > REGION_NAME_MAX_LENGTH) {
        issues.push(`Region name "${name}" exceeds ${REGION_NAME_MAX_LENGTH} characters`);
    }
    if (terrain.length > REGION_TERRAIN_MAX_LENGTH) {
        issues.push(`Region terrain "${terrain}" exceeds ${REGION_TERRAIN_MAX_LENGTH} characters`);
    }

    let encounterOdds: number | undefined = undefined;
    if (region.encounterOdds !== undefined) {
        const odds = Number(region.encounterOdds);
        if (!Number.isFinite(odds) || odds < ENCOUNTER_ODDS_MIN || odds > ENCOUNTER_ODDS_MAX) {
            issues.push(
                `Region encounter odds must be between ${ENCOUNTER_ODDS_MIN} and ${ENCOUNTER_ODDS_MAX}`
            );
        } else {
            encounterOdds = odds;
        }
    }

    if (issues.length) {
        throw new RegionValidationError(issues);
    }

    return {
        name,
        terrain,
        encounterOdds,
    };
}

export function validateRegionList(regions: Region[]): Region[] {
    const validated: Region[] = [];
    const errors: string[] = [];

    for (let i = 0; i < regions.length; i++) {
        try {
            validated.push(validateRegion(regions[i]));
        } catch (error) {
            if (error instanceof RegionValidationError) {
                errors.push(`Region ${i}: ${error.message}`);
            } else {
                errors.push(`Region ${i}: Unknown validation error`);
            }
        }
    }

    if (errors.length) {
        throw new RegionValidationError(errors);
    }

    return validated;
}
