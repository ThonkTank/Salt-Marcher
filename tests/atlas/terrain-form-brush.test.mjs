import { test } from 'node:test';
import assert from 'node:assert/strict';
import { buildSync } from 'esbuild';
import { createRequire } from 'node:module';
buildSync({
  stdin: {
    contents:
      "export * from './src/app/atlas/terrain-brush';export * from './src/app/atlas/terrain-height';export * from './src/app/atlas/terrain-form-brush';export * from './src/app/atlas/terrain-brush-draft';",
    resolveDir: process.cwd(),
  },
  outfile: '.build/terrain-form-brush-test.cjs',
  bundle: true,
  platform: 'node',
  format: 'cjs',
});
const {
  applyTerrainBrush,
  validateHeightStroke,
  TerrainSampler,
  TerrainBrushDraft,
  TERRAIN_FORM_SEED,
} = createRequire(import.meta.url)('../../.build/terrain-form-brush-test.cjs');
const forms = ['hills', 'mountains', 'canyon'];
const straight = [
  { x: -96, y: 0, t: 0 },
  { x: 96, y: 0, t: 2400 },
];
const curve = [
  { x: -48, y: -20, t: 0 },
  { x: -18, y: -4, t: 600 },
  { x: 0, y: 16, t: 1200 },
  { x: 24, y: 8, t: 1800 },
  { x: 48, y: -16, t: 2400 },
];
const stroke = (form, samples = straight, extra = {}) => ({
  form,
  mode: form === 'canyon' ? 'lower' : 'raise',
  seed: TERRAIN_FORM_SEED,
  radius: 32,
  strength: 200,
  feather: 0.65,
  samples,
  ...extra,
});
const merge = (before, tiles) => [
  ...before.filter((r) => !tiles.some((t) => t.id === r.id)),
  ...tiles,
];
const edit = (before, s) => merge(before, applyTerrainBrush(before, s));
const sample = (records) => {
  const sampler = new TerrainSampler(records);
  return (x, y = 0) => sampler.sample({ x, y }).heightM + 100;
};
function dense(samples, count) {
  return samples.flatMap((b, i) => {
    if (!i) return [b];
    const a = samples[i - 1];
    return Array.from({ length: count }, (_, j) => {
      const f = (j + 1) / count;
      return { x: a.x + (b.x - a.x) * f, y: a.y + (b.y - a.y) * f, t: a.t + (b.t - a.t) * f };
    });
  });
}
test('forms are validated immutable stroke data with a fixed seed and directional operation', () => {
  for (const form of forms) {
    const s = stroke(form),
      before = JSON.stringify(s);
    validateHeightStroke(s);
    applyTerrainBrush([], s);
    assert.equal(JSON.stringify(s), before);
    for (const change of [
      { mode: 'roughen' },
      { mode: 'smooth' },
      { targetM: 200 },
      { roughness: 0.5 },
      { seed: undefined },
      { form: 'plateau' },
      { seed: -1 },
    ])
      assert.throws(() => validateHeightStroke({ ...s, ...change }), /prüfen/);
  }
});
test('hills fill a wide corridor with several broad knolls rather than a single extruded wall', () => {
  const at = sample(edit([], stroke('hills'))),
    peaks = [];
  for (let y = -16; y <= 16; y++)
    for (let x = -72; x <= 72; x++) {
      const z = at(x, y);
      if (z > at(x - 1, y) && z > at(x + 1, y) && z > at(x, y - 1) && z > at(x, y + 1))
        peaks.push({ x, y, z });
    }
  assert(peaks.length >= 4, JSON.stringify(peaks));
  assert(
    peaks.some((p) => Math.abs(p.y) > 4),
    'knolls must also occur beside the pointer centreline',
  );
  for (const p of peaks) assert(at(p.x + 3, p.y) > p.z * 0.55, 'broad hills, no one-cell spikes');
  assert(Math.max(...peaks.map((p) => p.z)) / Math.min(...peaks.map((p) => p.z)) > 1.15);
});
test('mountains keep an unbroken main ridge and broad connected slopes; canyon has floor and banks', () => {
  const mountain = sample(edit([], stroke('mountains'))),
    canyon = sample(edit([], stroke('canyon')));
  const ridge = [];
  for (let x = -72; x <= 72; x += 2) {
    const centre = mountain(x),
      shoulder = mountain(x, 12),
      foot = mountain(x, 26);
    assert(centre > 20 && centre > shoulder * 1.5 && shoulder > foot && foot > 0, {
      x,
      centre,
      shoulder,
      foot,
    });
    ridge.push(centre);
    assert(canyon(x) < -25 && canyon(x) < canyon(x, 12) && canyon(x, 12) < canyon(x, 26), { x });
  }
  assert(Math.max(...ridge) / Math.min(...ridge) > 1.1, 'unequal continuous summits');
});
test('all forms preserve the outside and taper at the edge even with a hard selected feather', () => {
  for (const form of forms) {
    const at = sample(edit([], stroke(form, straight, { feather: 0 }))),
      sign = form === 'canyon' ? -1 : 1;
    assert.equal(at(0, 33), 0);
    assert.equal(at(0, 32), 0);
    assert(sign * at(0, 31) > 0 && sign * at(0, 31) < sign * at(0, 28));
    assert.equal(at(140, 0), 0);
  }
});
test('curves, self-crossings and adjacent follow-up strokes remain connected across signed tile boundaries', () => {
  const crossing = [
    { x: -48, y: -24, t: 0 },
    { x: 48, y: 24, t: 1600 },
    { x: 48, y: -24, t: 2400 },
    { x: -48, y: 24, t: 4000 },
  ];
  for (const form of forms) {
    for (const path of [curve, crossing]) {
      const at = sample(edit([], stroke(form, path))),
        sign = form === 'canyon' ? -1 : 1;
      for (let i = 1; i < path.length; i++)
        for (let j = 0; j <= 20; j++) {
          const a = path[i - 1],
            b = path[i],
            f = j / 20;
          assert(
            sign * at(a.x + (b.x - a.x) * f, a.y + (b.y - a.y) * f) > 5,
            `${form} continuous segment ${i}`,
          );
        }
      for (const x of [-0.1, 0, 0.1, 63.9, 64, 64.1])
        assert(Number.isFinite(at(x)), 'finite interpolation at negative/positive joins');
    }
    const first = edit(
        [],
        stroke(form, [
          { x: -96, y: 0, t: 0 },
          { x: 0, y: 0, t: 1600 },
        ]),
      ),
      after = edit(
        first,
        stroke(form, [
          { x: -12, y: 0, t: 0 },
          { x: 96, y: 4, t: 1800 },
        ]),
      ),
      at = sample(after),
      sign = form === 'canyon' ? -1 : 1;
    for (let x = -80; x <= 80; x++) assert(sign * at(x, 0) > 5, form + ' connected follow-up');
    // Adjacent gestures share the deterministic field and add to the old data.
    assert(sign * (at(0) - sample(first)(0)) > 0);
  }
});
test('sample density does not set form geometry or exposure; stationary duration strengthens the same form', (t) => {
  for (const form of forms) {
    const a = sample(edit([], stroke(form, curve))),
      b = sample(edit([], stroke(form, dense(curve, 13))));
    let maxError = 0,
      maxEffect = 0;
    for (let y = -48; y <= 48; y += 2)
      for (let x = -64; x <= 64; x += 2) {
        maxError = Math.max(maxError, Math.abs(a(x, y) - b(x, y)));
        maxEffect = Math.max(maxEffect, Math.abs(a(x, y)));
      }
    // Same piecewise-linear path and timing. Midpoint time integration is at
    // <=1/30 s and <=radius/8; allow 0.5% of peak plus 2 cm for float storage.
    assert(maxError < maxEffect * 0.005 + 0.02, { form, maxError, maxEffect });
    t.diagnostic(JSON.stringify({ form, maxError, maxEffect }));
    const hold = [
        { x: 0, y: 0, t: 0 },
        { x: 0, y: 0, t: 1000 },
      ],
      once = sample(edit([], stroke(form, hold))),
      twice = sample(edit([], stroke(form, [hold[0], { ...hold[1], t: 2000 }])));
    for (let y = -28; y <= 28; y += 4)
      for (let x = -28; x <= 28; x += 4)
        assert(Math.abs(2 * once(x, y) - twice(x, y)) < 0.0001, form + ' fixed stationary field');
  }
});
test('pauses cannot stamp separate pits into a form corridor; retracing builds the same form', () => {
  const path = [-96, -48, 0, 48, 96],
    continuous = path.map((x, i) => ({ x, y: 0, t: i * 500 })),
    paused = path.flatMap((x, i) => [
      { x, y: 0, t: i * 400 },
      { x, y: 0, t: (i + 1) * 400 },
    ]),
    retraced = [
      ...continuous,
      ...continuous
        .slice(0, -1)
        .reverse()
        .map((p, i) => ({ ...p, t: 2500 + i * 500 })),
    ];
  for (const form of forms) {
    const a = sample(edit([], stroke(form, continuous))),
      b = sample(edit([], stroke(form, paused))),
      c = sample(edit([], stroke(form, retraced)));
    for (let x = -90; x <= 90; x++) {
      assert(Math.abs(a(x) - b(x)) < 0.0001, form + ' continuous amplitude despite pauses');
      // The bounded corner round shortens a reversal by at most radius/24.
      assert(
        Math.abs(2 * a(x) - c(x)) < Math.abs(a(x)) * 0.02 + 0.0002,
        form + ' same corridor reinforces on retracing',
      );
    }
    if (form === 'canyon') {
      const depths = Array.from({ length: 181 }, (_, i) => -b(i - 90));
      assert(
        Math.min(...depths) > Math.max(...depths) * 0.85,
        'one continuous floor, no bead pits',
      );
    }
  }
});
test('live forms recompute joins from the fixed ground and match canonical lattice nodes', () => {
  for (const form of forms) {
    const view = {
        box: { x: -64, y: -64, width: 128, height: 128 },
        frame: { x: -64, y: -64, width: 128, height: 128 },
        columns: 129,
        rows: 129,
        focusM: 0,
        tilt: 0,
        rotation: 0,
        exaggeration: 1,
      },
      base = {
        view,
        seaLevelM: 0,
        heights: new Float32Array(129 * 129),
        editing: {
          ground: new Float32Array(129 * 129).fill(-100),
          water: new Float32Array(129 * 129),
        },
      },
      draft = new TerrainBrushDraft(base, []),
      s = stroke(form, curve);
    for (let n = 2; n <= curve.length; n++) {
      const partial = { ...s, samples: curve.slice(0, n) };
      assert(draft.update(partial));
      const at = sample(edit([], partial));
      for (let y = -60; y <= 60; y += 2)
        for (let x = -60; x <= 60; x += 2)
          assert(
            Math.abs(draft.ground[(y + 64) * 129 + x + 64] + 100 - at(x, y)) < 0.0001,
            `${form} stage ${n} ${x},${y}`,
          );
    }
    assert.equal(draft.update(s), false);
    assert(base.editing.ground.every((z) => z === -100));
  }
});
test('forms add scale bands without replacing fine detail and accept local basic corrections', () => {
  const fine = edit([], {
    mode: 'roughen',
    radius: 4,
    strength: 5,
    feather: 0.5,
    seed: 14,
    samples: [
      { x: 0, y: 0, t: 0 },
      { x: 0, y: 0, t: 1000 },
    ],
  });
  for (const form of forms) {
    const result = edit(fine, stroke(form, curve));
    assert.deepEqual(
      result.filter((r) => fine.some((f) => f.id === r.id)),
      fine,
    );
    for (const mode of ['raise', 'lower', 'smooth']) {
      const corrected = edit(result, {
        mode,
        radius: 8,
        strength: 100,
        feather: 0.8,
        samples: [
          { x: 0, y: 16, t: 0 },
          { x: 0, y: 16, t: 1000 },
        ],
      });
      assert.notEqual(sample(corrected)(0, 16), sample(result)(0, 16), form + ' ' + mode);
    }
  }
});
