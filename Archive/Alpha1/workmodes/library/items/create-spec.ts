// src/workmodes/library/create/item/item-spec.ts
// Declarative field specification for item creation using the global modal system

import { ITEM_CATEGORIES, ITEM_RARITIES, RECHARGE_TIMES, ITEM_TAGS } from "./constants";
// Removed: import { itemToMarkdown } from "./serializer";
import type { ItemData } from './calendar-types';
import type { CreateSpec, AnyFieldSpec, DataSchema } from "@features/data-manager/data-manager-types";

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
        id: "tags",
        label: "Tags",
        type: "tokens",
        config: {
            fields: [{
                id: "value",
                type: "select",
                displayInChip: true,
                editable: true,
                suggestions: ITEM_TAGS.map(tag => ({ key: tag, label: tag })),
                placeholder: "Tag auswählen...",
            }],
            primaryField: "value",
        },
        default: [],
        description: "Classification tags for filtering and organization",
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
        type: "checkbox",
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
        type: "checkbox",
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
        preserveCase: true,
        frontmatter: [
            "name", "category", "tags", "type", "rarity",
            "attunement", "attunement_req",
            "max_charges", "recharge_formula", "recharge_time", "destruction_risk",
            "spell_storage_capacity",
            "spells_json", "bonuses_json", "ability_changes_json", "speed_changes_json",
            "properties_json", "usage_limit_json", "tables_json", "sentient_props_json",
            "resistances", "immunities",
            "weight", "value",
            "cursed", "curse_description",
            "has_variants", "variant_info",
            "sentient",
        ],
    // SQLite backend - removed:         bodyTemplate: (data) => itemToMarkdown(data as ItemData),
    },
    ui: {
        submitLabel: "Item erstellen",
        cancelLabel: "Abbrechen",
        enableNavigation: true,
        sections: [
            {
                id: "basic",
                label: "Grunddaten",
                description: "Name, Kategorie, Tags, Typ und Seltenheit",
                fieldIds: ["name", "category", "tags", "type", "rarity"],
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
    // Browse configuration - replaces view-config.ts and list-schema.ts
    browse: {
        metadata: [
            {
                id: "category",
                cls: "sm-cc-item__type",
                getValue: (entry) => entry.category,
            },
            {
                id: "rarity",
                cls: "sm-cc-item__cr",
                getValue: (entry) => entry.rarity,
            },
        ],
        filters: [
            { id: "category", field: "category", label: "Category", type: "string" },
            { id: "tags", field: "tags", label: "Tags", type: "array" },
            {
                id: "rarity",
                field: "rarity",
                label: "Rarity",
                type: "custom",
                sortComparator: (a: string, b: string) => {
                    const RARITY_ORDER = new Map<string, number>([
                        ["common", 0],
                        ["uncommon", 1],
                        ["rare", 2],
                        ["very rare", 3],
                        ["legendary", 4],
                        ["artifact", 5],
                    ]);
                    const orderA = RARITY_ORDER.get(a?.toLowerCase() ?? "") ?? Number.POSITIVE_INFINITY;
                    const orderB = RARITY_ORDER.get(b?.toLowerCase() ?? "") ?? Number.POSITIVE_INFINITY;
                    return orderA - orderB || a.localeCompare(b);
                },
            },
        ],
        sorts: [
            { id: "name", label: "Name", field: "name" },
            { id: "category", label: "Category", field: "category" },
            {
                id: "rarity",
                label: "Rarity",
                compareFn: (a, b) => {
                    const RARITY_ORDER = new Map<string, number>([
                        ["common", 0],
                        ["uncommon", 1],
                        ["rare", 2],
                        ["very rare", 3],
                        ["legendary", 4],
                        ["artifact", 5],
                    ]);
                    const orderA = RARITY_ORDER.get(a.rarity?.toLowerCase() ?? "") ?? Number.POSITIVE_INFINITY;
                    const orderB = RARITY_ORDER.get(b.rarity?.toLowerCase() ?? "") ?? Number.POSITIVE_INFINITY;
                    return orderA - orderB || a.name.localeCompare(b.name);
                },
            },
        ],
        search: ["category", "tags", "rarity"],
    },
    // Loader configuration - replaces loader.ts (uses auto-loader by default)
    loader: {
        // Auto-loader from frontmatter is sufficient for items
        // No custom loader needed
    },
};
