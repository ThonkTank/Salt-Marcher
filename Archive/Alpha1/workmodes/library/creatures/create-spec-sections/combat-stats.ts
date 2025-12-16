// src/workmodes/library/creatures/create-spec-sections/combat-stats.ts
// Combat statistics fields: AC, HP, Initiative, CR, XP, Proficiency Bonus

import type { AnyFieldSpec } from "@features/data-manager/data-manager-types";

// Section 2: Kampfwerte (Combat Stats)
export const combatStatsFields: AnyFieldSpec[] = [
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
