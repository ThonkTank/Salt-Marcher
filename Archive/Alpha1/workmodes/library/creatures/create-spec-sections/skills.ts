// src/workmodes/library/creatures/create-spec-sections/skills.ts
// Skills fields with auto-calculation based on ability scores and proficiency bonus

import { CREATURE_SKILLS } from "../constants";
import type { AnyFieldSpec } from "@features/data-manager/data-manager-types";

// Section 4.5: Fertigkeiten (Skills) - Using modular tokens with auto-calculation
export const skillsFields: AnyFieldSpec[] = [
  {
    id: "skills",
    label: "Fertigkeiten",
    type: "tokens",
    config: {
      fields: [
        {
          id: "skill",
          type: "select",
          displayInChip: true,
          editable: true,
          suggestions: CREATURE_SKILLS.map(([name, ability]) => ({ key: name, label: name })),
          placeholder: "Fertigkeit wählen...",
        },
        {
          id: "value",
          type: "text",
          label: " ",
          displayInChip: true,
          editable: true,
          placeholder: "+0",
        },
        {
          id: "expertise",
          type: "checkbox",
          displayInChip: true,
          editable: true,
          icon: "★",
          default: false,
        },
      ],
      primaryField: "skill",
      getInitialValue: (formData, skillName) => {
        // Find the skill's associated ability
        const skillEntry = CREATURE_SKILLS.find(([name]) => name === skillName);
        if (!skillEntry) {
          return { skill: skillName, value: "+0", expertise: false };
        }

        const [, abilityKey] = skillEntry;

        // Extract PB from form data
        const pbStr = formData.pb as string || "+2";
        const pb = parseInt(pbStr.replace(/[^\d-]/g, '')) || 2;

        // Find the ability score from abilities array
        // Support both "key" (new format) and "ability" (legacy format) fields
        const abilities = formData.abilities as Array<{key?: string; ability?: string; score: number}> || [];
        const abilityEntry = abilities.find(a => (a.key === abilityKey || a.ability === abilityKey));
        const abilityScore = abilityEntry?.score || 10;

        // Calculate modifier
        const abilityMod = Math.floor((abilityScore - 10) / 2);

        // Calculate skill bonus (mod + PB)
        const skillBonus = abilityMod + pb;

        // Format with sign
        const sign = skillBonus >= 0 ? "+" : "";
        const valueStr = `${sign}${skillBonus}`;

        return {
          skill: skillName,
          value: valueStr,
          expertise: false,
        };
      },
      onTokenFieldChange: (token, fieldId, newValue, formData) => {
        // Only recalculate when expertise is toggled
        if (fieldId !== "expertise") return;

        const skillName = token.skill as string;
        if (!skillName) return;

        // Find the skill's associated ability
        const skillEntry = CREATURE_SKILLS.find(([name]) => name === skillName);
        if (!skillEntry) return;

        const [, abilityKey] = skillEntry;

        // Extract PB from form data
        const pbStr = formData.pb as string || "+2";
        const pb = parseInt(pbStr.replace(/[^\d-]/g, '')) || 2;

        // Find the ability score from abilities array
        const abilities = formData.abilities as Array<{key?: string; ability?: string; score: number}> || [];
        const abilityEntry = abilities.find(a => (a.key === abilityKey || a.ability === abilityKey));
        const abilityScore = abilityEntry?.score || 10;

        // Calculate modifier
        const abilityMod = Math.floor((abilityScore - 10) / 2);

        // Calculate skill bonus: mod + PB (or 2*PB if expertise)
        const expertise = newValue as boolean;
        const pbBonus = expertise ? (2 * pb) : pb;
        const skillBonus = abilityMod + pbBonus;

        // Format with sign
        const sign = skillBonus >= 0 ? "+" : "";
        const valueStr = `${sign}${skillBonus}`;

        // Update the value field in the token
        token.value = valueStr;
      },
    },
    default: [],
  },
];
