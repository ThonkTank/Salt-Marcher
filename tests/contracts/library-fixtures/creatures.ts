// salt-marcher/tests/contracts/library-fixtures/creatures.ts
// Definiert deterministische Creature-Statblocks samt Ownership-Metadaten für Vertragstests.
import type { StatblockData } from "../../../../src/apps/library/core/creature-files";

export interface CreatureFixtureSet {
    owner: "QA" | "Rules";
    entries: Array<StatblockData & { fixtureId: string }>;
}

export const creatureFixtures: CreatureFixtureSet = Object.freeze({
    owner: "QA" as const,
    entries: [
        Object.freeze({
            fixtureId: "creature.alpha",
            name: "Azure Manticore",
            size: "Large",
            type: "Monstrosity",
            alignmentLawChaos: "Chaotic",
            alignmentGoodEvil: "Neutral",
            ac: "17 (natural armor)",
            hp: "136 (16d10 + 48)",
            speeds: { walk: { distance: "40 ft." }, fly: { distance: "60 ft.", hover: false } },
            abilities: [
                { ability: "str", score: 18 },
                { ability: "dex", score: 15 },
                { ability: "con", score: 16 },
                { ability: "int", score: 5 },
                { ability: "wis", score: 12 },
                { ability: "cha", score: 10 },
            ],
            saves: [
                { ability: "str", bonus: 7 },
                { ability: "dex", bonus: 6 },
            ],
            skills: [
                { name: "Perception", bonus: 6 },
                { name: "Stealth", bonus: 6 },
            ],
            sensesList: ["darkvision 60 ft.", "passive Perception 16"],
            languagesList: ["Understands Common, can't speak"],
            damageResistancesList: ["Poison"],
            traits: "***Spike Barrage.*** When the manticore takes damage, roll a d6. On a 5-6 the attacker takes 5 (1d10) piercing damage.",
            actionsList: [
                { name: "Multiattack", text: "The manticore makes three tail spike attacks." },
                { name: "Tail Spike", to_hit: "+7", range: "100/200 ft.", damage: "11 (2d6 + 4) piercing" },
            ],
            spellcasting: {
                ability: "cha",
                groups: [
                    { type: "at-will", spells: [{ name: "Detect Magic" }, { name: "Message" }] },
                ],
            },
        }),
        Object.freeze({
            fixtureId: "creature.beta",
            name: "Brinebound Sage",
            size: "Medium",
            type: "Humanoid (wizard)",
            alignmentOverride: "Lawful Good",
            ac: "14 (mage armor)",
            hp: "71 (13d8 + 13)",
            speeds: { walk: { distance: "30 ft." }, swim: { distance: "30 ft." } },
            abilities: [
                { ability: "str", score: 9 },
                { ability: "dex", score: 14 },
                { ability: "con", score: 12 },
                { ability: "int", score: 18 },
                { ability: "wis", score: 13 },
                { ability: "cha", score: 11 },
            ],
            skills: [
                { name: "Arcana", bonus: 9 },
                { name: "History", bonus: 9 },
            ],
            sensesList: ["passive Perception 11"],
            languagesList: ["Common", "Aquan"],
            traits: "***Brine Veil.*** A shimmering veil grants the sage resistance to cold damage.",
            spellcasting: {
                ability: "int",
                groups: [
                    {
                        type: "level",
                        level: 3,
                        slots: 3,
                        spells: [
                            { name: "Counterspell" },
                            { name: "Water Breathing" },
                        ],
                    },
                    {
                        type: "custom",
                        title: "Rituals",
                        description: "The sage can cast *Augury* as a ritual without expending a slot.",
                    },
                ],
            },
        }),
        Object.freeze({
            fixtureId: "creature.gamma",
            name: "Glimmerfen Stalker",
            size: "Medium",
            type: "Plant",
            alignmentLawChaos: "Neutral",
            alignmentGoodEvil: "Evil",
            ac: "15 (natural armor)",
            hp: "88 (16d8 + 16)",
            speeds: {
                walk: { distance: "30 ft." },
                climb: { distance: "20 ft." },
                extras: [
                    { label: "swampstride", distance: "40 ft.", note: "difficult terrain" },
                ],
            },
            abilities: [
                { ability: "str", score: 16 },
                { ability: "dex", score: 14 },
                { ability: "con", score: 12 },
                { ability: "int", score: 7 },
                { ability: "wis", score: 15 },
                { ability: "cha", score: 8 },
            ],
            saves: [
                { ability: "wis", bonus: 5 },
            ],
            skills: [
                { name: "Stealth", bonus: 6 },
                { name: "Survival", bonus: 5 },
            ],
            sensesList: ["darkvision 60 ft.", "passive Perception 15"],
            languagesList: ["Understands Sylvan, can't speak"],
            damageImmunitiesList: ["poison"],
            conditionImmunitiesList: ["poisoned"],
            traits:
                "***Choking Spores.*** When reduced to half hit points the stalker releases spores; creatures within 10 ft. must succeed on a DC 13 Con save or be poisoned until the end of their next turn.",
            actionsList: [
                { name: "Multiattack", text: "The stalker makes two vine lash attacks." },
                {
                    name: "Vine Lash",
                    to_hit: "+6",
                    range: "10 ft.",
                    damage: "10 (2d6 + 3) bludgeoning",
                    text: "On a hit, the target is grappled (escape DC 14).",
                },
            ],
            spellcasting: {
                ability: "wis",
                groups: [
                    {
                        type: "per-day",
                        uses: "3/day",
                        spells: [
                            { name: "Entangle" },
                            { name: "Spike Growth" },
                        ],
                    },
                ],
            },
        }),
    ],
});
