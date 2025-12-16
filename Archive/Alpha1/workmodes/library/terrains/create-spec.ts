// src/workmodes/library/entities/terrains/create-spec.ts
// Declarative field specification for terrain creation using the global modal system

import { TERRAIN_BIOME_TAGS, TERRAIN_DIFFICULTY_TAGS } from "./constants";
// Removed: import { terrainToMarkdown } from "./serializer";
import type { TerrainData } from "./terrain-types";
import type { CreateSpec, AnyFieldSpec, DataSchema } from "@features/data-manager/data-manager-types";

// ============================================================================
// SCHEMA WITH VALIDATION
// ============================================================================

const terrainSchema: DataSchema<TerrainData> = {
  parse: (data: unknown) => data as TerrainData,
  safeParse: (data: unknown) => {
    try {
      const terrain = data as TerrainData;

      // Validate speed range
      if (typeof terrain.speed !== "number" || terrain.speed < 0.1 || terrain.speed > 1.0) {
        return {
          success: false,
          error: new Error("Speed must be between 0.1 and 1.0")
        };
      }

      // Validate color
      if (!terrain.color || typeof terrain.color !== "string") {
        return {
          success: false,
          error: new Error("Color is required")
        };
      }

      return { success: true, data: terrain };
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
    placeholder: "Wald",
    description: "Terrain name (leave empty for default/transparent terrain)",
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
        suggestions: TERRAIN_BIOME_TAGS.map(tag => ({ key: tag, label: tag })),
        placeholder: "Biome auswählen...",
      }],
      primaryField: "value",
    },
    default: [],
    description: "Terrain classification (Forest, Mountain, etc.)",
  },
  {
    id: "difficulty_tags",
    label: "Difficulty Tags",
    type: "tokens",
    config: {
      fields: [{
        id: "value",
        type: "select",
        displayInChip: true,
        editable: true,
        suggestions: TERRAIN_DIFFICULTY_TAGS.map(tag => ({ key: tag, label: tag })),
        placeholder: "Difficulty auswählen...",
      }],
      primaryField: "value",
    },
    default: [],
    description: "Movement difficulty (Easy, Difficult, Very Difficult)",
  },
  {
    id: "color",
    label: "Color",
    type: "select",
    required: true,
    options: [
      { value: "transparent", label: "Transparent (Default)" },
      { value: "#2e7d32", label: "Wald (Grün)" },
      { value: "#0288d1", label: "Meer (Blau)" },
      { value: "#6d4c41", label: "Berg (Braun)" },
      { value: "#ffeb3b", label: "Wüste (Gelb)" },
      { value: "#9e9e9e", label: "Gebirge (Grau)" },
      { value: "#757575", label: "Stein (Dunkelgrau)" },
      { value: "#795548", label: "Erde (Erdbraun)" },
      { value: "#4caf50", label: "Gras (Hellgrün)" },
      { value: "#00bcd4", label: "Eis (Cyan)" },
      { value: "custom", label: "Custom Hex Color..." },
    ],
    default: "transparent",
  },
  {
    id: "color_custom",
    label: "Custom Color",
    type: "text",
    placeholder: "#ff5722",
    description: "Hex color code (e.g., #ff5722)",
    visibleIf: (data) => data.color === "custom",
  },
  {
    id: "speed",
    label: "Movement Speed",
    type: "number-stepper",
    min: 0.1,
    max: 1.0,
    step: 0.1,
    default: 1.0,
    description: "Movement speed multiplier (1.0 = 100% normal speed)",
  },
];

// ============================================================================
// SPEC
// ============================================================================

export const terrainSpec: CreateSpec<TerrainData> = {
  kind: "terrain",
  title: "Terrain erstellen",
  subtitle: "Neues Terrain für deine Karten",
  schema: terrainSchema,
  fields,
  storage: {
    format: "md-frontmatter",
    pathTemplate: "SaltMarcher/Terrains/{name}.md",
    filenameFrom: "name",
    directory: "SaltMarcher/Terrains",
    frontmatter: ["name", "display_name", "biome_tags", "difficulty_tags", "color", "speed"],
    // SQLite backend - removed:     bodyTemplate: (data) => terrainToMarkdown(data as TerrainData),
  },
  ui: {
    submitLabel: "Terrain erstellen",
    cancelLabel: "Abbrechen",
    enableNavigation: false, // Single section, no nav needed
  },
  // Browse configuration - replaces view-config.ts and list-schema.ts
  browse: {
    metadata: [
      {
        id: "color",
        cls: "sm-cc-item__type",
        getValue: (entry) => entry.color,
      },
      {
        id: "speed",
        cls: "sm-cc-item__cr",
        getValue: (entry) => `Speed: ${Math.round(entry.speed * 100)}%`,
      },
    ],
    filters: [
      { id: "biome_tags", field: "biome_tags", label: "Biome", type: "array" },
      { id: "difficulty_tags", field: "difficulty_tags", label: "Difficulty", type: "array" },
      { id: "speed", field: "speed", label: "Speed", type: "number" },
    ],
    sorts: [
      { id: "name", label: "Name", field: "name" },
      { id: "speed", label: "Speed", field: "speed" },
    ],
    search: ["name", "biome_tags", "difficulty_tags", "color"],
  },
  // Loader configuration - uses auto-loader by default
  loader: {},
};
