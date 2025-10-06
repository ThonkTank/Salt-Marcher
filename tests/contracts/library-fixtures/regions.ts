// salt-marcher/tests/contracts/library-fixtures/regions.ts
// Liefert Regions-Fixtures mit Ownership-Informationen für Vertragstests.
import type { Region } from "../../../../src/core/regions-store";

export interface RegionFixtureSet {
    owner: "Lore" | "QA";
    entries: Array<Region & { fixtureId: string }>;
}

export const regionFixtures: RegionFixtureSet = Object.freeze({
    owner: "Lore" as const,
    entries: [
        Object.freeze({ fixtureId: "region.alpha", name: "Azure Spires", terrain: "Sunken City", encounterOdds: 35 }),
        Object.freeze({ fixtureId: "region.beta", name: "Reed Maze", terrain: "Marshland", encounterOdds: 20 }),
        Object.freeze({ fixtureId: "region.gamma", name: "Wave-Broken Cliffs", terrain: "Shattered Coast", encounterOdds: 55 }),
    ],
});
