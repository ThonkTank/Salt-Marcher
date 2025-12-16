// src/workmodes/library/creatures/create-spec-sections/resistances.ts
// Damage resistances, immunities, vulnerabilities, and condition immunities

import {
  CREATURE_DAMAGE_PRESETS,
  CREATURE_CONDITION_PRESETS,
} from "../constants";
import type { AnyFieldSpec } from "@features/data-manager/data-manager-types";

// Section 6: Widerstände (Resistances) - Using modular tokens
export const resistancesFields: AnyFieldSpec[] = [
  {
    id: "damageVulnerabilitiesList",
    label: "Schadensanfälligkeiten",
    type: "tokens",
    config: {
      fields: [{
        id: "value",
        type: "text",
        displayInChip: true,
        editable: true,
        placeholder: "Anfälligkeit hinzufügen...",
        suggestions: CREATURE_DAMAGE_PRESETS,
      }],
      primaryField: "value",
    },
    default: [],
  },
  {
    id: "damageResistancesList",
    label: "Schadenswiderstände",
    type: "tokens",
    config: {
      fields: [{
        id: "value",
        type: "text",
        displayInChip: true,
        editable: true,
        placeholder: "Widerstand hinzufügen...",
        suggestions: CREATURE_DAMAGE_PRESETS,
      }],
      primaryField: "value",
    },
    default: [],
  },
  {
    id: "damageImmunitiesList",
    label: "Schadensimmunitäten",
    type: "tokens",
    config: {
      fields: [{
        id: "value",
        type: "text",
        displayInChip: true,
        editable: true,
        placeholder: "Immunität hinzufügen...",
        suggestions: CREATURE_DAMAGE_PRESETS,
      }],
      primaryField: "value",
    },
    default: [],
  },
  {
    id: "conditionImmunitiesList",
    label: "Zustandsimmunitäten",
    type: "tokens",
    config: {
      fields: [{
        id: "value",
        type: "text",
        displayInChip: true,
        editable: true,
        placeholder: "Zustand hinzufügen...",
        suggestions: CREATURE_CONDITION_PRESETS,
      }],
      primaryField: "value",
    },
    default: [],
  },
];
