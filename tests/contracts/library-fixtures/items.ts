// salt-marcher/tests/contracts/library-fixtures/items.ts
// Definiert deterministische Item-Daten mit Ownership-Angaben für Vertragstests.
import type { ItemData } from "../../../../src/apps/library/core/item-files";

export interface ItemFixtureSet {
    owner: "Library" | "QA";
    entries: Array<ItemData & { fixtureId: string }>;
}

export const itemFixtures: ItemFixtureSet = Object.freeze({
    owner: "Library" as const,
    entries: [
        Object.freeze({
            fixtureId: "item.alpha",
            name: "Saltward Cloak",
            rarity: "Rare",
            type: "Wondrous Item",
            attunement: "yes",
            description: "A cloak woven with sea-silver thread that wards off corroding spray.",
            properties: [
                "While wearing the cloak you have advantage on saves against acid.",
                "Once per long rest you can cast *Absorb Elements* without expending a spell slot.",
            ],
        }),
        Object.freeze({
            fixtureId: "item.beta",
            name: "Compass of the Deep",
            rarity: "Uncommon",
            type: "Wondrous Item",
            attunement: "no",
            description: "This brass compass always points toward the nearest underwater ruin.",
            properties: [
                "While submerged you can breathe water for up to 10 minutes per day.",
            ],
        }),
    ],
});
