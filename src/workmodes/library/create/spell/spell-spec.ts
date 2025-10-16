// src/workmodes/library/create/spell/spell-spec.ts
// Declarative field specification for spell creation using the global modal system

import type { CreateSpec, AnyFieldSpec, DataSchema } from "../../../../features/data-manager/edit/types";
import type { SpellData } from "../../core/spell-files";
import { collectSpellScalingIssues } from "./validation";

// ============================================================================
// SCHEMA WITH VALIDATION
// ============================================================================

const spellSchema: DataSchema<SpellData> = {
    parse: (data: unknown) => data as SpellData,
    safeParse: (data: unknown) => {
        try {
            const spellData = data as SpellData;

            // Run spell scaling validation
            const scalingIssues = collectSpellScalingIssues(spellData);
            if (scalingIssues.length > 0) {
                return {
                    success: false,
                    error: new Error(scalingIssues.join("\n")),
                };
            }

            return { success: true, data: spellData };
        } catch (error) {
            return { success: false, error };
        }
    },
};

// ============================================================================
// PRESET CONSTANTS
// ============================================================================

const SPELL_SCHOOLS = [
    "Abjuration",
    "Conjuration",
    "Divination",
    "Enchantment",
    "Evocation",
    "Illusion",
    "Necromancy",
    "Transmutation",
];

const SPELL_ATTACK_TYPES = [
    "Melee Spell Attack",
    "Ranged Spell Attack",
    "Melee Weapon Attack",
    "Ranged Weapon Attack",
];

const SPELL_SAVE_ABILITIES = ["STR", "DEX", "CON", "INT", "WIS", "CHA"];

const SPELL_CLASS_SUGGESTIONS = [
    "Bard",
    "Cleric",
    "Druid",
    "Paladin",
    "Ranger",
    "Sorcerer",
    "Warlock",
    "Wizard",
    "Artificer",
];

// ============================================================================
// FIELD DEFINITIONS
// ============================================================================

// Section 1: Grunddaten (Basic Info)
const basicInfoFields: AnyFieldSpec[] = [
    {
        id: "name",
        label: "Name",
        type: "text",
        required: true,
        placeholder: "Fireball",
    },
    {
        id: "level",
        label: "Grad",
        type: "select",
        description: "0 = Zaubertrick",
        options: Array.from({ length: 10 }, (_, i) => ({
            value: String(i),
            label: i === 0 ? "Cantrip" : `Level ${i}`,
        })),
        default: "0",
    },
    {
        id: "school",
        label: "Schule",
        type: "select",
        options: [
            { value: "", label: "(keine)" },
            ...SPELL_SCHOOLS.map(s => ({ value: s, label: s })),
        ],
    },
];

// Section 2: Timing & Components
const timingComponentsFields: AnyFieldSpec[] = [
    {
        id: "casting_time",
        label: "Wirkzeit",
        type: "text",
        placeholder: "1 Aktion",
    },
    {
        id: "range",
        label: "Reichweite",
        type: "text",
        placeholder: "60 Fuß",
    },
    {
        id: "duration",
        label: "Dauer",
        type: "text",
        placeholder: "Augenblicklich / Konzentration, bis zu 1 Minute",
    },
    {
        id: "components",
        label: "Komponenten",
        type: "composite",
        config: {
            fields: [
                {
                    id: "v",
                    label: "V",
                    type: "toggle" as const,
                },
                {
                    id: "s",
                    label: "S",
                    type: "toggle" as const,
                },
                {
                    id: "m",
                    label: "M",
                    type: "toggle" as const,
                },
            ],
            layout: "horizontal",
            toData: (value: Record<string, unknown>) => {
                const arr: string[] = [];
                if (value.v) arr.push("V");
                if (value.s) arr.push("S");
                if (value.m) arr.push("M");
                return arr.length > 0 ? arr : undefined;
            },
            fromData: (data: string[] | undefined) => ({
                v: data?.includes("V") ?? false,
                s: data?.includes("S") ?? false,
                m: data?.includes("M") ?? false,
            }),
        },
    },
    {
        id: "materials",
        label: "Materialien",
        type: "text",
        placeholder: "winzige Kugel aus Guano und Schwefel",
    },
];

