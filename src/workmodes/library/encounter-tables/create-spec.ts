/**
 * Encounter Table CreateSpec
 *
 * Declarative field specification for encounter table creation using the global modal system.
 * Encounter tables define weighted random encounter lists filtered by terrain, weather, time, faction, and situation.
 */

import type { CreateSpec, AnyFieldSpec, DataSchema } from "../../../features/data-manager/types";
import type { EncounterTableData } from "./types";
import { encounterTableToMarkdown } from "./serializer";
import {
    TERRAIN_TAGS,
    WEATHER_TAGS,
    TIME_OF_DAY_TAGS,
    FACTION_TAGS,
    SITUATION_TAGS,
    DEFAULT_ENTRY_WEIGHT,
} from "./constants";

// ============================================================================
// SCHEMA WITH VALIDATION
// ============================================================================

const encounterTableSchema: DataSchema<EncounterTableData> = {
    parse: (data: unknown) => data as EncounterTableData,
    safeParse: (data: unknown) => {
        try {
            const table = data as EncounterTableData;

            // Validate name
            if (!table.name || typeof table.name !== "string" || table.name.trim().length === 0) {
                return {
                    success: false,
                    error: new Error("Name is required"),
                };
            }

            // Validate entries array exists
            if (!Array.isArray(table.entries)) {
                return {
                    success: false,
                    error: new Error("Entries must be an array"),
                };
            }

            // Validate at least one entry
            if (table.entries.length === 0) {
                return {
                    success: false,
                    error: new Error("At least one encounter entry is required"),
                };
            }

            // Validate CR range
            if (table.crRange) {
                const { min, max } = table.crRange;
                if (min !== undefined && (typeof min !== "number" || min < 0)) {
                    return {
                        success: false,
                        error: new Error("CR min must be a non-negative number"),
                    };
                }
                if (max !== undefined && (typeof max !== "number" || max < 0)) {
                    return {
                        success: false,
                        error: new Error("CR max must be a non-negative number"),
                    };
                }
                if (min !== undefined && max !== undefined && min > max) {
                    return {
                        success: false,
                        error: new Error("CR min cannot exceed CR max"),
                    };
                }
            }

            return { success: true, data: table };
        } catch (error) {
            return { success: false, error };
        }
    },
};

// ============================================================================
// FIELD DEFINITIONS
// ============================================================================

const fields: AnyFieldSpec[] = [
    {
        id: "name",
        label: "Name",
        type: "text",
        required: true,
        placeholder: "Forest Encounters",
        description: "Internal name for the encounter table (used for file path)",
    },
    {
        id: "display_name",
        label: "Display Name",
        type: "text",
        placeholder: "Random Forest Encounters",
        description: "Human-readable name shown in UI (defaults to name if not set)",
    },
    {
        id: "description",
        label: "Description",
        type: "textarea",
        placeholder: "Encounters for dense forest hexes...",
        description: "Optional description of the encounter table's purpose and context",
    },

    // Tag fields for automatic selection (matches playlist pattern)
    {
        id: "terrain_tags",
        label: "Terrain Tags",
        type: "tokens",
        config: {
            fields: [
                {
                    id: "value",
                    type: "select",
                    displayInChip: true,
                    editable: true,
                    suggestions: TERRAIN_TAGS.map((tag) => ({ key: tag, label: tag })),
                    placeholder: "Terrain auswählen...",
                },
            ],
            primaryField: "value",
        },
        default: [],
        description: "Terrain types this table applies to (Forest, Mountain, etc.)",
    },
    {
        id: "weather_tags",
        label: "Weather Tags",
        type: "tokens",
        config: {
            fields: [
                {
                    id: "value",
                    type: "select",
                    displayInChip: true,
                    editable: true,
                    suggestions: WEATHER_TAGS.map((tag) => ({ key: tag, label: tag })),
                    placeholder: "Weather auswählen...",
                },
            ],
            primaryField: "value",
        },
        default: [],
        description: "Weather conditions this table applies to (Clear, Rain, etc.)",
    },
    {
        id: "time_of_day_tags",
        label: "Time of Day Tags",
        type: "tokens",
        config: {
            fields: [
                {
                    id: "value",
                    type: "select",
                    displayInChip: true,
                    editable: true,
                    suggestions: TIME_OF_DAY_TAGS.map((tag) => ({ key: tag, label: tag })),
                    placeholder: "Time auswählen...",
                },
            ],
            primaryField: "value",
        },
        default: [],
        description: "Time of day this table applies to (Dawn, Night, etc.)",
    },
    {
        id: "faction_tags",
        label: "Faction Tags",
        type: "tokens",
        config: {
            fields: [
                {
                    id: "value",
                    type: "select",
                    displayInChip: true,
                    editable: true,
                    suggestions: FACTION_TAGS.map((tag) => ({ key: tag, label: tag })),
                    placeholder: "Faction auswählen...",
                },
            ],
            primaryField: "value",
        },
        default: [],
        description: "Faction types this table applies to (Hostile, Undead, etc.)",
    },
    {
        id: "situation_tags",
        label: "Situation Tags",
        type: "tokens",
        config: {
            fields: [
                {
                    id: "value",
                    type: "select",
                    displayInChip: true,
                    editable: true,
                    suggestions: SITUATION_TAGS.map((tag) => ({ key: tag, label: tag })),
                    placeholder: "Situation auswählen...",
                },
            ],
            primaryField: "value",
        },
        default: [],
        description: "Situations this table applies to (Exploration, Combat, etc.)",
    },

    // CR Range
    {
        id: "crRange",
        label: "CR Range (Optional)",
        type: "group",
        config: {
            fields: [
                {
                    id: "min",
                    label: "Minimum CR",
                    type: "number-stepper",
                    min: 0,
                    max: 30,
                    step: 0.125,
                    placeholder: "0",
                    description: "Minimum challenge rating (e.g. 0.125 = 1/8, 0.5 = 1/2)",
                },
                {
                    id: "max",
                    label: "Maximum CR",
                    type: "number-stepper",
                    min: 0,
                    max: 30,
                    step: 0.125,
                    placeholder: "30",
                    description: "Maximum challenge rating",
                },
            ],
        },
        description: "CR range filter for creatures in this table",
    },

    // Encounter Entries
    {
        id: "entries",
        label: "Encounter Entries",
        type: "list",
        config: {
            fields: [
                {
                    id: "weight",
                    label: "Weight",
                    type: "number-stepper",
                    required: true,
                    min: 1,
                    max: 100,
                    step: 1,
                    default: DEFAULT_ENTRY_WEIGHT,
                    description: "Probability weight (higher = more likely)",
                },
                {
                    id: "creatures",
                    label: "Creatures",
                    type: "tokens",
                    required: true,
                    config: {
                        fields: [
                            {
                                id: "value",
                                type: "text",
                                displayInChip: true,
                                editable: true,
                                placeholder: "Creature name...",
                            },
                        ],
                        primaryField: "value",
                    },
                    description: "Creature names from Library (will be resolved at generation time)",
                },
                {
                    id: "quantity",
                    label: "Quantity",
                    type: "text",
                    placeholder: "1d4",
                    description: "Dice formula or number (e.g. '1d4', '2', '1d6+2')",
                },
                {
                    id: "description",
                    label: "Description",
                    type: "textarea",
                    placeholder: "Optional flavor text...",
                    description: "Optional description or context for this entry",
                },
            ],
            itemLabel: (item: any) => {
                const creatures = Array.isArray(item.creatures)
                    ? item.creatures.map((c: any) => (typeof c === "string" ? c : c.value)).join(", ")
                    : "No creatures";
                const weight = item.weight || 1;
                return `[${weight}] ${creatures}`;
            },
        },
        default: [],
        description: "Weighted encounter entries (roll to select)",
    },
];

