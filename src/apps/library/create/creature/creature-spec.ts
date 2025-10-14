// src/apps/library/create/creature/creature-spec.ts
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
import { createCreatureEntryCardConfig } from "./components/entry-card";

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
    help: "Zusätzliche Beschreibungen (z.B. elf, goblinoid, shapechanger)",
    placeholder: "Tag hinzufügen...",
    default: [],
  },
  {
    id: "alignmentLawChaos",
    label: "Gesinnung (Gesetz/Chaos)",
    type: "select",
    options: CREATURE_ALIGNMENT_LAW_CHAOS.map(a => ({ value: a, label: a })),
  },
  {
    id: "alignmentGoodEvil",
    label: "Gesinnung (Gut/Böse)",
    type: "select",
    options: CREATURE_ALIGNMENT_GOOD_EVIL.map(a => ({ value: a, label: a })),
  },
  {
    id: "alignmentOverride",
    label: "Gesinnung (Überschreiben)",
    type: "text",
    help: "Optionale Freitextalternative (z.B. 'unaligned', 'any alignment')",
    placeholder: "z.B. unaligned",
  },
];

// Section 2: Kampfwerte (Combat Stats)
const combatStatsFields: AnyFieldSpec[] = [
  {
    id: "ac",
    label: "Rüstungsklasse",
    type: "text",
    placeholder: "z.B. 15 (Lederrüstung)",
  },
  {
    id: "initiative",
    label: "Initiative",
    type: "text",
    placeholder: "z.B. +2",
  },
  {
    id: "hp",
    label: "Trefferpunkte",
    type: "text",
    placeholder: "z.B. 45",
  },
  {
    id: "hitDice",
    label: "Trefferwürfel",
    type: "text",
    placeholder: "z.B. 6d8+18",
  },
  {
    id: "cr",
    label: "Herausforderungsgrad",
    type: "text",
    placeholder: "z.B. 3",
  },
  {
    id: "xp",
    label: "Erfahrungspunkte",
    type: "text",
    placeholder: "z.B. 700",
  },
  {
    id: "pb",
    label: "Übungsbonus",
    type: "text",
    placeholder: "z.B. +2",
  },
];

// Section 3: Bewegung (Movement) - Using composite widget
const movementFields: AnyFieldSpec[] = [
  {
    id: "speeds",
    label: "Bewegungsraten",
    type: "composite",
    help: "Bewegungsgeschwindigkeiten nach Typ",
    config: {
      fields: CREATURE_MOVEMENT_TYPES.map(([key, label]) => ({
        id: key,
        label,
        type: "text",
        placeholder: "z.B. 30 ft.",
      })),
    },
  },
];

// Section 4: Attribute (Abilities) - Using composite widget
const abilitiesFields: AnyFieldSpec[] = [
  {
    id: "abilities",
    label: "Attributswerte",
    type: "composite",
    help: "Grundattribute der Kreatur",
    config: {
      fields: CREATURE_ABILITIES.map(ability => ({
        id: ability.key,
        label: ability.label,
        type: "number-stepper",
        min: 1,
        max: 30,
        step: 1,
        default: 10,
      })),
    },
    default: CREATURE_ABILITIES.map(ability => ({ ability: ability.key, score: 10 })),
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

// Section 8: Einträge (Entries) - Using repeating widget with custom card
const entriesFields: AnyFieldSpec[] = [
  {
    id: "entries",
    label: "Aktionen & Eigenschaften",
    type: "repeating",
    help: "Eigenschaften, Aktionen, Reaktionen und legendäre Aktionen",
    config: {
      categories: CREATURE_ENTRY_CATEGORIES.map(([id, label]) => ({ id, label })),
      card: createCreatureEntryCardConfig,
      insertPosition: "end",
    },
    itemTemplate: {
      category: { type: "select", default: "trait" },
      name: { type: "text", default: "" },
      kind: { type: "text", default: "" },
      text: { type: "textarea", default: "" },
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
        fieldIds: ["name", "size", "type", "typeTags", "alignmentLawChaos", "alignmentGoodEvil", "alignmentOverride"],
      },
      {
        id: "combat",
        label: "Kampfwerte",
        description: "AC, HP, Initiative und CR",
        fieldIds: ["ac", "initiative", "hp", "hitDice", "cr", "xp", "pb"],
      },
      {
        id: "movement",
        label: "Bewegung",
        description: "Bewegungsgeschwindigkeiten",
        fieldIds: ["speeds"],
      },
      {
        id: "abilities",
        label: "Attribute",
        description: "Grundattribute und Modifikatoren",
        fieldIds: ["abilities"],
      },
      {
        id: "senses",
        label: "Sinne & Sprachen",
        description: "Sinneswahrnehmungen und Kommunikation",
        fieldIds: ["sensesList", "passivesList", "languagesList"],
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
