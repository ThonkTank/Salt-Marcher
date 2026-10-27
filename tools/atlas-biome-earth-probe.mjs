import { randomUUID } from 'node:crypto';
import { isDeepStrictEqual } from 'node:util';

/** Synthetic surfaces use the canonical store, snapshots and material path.
 * They are deliberately large author areas, never enlarged local plant models. */
export function writeBiomeOverview({
  fixture,
  fixtureStore,
  fixtureHeightRecord,
  vegetationSpec,
  side = 2000000,
  heightPixelSize = 65536,
  smallPatch = false,
}) {
  const store = new fixtureStore(fixture.filename),
    token = store.activate(fixture.campaignId).token;
  try {
    const write = (record) =>
      store.executeAtlasCommit({
        commandId: randomUUID(),
        campaignId: fixture.campaignId,
        token,
        action: { kind: 'landscape-put', record, expectedRevision: null },
      });
    if (heightPixelSize)
      for (const y of [-64 * heightPixelSize, 0])
        for (const x of [-64 * heightPixelSize, 0])
          write(fixtureHeightRecord(x, y, heightPixelSize, new Float32Array(4096).fill(30)));
    const area = (id, vegetation, x, y, size, resolution) => ({
      id,
      revision: 0,
      kind: 'vegetation',
      name: id,
      points: [],
      width: 0,
      resolution,
      values: { terrain: vegetation.preset.terrain },
      polygons: [
        {
          outer: [
            { x, y },
            { x: x + size, y },
            { x: x + size, y: y + size },
            { x, y: y + size },
          ],
          holes: [],
        },
      ],
      vegetation,
    });
    for (const [n, id] of ['deciduous', 'marsh', 'desert', 'farmland'].entries())
      write(
        area(
          'synthetic-' + id,
          vegetationSpec(id, 200 + n),
          n % 2 === 0 ? -side : 0,
          n < 2 ? -side : 0,
          side,
          16384,
        ),
      );
    if (smallPatch)
      write(
        area('physical-150m-field', vegetationSpec('farmland', 500), -8000000, 8000000, 150, 1),
      );
  } finally {
    store.close();
  }
}

/** Upper functional bound: an Earth circumference in the existing flat metric
 * camera. Close-scale and history evidence belongs to the bounded library run. */
export async function qualifyBiomeEarth({
  native,
  getPage,
  open,
  query,
  canonical,
  frame,
  pixels,
  project,
  zoomTo,
  check,
  results,
  save,
}) {
  const width = await getPage().evaluate(() => window.__qaRaster.surface.frame.width),
    metres = 40000000,
    target = metres / width,
    saved = canonical(query().records.filter((r) => r.vegetation)),
    probes = [
      { x: -4000000, y: -4000000 },
      { x: 4000000, y: -4000000 },
      { x: -4000000, y: 4000000 },
      { x: 4000000, y: 4000000 },
    ];
  results.scaleViews = [];
  for (const fresh of [false, true]) {
    if (fresh) {
      await native.close();
      await open();
    }
    native.mark('Earth 40000000 m' + (fresh ? ' fresh' : ''));
    await zoomTo(target);
    const f = await frame(probes),
      shown = await pixels(probes),
      material = f.samples.map((s) => s.material),
      layers = await getPage().evaluate(() =>
        window.__qaRaster.vegetation.batches.map((b) => ({ asset: b.asset, count: b.data.length })),
      ),
      smallStart = await project({ x: -8000000, y: 8000000 }),
      smallEnd = await project({ x: -7999850, y: 8000000 }),
      label = 'earth-40000000m' + (fresh ? '-fresh' : '');
    check(
      label + '-physical-span',
      Math.abs((f.camera.metersPerPixel * width) / metres - 1) < 1e-4,
    );
    check(
      label + '-four-biomes-material-and-visible',
      new Set(material.map((m) => m.baseColor.join(','))).size === 4 &&
        new Set(shown.map((p) => p.rgb.join(','))).size === 4 &&
        material[0].deciduous[0] > 100 &&
        material[1].reed[0] > 100 &&
        material[2].debris[0] > 0 &&
        material[3].furrows[0] > 100,
      { material, shown },
    );
    check(
      label + '-local-field-remains-physical',
      smallStart.visible &&
        smallEnd.visible &&
        Math.abs(smallEnd.x - smallStart.x) < 0.01 &&
        layers.every((b) => b.count === 0),
      { smallFieldCssPixels: Math.abs(smallEnd.x - smallStart.x), layers },
    );
    check(
      label + '-snapshots-preserved',
      isDeepStrictEqual(canonical(query().records.filter((r) => r.vegetation)), saved),
    );
    await native.capture(getPage(), label + '.png');
    results.scaleViews.push({
      kind: 'earth',
      fresh,
      metres,
      target,
      actualMpp: f.camera.metersPerPixel,
      actualSpanM: f.camera.metersPerPixel * width,
      camera: f.camera,
      tiles: f.tiles,
      smallFieldCssPixels: Math.abs(smallEnd.x - smallStart.x),
      layers,
    });
    await save();
  }
}