// Section 3: Flags
const flagsFields: AnyFieldSpec[] = [
    {
        id: "concentration",
        label: "Konzentration",
        type: "toggle",
        default: false,
    },
    {
        id: "ritual",
        label: "Ritual",
        type: "toggle",
        default: false,
    },
];

// Section 4: Combat & Targeting
const combatFields: AnyFieldSpec[] = [
    {
        id: "attack",
        label: "Angriff",
        type: "select",
        options: [
            { value: "", label: "(kein)" },
            ...SPELL_ATTACK_TYPES.map(a => ({ value: a, label: a })),
        ],
    },
    {
        id: "save_ability",
        label: "Rettungswurf",
        type: "select",
        options: [
            { value: "", label: "(kein)" },
            ...SPELL_SAVE_ABILITIES.map(a => ({ value: a, label: a })),
        ],
    },
    {
        id: "save_effect",
        label: "Effekt",
        type: "text",
        placeholder: "Half on save / Negates …",
        visibleIf: (data) => Boolean(data.save_ability),
    },
];

// Section 5: Damage
const damageFields: AnyFieldSpec[] = [
    {
        id: "damage",
        label: "Schadenswürfel",
        type: "text",
        placeholder: "8d6",
    },
    {
        id: "damage_type",
        label: "Schadenstyp",
        type: "text",
        placeholder: "fire / radiant …",
    },
];

// Section 6: Classes
const classesFields: AnyFieldSpec[] = [
    {
        id: "classes",
        label: "Klassen",
        type: "tags",
        placeholder: "Klasse hinzufügen...",
        config: {
            suggestions: SPELL_CLASS_SUGGESTIONS,
        },
        default: [],
    },
];

// Section 7: Description
const descriptionFields: AnyFieldSpec[] = [
    {
        id: "description",
        label: "Beschreibung",
        type: "textarea",
        placeholder: "Beschreibung (Markdown)",
    },
    {
        id: "higher_levels",
        label: "Höhere Grade",
        type: "textarea",
        placeholder: "Bei höheren Graden (Markdown)",
        description: "Optional: Skalierung des Zaubers bei höheren Stufen",
    },
];

// ============================================================================
// SPEC
// ============================================================================

export const spellSpec: CreateSpec<SpellData> = {
    kind: "spell",
    title: "Zauber erstellen",
    subtitle: "Neuer Zauber für deine Kampagne",
    schema: spellSchema,
    fields: [
        ...basicInfoFields,
        ...timingComponentsFields,
        ...flagsFields,
        ...combatFields,
        ...damageFields,
        ...classesFields,
        ...descriptionFields,
    ],
    storage: {
        format: "md-frontmatter",
        pathTemplate: "SaltMarcher/Spells/{name}.md",
        filenameFrom: "name",
        directory: "SaltMarcher/Spells",
        frontmatter: [
            "name", "level", "school", "casting_time", "range", "components",
            "materials", "duration", "concentration", "ritual", "classes",
            "attack", "save_ability", "save_effect", "damage", "damage_type",
        ],
    },
    ui: {
        submitLabel: "Zauber erstellen",
        cancelLabel: "Abbrechen",
        enableNavigation: true,
        sections: [
            {
                id: "basic",
                label: "Grunddaten",
                description: "Name, Grad und Schule",
                fieldIds: ["name", "level", "school"],
            },
            {
                id: "timing",
                label: "Timing & Komponenten",
                description: "Wirkzeit, Reichweite, Dauer und Komponenten",
                fieldIds: ["casting_time", "range", "duration", "components", "materials"],
            },
            {
                id: "flags",
                label: "Eigenschaften",
                description: "Konzentration und Ritual",
                fieldIds: ["concentration", "ritual"],
            },
            {
                id: "combat",
                label: "Kampf & Targeting",
                description: "Angriffe und Rettungswürfe",
                fieldIds: ["attack", "save_ability", "save_effect"],
            },
            {
                id: "damage",
                label: "Schaden",
                description: "Schadenswürfel und Typ",
                fieldIds: ["damage", "damage_type"],
            },
            {
                id: "classes",
                label: "Klassen",
                description: "Verfügbare Klassen",
                fieldIds: ["classes"],
            },
            {
                id: "description",
                label: "Beschreibung",
                description: "Zauberbeschreibung und Skalierung",
                fieldIds: ["description", "higher_levels"],
            },
        ],
    },
};
