// src/workmodes/library/creatures/create-spec-sections/basic-info.ts
// Basic creature information fields: name, size, type, alignment

import {
  CREATURE_SIZES,
  CREATURE_TYPES,
  CREATURE_ALIGNMENT_LAW_CHAOS,
  CREATURE_ALIGNMENT_GOOD_EVIL,
} from "../constants";
import type { AnyFieldSpec } from "@features/data-manager/data-manager-types";

// Section 1: Grunddaten (Basic Info)
export const basicInfoFields: AnyFieldSpec[] = [
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
    type: "tokens",
    config: {
      fields: [{
        id: "value",
        type: "text",
        displayInChip: true,
        editable: true,
        placeholder: "Tag hinzufügen...",
      }],
      primaryField: "value",
    },
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
