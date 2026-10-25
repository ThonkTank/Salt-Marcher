// Diagnostic counterexample: measure semantic coverage, not merely different pixels.
import { buildSync } from 'esbuild';
import { createRequire } from 'node:module';
import { writeFileSync, mkdirSync } from 'node:fs';
import { resolve } from 'node:path';
const output = resolve('.build/atlas-material-coverage', `${Date.now()}-${process.pid}`);
mkdirSync(output, { recursive: true });
buildSync({
  stdin: {
    contents:
      "export * from './src/app/atlas/terrain-material';export * from './src/app/atlas/terrain-relief';export * from './src/app/atlas/landscape-raster';export * from './src/app/atlas/terrain-height';export * from './src/app/atlas/vegetation';",
    resolveDir: process.cwd(),
  },
  outfile: output + '/probe.cjs',
  bundle: true,
  platform: 'node',
  format: 'cjs',
});
const { LandscapeRasterizer, settingsRecord, DEFAULT_TERRAIN_STYLE } = createRequire(
  import.meta.url,
)(output + '/probe.cjs');
const polygon = {
  outer: [
    { x: 430.12, y: 100 },
    { x: 430.37, y: 100 },
    { x: 430.37, y: 700 },
    { x: 430.12, y: 700 },
  ],
  holes: [],
};
const record = {
  id: 'narrow-forest',
  kind: 'patch',
  revision: 0,
  order: 1,
  resolution: 1,
  width: 0,
  points: [],
  polygons: [polygon],
  values: { terrain: 'forest' },
};
function render(x, y, size, withFeature) {
  const settings = settingsRecord(0);
  settings.terrainSettings.style = { ...DEFAULT_TERRAIN_STYLE };
  const image = new LandscapeRasterizer(
      { x, y, width: size, height: size },
      256,
      256,
      0,
      size / 256,
      true,
    ),
    lattice = image.sampleLattice();
  image.setTerrainField({
    heights: new Float32Array(lattice.columns * lattice.rows).fill(100),
    water: new Uint8Array(lattice.columns * lattice.rows),
  });
  image.paint(settings);
  if (withFeature) image.paint(record);
  return image.materialChannelsSteps(function* () {}, new Set(['baseColor', 'forest'])).next()
    .value;
}
function measure(tileCount) {
  const accum = { forest: 0, baseProjection: 0, baseAlpha: 0 },
    tileSize = 1024 / tileCount,
    pixelArea = (tileSize / 256) ** 2,
    bg = [238, 229, 207],
    fg = [102, 139, 105],
    den = bg.reduce((sum, v, i) => sum + (fg[i] - v) ** 2, 0);
  for (let ty = 0; ty < tileCount; ty++)
    for (let tx = 0; tx < tileCount; tx++) {
      const tile = render(tx * tileSize, ty * tileSize, tileSize, true);
      for (const v of tile.forest) accum.forest += (v / 255) * pixelArea;
      for (let i = 0; i < tile.baseColor.length; i += 4) {
        let dot = 0;
        for (let c = 0; c < 3; c++) dot += (tile.baseColor[i + c] - bg[c]) * (fg[c] - bg[c]);
        accum.baseProjection += (dot / den) * pixelArea;
        accum.baseAlpha += (tile.baseColor[i + 3] / 255) * pixelArea;
      }
    }
  return accum;
}
const parent = measure(1),
  children = measure(4),
  exact = 150;
const out = {
  feature: {
    shape: 'rectangle',
    widthM: 0.25,
    lengthM: 600,
    exactAreaM2: exact,
    x: [430.12, 430.37],
    y: [100, 700],
  },
  setup: {
    terrain: 'constant 100 m',
    water: 'all dry',
    style: 'default',
    raster:
      'production LandscapeRasterizer.materialChannelsSteps, 256 output pixels per side, existing 2x internal sample lattice',
    parent: 'LOD2, one 1024 m tile',
    children: 'LOD0, all 16 256 m tiles',
  },
  results: {
    parent,
    children,
    forestAreaErrorM2: { parent: parent.forest - exact, children: children.forest - exact },
    baseColorForestProjectionM2: {
      parent: parent.baseProjection,
      children: children.baseProjection,
    },
    baseColorProjectionErrorM2: {
      parent: parent.baseProjection - exact,
      children: children.baseProjection - exact,
    },
    baseColorAlphaAreaM2: { parent: parent.baseAlpha, children: children.baseAlpha },
  },
  interpretation:
    'Forest is the semantic coverage channel (0..255), so its integrated area is direct. Base color projection estimates forest share along the default-land to forest RGB vector. LOD2 misses this source feature entirely; LOD0 child coverage samples it at about twice exact area. This is evidenced quality loss, beyond expected pixel rearrangement.',
};
out.approaches = [
  {
    name: 'source area integration',
    benefit: 'Conserves exact polygon area at each LOD; targets the observed loss.',
    risk: 'Geometry clipping and authored-order composition must cover holes, masks, strokes, feathered vegetation, water topology, and pigment. Best targeted at coverage channels while retaining sampled height fields.',
  },
  {
    name: 'mipmap child downsampling',
    benefit:
      'Makes parent equal the aggregate of children and guarantees transition consistency for complete child sets.',
    risk: 'Cold overview waits on child generation and fan-in; more invalidation dependencies. Keeps current fine bias (~301 m2 for a 150 m2 feature) unless child raster improves; categorical channels need custom reducers.',
  },
  {
    name: 'larger fixed samples',
    benefit: 'Small conceptual change; reduces point-sampling misses and fine-level overcoverage.',
    risk: 'Quadratic work growth. The 2x internal grid misses the feature at 4 m parent pixel scale; at least 16 samples across a pixel are needed just to guarantee a hit for a 0.25 m strip, before accurate area estimation. Phase sensitivity remains; no conservation guarantee.',
  },
];
writeFileSync(output + '/result.json', JSON.stringify(out, null, 2) + '\n');
console.log(JSON.stringify({ complete: true, output, result: out }));
