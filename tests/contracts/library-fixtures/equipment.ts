// salt-marcher/tests/contracts/library-fixtures/equipment.ts
// Liefert deterministische Ausrüstungseinträge inklusive Ownership-Angaben.
import type { EquipmentData } from "../../../../src/apps/library/core/equipment-files";

export interface EquipmentFixtureSet {
    owner: "Systems" | "QA";
    entries: Array<EquipmentData & { fixtureId: string }>;
}

export const equipmentFixtures: EquipmentFixtureSet = Object.freeze({
    owner: "Systems" as const,
    entries: [
        Object.freeze({
            fixtureId: "equipment.alpha",
            name: "Stormglass Pike",
            cost: "35 gp",
            weight: "6 lb.",
            category: "Martial Melee Weapons",
            damage: "1d8 piercing",
            properties: ["Reach", "Two-Handed"],
            description: "Forged from hardened stormglass that crackles with static energy.",
        }),
        Object.freeze({
            fixtureId: "equipment.beta",
            name: "Kelpweave Armor",
            cost: "120 gp",
            weight: "20 lb.",
            category: "Medium Armor",
            ac: "15",
            properties: ["Resistance (cold) while submerged"],
            description: "Armor woven from kelp strands treated with alchemical resin.",
        }),
        Object.freeze({
            fixtureId: "equipment.gamma",
            name: "Thundercoil Net",
            cost: "65 gp",
            weight: "3 lb.",
            category: "Martial Ranged Weapons",
            damage: "1d6 bludgeoning",
            properties: ["Thrown (20/60)", "Special"],
            description: "Braided with resonant wire, this net delivers a concussive jolt when it ensnares a creature.",
        }),
    ],
});
