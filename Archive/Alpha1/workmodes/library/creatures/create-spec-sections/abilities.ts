// src/workmodes/library/creatures/create-spec-sections/abilities.ts
// Ability score fields with modifiers and saving throws

import { debugLogger } from "@services/logging/debug-logger";
import { CREATURE_ABILITIES } from "../constants";
import type { AnyFieldSpec } from "@features/data-manager/data-manager-types";

// Section 4: Attribute (Abilities) - Using repeating with template-based rendering
export const abilitiesFields: AnyFieldSpec[] = [
  {
    id: "abilities",
    label: "",
    type: "repeating",
    config: {
      static: true,  // No add/remove/reorder controls
      synchronizeWidths: true,  // Synchronize widths across all ability rows
      fields: [
        // Heading (ability abbreviation - STR, DEX, etc.)
        {
          id: "name",
          label: "",
          type: "heading" as const,
          getValue: (data: Record<string, unknown>) => (data.key as string)?.toUpperCase() || "",
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
          label: "",
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
            maxTokens: 3,  // Format: +/-XX (e.g., "+5", "-1")
          },
        },
        // Save Proficiency (star icon - click to toggle)
        {
          id: "saveProf",
          label: "Save",
          type: "clickable-icon" as const,
          icon: "★",
          inactiveIcon: "☆",
        },
        // Save Modifier (conditional - only visible when save checkbox is true)
        // Initial value = ability modifier + proficiency bonus
        {
          id: "saveMod",
          label: "Save",
          type: "number-stepper" as const,
          min: -10,
          max: 20,
          step: 1,
          autoSizeOnInput: false,  // Suppress auto-sizing on input for width sync
          visibleIf: (data: Record<string, unknown>) => Boolean(data.saveProf),
          config: {
            // Auto-initialize with ability modifier + PB when field becomes visible
            init: (data: Record<string, unknown>, allFormData: Record<string, unknown>) => {
              debugLogger.logField("saveMod", "init-function", "saveMod init called", data);
              const score = data.score as number || 10;
              debugLogger.logField("saveMod", "init-function", "Calculated score", { score });
              const abilityMod = Math.floor((score - 10) / 2);
              debugLogger.logField("saveMod", "init-function", "Calculated abilityMod", { abilityMod });

              // Extract PB from form data (same as skills do it)
              const pbStr = allFormData.pb as string || "+2";
              const pb = parseInt(pbStr.replace(/[^\d-]/g, '')) || 2;
              debugLogger.logField("saveMod", "init-function", "Using PB from form", { pbStr, pb });

              const result = abilityMod + pb;
              debugLogger.logField("saveMod", "init-function", "Returning result", { result });
              return result;
            },
          },
        },
      ],
    },
    // Default: Array of ability entries (data) - template defined once above
    default: CREATURE_ABILITIES.map(ability => ({
      key: ability.key,
      label: ability.label,
      score: 10,
      saveProf: false,
      // saveMod will be auto-initialized when saveProf checkbox is checked
    })),
  },
];
