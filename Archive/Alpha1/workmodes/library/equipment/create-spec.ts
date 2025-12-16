// src/workmodes/library/create/equipment/equipment-spec.ts
// Declarative field specification for equipment creation using the global modal system

import { EQUIPMENT_TYPES, WEAPON_CATEGORIES, WEAPON_TYPES, WEAPON_PROPERTIES, ARMOR_CATEGORIES, TOOL_CATEGORIES, CRAFT_SUGGESTIONS, EQUIPMENT_TAGS } from "./constants";
// Removed: import { equipmentToMarkdown } from "./serializer";
import type { EquipmentData } from "./equipment-types";
import type { CreateSpec, AnyFieldSpec, DataSchema } from "@features/data-manager/data-manager-types";

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
        id: "tags",
        label: "Tags",
        type: "tokens",
        config: {
            fields: [{
                id: "value",
                type: "select",
                displayInChip: true,
                editable: true,
                suggestions: EQUIPMENT_TAGS.map(tag => ({ key: tag, label: tag })),
                placeholder: "Tag auswählen...",
            }],
            primaryField: "value",
        },
        default: [],
        description: "Classification tags for filtering and organization",
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
        type: "tokens",
        description: "e.g., Finesse, Light, Thrown",
        config: {
            fields: [{
                id: "value",
                type: "text",
                displayInChip: true,
                editable: true,
                placeholder: "Property hinzufügen...",
                suggestions: WEAPON_PROPERTIES,
            }],
            primaryField: "value",
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
        type: "checkbox",
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
        type: "tokens",
        description: "Available utilize actions",
        config: {
            fields: [{
                id: "value",
                type: "text",
                displayInChip: true,
                editable: true,
                placeholder: "Action hinzufügen...",
            }],
            primaryField: "value",
        },
        visibleIf: (data) => data.type === "tool",
        default: [],
    },
    {
        id: "craft",
        label: "Craft",
        type: "tokens",
        description: "Craftable items",
        config: {
            fields: [{
                id: "value",
                type: "text",
                displayInChip: true,
                editable: true,
                placeholder: "Item hinzufügen...",
                suggestions: CRAFT_SUGGESTIONS,
            }],
            primaryField: "value",
        },
        visibleIf: (data) => data.type === "tool",
        default: [],
    },
    {
        id: "variants",
        label: "Variants",
        type: "tokens",
        description: "Available variants",
        config: {
            fields: [{
                id: "value",
                type: "text",
                displayInChip: true,
                editable: true,
                placeholder: "Variant hinzufügen...",
            }],
            primaryField: "value",
        },
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
        preserveCase: true,
        frontmatter: [
            "name", "type", "tags", "cost", "weight",
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
    // SQLite backend - removed:         bodyTemplate: (data) => equipmentToMarkdown(data as EquipmentData),
    },
    ui: {
        submitLabel: "Equipment erstellen",
        cancelLabel: "Abbrechen",
        enableNavigation: true,
        sections: [
            {
                id: "basic",
                label: "Grunddaten",
                description: "Name, Typ, Tags, Kosten und Gewicht",
                fieldIds: ["name", "type", "tags", "cost", "weight"],
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
    // Browse configuration - replaces view-config.ts and list-schema.ts
    browse: {
        metadata: [
            {
                id: "type",
                cls: "sm-cc-item__type",
                getValue: (entry) => entry.type,
            },
            {
                id: "role",
                cls: "sm-cc-item__cr",
                getValue: (entry) => {
                    // Derive role from type-specific category fields
                    if (entry.type === "weapon") return entry.weapon_category;
                    if (entry.type === "armor") return entry.armor_category;
                    if (entry.type === "tool") return entry.tool_category;
                    if (entry.type === "gear") return entry.gear_category;
                    return undefined;
                },
            },
        ],
        filters: [
            { id: "type", field: "type", label: "Type", type: "string" },
            { id: "tags", field: "tags", label: "Tags", type: "array" },
            {
                id: "role",
                field: "role",
                label: "Role",
                type: "custom",
                // Role is derived from multiple category fields, needs custom handling
            },
        ],
        sorts: [
            { id: "name", label: "Name", field: "name" },
            { id: "type", label: "Type", field: "type" },
            {
                id: "role",
                label: "Role",
                compareFn: (a, b) => {
                    const roleA = a.type === "weapon" ? a.weapon_category :
                                 a.type === "armor" ? a.armor_category :
                                 a.type === "tool" ? a.tool_category :
                                 a.type === "gear" ? a.gear_category : "";
                    const roleB = b.type === "weapon" ? b.weapon_category :
                                 b.type === "armor" ? b.armor_category :
                                 b.type === "tool" ? b.tool_category :
                                 b.type === "gear" ? b.gear_category : "";
                    return (roleA ?? "").localeCompare(roleB ?? "") || a.name.localeCompare(b.name);
                },
            },
        ],
        search: ["type", "tags"],
    },
    // Loader configuration - replaces loader.ts (uses auto-loader by default)
    loader: {
        // Auto-loader from frontmatter is sufficient for equipment
        // No custom loader needed
    },
};
