// src/workmodes/library/create/equipment/equipment-spec.ts
// Declarative field specification for equipment creation using the global modal system

import type { CreateSpec, AnyFieldSpec, DataSchema } from "../../../../features/data-manager/edit/types";
import type { EquipmentData, EquipmentType } from "../../core/equipment-files";

// ============================================================================
// SCHEMA
// ============================================================================

const equipmentSchema: DataSchema<EquipmentData> = {
    parse: (data: unknown) => data as EquipmentData,
    safeParse: (data: unknown) => {
        try {
            return { success: true, data: data as EquipmentData };
        } catch (error) {
            return { success: false, error };
        }
    },
};

// ============================================================================
// PRESET CONSTANTS
// ============================================================================

const EQUIPMENT_TYPES: EquipmentType[] = ["weapon", "armor", "tool", "gear"];

// Weapon constants
const WEAPON_CATEGORIES = ["Simple", "Martial"];
const WEAPON_TYPES = ["Melee", "Ranged"];

// Armor constants
const ARMOR_CATEGORIES = ["Light", "Medium", "Heavy", "Shield"];

// Tool constants
const TOOL_CATEGORIES = ["Artisan", "Gaming", "Musical", "Other"];

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
        placeholder: "Longsword",
    },
    {
        id: "type",
        label: "Type",
        type: "select",
        required: true,
        options: EQUIPMENT_TYPES.map(type => ({
            value: type,
            label: type.charAt(0).toUpperCase() + type.slice(1),
        })),
        default: "weapon",
    },
    {
        id: "cost",
        label: "Cost",
        type: "text",
        description: "e.g., '15 GP', '2 SP'",
        placeholder: "15 GP",
    },
    {
        id: "weight",
        label: "Weight",
        type: "text",
        description: "e.g., '3 lb.', '—'",
        placeholder: "3 lb.",
    },
];

// Section 2: Weapon Properties (conditional on type === "weapon")
const weaponFields: AnyFieldSpec[] = [
    {
        id: "weapon_category",
        label: "Category",
        type: "select",
        options: [
            { value: "", label: "(none)" },
            ...WEAPON_CATEGORIES.map(c => ({ value: c, label: c })),
        ],
        visibleIf: (data) => data.type === "weapon",
    },
    {
        id: "weapon_type",
        label: "Weapon Type",
        type: "select",
        options: [
            { value: "", label: "(none)" },
            ...WEAPON_TYPES.map(t => ({ value: t, label: t })),
        ],
        visibleIf: (data) => data.type === "weapon",
    },
    {
        id: "damage",
        label: "Damage",
        type: "text",
        description: "e.g., '1d8 Slashing'",
        placeholder: "1d8 Slashing",
        visibleIf: (data) => data.type === "weapon",
    },
    {
        id: "properties",
        label: "Properties",
        type: "tags",
        description: "e.g., Finesse, Light, Thrown",
        placeholder: "Property hinzufügen...",
        config: {
            suggestions: [
                "Finesse",
                "Light",
                "Heavy",
                "Reach",
                "Thrown",
                "Two-Handed",
                "Versatile",
                "Loading",
                "Ammunition",
            ],
        },
        visibleIf: (data) => data.type === "weapon",
        default: [],
    },
    {
        id: "mastery",
        label: "Mastery",
        type: "text",
        description: "e.g., 'Sap', 'Vex'",
        placeholder: "Sap",
        visibleIf: (data) => data.type === "weapon",
    },
];

// Section 3: Armor Properties (conditional on type === "armor")
const armorFields: AnyFieldSpec[] = [
    {
        id: "armor_category",
        label: "Category",
        type: "select",
        options: [
            { value: "", label: "(none)" },
            ...ARMOR_CATEGORIES.map(c => ({ value: c, label: c })),
        ],
        visibleIf: (data) => data.type === "armor",
    },
    {
        id: "ac",
        label: "Armor Class (AC)",
        type: "text",
        description: "e.g., '11 + Dex modifier', '18'",
        placeholder: "11 + Dex modifier",
        visibleIf: (data) => data.type === "armor",
    },
    {
        id: "strength_requirement",
        label: "Strength Requirement",
        type: "text",
        description: "e.g., 'Str 13'",
        placeholder: "Str 13",
        visibleIf: (data) => data.type === "armor",
    },
    {
        id: "stealth_disadvantage",
        label: "Stealth Disadvantage",
        type: "toggle",
        visibleIf: (data) => data.type === "armor",
        default: false,
    },
    {
        id: "don_time",
        label: "Don Time",
        type: "text",
        description: "e.g., '1 Minute'",
        placeholder: "1 Minute",
        visibleIf: (data) => data.type === "armor",
    },
    {
        id: "doff_time",
        label: "Doff Time",
        type: "text",
        description: "e.g., '1 Minute'",
        placeholder: "1 Minute",
        visibleIf: (data) => data.type === "armor",
    },
];

