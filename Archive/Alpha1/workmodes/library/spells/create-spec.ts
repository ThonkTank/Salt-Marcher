// src/workmodes/library/create/spell/spell-spec.ts
// Declarative field specification for spell creation using the global modal system

import { SPELL_SCHOOLS, SPELL_ATTACK_TYPES, SPELL_SAVE_ABILITIES, SPELL_CLASS_SUGGESTIONS } from "./constants";
// Removed: import { spellToMarkdown } from "./serializer";
import { collectSpellScalingIssues } from "./validation";
import type { SpellData } from "./spell-types";
import type { CreateSpec, AnyFieldSpec, DataSchema } from "@features/data-manager/data-manager-types";
import { createVirtualFilePostSaveHook } from "../core/virtual-file-hooks";

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
                    type: "checkbox" as const,
                },
                {
                    id: "s",
                    label: "S",
                    type: "checkbox" as const,
                },
                {
                    id: "m",
                    label: "M",
                    type: "checkbox" as const,
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
        type: "checkbox",
        default: false,
    },
    {
        id: "ritual",
        label: "Ritual",
        type: "checkbox",
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
        type: "tokens",
        config: {
            fields: [{
                id: "value",
                type: "text",
                displayInChip: true,
                editable: true,
                placeholder: "Klasse hinzufügen...",
                suggestions: SPELL_CLASS_SUGGESTIONS,
            }],
            primaryField: "value",
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
        preserveCase: true,
        frontmatter: [
            "name", "level", "school", "casting_time", "range", "components",
            "materials", "duration", "concentration", "ritual", "classes",
            "attack", "save_ability", "save_effect", "damage", "damage_type",
        ],
    // SQLite backend - removed:         bodyTemplate: (data) => spellToMarkdown(data as SpellData),
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
    // Browse configuration - replaces view-config.ts and list-schema.ts
    browse: {
        metadata: [
            {
                id: "level",
                cls: "sm-cc-item__type",
                getValue: (entry) => {
                    const level = entry.level;
                    if (level == null) return "Unknown";
                    if (level === 0) return "Cantrip";
                    return `Level ${level}`;
                },
            },
            {
                id: "school",
                cls: "sm-cc-item__cr",
                getValue: (entry) => entry.school,
            },
        ],
        filters: [
            { id: "school", field: "school", label: "School", type: "string" },
            {
                id: "level",
                field: "level",
                label: "Level",
                type: "custom",
                sortComparator: (a: string, b: string) => Number(a) - Number(b),
            },
            {
                id: "ritual",
                field: "ritual",
                label: "Ritual",
                type: "custom",
                sortComparator: (a: string, b: string) => {
                    // Sort boolean values: undefined < false < true
                    const order = { "undefined": 0, "false": 1, "true": 2 };
                    return (order[a as keyof typeof order] ?? 0) - (order[b as keyof typeof order] ?? 0);
                },
            },
        ],
        sorts: [
            { id: "name", label: "Name", field: "name" },
            { id: "school", label: "School", field: "school" },
            {
                id: "level",
                label: "Level",
                compareFn: (a, b) => (a.level ?? 0) - (b.level ?? 0) || a.name.localeCompare(b.name),
            },
        ],
        search: ["school", "casting_time", "duration", "description"],
    },
    // Loader configuration - replaces loader.ts (uses auto-loader by default)
    loader: {
        // Auto-loader from frontmatter is sufficient for spells
        // No custom loader needed
    },
    transformers: {
        postSave: createVirtualFilePostSaveHook("spells"),
    },
};
