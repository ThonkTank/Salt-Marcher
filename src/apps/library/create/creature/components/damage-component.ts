// src/apps/library/create/creature/components/damage-component.ts
// Backward-compatible re-exports for damage component helpers (moved to entry-helpers.ts).

export {
  validateDiceNotation,
  parseDiceNotation,
  calculateAverageDamage,
  formatDamageString,
  damageInstancesToString,
  parseDamageString,
} from "./entry-helpers";

export type { DamageInstance } from "./types";
