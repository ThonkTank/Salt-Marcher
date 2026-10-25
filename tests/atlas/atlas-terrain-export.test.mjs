import { emptyMaterialChannels } from '../helpers/atlas-material-channels.mjs';
import { test } from 'node:test';
import assert from 'node:assert/strict';
import { build } from 'esbuild';
import { createRequire } from 'node:module';
await build({
  stdin: { resolveDir: process.cwd(), contents: "export * from './src/app/atlas/atlas-terrain-export';" },
  outfile: '.build/atlas-terrain-export-test.cjs',
  bundle: true,
  platform: 'node',
  format: 'cjs',
  plugins: [
    {
      name: 'capture-image-boundary',
      setup(b) {
        b.onResolve({ filter: /^\.\/atlas-deck-runtime$/ }, () => ({
          path: 'image-boundary',
          namespace: 'probe',
        }));
        b.onResolve({ filter: /^\.\/atlas-surface-tile-stream$/ }, () => ({
          path: 'stream',
          namespace: 'stream',
        }));
        b.onLoad({ filter: /.*/, namespace: 'stream' }, () => ({
          contents:
            'export class AtlasSurfaceTileStream{async load(q,fetch,publish){publish({complete:true,tiles:globalThis.exportTiles});}dispose(){}} export const atlasSurfaceTileFetcher=()=>()=>{};',
        }));
        b.onLoad({ filter: /.*/, namespace: 'probe' }, () => ({
          contents:
            'export async function atlasDeckImage(input){return globalThis.captureTerrainImage(input);}',
        }));
      },
    },
  ],
});
const { atlasTerrainExport } = createRequire(import.meta.url)(
  '../../.build/atlas-terrain-export-test.cjs',
);
const box = { x: 100, y: 200, width: 300, height: 200 };
const tile = (content, data) => ({
  box: { x: 120, y: 230, width: 50, height: 40 },
  width: 50,
  height: 40,
  content,
  data,
});
const options = {
  audience: 'gm',
  width: 900,
  height: 600,
  format: 'png',
  references: false,
  grid: false,
  level: 'local',
  floorId: 'ground',
  roofs: true,
  contours: 0,
};
function fixture(t) {
  const snapshot = {
    revision: 7,
    cities: [],
    bindings: [],
    entrances: [],
    region: {
      fence: 'source-7',
      landscape: {
        state: 'ready',
        coverage: { complete: true, mode: 'raster' },
        records: [],
        tiles: [tile(undefined, 'ground'), tile('objects', 'forest'), tile('objects', 'road')],
      },
    },
  };
  const priorWindow = globalThis.window,
    priorCapture = globalThis.captureTerrainImage,
    priorTiles = globalThis.exportTiles;
  const identity = { tile: { lod: 0, x: 0, y: 0 }, revision: 7, fence: 'source-7' };
  globalThis.exportTiles = [
    {
      terrain: {
        ...identity,
        projection: {
          grid: {
            view: { box: { x: 0, y: 0, width: 1024, height: 1024 }, columns: 2, rows: 2 },
            heights: new Float32Array(4),
            seaLevelM: 0,
          },
        },
      },
      material: {
        ...identity,
        width: 1,
        height: 1,
        channels: {
          ...emptyMaterialChannels(1),
          baseColor: new Uint8Array([1, 2, 3, 255]),
          water: new Uint8Array([0]),
          forest: new Uint8Array([0]),
        },
      },
    },
  ];
  const projection = { revision: 7, fence: 'source-7' };
  let captures = 0;
  globalThis.window = {
    campaign: {
      async atlasTerrainProjection() {
        return { ok: true, value: projection };
      },
    },
  };
  globalThis.captureTerrainImage = async (args) => {
    captures++;
    return args.scene;
  };
  t.after(() => {
    globalThis.window = priorWindow;
    globalThis.captureTerrainImage = priorCapture;
    globalThis.exportTiles = priorTiles;
  });
  return {
    snapshot,
    projection,
    captures: () => captures,
    run: () =>
      atlasTerrainExport(
        'token',
        snapshot,
        {
          box,
          frame: box,
          columns: 65,
          rows: 65,
          focusM: 0,
          tilt: 45,
          rotation: 0,
          exaggeration: 1,
        },
        options,
        () => true,
        () => {},
      ),
  };
}
const images = (node) => [
  ...(node.kind === 'image' ? [node] : []),
  ...node.children.flatMap(images),
];
test('perspective export preserves dense forest and road object tiles at world positions without repainting ground', async (t) => {
  const f = fixture(t),
    before = structuredClone(f.snapshot),
    scene = await f.run(),
    tiles = images(scene);
  assert.deepEqual(
    tiles.map((i) => i.geometry.source),
    ['forest', 'road'],
  );
  for (const image of tiles) {
    assert.equal(image.geometry.x, 20);
    assert.equal(image.geometry.y, 30);
    assert.equal(image.geometry.width, 50);
    assert.equal(image.geometry.height, 40);
  }
  assert.deepEqual(f.snapshot, before);
  assert.equal(f.captures(), 1);
});
test('incomplete layers and changed projection fences cannot produce a partial forest export', async (t) => {
  const f = fixture(t);
  f.snapshot.region.landscape.coverage.complete = false;
  await assert.rejects(f.run, /nicht vollständig/);
  assert.equal(f.captures(), 0);
  f.snapshot.region.landscape.coverage.complete = true;
  f.projection.fence = 'changed';
  await assert.rejects(f.run, /während der Ausgabe geändert/);
  assert.equal(f.captures(), 0);
});
