import { test } from 'node:test';
import assert from 'node:assert/strict';
import { buildSync } from 'esbuild';
import { createRequire } from 'node:module';
buildSync({
  stdin: {
    resolveDir: process.cwd(),
    contents:
      "export * from './src/app/landscape-raster';export {contains} from './src/app/atlas-landscape';",
  },
  outfile: '.build/terrain-opaque-raster-test.cjs',
  bundle: true,
  platform: 'node',
  format: 'cjs',
});
const { LandscapeRasterizer, contains } = createRequire(import.meta.url)(
  '../.build/terrain-opaque-raster-test.cjs',
);
const rect = (x, y, w, h) => [
  { x, y },
  { x: x + w, y },
  { x: x + w, y: y + h },
  { x, y: y + h },
];
for (const origin of [0, -1048576, 1048576])
  test(`opaque scanline spans preserve holes, clipping and RGBA byte order at ${origin}`, () => {
    const box = { x: origin - 5.25, y: origin - 3.5, width: 17, height: 13 },
      width = 17,
      height = 13;
    const shapes = [
      { outer: rect(-20, -20, 40, 40), holes: [rect(-2.2, -1.1, 5.4, 4.2)] },
      {
        outer: [
          { x: -8, y: 2.1 },
          { x: 3.6, y: 3.7 },
          { x: 5.9, y: 10.4 },
          { x: -1.3, y: 8.23 },
        ],
        holes: [],
      },
      { outer: rect(-900, -8, 10, 30), holes: [] },
      { outer: rect(900, -8, 10, 30), holes: [] },
    ].map((p) => ({
      outer: p.outer.map((v) => ({ x: v.x + origin, y: v.y + origin })),
      holes: p.holes.map((r) => r.map((v) => ({ x: v.x + origin, y: v.y + origin }))),
    }));
    const image = new LandscapeRasterizer(box, width, height);
    image.paintPolygons([shapes[0]], '#9f405e');
    image.paintPolygons([shapes[1]], '#3ac184', 0.5);
    image.paintPolygons(shapes.slice(2), '#ff0000');
    const expected = new Uint8Array(width * height * 4);
    // Independent authored point containment determines the four sample colours.
    for (let y = 0; y < height; y++)
      for (let x = 0; x < width; x++) {
        const samples = [];
        for (const dy of [0.25, 0.75])
          for (const dx of [0.25, 0.75]) {
            const p = { x: box.x + x + dx, y: box.y + y + dy };
            let rgba = contains(p, [shapes[0]]) ? [159, 64, 94, 255] : [0, 0, 0, 0];
            if (contains(p, [shapes[1]])) {
              const a = rgba[3] / 255,
                combined = 0.5 + a * 0.5;
              rgba = [58, 193, 132]
                .map((c, i) => Math.round((c * 0.5 + rgba[i] * a * 0.5) / combined))
                .concat(Math.round(combined * 255));
            }
            samples.push(rgba);
          }
        const alpha = samples.reduce((n, s) => n + s[3], 0),
          at = (y * width + x) * 4;
        if (alpha)
          for (let c = 0; c < 3; c++)
            expected[at + c] = Math.round(samples.reduce((n, s) => n + s[c] * s[3], 0) / alpha);
        expected[at + 3] = Math.round(alpha / 4);
      }
    assert.deepEqual(image.finish(), expected);
  });