// ============================================================================
// SPEC
// ============================================================================

export const encounterTableSpec: CreateSpec<EncounterTableData> = {
    kind: "encounter-table",
    title: "Encounter Table erstellen",
    subtitle: "Neue zufällige Begegnungstabelle",
    schema: encounterTableSchema,
    fields,
    storage: {
        format: "md-frontmatter",
        pathTemplate: "SaltMarcher/EncounterTables/{name}.md",
        filenameFrom: "name",
        directory: "SaltMarcher/EncounterTables",
        frontmatter: [
            "name",
            "display_name",
            "description",
            "terrain_tags",
            "weather_tags",
            "time_of_day_tags",
            "faction_tags",
            "situation_tags",
            "crRange",
            "entries",
        ],
        bodyTemplate: (data) => encounterTableToMarkdown(data as EncounterTableData),
    },
    ui: {
        submitLabel: "Table erstellen",
        cancelLabel: "Abbrechen",
        enableNavigation: false,
    },
    browse: {
        metadata: [
            {
                id: "entry_count",
                cls: "sm-cc-item__cr",
                getValue: (entry) => `${entry.entry_count || 0} entries`,
            },
            {
                id: "cr_range",
                cls: "sm-cc-item__type",
                getValue: (entry) => {
                    if (!entry.crRange) return "All CRs";
                    const min = entry.crRange.min !== undefined ? formatCRDisplay(entry.crRange.min) : "—";
                    const max = entry.crRange.max !== undefined ? formatCRDisplay(entry.crRange.max) : "—";
                    return `CR ${min}-${max}`;
                },
            },
        ],
        filters: [
            { id: "terrain_tags", field: "terrain_tags", label: "Terrain", type: "array" },
            { id: "weather_tags", field: "weather_tags", label: "Weather", type: "array" },
            { id: "time_of_day_tags", field: "time_of_day_tags", label: "Time", type: "array" },
            { id: "faction_tags", field: "faction_tags", label: "Faction", type: "array" },
            { id: "situation_tags", field: "situation_tags", label: "Situation", type: "array" },
        ],
        sorts: [
            { id: "name", label: "Name", field: "name" },
            { id: "entry_count", label: "Entry Count", field: "entry_count" },
        ],
        search: ["name", "display_name", "description"],
    },
    loader: {},
};

/**
 * Format CR for display
 */
function formatCRDisplay(cr: number): string {
    if (cr === 0.125) return "1/8";
    if (cr === 0.25) return "1/4";
    if (cr === 0.5) return "1/2";
    return cr.toString();
}
