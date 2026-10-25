import { test } from 'node:test';
import assert from 'node:assert/strict';
import { createHash } from 'node:crypto';
import { buildSync } from 'esbuild';
import { createRequire } from 'node:module';
buildSync({
  stdin: {
    resolveDir: process.cwd(),
    contents: "export {LandscapeRasterizer} from './src/app/atlas/landscape-raster';",
  },
  outfile: '.build/terrain-pigment-coverage-test.cjs',
  bundle: true,
  platform: 'node',
  format: 'cjs',
});
const { LandscapeRasterizer } = createRequire(import.meta.url)(
  '../../.build/terrain-pigment-coverage-test.cjs',
);
const rect = (x, y, w, h) => [
  { x, y },
  { x: x + w, y },
  { x: x + w, y: y + h },
  { x, y: y + h },
];
const cases = [
  [0, '5fa463df9e0f0232108df2734fcf26fcd361f45115256bc6524db3add80c45c9'],
  [-1e9, 'e5602cc1209c7ed71c66ae0e8b6de54f69fb79dd1d8b95eca12a1992cc60bb91'],
  [1e9, 'f07c3fdd7779dbeed0f314677b616c5ee9322affb67c6604524125c9101d2676'],
];
for (const [origin, expected] of cases)
  test(`stroke coverage keeps pre-change pixels at world origin ${origin}`, () => {
    const box = { x: origin - 32, y: origin - 24, width: 64, height: 48 },
      image = new LandscapeRasterizer(box, 128, 96),
      lattice = image.sampleLattice(),
      size = lattice.columns * lattice.rows;
    image.setTerrainField({
      heights: new Float32Array(size).fill(100),
      water: Uint8Array.from({ length: size }, (_, i) =>
        i % lattice.columns < lattice.columns / 2 ? 1 : 0,
      ),
    });
    const point = (x, y) => ({ x: origin + x, y: origin + y }),
      polygons = [
        {
          outer: rect(origin - 100, origin - 100, 200, 200),
          holes: [rect(origin - 3.2, origin - 1.1, 4.4, 6.6)],
        },
      ];
    const record = (i, points, extra) => ({
      id: 'p' + i,
      revision: 1,
      kind: 'patch',
      name: '',
      points: points.map(([x, y]) => point(x, y)),
      polygons,
      width: 0,
      resolution: 1,
      values: {},
      paint: {
        version: 2,
        operation: 'paint',
        target: 'ground',
        color: i % 2 ? '#967755' : '#778866',
        opacity: 0.4,
        flow: 0.6,
        tip: 'soft',
        radius: 11.3,
        seed: 9,
        fill: false,
        ...extra,
      },
    });
    const records = [
      record(
        0,
        [
          [-25, -15],
          [20, 10],
        ],
        {},
      ),
      record(
        1,
        [
          [-26, 13],
          [25, 16],
        ],
        {
          tip: 'textured',
          radius: 9.7,
          seed: 0xffffffff,
          strokes: [
            [],
            [point(-26, 13), point(10, -9), point(25, 16)],
            [point(-10, -3), point(-10, -3)],
            [point(200, 200), point(201, 200)],
          ],
        },
      ),
      record(
        2,
        [
          [-30, 8],
          [-8, -10],
        ],
        { target: 'water', tip: 'round', radius: 13.3, flow: 0.7 },
      ),
      record(
        3,
        [
          [0, 0],
          [17, 10],
        ],
        { operation: 'erase', radius: 6.7 },
      ),
    ];
    let steps = 0;
    function* checkpoint() {
      steps++;
      yield;
    }
    for (const r of records)
      for (const _ of image.paintColorSteps(r, checkpoint)) {
      }
    assert(steps > 50, 'large dabs retain interruption points');
    const actual = createHash('sha256').update(image.finish()).digest('hex');
    // Captured from the scalar rasterizer at bc8908757, before shared axes.
    assert.equal(actual, expected);
  });
