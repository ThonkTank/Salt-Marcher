// salt-marcher/tests/contracts/library-fixtures/index.ts
// Aggregiert sämtliche Domain-Fixtures für den Library-Vertragstest-Harness.
import { creatureFixtures } from "./creatures";
import { equipmentFixtures } from "./equipment";
import { itemFixtures } from "./items";
import { spellPresetFixtures } from "./spell-presets";
import { regionFixtures } from "./regions";
import { terrainFixtures } from "./terrains";

export const libraryFixtures = Object.freeze({
    creatures: creatureFixtures,
    equipment: equipmentFixtures,
    items: itemFixtures,
    spellPresets: spellPresetFixtures,
    regions: regionFixtures,
    terrains: terrainFixtures,
});

export type LibraryFixtureSet = typeof libraryFixtures;
