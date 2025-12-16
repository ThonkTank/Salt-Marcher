// src/workmodes/library/creatures/create-spec-sections/habitat.ts
// Environmental and habitat preference fields

import type { AnyFieldSpec } from "@features/data-manager/data-manager-types";

// Section 5.5: Habitat & Umgebung (Habitat & Environment)
export const habitatFields: AnyFieldSpec[] = [
  // Numerische Habitat-Präferenzen (für präzises Matching mit Tile Climate Data)
  {
    id: "temperatureRange",
    label: "Temperatur-Bereich (°C)",
    type: "composite",
    config: {
      fields: [
        {
          id: "min",
          label: "Min",
          type: "number",
          placeholder: "-50",
        },
        {
          id: "max",
          label: "Max",
          type: "number",
          placeholder: "50",
        },
      ],
      layout: "row",
    },
  },
  {
    id: "moisturePreference",
    label: "Feuchtigkeits-Präferenzen",
    type: "tokens",
    config: {
      suggestions: [
        "desert",
        "dry",
        "lush",
        "marshy",
        "swampy",
        "ponds",
        "lakes",
        "large_lake",
        "sea",
        "flood_plains",
      ],
    },
  },
  {
    id: "elevationRange",
    label: "Höhenbereich (Meter)",
    type: "composite",
    config: {
      fields: [
        {
          id: "min",
          label: "Min",
          type: "number",
          placeholder: "-100",
        },
        {
          id: "max",
          label: "Max",
          type: "number",
          placeholder: "5000",
        },
      ],
      layout: "row",
    },
  },
  // Text-basierte Präferenzen (für flexibles Tagging)
  {
    id: "climatePreference",
    label: "Klima-Präferenzen (Tags)",
    type: "tokens",
    config: {
      fields: [{
        id: "value",
        type: "text",
        displayInChip: true,
        editable: true,
        placeholder: "Klima hinzufügen...",
        suggestions: ["arctic", "cold", "temperate", "hot", "desert", "tropical"],
      }],
      primaryField: "value",
    },
    default: [],
  },
  {
    id: "terrainPreference",
    label: "Terrain-Präferenzen",
    type: "tokens",
    config: {
      fields: [{
        id: "value",
        type: "text",
        displayInChip: true,
        editable: true,
        placeholder: "Terrain hinzufügen...",
        suggestions: ["plains", "hills", "mountains", "any"],
      }],
      primaryField: "value",
    },
    default: [],
  },
  {
    id: "floraPreference",
    label: "Flora-Präferenzen",
    type: "tokens",
    config: {
      fields: [{
        id: "value",
        type: "text",
        displayInChip: true,
        editable: true,
        placeholder: "Flora hinzufügen...",
        suggestions: ["dense", "medium", "field", "barren", "any"],
      }],
      primaryField: "value",
    },
    default: [],
  },
  {
    id: "weatherPreference",
    label: "Wetter-Präferenzen (Tags)",
    type: "tokens",
    config: {
      fields: [{
        id: "value",
        type: "text",
        displayInChip: true,
        editable: true,
        placeholder: "Wetter hinzufügen...",
        suggestions: ["clear", "rain", "fog", "snow", "storm", "any"],
      }],
      primaryField: "value",
    },
    default: [],
  },
  {
    id: "activityPeriod",
    label: "Aktivitätszeitraum (Tags)",
    type: "tokens",
    config: {
      fields: [{
        id: "value",
        type: "text",
        displayInChip: true,
        editable: true,
        placeholder: "Zeit hinzufügen...",
        suggestions: ["nocturnal", "diurnal", "crepuscular", "any"],
      }],
      primaryField: "value",
    },
    default: [],
  },
];
