// src/workmodes/library/creatures/create-spec-schema.ts
// Creature data schema definition

import type { StatblockData } from "./creature-types";
import type { DataSchema } from "@features/data-manager/data-manager-types";

// Simple passthrough schema (validation can be added later if needed)
export const creatureSchema: DataSchema<StatblockData> = {
  parse: (data: unknown) => data as StatblockData,
  safeParse: (data: unknown) => {
    try {
      return { success: true, data: data as StatblockData };
    } catch (error) {
      return { success: false, error };
    }
  },
};
