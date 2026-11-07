import { test } from 'node:test';
import assert from 'node:assert/strict';
import { buildSync } from '../helpers/build.mjs';
import { createRequire } from 'node:module';
import { mkdirSync, mkdtempSync, rmSync } from 'node:fs';
import { homedir } from 'node:os';
import { randomUUID } from 'node:crypto';
const require = createRequire(import.meta.url);
for (const [name, file] of [
  ['store', 'src/app/storage/store.ts'],
  ['service', 'desktop/atlas-region.ts'],
  ['worker', 'desktop/atlas-region-worker.ts'],
])
  buildSync({
    entryPoints: [file],
    outfile: '.build/color-service-' + name + '.cjs',
    bundle: true,
    platform: 'node',
    format: 'cjs',
    external: ['better-sqlite3'],
  });
buildSync({
  entryPoints: ['src/app/atlas/terrain-height.ts'],
  outfile: '.build/color-height.cjs',
  bundle: true,
  platform: 'node',
  format: 'cjs',
});
const { CampaignStore } = require('../../.build/color-service-store.cjs'),
  { AtlasRegionService } = require('../../.build/color-service-service.cjs'),
  { heightRecord } = require('../../.build/color-height.cjs');
for (const paintCount of [0, 12])
  test(`colour jobs with ${paintCount} pigment layers yield to selection, share pixels and reject stale revisions`, async (t) => {
    const base = homedir() + '/.cache/saltmarcher/tests';
    mkdirSync(base, { recursive: true });
    const dir = mkdtempSync(base + '/colour-worker-'),
      store = new CampaignStore(dir + '/world.sqlite'),
      campaign = store.create('Colour tiles'),
      token = store.activateShell(campaign.id).token,
      service = new AtlasRegionService(
        new URL('../../.build/color-service-worker.cjs', import.meta.url).pathname,
      );
    t.after(async () => {
      await service.close();
      store.close();
      rmSync(dir, { recursive: true, force: true });
    });
    store.executeAtlasCommit({
      campaignId: campaign.id,
      token,
      commandId: randomUUID(),
      action: {
        kind: 'landscape-put',
        expectedRevision: null,
        record: heightRecord(
          0,
          0,
          16,
          Float32Array.from({ length: 4096 }, (_, i) => 40 + 25 * Math.sin((i % 64) / 8)),
        ),
      },
    });
    const insert = store.db.prepare('INSERT INTO atlas_landscape VALUES(?,?,?,?,?,?,?,?)');
    for (let i = 0; i < paintCount; i++) {
      const record = {
        id: 'pigment' + i,
        revision: 1,
        kind: 'patch',
        name: '',
        width: 0,
        resolution: 1,
        order: i,
        points: [{ x: 0, y: 0 }],
        polygons: [
          {
            outer: [
              { x: 0, y: 0 },
              { x: 1024, y: 0 },
              { x: 1024, y: 1024 },
              { x: 0, y: 1024 },
            ],
            holes: [],
          },
        ],
        values: {},
        paint: {
          version: 2,
          operation: 'paint',
          target: 'ground',
          color: i % 2 ? '#967755' : '#778866',
          opacity: 0.15,
          flow: 1,
          tip: 'round',
          radius: 128,
          seed: i,
          fill: true,
        },
      };
      insert.run(campaign.id, record.id, 1, 0, 1024, 0, 1024, JSON.stringify(record));
    }
    const source = store.atlasRegionSource(token),
      box = { x: 0, y: 0, width: 256, height: 256 },
      q = {
        box,
        routeContext: box,
        width: 256,
        height: 256,
        displayMpp: 1,
        contours: 0,
        revision: source.revision,
        fence: source.fence,
      },
      order = [];
    const colour = service.terrainColor(source, q).then((value) => {
      order.push('colour');
      return value;
    });
    const selection = service
      .candidates(
        source,
        {
          box,
          width: 256,
          height: 256,
          scopeId: null,
          floorId: 'ground',
          slice: null,
          roofs: true,
        },
        { x: 30, y: 30 },
      )
      .then((value) => {
        order.push('selection');
        return value;
      });
    await selection;
    const value = await colour;
    assert.deepEqual(order, ['selection', 'colour']);
    assert.equal(value.grid, undefined);
    assert.equal(value.pixels.length, 256 * 256 * 4);
    assert(service.diagnostics.terrainYields > 0);
    const full = await service.terrain(store.atlasRegionSource(token, service.cursor), {
      view: {
        box,
        frame: box,
        columns: 33,
        rows: 33,
        focusM: 0,
        tilt: 45,
        rotation: 0,
        exaggeration: 1,
      },
      width: 256,
      height: 256,
      displayMpp: 1,
      contours: 0,
      revision: source.revision,
    });
    assert.deepEqual(value.pixels, full.pixels);
    assert.equal(service.diagnostics.workerStarts, 1);
    store.executeAtlasCommit({
      campaignId: campaign.id,
      token,
      commandId: randomUUID(),
      action: { kind: 'undo' },
    });
    await assert.rejects(service.terrainColor(source, q), /inzwischen geändert/);
    const next = store.atlasRegionSource(token, service.cursor),
      fresh = await service.terrainColor(next, {
        ...q,
        revision: next.revision,
        fence: next.fence,
      });
    assert.notDeepEqual(fresh.pixels, value.pixels);
  });
