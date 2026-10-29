import test from 'node:test';
import assert from 'node:assert/strict';
import { build } from 'esbuild';
const { outputFiles } = await build({
  entryPoints: ['src/app/atlas/atlas-raster-kernel.ts'],
  bundle: true,
  write: false,
  platform: 'node',
  format: 'esm',
});
const { reduceAtlasMaterialRows } = await import(
  'data:text/javascript;base64,' + Buffer.from(outputFiles[0].text).toString('base64')
);
test('bounded reduction equals independent alpha-weighted reference including topology and partial rows', () => {
  let seed = 41;
  const random = () => {
    seed = (Math.imul(seed, 1664525) + 1013904223) >>> 0;
    return seed >>> 24;
  };
  for (const scale of [2, 4])
    for (const width of [1, 7, 64, 1024]) {
      const rows = 19,
        stride = (width + 3) * scale,
        left = scale,
        top = 2 * scale,
        n = stride * (rows + 4) * scale;
      const samples = Uint8Array.from({ length: n * 4 }, random),
        water = Uint8Array.from({ length: n }, () => (random() > 127 ? 1 : 0)),
        forest = Uint8Array.from({ length: n }, random);
      const channels = {
        baseColor: new Uint8Array(width * rows * 4),
        water: new Uint8Array(width * rows),
        forest: new Uint8Array(width * rows),
        waterTopology: new Uint16Array(width * rows),
      };
      for (let y = 0; y < rows; y += 16)
        reduceAtlasMaterialRows(
          {
            samples,
            water,
            forest,
            stride,
            left,
            top: top + y * scale,
            width,
            rows: Math.min(16, rows - y),
            scale,
          },
          channels,
          y,
        );
      for (let y = 0; y < rows; y++)
        for (let x = 0; x < width; x++) {
          const rgb = [0, 0, 0];
          let alpha = 0,
            w = 0,
            f = 0,
            bits = 0;
          for (let sy = 0; sy < scale; sy++)
            for (let sx = 0; sx < scale; sx++) {
              const i = (top + y * scale + sy) * stride + left + x * scale + sx,
                a = samples[i * 4 + 3];
              alpha += a;
              for (let c = 0; c < 3; c++) rgb[c] += samples[i * 4 + c] * a;
              if (water[i]) {
                w += 255;
                bits |= 1 << (sy * scale + sx);
              } else f += forest[i];
            }
          const out = y * width + x,
            count = scale * scale;
          for (let c = 0; c < 3; c++)
            assert.equal(channels.baseColor[out * 4 + c], alpha ? Math.round(rgb[c] / alpha) : 0);
          assert.equal(channels.baseColor[out * 4 + 3], Math.round(alpha / count));
          assert.equal(channels.water[out], Math.round(w / count));
          assert.equal(channels.forest[out], Math.round(f / count));
          assert.equal(channels.waterTopology[out], bits);
        }
    }
});
test('reject oversized or out-of-bounds blocks before touching the output', () => {
  const input = {
    samples: new Uint8Array(64),
    water: new Uint8Array(16),
    stride: 4,
    left: 0,
    top: 0,
    width: 1,
    rows: 1,
    scale: 4,
  };
  for (const patch of [{ rows: 17 }, { width: 1025 }, { scale: 8 }, { top: 1 }, { left: -1 }])
    assert.throws(() => reduceAtlasMaterialRows({ ...input, ...patch }, {}, 0));
});

test('supersample reduction resolves each cover buffer once while preserving coverage', () => {
  const width = 16,
    rows = 16,
    scale = 4,
    stride = width * scale,
    n = stride * rows * scale,
    values = new Uint8Array(n).fill(153);
  let reads = 0;
  const covers = Object.defineProperty({}, 'reed', {
    get: () => {
      reads++;
      return values;
    },
  });
  const output = { reed: new Uint8Array(width * rows) };
  reduceAtlasMaterialRows(
    {
      samples: new Uint8Array(n * 4),
      water: new Uint8Array(n).fill(1),
      covers,
      stride,
      left: 0,
      top: 0,
      width,
      rows,
      scale,
    },
    output,
    0,
  );
  assert(output.reed.every((v) => v === 153));
  assert(reads <= 3, 'a stable source buffer lookup is not repeated for every channel supersample');
});
