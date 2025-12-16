// src/workmodes/library/creatures/create-spec-sections/equipment.ts
// Equipment and gear fields

import type { AnyFieldSpec } from "@features/data-manager/data-manager-types";

// Section 7: Ausrüstung (Equipment)
export const equipmentFields: AnyFieldSpec[] = [
  {
    id: "gearList",
    label: "Ausrüstung",
    type: "tokens",
    config: {
      fields: [{
        id: "value",
        type: "text",
        displayInChip: true,
        editable: true,
        placeholder: "Gegenstand hinzufügen...",
      }],
      primaryField: "value",
    },
    default: [],
  },
];
