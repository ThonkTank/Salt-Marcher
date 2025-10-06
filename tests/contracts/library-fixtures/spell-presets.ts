// salt-marcher/tests/contracts/library-fixtures/spell-presets.ts
// Definiert Spell-Preset-Datensätze inklusive Metadaten für Vertragstests.
import type { SpellData } from "../../../../src/apps/library/core/spell-files";

export interface SpellPresetFixtureSet {
    owner: "QA" | "Rules";
    entries: Array<SpellData & { fixtureId: string }>;
}

export const spellPresetFixtures: SpellPresetFixtureSet = Object.freeze({
    owner: "QA" as const,
    entries: [
        Object.freeze({
            fixtureId: "spell-preset.ember-ward",
            name: "Ember Ward",
            level: 2,
            school: "Abjuration",
            casting_time: "1 action",
            range: "Self",
            components: ["V", "S"],
            materials: "a shard of kiln-fired glass",
            duration: "10 minutes",
            concentration: true,
            ritual: false,
            classes: ["Wizard", "Artificer"],
            description:
                "A lattice of emberlight surrounds you, reducing fire damage by channeling the heat into harmless sparks.",
            higher_levels:
                "When you cast this spell using a spell slot of 3rd level or higher, the ward also grants resistance to lightning damage.",
        }),
        Object.freeze({
            fixtureId: "spell-preset.tidal-script",
            name: "Tidal Script",
            level: 0,
            school: "Transmutation",
            casting_time: "1 bonus action",
            range: "Touch",
            components: ["V", "S", "M"],
            materials: "a ribbon of dried kelp",
            duration: "1 minute",
            concentration: false,
            ritual: false,
            classes: ["Bard", "Druid", "Wizard"],
            save_ability: "dex",
            save_effect: "On a failure, the target is briefly anchored in a glyph of swirling water.",
            description:
                "You etch a watery sigil on a creature's gear. Until the spell ends, the target's weapon attacks deal an extra 1 cold damage.",
            higher_levels:
                "The bonus damage increases by 1 when you reach 5th level (2 cold), 11th level (3 cold), and 17th level (4 cold).",
        }),
        Object.freeze({
            fixtureId: "spell-preset.coralmind-bastion",
            name: "Coralmind Bastion",
            level: 4,
            school: "Abjuration",
            casting_time: "1 action",
            range: "60 feet",
            components: ["V", "S", "M"],
            materials: "a miniature coral crown worth 50 gp",
            duration: "Concentration, up to 10 minutes",
            concentration: true,
            ritual: false,
            classes: ["Cleric", "Druid"],
            description:
                "You raise a shimmering reef of thought coral that grants allies within a 20-foot radius resistance to psychic damage.",
            higher_levels:
                "When you cast this spell using a spell slot of 6th level or higher, creatures in the area also gain advantage on Wisdom saving throws.",
        }),
    ],
});
