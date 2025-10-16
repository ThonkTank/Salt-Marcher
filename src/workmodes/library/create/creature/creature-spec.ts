// src/workmodes/library/create/creature/creature-spec.ts
// Declarative field specification for creature creation using the global modal system

import type { CreateSpec, AnyFieldSpec, DataSchema } from "../../../../ui/workmode/create/types";
import type { StatblockData } from "../../core/creature-files";
import {
  CREATURE_SIZES,
  CREATURE_TYPES,
  CREATURE_ALIGNMENT_LAW_CHAOS,
  CREATURE_ALIGNMENT_GOOD_EVIL,
  CREATURE_MOVEMENT_TYPES,
  CREATURE_ABILITIES,
  CREATURE_SKILLS,
  CREATURE_DAMAGE_PRESETS,
  CREATURE_CONDITION_PRESETS,
  CREATURE_LANGUAGE_PRESETS,
  CREATURE_SENSE_PRESETS,
  CREATURE_PASSIVE_PRESETS,
  CREATURE_ENTRY_CATEGORIES,
} from "./presets";
// Note: Entry card config removed - entries now use template-based rendering

// ============================================================================
// SCHEMA
// ============================================================================

// Simple passthrough schema (validation can be added later if needed)
const creatureSchema: DataSchema<StatblockData> = {
  parse: (data: unknown) => data as StatblockData,
  safeParse: (data: unknown) => {
    try {
      return { success: true, data: data as StatblockData };
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
    placeholder: "Kreaturname eingeben...",
  },
  {
    id: "size",
    label: "Größe",
    type: "select",
    options: CREATURE_SIZES.map(s => ({ value: s, label: s })),
    default: "Medium",
  },
  {
    id: "type",
    label: "Typ",
    type: "select",
    options: CREATURE_TYPES.map(t => ({ value: t, label: t })),
  },
  {
    id: "typeTags",
    label: "Typ-Tags",
    type: "tags",
    placeholder: "Tag hinzufügen...",
    default: [],
  },
  {
    id: "alignmentLawChaos",
    label: "Gesetz/Chaos",
    type: "select",
    options: CREATURE_ALIGNMENT_LAW_CHAOS.map(a => ({ value: a, label: a })),
  },
  {
    id: "alignmentGoodEvil",
    label: "Gut/Böse",
    type: "select",
    options: CREATURE_ALIGNMENT_GOOD_EVIL.map(a => ({ value: a, label: a })),
  },
  {
    id: "alignmentOverride",
    label: "Gesinnung (Freiform)",
    type: "text",
    placeholder: "z.B. unaligned",
  },
];

// Section 2: Kampfwerte (Combat Stats)
const combatStatsFields: AnyFieldSpec[] = [
  {
    id: "ac",
    label: "AC",
    type: "text",
    placeholder: "z.B. 15 (Lederrüstung)",
  },
  {
    id: "initiative",
    label: "INI",
    type: "text",
    placeholder: "z.B. +2",
  },
  {
    id: "hp",
    label: "TP",
    type: "text",
    placeholder: "z.B. 45",
  },
  {
    id: "hitDice",
    label: "TW",
    type: "text",
    placeholder: "z.B. 6d8+18",
  },
  {
    id: "cr",
    label: "CR",
    type: "text",
    placeholder: "z.B. 3",
  },
  {
    id: "xp",
    label: "EP",
    type: "text",
    placeholder: "z.B. 700",
  },
  {
    id: "pb",
    label: "ÜB",
    type: "text",
    placeholder: "z.B. +2",
  },
];

// Section 3: Bewegung (Movement) - Using structured-tags widget
const movementFields: AnyFieldSpec[] = [
  {
    id: "speeds",
    label: "Bewegungsraten",
    type: "structured-tags",
    config: {
      suggestions: CREATURE_MOVEMENT_TYPES.map(([key, label]) => ({ key, label })),
      valueConfig: {
        placeholder: "z.B. 30 ft.",
        unit: "ft.",
      },
    },
    default: [],
  },
];

// Section 4: Attribute (Abilities) - Using repeating with template-based rendering
const abilitiesFields: AnyFieldSpec[] = [
  {
    id: "abilities",
    label: "Attributswerte",
    type: "repeating",
    config: {
      static: true,  // No add/remove/reorder controls
      synchronizeWidths: true,  // Synchronize widths across all ability rows
      fields: [
        // Heading (ability name)
        {
          id: "name",
          label: "",
          type: "heading" as const,
          getValue: (data: Record<string, unknown>) => (data.label as string) || "",
        },
        // Score
        {
          id: "score",
          label: "",
          type: "number-stepper" as const,
          min: 1,
          max: 30,
          step: 1,
          autoSizeOnInput: false,  // Suppress auto-sizing on input for width sync
        },
        // Modifier (display)
        {
          id: "mod",
          label: "Mod",
          type: "display" as const,
          config: {
            compute: (data: Record<string, unknown>) => {
              const score = data.score as number || 10;
              const mod = Math.floor((score - 10) / 2);
              return mod;
            },
            prefix: (data: Record<string, unknown>) => {
              const score = data.score as number || 10;
              const mod = Math.floor((score - 10) / 2);
              return mod >= 0 ? "+" : "";
            },
          },
        },
        // Save Proficiency Checkbox
        {
          id: "saveProf",
          label: "Save",
          type: "toggle" as const,
        },
        // Save Override (conditional - only visible when save checkbox is true)
        {
          id: "saveOverride",
          label: "Save Mod",
          type: "number-stepper" as const,
          min: -10,
          max: 20,
          step: 1,
          autoSizeOnInput: false,  // Suppress auto-sizing on input for width sync
          visibleIf: (data: Record<string, unknown>) => Boolean(data.saveProf),
          config: {
            // Auto-initialize with PB when field becomes visible
            init: (data: Record<string, unknown>) => {
              // Get PB from parent form data (assuming it's stored in pb field)
              // For now, default to +2 as a reasonable starting proficiency bonus
              return 2;
            },
          },
        },
        // Final Save Display (conditional - only visible when save checkbox is true)
        {
          id: "saveFinal",
          label: "Total",
          type: "display" as const,
          config: {
            compute: (data: Record<string, unknown>) => {
              const score = data.score as number || 10;
              const mod = Math.floor((score - 10) / 2);
              const override = data.saveOverride as number;

              // If override exists, use modifier + override
              // Otherwise, just use modifier (no proficiency)
              if (typeof override === "number") {
                return mod + override;
              }
              return mod;
            },
            prefix: (data: Record<string, unknown>) => {
              const score = data.score as number || 10;
              const mod = Math.floor((score - 10) / 2);
              const override = data.saveOverride as number;
              const total = typeof override === "number" ? mod + override : mod;
              return total >= 0 ? "+" : "";
            },
          },
          visibleIf: (data: Record<string, unknown>) => Boolean(data.saveProf),
        },
      ],
    },
    // Default: Array of ability entries (data) - template defined once above
    default: CREATURE_ABILITIES.map(ability => ({
      key: ability.key,
      label: ability.label,
      score: 10,
      saveProf: false,
    })),
  },
];

// Section 5: Sinne & Sprachen (Senses & Languages) - Using tags with suggestions
const sensesLanguagesFields: AnyFieldSpec[] = [
  {
    id: "sensesList",
    label: "Sinne",
    type: "tags",
    placeholder: "Sinn hinzufügen...",
    config: {
      suggestions: CREATURE_SENSE_PRESETS,
    },
    default: [],
  },
  {
    id: "passivesList",
    label: "Passive Werte",
    type: "tags",
    placeholder: "Passiven Wert hinzufügen...",
    config: {
      suggestions: CREATURE_PASSIVE_PRESETS,
    },
    default: [],
  },
  {
    id: "languagesList",
    label: "Sprachen",
    type: "tags",
    placeholder: "Sprache hinzufügen...",
    config: {
      suggestions: CREATURE_LANGUAGE_PRESETS,
    },
    default: [],
  },
];

// Section 6: Widerstände (Resistances) - Using tags with suggestions
const resistancesFields: AnyFieldSpec[] = [
  {
    id: "damageVulnerabilitiesList",
    label: "Schadensanfälligkeiten",
    type: "tags",
    placeholder: "Anfälligkeit hinzufügen...",
    config: {
      suggestions: CREATURE_DAMAGE_PRESETS,
    },
    default: [],
  },
  {
    id: "damageResistancesList",
    label: "Schadenswiderstände",
    type: "tags",
    placeholder: "Widerstand hinzufügen...",
    config: {
      suggestions: CREATURE_DAMAGE_PRESETS,
    },
    default: [],
  },
  {
    id: "damageImmunitiesList",
    label: "Schadensimmunitäten",
    type: "tags",
    placeholder: "Immunität hinzufügen...",
    config: {
      suggestions: CREATURE_DAMAGE_PRESETS,
    },
    default: [],
  },
  {
    id: "conditionImmunitiesList",
    label: "Zustandsimmunitäten",
    type: "tags",
    placeholder: "Zustand hinzufügen...",
    config: {
      suggestions: CREATURE_CONDITION_PRESETS,
    },
    default: [],
  },
];

// Section 7: Ausrüstung (Equipment)
const equipmentFields: AnyFieldSpec[] = [
  {
    id: "gearList",
    label: "Ausrüstung",
    type: "tags",
    placeholder: "Gegenstand hinzufügen...",
    default: [],
  },
];

// Section 8: Einträge (Entries) - Using template-based repeating field
// Note: Simplified to basic fields only. Complex features (components, spellcasting)
// can be added via separate edit workflow after creation.
const entriesFields: AnyFieldSpec[] = [
  {
    id: "entries",
    label: "Aktionen & Eigenschaften",
    type: "repeating",
    config: {
      static: false,
      fields: [
        {
          id: "category",
          label: "Kategorie",
          type: "select" as const,
          options: CREATURE_ENTRY_CATEGORIES.map(([id, label]) => ({ value: id, label })),
        },
        {
          id: "name",
          label: "Name",
          type: "text" as const,
          placeholder: "z.B. Multiattack, Bite, Claw...",
        },
        {
          id: "text",
          label: "Beschreibung",
          type: "textarea" as const,
          placeholder: "Entry description (Markdown)...",
        },
      ],
    },
    default: [],
  },
];

// ============================================================================
// SECTIONS
// ============================================================================

export const creatureSpec: CreateSpec<StatblockData> = {
  kind: "creature",
  title: "Kreatur erstellen",
  subtitle: "Neue Kreatur für deine Kampagne",
  schema: creatureSchema,
  fields: [
    ...basicInfoFields,
    ...combatStatsFields,
    ...movementFields,
    ...abilitiesFields,
    ...sensesLanguagesFields,
    ...resistancesFields,
    ...equipmentFields,
    ...entriesFields,
  ],
  storage: {
    format: "md-frontmatter",
    pathTemplate: "SaltMarcher/Creatures/{name}.md",
    filenameFrom: "name",
    directory: "SaltMarcher/Creatures",
    frontmatter: [
      "name", "size", "type", "typeTags", "alignmentLawChaos", "alignmentGoodEvil",
      "ac", "hp", "speeds", "abilities", "saves", "skills",
      "sensesList", "languagesList", "cr"
    ],
  },
  ui: {
    submitLabel: "Kreatur erstellen",
    cancelLabel: "Abbrechen",
    enableNavigation: true,
    sections: [
      {
        id: "basic",
        label: "Grunddaten",
        description: "Name, Größe, Typ und Gesinnung",
        fieldIds: ["name", "size", "alignmentLawChaos", "alignmentGoodEvil", "alignmentOverride", "type", "typeTags"],
      },
      {
        id: "combat",
        label: "Kampfwerte",
        description: "AC, HP, Initiative und CR",
        fieldIds: ["ac", "initiative", "hp", "hitDice", "cr", "xp", "pb"],
      },
      {
        id: "abilities",
        label: "Attribute",
        description: "Grundattribute und Modifikatoren",
        fieldIds: ["abilities"],
      },
      {
        id: "senses",
        label: "Fähigkeiten",
        description: "Bewegungsraten, Sinneswahrnehmungen und Kommunikation",
        fieldIds: ["speeds", "sensesList", "passivesList", "languagesList"],
      },
      {
        id: "resistances",
        label: "Widerstände",
        description: "Schadenswiderstände und Immunitäten",
        fieldIds: ["damageVulnerabilitiesList", "damageResistancesList", "damageImmunitiesList", "conditionImmunitiesList"],
      },
      {
        id: "equipment",
        label: "Ausrüstung",
        description: "Gegenstände und Ausrüstung",
        fieldIds: ["gearList"],
      },
      {
        id: "entries",
        label: "Eigenschaften & Aktionen",
        description: "Spezialfähigkeiten, Angriffe und Reaktionen",
        fieldIds: ["entries"],
      },
    ],
  },
};
