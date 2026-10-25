import test from 'node:test';
import assert from 'node:assert/strict';
import { createHash } from 'node:crypto';
import { createRequire } from 'node:module';
import { buildSync } from 'esbuild';

buildSync({
  stdin: {
    contents:
      "export * from './src/app/campaign/generation/selector'; export {checkedGeneratorConfig} from './src/app/campaign/generation/config';",
    resolveDir: process.cwd(),
    loader: 'ts',
  },
  outfile: '.build/encounter-selector.cjs',
  bundle: true,
  platform: 'node',
  format: 'cjs',
});
const { buildSelectionIndex, selectEncounter, checkedGeneratorConfig } = createRequire(
  import.meta.url,
)('../../.build/encounter-selector.cjs');
const roles = ['minion', 'support', 'standard', 'elite', 'boss'];
const catalog = {
  challengeRatings: ['0', '1/8', '1/4', '1/2', '1', '2', '3', '4', '5', '8', '12', '20'].map(
    (label, i) => ({
      id: 'cr-' + label,
      label,
      code: [0, 0.125, 0.25, 0.5, 1, 2, 3, 4, 5, 8, 12, 20][i],
      xp: [10, 25, 50, 100, 200, 450, 700, 1100, 1800, 3900, 8400, 25000][i],
      active: true,
      availableQuantity: null,
      maximumSingleQuantity: null,
      availableStatblocks: 3,
    }),
  ),
};
function config(mixing) {
  return checkedGeneratorConfig({
    composition: {
      roleMatrix: Array.from({ length: 20 }, (_, level) =>
        Array.from({ length: 34 }, (_, cr) => roles[(cr + level) % roles.length]),
      ),
      roleQuantities: Object.fromEntries(roles.map((r) => [r, { min: 1, max: 3 }])),
      roleCombinations: [
        ['standard'],
        ['boss'],
        ['minion', 'elite'],
        ['support', 'standard', 'boss'],
      ],
      crBlocks: { min: 1, max: 3 },
      statblocks: { min: 1, max: 5 },
      monsters: { min: { value: 2, perPlayer: false }, max: { value: 10, perPlayer: false } },
      initiativeSlots: { min: { value: 1, perPlayer: false }, max: { value: 6, perPlayer: false } },
      mixing,
    },
    generationDefaults: {
      difficulty: 'medium',
      amount: 'standard',
      balance: 'even',
      diversity: 'high',
    },
    scene: { difficultyWeights: { trivial: 0, easy: 0, medium: 100, hard: 0, deadly: 0 } },
    combat: { mobThreshold: 3 },
  });
}
const entropy = {
  modulo: () => 0,
  unit: (stream) =>
    parseInt(createHash('sha256').update(stream).digest('hex').slice(0, 13), 16) / 0x10000000000000,
};

test('exhaustive encounter selection is independent of catalog and index iteration order, including exact entropy ties', () => {
  for (const [level, mixing, stock, fixed, ceiling] of [
    [
      1,
      'mixed-within-cr-block',
      null,
      { units: [], statblockCount: 0, initiativeSlots: 0 },
      Infinity,
    ],
    [
      7,
      'one-per-cr-block',
      2,
      { units: [{ unitXp: 50, quantity: 2 }], statblockCount: 1, initiativeSlots: 1 },
      1200,
    ],
    [13, 'mixed-within-cr-block', 3, { units: [], statblockCount: 0, initiativeSlots: 0 }, 3000],
    [
      20,
      'one-per-cr-block',
      1,
      { units: [{ unitXp: 200, quantity: 1 }], statblockCount: 1, initiativeSlots: 1 },
      Infinity,
    ],
  ]) {
    const c = config(mixing),
      rows = catalog.challengeRatings.map((r) => ({
        ...r,
        availableQuantity: stock,
        maximumSingleQuantity: stock,
      })),
      before = JSON.stringify({ c, rows, fixed });
    for (const random of [entropy, { ...entropy, unit: () => 0 }]) {
      const expected = selectEncounter(
        42,
        2,
        1000,
        buildSelectionIndex({ challengeRatings: rows }, level, c),
        random,
        c,
        3,
        fixed,
        ceiling,
      );
      assert(expected.candidateCount > 0);
      assert(expected.composition);
      assert(expected.composition.metrics.adjustedXp <= ceiling);
      for (const ordered of [[...rows].reverse(), [...rows.slice(4), ...rows.slice(0, 4)]]) {
        const index = buildSelectionIndex({ challengeRatings: ordered }, level, c),
          reversed = new Map([...index].reverse().map(([r, blocks]) => [r, [...blocks].reverse()]));
        assert.deepEqual(
          selectEncounter(42, 2, 1000, index, random, c, 3, fixed, ceiling),
          expected,
        );
        assert.deepEqual(
          selectEncounter(42, 2, 1000, reversed, random, c, 3, fixed, ceiling),
          expected,
        );
      }
    }
    assert.equal(
      JSON.stringify({ c, rows, fixed }),
      before,
      'selection must not mutate policy, capacity or fixed roster',
    );
  }
});
