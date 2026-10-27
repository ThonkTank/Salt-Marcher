import assert from 'node:assert/strict';
import { createHash } from 'node:crypto';
import { writeBiomeOverview } from './atlas-biome-earth-probe.mjs';
import { setBrushWorldRadius } from './atlas-brush-probe.mjs';

/** Bounded library qualification through the same native paint tool as the
 * radius regression. The parent harness owns camera/event and process evidence. */
export async function qualifyBiomeLibrary({
  native,
  getPage,
  open,
  ready,
  query,
  project,
  frame,
  pixels,
  sceneRead,
  history,
  mapImageHash,
  zoomTo,
  check,
  canonical,
  results,
  save,
  vegetationSpec,
  fixture,
  fixtureStore,
  fixtureHeightRecord,
  output,
  marshOnly,
}) {
  const cases = marshOnly
    ? [['marsh', -180]]
    : [
        ['marsh', -180],
        ['deciduous', -60],
        ['desert', 60],
        ['farmland', 180],
      ];
  const readBox = { x: -235, y: -120, width: 470, height: 240 };
  const hash = (value) => createHash('sha256').update(JSON.stringify(value)).digest('hex');
  for (const [id, x] of cases) {
    let page = getPage();
    native.mark('library ' + id + ' paint/history/fresh');
    const before = query(),
      beforeImage = await mapImageHash();
    await page.locator('#vegetation-preset').selectOption(id);
    await setBrushWorldRadius(page, 'land-radius', 35);
    await page.locator('#vegetation-edge').fill('0');
    await page.locator('#vegetation-edge').press('Tab');
    await ready();
    const start = await project({ x, y: -65 }),
      end = await project({ x, y: 65 });
    assert(start.visible && end.visible, 'Library stroke fits loaded native camera');
    await native.capture(page, id + '-before.png');
    await page.mouse.move(start.x, start.y);
    await page.mouse.down();
    await page.mouse.move(end.x, end.y, { steps: 20 });
    await page.mouse.up();
    for (let n = 0; query().cursor === before.cursor && n < 300; n++)
      await page.waitForTimeout(100);
    await ready();
    const painted = query(),
      record = painted.records.find((r) => r.vegetation && r.vegetation.preset.id === id);
    assert(record, 'Selected biome committed through the shared brush');
    const samples = [
        { x, y: -60 },
        { x, y: 5 },
        { x, y: 65 },
      ],
      material = await frame(samples),
      shown = await pixels(samples),
      instances = (await sceneRead(readBox)).filter((i) => i.areaId === record.id);
    const materialValues = material.samples.map((s) => s.material),
      assets = Object.fromEntries(
        [...new Set(instances.map((i) => i.asset))].map((a) => [
          a,
          instances.filter((i) => i.asset === a).length,
        ]),
      );
    check(
      id + '-shared-selection-one-history',
      painted.cursor === before.cursor + 1 &&
        painted.records.length === before.records.length + 1 &&
        record.values.terrain === vegetationSpec(id).preset.terrain,
      { preset: record.vegetation.preset, assets },
    );
    check(
      id + '-matching-assets',
      instances.length > 0 &&
        (id === 'marsh'
          ? instances.some((i) => i.asset === 'reed' && i.y < -20) &&
            instances.some((i) => i.asset === 'reed' && i.y > 0 && i.y < 40) &&
            instances.every((i) => i.y < 40 && (i.y < -20 || i.asset === 'reed'))
          : id === 'farmland'
            ? instances.every((i) => i.asset === 'crop') &&
              new Set(instances.map((i) => i.x)).size > 3 &&
              new Set(instances.map((i) => i.y)).size > 5
            : id === 'desert'
              ? instances.every((i) => i.asset === 'rock' || i.asset === 'shrub')
              : instances.some((i) => i.asset === 'oak')),
      { assets, instancesHash: hash(instances) },
    );
    check(
      id + '-ground-material',
      materialValues.some((m) =>
        id === 'marsh'
          ? m.reed[0] > 0
          : id === 'farmland'
            ? m.furrows[0] > 0
            : id === 'desert'
              ? m.debris[0] > 0
              : m.deciduous[0] > 0,
      ),
      { materialValues, shown },
    );
    if (id === 'marsh')
      check(
        'marsh-shallow-visible-deep-free-water-preserved',
        materialValues[0].water[0] === 0 &&
          materialValues[1].water[0] === 255 &&
          materialValues[2].water[0] === 255 &&
          materialValues[0].reed[0] > 0 &&
          materialValues[1].reed[0] > 0 &&
          materialValues[2].reed[0] === 0 &&
          materialValues[1].shrub[0] === 0 &&
          instances.every((i) => i.z === 30),
        { materialValues },
      );
    const paintedImage = await mapImageHash(),
      saved = canonical([record])[0];
    await native.capture(page, id + '-painted.png');
    check(id + '-visible-native-effect', paintedImage.sha256 !== beforeImage.sha256, {
      before: beforeImage,
      painted: paintedImage,
    });
    await history('undo');
    const undoImage = await mapImageHash();
    check(
      id + '-undo',
      query().cursor === before.cursor &&
        hash(canonical(query().records)) === hash(canonical(before.records)) &&
        undoImage.sha256 === beforeImage.sha256,
    );
    await history('redo');
    const redoImage = await mapImageHash();
    check(
      id + '-redo',
      hash(canonical(query().records.filter((r) => r.id === record.id))) === hash([saved]) &&
        hash((await sceneRead(readBox)).filter((i) => i.areaId === record.id)) ===
          hash(instances) &&
        redoImage.sha256 === paintedImage.sha256,
    );
    await native.close();
    await open();
    page = getPage();
    const freshImage = await mapImageHash();
    check(
      id + '-fresh',
      query().cursor === painted.cursor &&
        hash(canonical(query().records.filter((r) => r.id === record.id))) === hash([saved]) &&
        hash((await sceneRead(readBox)).filter((i) => i.areaId === record.id)) ===
          hash(instances) &&
        freshImage.sha256 === paintedImage.sha256,
      { redoImage, freshImage },
    );
    await native.capture(page, id + '-fresh.png');
    results.strokes.push({
      id,
      record,
      assets,
      instancesHash: hash(instances),
      beforeImage,
      paintedImage,
      undoImage,
      redoImage,
      freshImage,
    });
    await save();
  }
  if (marshOnly) return;
  // Targeted transitions use native wheel deltas observed by the parent, as in
  // point 1. The fine author areas remain physical when the world is shown.
  results.scaleViews = [];
  for (const target of [1.99, 2.01, 7.99, 8.01]) {
    native.mark('library transition ' + target + ' m/px');
    await zoomTo(target);
    const f = await frame();
    await native.capture(getPage(), 'transition-' + target + '.png');
    results.scaleViews.push({
      target,
      actualMpp: f.camera.metersPerPixel,
      kind: 'transition',
      camera: f.camera,
      tiles: f.tiles,
    });
    check('native-transition-' + target, Math.abs(f.camera.metersPerPixel / target - 1) < 1e-4);
  }
  async function scaleViews(spans) {
    const width = await getPage().evaluate(() => window.__qaRaster.surface.frame.width);
    for (const metres of spans) {
      const target = metres / width;
      native.mark('library scale ' + metres + ' m');
      await zoomTo(target, metres >= 100000 ? { x: 0, y: 0 } : { x: 174, y: 6 });
      const f = await frame();
      const label = 'view-' + metres + 'm';
      if (metres >= 100000) {
        const d = metres / 10,
          probes = [
            { x: -d, y: -d },
            { x: d, y: -d },
            { x: -d, y: d },
            { x: d, y: d },
          ];
        const material = await frame(probes),
          m = material.samples.map((s) => s.material);
        const colors = m.map((v) => v.baseColor.join(','));
        check(
          label + '-four-distinct-biome-surfaces',
          new Set(colors).size === 4 &&
            m[0].deciduous[0] > 100 &&
            m[1].reed[0] > 100 &&
            m[2].debris[0] > 0 &&
            m[3].furrows[0] > 100,
          { probes, material: m },
        );
      }

      await native.capture(getPage(), label + '.png');
      const layers = await getPage().evaluate(() =>
        window.__qaRaster.vegetation.batches.map((b) => ({ asset: b.asset, count: b.data.length })),
      );
      results.scaleViews.push({
        kind: 'span',
        metres,
        target,
        actualMpp: f.camera.metersPerPixel,
        actualSpanM: f.camera.metersPerPixel * width,
        camera: f.camera,
        tiles: f.tiles,
        layers,
      });
      check(
        label + '-physical-span',
        Math.abs((f.camera.metersPerPixel * width) / metres - 1) < 1e-4,
        { mpp: f.camera.metersPerPixel, width, layers },
      );
      await save();
    }
  }
  await scaleViews([10, 100, 1000]);
  // Synthetic region/world areas are fixture data, created while the app is
  // closed. They use the identical snapshots/generator/material/store boundary.
  await native.close();
  writeBiomeOverview({ fixture, fixtureStore, fixtureHeightRecord, vegetationSpec });
  await open();
  await scaleViews([100000, 1000000]);
}
