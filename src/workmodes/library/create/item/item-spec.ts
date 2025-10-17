// src/workmodes/library/create/item/item-spec.ts
// Declarative field specification for item creation using the global modal system

import type { CreateSpec, AnyFieldSpec, DataSchema } from "../../../../features/data-manager/types";
import type { ItemData } from "../../core/item-files";

// ============================================================================
// SCHEMA
// ============================================================================

const itemSchema: DataSchema<ItemData> = {
    parse: (data: unknown) => data as ItemData,
    safeParse: (data: unknown) => {
        try {
            return { success: true, data: data as ItemData };
        } catch (error) {
            return { success: false, error };
        }
    },
};

// ============================================================================
// PRESET CONSTANTS
// ============================================================================

const ITEM_CATEGORIES = [
    "Armor",
    "Potion",
    "Ring",
    "Rod",
    "Scroll",
    "Staff",
    "Wand",
    "Weapon",
    "Wondrous Item",
];

const ITEM_RARITIES = [
    "Common",
    "Uncommon",
    "Rare",
    "Very Rare",
    "Legendary",
    "Artifact",
];

const RECHARGE_TIMES = [
    "Dawn",
    "Dusk",
    "Long Rest",
    "Short Rest",
];

// ============================================================================
// FIELD DEFINITIONS
// ============================================================================

// Section 1: Basic Information
const basicInfoFields: AnyFieldSpec[] = [
    {
        id: "name",
        label: "Name",
        type: "text",
        required: true,
        placeholder: "Flaming Longsword",
    },
    {
        id: "category",
        label: "Category",
        type: "select",
        options: [
            { value: "", label: "(none)" },
            ...ITEM_CATEGORIES.map(c => ({ value: c, label: c })),
        ],
    },
    {
        id: "type",
        label: "Type",
        type: "text",
        description: "e.g., 'Armor (Plate)', 'Weapon (Longsword)'",
        placeholder: "Weapon (Longsword)",
    },
    {
        id: "rarity",
        label: "Rarity",
        type: "select",
        options: [
            { value: "", label: "(none)" },
            ...ITEM_RARITIES.map(r => ({ value: r, label: r })),
        ],
    },
];

// Section 2: Attunement
const attunementFields: AnyFieldSpec[] = [
    {
        id: "attunement",
        label: "Requires Attunement",
        type: "toggle",
        default: false,
    },
    {
        id: "attunement_req",
        label: "Attunement Requirement",
        type: "text",
        description: "e.g., 'by a Cleric'",
        placeholder: "by a Druid, Sorcerer, Warlock, or Wizard",
        visibleIf: (data) => Boolean(data.attunement),
    },
];

// Section 3: Charges System
const chargesFields: AnyFieldSpec[] = [
    {
        id: "max_charges",
        label: "Max Charges",
        type: "number-stepper",
        min: 0,
        max: 50,
        step: 1,
        placeholder: "10",
    },
    {
        id: "recharge_formula",
        label: "Recharge Formula",
        type: "text",
        description: "e.g., '1d6 + 4'",
        placeholder: "1d6 + 4",
        visibleIf: (data) => typeof data.max_charges === "number" && data.max_charges > 0,
    },
    {
        id: "recharge_time",
        label: "Recharge Time",
        type: "select",
        options: [
            { value: "", label: "(none)" },
            ...RECHARGE_TIMES.map(t => ({ value: t, label: t })),
        ],
        visibleIf: (data) => typeof data.max_charges === "number" && data.max_charges > 0,
    },
    {
        id: "destruction_risk",
        label: "Destruction Risk",
        type: "text",
        description: "e.g., 'On 1, turns to water'",
        placeholder: "On 1, turns to water and is destroyed",
        visibleIf: (data) => typeof data.max_charges === "number" && data.max_charges > 0,
    },
];

// Section 4: Properties & Effects
const propertiesFields: AnyFieldSpec[] = [
    {
        id: "description",
        label: "Description",
        type: "textarea",
        placeholder: "While wearing this armor...",
    },
    {
        id: "notes",
        label: "Notes",
        type: "textarea",
        placeholder: "Additional information...",
    },
];

// Section 5: Weight & Value
const metadataFields: AnyFieldSpec[] = [
    {
        id: "weight",
        label: "Weight",
        type: "text",
        placeholder: "5 pounds",
    },
    {
        id: "value",
        label: "Value",
        type: "text",
        placeholder: "2,000 GP",
    },
];

// Section 6: Curse
const curseFields: AnyFieldSpec[] = [
    {
        id: "cursed",
        label: "Cursed Item",
        type: "toggle",
        default: false,
    },
    {
        id: "curse_description",
        label: "Curse Description",
        type: "textarea",
        placeholder: "This armor is cursed...",
        visibleIf: (data) => Boolean(data.cursed),
    },
];

// ============================================================================
// SPEC
// ============================================================================

export const itemSpec: CreateSpec<ItemData> = {
    kind: "item",
    title: "Item erstellen",
    subtitle: "Neues magisches Item für deine Kampagne",
    schema: itemSchema,
    fields: [
        ...basicInfoFields,
        ...attunementFields,
        ...chargesFields,
        ...propertiesFields,
        ...metadataFields,
        ...curseFields,
    ],
    storage: {
        format: "md-frontmatter",
        pathTemplate: "SaltMarcher/Items/{name}.md",
        filenameFrom: "name",
        directory: "SaltMarcher/Items",
        frontmatter: [
            "name", "category", "type", "rarity",
            "attunement", "attunement_req",
            "max_charges", "recharge_formula", "recharge_time", "destruction_risk",
            "weight", "value",
            "cursed", "curse_description",
        ],
    },
    ui: {
        submitLabel: "Item erstellen",
        cancelLabel: "Abbrechen",
        enableNavigation: true,
        sections: [
            {
                id: "basic",
                label: "Grunddaten",
                description: "Name, Kategorie, Typ und Seltenheit",
                fieldIds: ["name", "category", "type", "rarity"],
            },
            {
                id: "attunement",
                label: "Einstimmung",
                description: "Einstimmungsanforderungen",
                fieldIds: ["attunement", "attunement_req"],
            },
            {
                id: "charges",
                label: "Ladungen",
                description: "Ladungssystem und Aufladung",
                fieldIds: ["max_charges", "recharge_formula", "recharge_time", "destruction_risk"],
            },
            {
                id: "properties",
                label: "Eigenschaften",
                description: "Beschreibung und Notizen",
                fieldIds: ["description", "notes"],
            },
            {
                id: "metadata",
                label: "Metadaten",
                description: "Gewicht und Wert",
                fieldIds: ["weight", "value"],
            },
            {
                id: "curse",
                label: "Fluch",
                description: "Verfluchte Items",
                fieldIds: ["cursed", "curse_description"],
            },
        ],
    },
};
