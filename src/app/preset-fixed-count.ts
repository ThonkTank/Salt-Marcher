import type { GeneratorPresetConfigV3 } from './generation/config';
import { generatorRoles } from './generation/model';

/** Translate a simple roster choice into the existing composition rules. */
export function presetWithFixedCount(
  source: GeneratorPresetConfigV3,
  count: number,
): GeneratorPresetConfigV3 {
  if (!Number.isSafeInteger(count) || count < 1 || count > 999)
    throw new Error('Gegnerzahl: eine ganze Zahl von 1 bis 999 eingeben.');
  const next = structuredClone(source),
    c = next.composition;
  c.roleCombinations = generatorRoles.map((role) => [role]);
  for (const role of generatorRoles) c.roleQuantities[role] = { min: count, max: count };
  c.crBlocks = { min: 1, max: 1 };
  c.statblocks = { min: 1, max: count };
  c.mixing = 'mixed-within-cr-block';
  c.monsters = { min: { value: count, perPlayer: false }, max: { value: count, perPlayer: false } };
  c.initiativeSlots = {
    min: { value: 1, perPlayer: false },
    max: { value: count, perPlayer: false },
  };
  return next;
}
