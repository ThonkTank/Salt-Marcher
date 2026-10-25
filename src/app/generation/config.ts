import {
  generatorRoles,
  generatorChallengeRatings,
  maximumCompositionComplexity,
  type GeneratorRole,
  type GeneratorRoleCell,
} from './model';
export interface ScaledRange {
  min: { value: number; perPlayer: boolean };
  max: { value: number; perPlayer: boolean };
}
export interface GeneratorPresetConfigV3 {
  composition: {
    roleMatrix: GeneratorRoleCell[][];
    roleQuantities: Record<GeneratorRole, { min: number; max: number }>;
    roleCombinations: GeneratorRole[][];
    crBlocks: { min: number; max: number };
    statblocks: { min: number; max: number };
    monsters: ScaledRange;
    initiativeSlots: ScaledRange;
    mixing: 'mixed-within-cr-block' | 'one-per-cr-block';
  };
  generationDefaults: {
    difficulty: 'weighted' | 'trivial' | 'easy' | 'medium' | 'hard' | 'deadly';
    amount: 'neutral' | 'few' | 'standard' | 'many';
    balance: 'neutral' | 'even' | 'varied';
    diversity: 'neutral' | 'low' | 'high';
  };
  scene: { difficultyWeights: Record<'trivial' | 'easy' | 'medium' | 'hard' | 'deadly', number> };
  combat: { mobThreshold: number };
  loot?: unknown;
}
export function checkedGeneratorConfig(value: GeneratorPresetConfigV3): GeneratorPresetConfigV3 {
  if (!value || !value.composition || !value.generationDefaults || !value.scene || !value.combat)
    throw new Error('Generator-Konfiguration fehlt.');
  const c = value.composition;
  if (
    !Array.isArray(c.roleMatrix) ||
    c.roleMatrix.length !== 20 ||
    c.roleMatrix.some(
      (row) =>
        !Array.isArray(row) ||
        row.length !== generatorChallengeRatings.length ||
        row.some((role) => !['none', ...generatorRoles].includes(role)),
    )
  )
    throw new Error('Rollenmatrix benötigt 20 Level und 34 HG-Spalten.');
  const range = (r: { min: number; max: number }, minimum = 1) => {
    if (
      !r ||
      ![r.min, r.max].every((v) => Number.isSafeInteger(v) && v >= minimum && v <= 999) ||
      r.min > r.max
    )
      throw new Error('Mengenbereiche müssen geordnet sein.');
  };
  for (const role of generatorRoles) range(c.roleQuantities[role]);
  range(c.crBlocks);
  range(c.statblocks);
  for (const r of [c.monsters, c.initiativeSlots]) {
    if (
      !r ||
      [r.min, r.max].some(
        (b) =>
          !b ||
          !Number.isFinite(b.value) ||
          b.value < 0 ||
          b.value > 999 ||
          typeof b.perPlayer !== 'boolean',
      ) ||
      (r.min.perPlayer === r.max.perPlayer || (!r.min.perPlayer && r.max.perPlayer)
        ? r.min.value > r.max.value
        : r.min.value !== 0)
    )
      throw new Error('Skalierte Bereiche müssen für jede Partygröße geordnet bleiben.');
  }
  if (
    !Array.isArray(c.roleCombinations) ||
    !c.roleCombinations.length ||
    c.roleCombinations.length > 32 ||
    c.roleCombinations.some(
      (roles) =>
        !Array.isArray(roles) ||
        !roles.length ||
        roles.length > 3 ||
        new Set(roles).size !== roles.length ||
        roles.some((role) => !generatorRoles.includes(role)),
    ) ||
    new Set(c.roleCombinations.map((roles) => [...roles].sort().join('|'))).size !==
      c.roleCombinations.length
  )
    throw new Error(
      'Rollenkombinationen benötigen ein bis drei verschiedene Rollen und dürfen nicht doppelt vorkommen.',
    );
  if (
    !['mixed-within-cr-block', 'one-per-cr-block'].includes(c.mixing) ||
    !['weighted', 'trivial', 'easy', 'medium', 'hard', 'deadly'].includes(
      value.generationDefaults.difficulty,
    ) ||
    !['neutral', 'few', 'standard', 'many'].includes(value.generationDefaults.amount) ||
    !['neutral', 'even', 'varied'].includes(value.generationDefaults.balance) ||
    !['neutral', 'low', 'high'].includes(value.generationDefaults.diversity)
  )
    throw new Error('Unbekannte Generatorwahl.');
  const weights = value.scene.difficultyWeights;
  if (
    !weights ||
    ['trivial', 'easy', 'medium', 'hard', 'deadly'].some(
      (k) =>
        !Number.isSafeInteger(weights[k as keyof typeof weights]) ||
        weights[k as keyof typeof weights] < 0,
    ) ||
    Object.values(weights).reduce((a, b) => a + b, 0) !== 100
  )
    throw new Error('Schwierigkeitsgewichte müssen zusammen 100 ergeben.');
  if (
    !Number.isSafeInteger(value.combat.mobThreshold) ||
    value.combat.mobThreshold < 0 ||
    value.combat.mobThreshold > 999
  )
    throw new Error('Mobschwelle benötigt eine nichtnegative ganze Zahl.');
  const complexity = maximumCompositionComplexity(c);
  if (complexity.count > 250000)
    throw new Error(
      'Preset erzeugt auf Level ' +
        complexity.partyLevel +
        ' mehr als 250.000 Kompositionskandidaten.',
    );
  return structuredClone(value);
}
