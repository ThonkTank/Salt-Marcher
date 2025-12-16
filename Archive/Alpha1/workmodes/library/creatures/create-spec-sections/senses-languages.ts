// src/workmodes/library/creatures/create-spec-sections/senses-languages.ts
// Senses, languages, and passive perception fields

import {
  CREATURE_SENSE_TYPES,
  CREATURE_LANGUAGE_PRESETS,
} from "../constants";
import type { AnyFieldSpec } from "@features/data-manager/data-manager-types";

// Section 5: Sinne & Sprachen (Senses & Languages) - Using modular tokens
export const sensesLanguagesFields: AnyFieldSpec[] = [
  {
    id: "sensesList",
    label: "Sinne",
    type: "tokens",
    config: {
      fields: [
        {
          id: "type",
          type: "select",
          displayInChip: true,
          editable: true,
          suggestions: CREATURE_SENSE_TYPES,
          placeholder: "Sinn wählen...",
        },
        {
          id: "range",
          type: "text",
          label: ": ",
          displayInChip: true,
          editable: true,
          unit: "ft.",
          placeholder: "60",
          visibleIf: (token) => Boolean(token.type),
        },
      ],
      primaryField: "type",
    },
    default: [],
  },
  {
    id: "passivesList",
    label: "Passive Werte",
    type: "tokens",
    config: {
      fields: [
        {
          id: "skill",
          type: "select",
          label: "Passive ",
          displayInChip: true,
          editable: true,
          suggestions: [
            { key: "Perception", label: "Perception" },
            { key: "Insight", label: "Insight" },
            { key: "Investigation", label: "Investigation" },
          ],
          placeholder: "Fertigkeit wählen...",
        },
        {
          id: "value",
          type: "text",
          label: " ",
          displayInChip: true,
          editable: true,
          placeholder: "Wert",
        },
      ],
      primaryField: "skill",
      // chipTemplate removed - use automatic segment rendering for editability
    },
    default: [],
  },
  {
    id: "languagesList",
    label: "Sprachen",
    type: "tokens",
    config: {
      fields: [
        {
          id: "value",
          type: "text",
          displayInChip: true,
          editable: true,
          placeholder: "Sprache hinzufügen...",
          suggestions: CREATURE_LANGUAGE_PRESETS,
          visibleIf: (token) => !token.type,
        },
        {
          id: "type",
          type: "select",
          displayInChip: true,
          editable: true,
          suggestions: [{ key: "telepathy", label: "Telepathy" }],
          placeholder: "Telepathie",
          optional: true,
          visibleIf: (token) => Boolean(token.type),
        },
        {
          id: "range",
          type: "text",
          label: ": ",
          displayInChip: true,
          editable: true,
          unit: "ft.",
          placeholder: "120",
          visibleIf: (token) => token.type === "telepathy",
        },
      ],
      primaryField: "value",
    },
    default: [],
  },
];
