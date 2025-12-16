// src/workmodes/library/entities/regions/create-spec.ts
// Declarative field specification for region creation using the global modal system

import { ENCOUNTER_ODDS_PRESETS, TERRAIN_SUGGESTIONS, REGION_BIOME_TAGS, REGION_DANGER_TAGS, REGION_CLIMATE_TAGS, REGION_SETTLEMENT_TAGS, CLIMATE_TEMPLATES } from "./constants";
// Removed: import { regionToMarkdown } from "./serializer";
import type { RegionData } from './calendar-types';
import type { CreateSpec, AnyFieldSpec, DataSchema } from "@features/data-manager/data-manager-types";

// ============================================================================
// SCHEMA
// ============================================================================

const regionSchema: DataSchema<RegionData> = {
  parse: (data: unknown) => data as RegionData,
  safeParse: (data: unknown) => {
    try {
      const region = data as RegionData;

      // Validate encounter odds
      if (region.encounter_odds !== undefined) {
        if (typeof region.encounter_odds !== "number" || region.encounter_odds < 0) {
          return {
            success: false,
            error: new Error("Encounter odds must be a positive number")
          };
        }
      }

      return { success: true, data: region };
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
    placeholder: "Saltmarsh",
    description: "Name of the region",
  },
  {
    id: "color",
    label: "Grenzfarbe",
    type: "color",
    default: "#2196f3",
    description: "Farbe für Regionsgrenzen und Labels auf der Karte",
  },
  {
    id: "biome_tags",
    label: "Biome Tags",
    type: "tokens",
    config: {
      fields: [{
        id: "value",
        type: "select",
        displayInChip: true,
        editable: true,
        suggestions: REGION_BIOME_TAGS.map(tag => ({ key: tag, label: tag })),
        placeholder: "Biome auswählen...",
      }],
      primaryField: "value",
    },
    default: [],
    description: "Terrain classification (Forest, Mountain, Coastal, etc.)",
  },
  {
    id: "danger_tags",
    label: "Danger Tags",
    type: "tokens",
    config: {
      fields: [{
        id: "value",
        type: "select",
        displayInChip: true,
        editable: true,
        suggestions: REGION_DANGER_TAGS.map(tag => ({ key: tag, label: tag })),
        placeholder: "Danger auswählen...",
      }],
      primaryField: "value",
    },
    default: [],
    description: "Danger level (Safe, Moderate, Dangerous, Deadly)",
  },
  {
    id: "climate_tags",
    label: "Climate Tags",
    type: "tokens",
    config: {
      fields: [{
        id: "value",
        type: "select",
        displayInChip: true,
        editable: true,
        suggestions: REGION_CLIMATE_TAGS.map(tag => ({ key: tag, label: tag })),
        placeholder: "Climate auswählen...",
      }],
      primaryField: "value",
    },
    default: [],
    description: "Climate type (Arctic, Cold, Temperate, Warm, Hot, Desert)",
  },
  {
    id: "settlement_tags",
    label: "Settlement Tags",
    type: "tokens",
    config: {
      fields: [{
        id: "value",
        type: "select",
        displayInChip: true,
        editable: true,
        suggestions: REGION_SETTLEMENT_TAGS.map(tag => ({ key: tag, label: tag })),
        placeholder: "Settlement auswählen...",
      }],
      primaryField: "value",
    },
    default: [],
    description: "Settlement type (Civilized, Frontier, Wilderness, Ruins)",
  },
  {
    id: "terrain",
    label: "Terrain",
    type: "text",
    placeholder: "Küste",
    description: "Primary terrain type of this region",
    config: {
      suggestions: TERRAIN_SUGGESTIONS,
    },
  },
  {
    id: "encounter_odds",
    label: "Encounter Rate",
    type: "select",
    options: ENCOUNTER_ODDS_PRESETS.map(p => ({
      value: String(p.value),
      label: p.label,
    })),
    default: "0",
    description: "Chance of random encounters (1/N per travel period)",
  },
  {
    id: "climate_template",
    label: "Weather Climate",
    type: "select",
    options: [
      { value: "", label: "Default (Temperate)" },
      ...CLIMATE_TEMPLATES.map(climate => ({
        value: climate,
        label: climate,
      })),
    ],
    default: "",
    description: "Climate template for procedural weather generation",
  },
  {
    id: "description",
    label: "Description",
    type: "textarea",
    placeholder: "A bustling coastal town known for fishing and trade...",
    description: "Optional description of the region",
  },
];

// ============================================================================
// SPEC
// ============================================================================

export const regionSpec: CreateSpec<RegionData> = {
  kind: "region",
  title: "Region erstellen",
  subtitle: "Neue Region für deine Welt",
  schema: regionSchema,
  fields,
  storage: {
    format: "md-frontmatter",
    pathTemplate: "SaltMarcher/Regions/{name}.md",
    filenameFrom: "name",
    directory: "SaltMarcher/Regions",
    frontmatter: ["name", "color", "biome_tags", "danger_tags", "climate_tags", "settlement_tags", "terrain", "encounter_odds", "description"],
    // SQLite backend - removed:     bodyTemplate: (data) => regionToMarkdown(data as RegionData),
  },
  ui: {
    submitLabel: "Region erstellen",
    cancelLabel: "Abbrechen",
    enableNavigation: false, // Single section, no nav needed
  },
  // Browse configuration - replaces view-config.ts and list-schema.ts
  browse: {
    metadata: [
      {
        id: "terrain",
        cls: "sm-cc-item__type",
        getValue: (entry) => entry.terrain || "Unknown",
      },
      {
        id: "encounter_odds",
        cls: "sm-cc-item__cr",
        getValue: (entry) => {
          if (!entry.encounter_odds || entry.encounter_odds === 0) return "No encounters";
          return `Encounters: 1/${entry.encounter_odds}`;
        },
      },
    ],
    filters: [
      { id: "biome_tags", field: "biome_tags", label: "Biome", type: "array" },
      { id: "danger_tags", field: "danger_tags", label: "Danger", type: "array" },
      { id: "climate_tags", field: "climate_tags", label: "Climate", type: "array" },
      { id: "settlement_tags", field: "settlement_tags", label: "Settlement", type: "array" },
      { id: "terrain", field: "terrain", label: "Terrain", type: "string" },
      { id: "encounter_odds", field: "encounter_odds", label: "Encounter Rate", type: "number" },
    ],
    sorts: [
      { id: "name", label: "Name", field: "name" },
      { id: "terrain", label: "Terrain", field: "terrain" },
      {
        id: "encounter_odds",
        label: "Danger Level",
        compareFn: (a, b) => {
          // Sort by danger (lower odds = more dangerous)
          const oddsA = a.encounter_odds || Number.MAX_VALUE;
          const oddsB = b.encounter_odds || Number.MAX_VALUE;
          return oddsA - oddsB;
        },
      },
    ],
    search: ["name", "biome_tags", "danger_tags", "climate_tags", "settlement_tags", "terrain", "description"],
  },
  // Loader configuration - uses auto-loader by default
  loader: {},
};