// Section 4: Tool Properties (conditional on type === "tool")
const toolFields: AnyFieldSpec[] = [
    {
        id: "tool_category",
        label: "Category",
        type: "select",
        options: [
            { value: "", label: "(none)" },
            ...TOOL_CATEGORIES.map(c => ({ value: c, label: c })),
        ],
        visibleIf: (data) => data.type === "tool",
    },
    {
        id: "ability",
        label: "Ability",
        type: "text",
        description: "e.g., 'Intelligence', 'Dexterity'",
        placeholder: "Intelligence",
        visibleIf: (data) => data.type === "tool",
    },
    {
        id: "utilize",
        label: "Utilize",
        type: "tags",
        description: "Available utilize actions",
        placeholder: "Action hinzufügen...",
        visibleIf: (data) => data.type === "tool",
        default: [],
    },
    {
        id: "craft",
        label: "Craft",
        type: "tags",
        description: "Craftable items",
        placeholder: "Item hinzufügen...",
        config: {
            suggestions: [
                "Acid",
                "Alchemist's Fire",
                "Oil",
                "Perfume",
                "Soap",
            ],
        },
        visibleIf: (data) => data.type === "tool",
        default: [],
    },
    {
        id: "variants",
        label: "Variants",
        type: "tags",
        description: "Available variants",
        placeholder: "Variant hinzufügen...",
        visibleIf: (data) => data.type === "tool",
        default: [],
    },
];

// Section 5: Gear Properties (conditional on type === "gear")
const gearFields: AnyFieldSpec[] = [
    {
        id: "gear_category",
        label: "Category",
        type: "text",
        description: "e.g., 'Container', 'Light Source'",
        placeholder: "Container",
        visibleIf: (data) => data.type === "gear",
    },
    {
        id: "capacity",
        label: "Capacity",
        type: "text",
        description: "For containers",
        placeholder: "30 cubic feet / 300 lb.",
        visibleIf: (data) => data.type === "gear",
    },
    {
        id: "duration",
        label: "Duration",
        type: "text",
        description: "For consumables",
        placeholder: "1 hour",
        visibleIf: (data) => data.type === "gear",
    },
    {
        id: "special_use",
        label: "Special Use",
        type: "textarea",
        description: "Special usage rules",
        placeholder: "When you take the Attack action...",
        visibleIf: (data) => data.type === "gear",
    },
];

// Section 6: Description (always visible)
const descriptionFields: AnyFieldSpec[] = [
    {
        id: "description",
        label: "Description",
        type: "textarea",
        placeholder: "Equipment description...",
    },
];

// ============================================================================
// SPEC
// ============================================================================

export const equipmentSpec: CreateSpec<EquipmentData> = {
    kind: "equipment",
    title: "Equipment erstellen",
    subtitle: "Neue Ausrüstung für deine Kampagne",
    schema: equipmentSchema,
    fields: [
        ...basicInfoFields,
        ...weaponFields,
        ...armorFields,
        ...toolFields,
        ...gearFields,
        ...descriptionFields,
    ],
    storage: {
        format: "md-frontmatter",
        pathTemplate: "SaltMarcher/Equipment/{name}.md",
        filenameFrom: "name",
        directory: "SaltMarcher/Equipment",
        frontmatter: [
            "name", "type", "cost", "weight",
            // Weapon fields
            "weapon_category", "weapon_type", "damage", "properties", "mastery",
            // Armor fields
            "armor_category", "ac", "strength_requirement", "stealth_disadvantage",
            "don_time", "doff_time",
            // Tool fields
            "tool_category", "ability", "utilize", "craft", "variants",
            // Gear fields
            "gear_category", "capacity", "duration", "special_use",
        ],
    },
    ui: {
        submitLabel: "Equipment erstellen",
        cancelLabel: "Abbrechen",
        enableNavigation: true,
        sections: [
            {
                id: "basic",
                label: "Grunddaten",
                description: "Name, Typ, Kosten und Gewicht",
                fieldIds: ["name", "type", "cost", "weight"],
            },
            {
                id: "weapon",
                label: "Waffeneigenschaften",
                description: "Kategorie, Schaden und Eigenschaften",
                fieldIds: ["weapon_category", "weapon_type", "damage", "properties", "mastery"],
            },
            {
                id: "armor",
                label: "Rüstungseigenschaften",
                description: "Kategorie, AC und Anforderungen",
                fieldIds: ["armor_category", "ac", "strength_requirement", "stealth_disadvantage", "don_time", "doff_time"],
            },
            {
                id: "tool",
                label: "Werkzeugeigenschaften",
                description: "Kategorie, Fähigkeit und Verwendungen",
                fieldIds: ["tool_category", "ability", "utilize", "craft", "variants"],
            },
            {
                id: "gear",
                label: "Ausrüstungseigenschaften",
                description: "Kategorie, Kapazität und spezielle Verwendung",
                fieldIds: ["gear_category", "capacity", "duration", "special_use"],
            },
            {
                id: "description",
                label: "Beschreibung",
                description: "Allgemeine Beschreibung",
                fieldIds: ["description"],
            },
        ],
    },
};
