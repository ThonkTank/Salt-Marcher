// src/workmodes/library/creatures/create-spec-sections/movement.ts
// Movement and speed fields for creatures

import { CREATURE_MOVEMENT_TYPES } from "../constants";
import type { AnyFieldSpec } from "@features/data-manager/data-manager-types";

// Section 3: Bewegung (Movement) - Using modular tokens with inline editing
export const movementFields: AnyFieldSpec[] = [
  {
    id: "speeds",
    label: "Bewegungsraten",
    type: "tokens",
    config: {
      fields: [
        {
          id: "type",
          type: "select",
          displayInChip: true,
          editable: true,
          suggestions: CREATURE_MOVEMENT_TYPES.map(([key, label]) => ({ key, label })),
          placeholder: "Bewegungsart wählen...",
        },
        {
          id: "value",
          type: "text",
          label: ": ",
          displayInChip: true,
          editable: true,
          unit: "ft.",
          placeholder: "30",
        },
        {
          id: "hover",
          type: "checkbox",
          displayInChip: true,
          editable: true,
          icon: "⟨hover⟩",
          visibleIf: (token) => token.type === "fly",
          default: false,
        },
      ],
      primaryField: "type",
    },
    default: [],
  },
];
