import assert from 'node:assert/strict';
import { createHash } from 'node:crypto';
import { createReadStream, createWriteStream } from 'node:fs';
import { readFile, stat, writeFile } from 'node:fs/promises';
import { createGunzip } from 'node:zlib';
import { pipeline } from 'node:stream/promises';
import { createRequire } from 'node:module';
import path from 'node:path';
import { createNativeSession } from './native-session.mjs';

const root = process.cwd(),
  require = createRequire(root + '/package.json');
const Database = require('better-sqlite3');
const output = path.resolve(
  process.env.QA_EVIDENCE_DIR ?? '.build/atlas-material-stream-native',
  `${Date.now()}-${process.pid}`,
);
const native = await createNativeSession({ root, output, name: 'atlas-material-stream' });
const fixtureGzip = path.join(root, 'tests/fixtures/atlas/mixed-world.sqlite.gz');
const databasePath = path.join(native.profile, 'workbench.sqlite');
const frozenFixture = {
  sha256: '19d4edc88b50d8074578a5c40c870a50331fec1c78a7a8b4f4feee5d463fdb12',
  bytes: 225546240,
  compressedBytes: 40236558,
};
const files = [
  'src/app/atlas/atlas-material-tile-stream.ts',
  'src/app/atlas/atlas-raster-tile-stream.ts',
  'src/app/atlas/atlas-tile-stream.ts',
  'src/app/atlas/atlas-deck-runtime.ts',
  'src/app/atlas/atlas-material-tile.ts',
  'src/app/storage/atlas-material-tiles.ts',
  'desktop/main.ts',
  'desktop/preload.ts',
  'tools/test-desktop-atlas-material-stream.mjs',
  '.build/desktop/main.cjs',
  '.build/desktop/preload.cjs',
  '.build/desktop/atlas-region-worker.cjs',
  '.build/desktop/ui/atlas-deck-runtime.js',
];
const hashFile = async (file) =>
  createHash('sha256')
    .update(await readFile(path.join(root, file)))
    .digest('hex');
const hashes = async () =>
  Object.fromEntries(await Promise.all(files.map(async (file) => [file, await hashFile(file)])));
const hashStream = async (file) => {
  const hash = createHash('sha256');
  for await (const chunk of createReadStream(file)) hash.update(chunk);
  return hash.digest('hex');
};
const canonicalTables = [
  'campaign_atlas',
  'atlas_binding',
  'atlas_landscape',
  'room_group',
  'room',
  'drawing_element',
  'scope',
  'drawing_floor',
  'city_document',
  'location',
  'location_map',
  'world_record',
];
function canonicalSnapshot(campaignId) {
  const db = new Database(databasePath, { readonly: true }),
    hash = createHash('sha256');
  try {
    const revision = db
      .prepare('SELECT revision FROM campaign_atlas WHERE campaign_id=?')
      .get(campaignId)?.revision;
    assert(Number.isSafeInteger(revision), 'The frozen campaign must have an Atlas revision');
    for (const table of canonicalTables) {
      if (!db.prepare("SELECT 1 FROM sqlite_master WHERE type='table' AND name=?").get(table))
        continue;
      const columns = db.pragma(`table_info("${table}")`),
        primaryKey = columns.filter((column) => column.pk > 0).sort((a, b) => a.pk - b.pk);
      const order = primaryKey.length
        ? primaryKey.map((column) => `"${column.name.replaceAll('"', '""')}"`).join(',')
        : 'rowid';
      let count = 0;
      for (const row of db
        .prepare(`SELECT * FROM "${table}" WHERE campaign_id=? ORDER BY ${order}`)
        .iterate(campaignId)) {
        hash.update(JSON.stringify(row));
        hash.update('\n');
        count++;
      }
      hash.update(`${table}:${count}\n`);
    }
    return { sha256: hash.digest('hex'), atlasRevision: revision };
  } finally {
    db.close();
  }
}
const tileKey = (tile) => `${tile.lod}/${tile.x}/${tile.y}`;
const tileBounds = (tile) => {
  const size = 256 * 2 ** tile.lod;
  return {
    left: tile.x * size,
    top: tile.y * size,
    right: (tile.x + 1) * size,
    bottom: (tile.y + 1) * size,
  };
};
function assertNoOverlap(tiles) {
  const bounds = tiles.map(tileBounds);
  for (let i = 0; i < bounds.length; i++)
    for (let j = i + 1; j < bounds.length; j++) {
      const a = bounds[i],
        b = bounds[j],
        overlap =
          Math.max(a.left, b.left) < Math.min(a.right, b.right) &&
          Math.max(a.top, b.top) < Math.min(a.bottom, b.bottom);
      assert.equal(
        overlap,
        false,
        `Visible parent/child material tiles overlap: ${tileKey(tiles[i])} and ${tileKey(tiles[j])}`,
      );
    }
}
// Run entirely in the renderer: only summaries and hashes cross Playwright.
// Keeping typed buffers here avoids serialization changing their representation.
async function startProbe({ campaignId, holdDetail }) {
  const unwrap = (result) => {
    if (!result.ok) throw Error(JSON.stringify(result));
    return result.value;
  };
  const active = unwrap(await window.campaign.activate(campaignId)),
    revision = unwrap(await window.campaign.atlasTerrainSource(active.token)).revision;
  const first = unwrap(
    await window.campaign.atlasMaterialTile(active.token, {
      tile: { lod: 2, x: 0, y: 0 },
      revision,
    }),
  );
  const { AtlasMaterialTileStream } = await import('campaign://app/atlas-deck-runtime.js');
  const panel = document.createElement('div');
  panel.id = 'material-stream-probe';
  Object.assign(panel.style, {
    position: 'fixed',
    inset: '0',
    zIndex: '2147483647',
    background: '#dce2df',
    padding: '18px',
    color: '#26313a',
    font: '600 16px sans-serif',
  });
  const title = document.createElement('div');
  title.textContent = 'Atlas · Rohmaterial-Kachelstrom · technische Prüfung';
  const viewport = document.createElement('div');
  viewport.id = 'stage';
  Object.assign(viewport.style, {
    position: 'relative',
    marginTop: '24px',
    width: '512px',
    height: '512px',
    overflow: 'hidden',
  });
  panel.append(title, viewport);
  document.body.append(panel);
  const state = {
    stream: new AtlasMaterialTileStream(),
    revision,
    source: first.fence,
    token: active.token,
    frames: [],
    calls: [],
    last: null,
    paused: false,
    error: null,
    initialCache: first.cache,
  };
  const stage = document.getElementById('stage');
  let release;
  const gate = new Promise((resolve) => (release = resolve));
  state.resume = release;
  state.publish = (frame) => {
    state.last = frame;
    stage.replaceChildren();
    for (const value of frame.tiles) {
      const { tile, width, height, channels } = value,
        canvas = document.createElement('canvas');
      canvas.width = width;
      canvas.height = height;
      const context = canvas.getContext('2d'),
        image = context.createImageData(width, height);
      image.data.set(channels.baseColor);
      context.putImageData(image, 0, 0);
      const size = 256 * 2 ** tile.lod;
      Object.assign(canvas.style, {
        position: 'absolute',
        left: `${tile.x * size}px`,
        top: `${tile.y * size}px`,
        width: `${size}px`,
        height: `${size}px`,
        imageRendering: 'pixelated',
      });
      stage.append(canvas);
    }
    const canvas = stage.querySelector('canvas');
    let opaque = 0;
    if (canvas) {
      const pixels = canvas.getContext('2d').getImageData(0, 0, canvas.width, canvas.height).data;
      for (let i = 3; i < pixels.length; i += 4) if (pixels[i]) opaque++;
    }
    state.frames.push({
      generation: frame.generation,
      complete: frame.complete,
      tiles: frame.tiles.map((value) => value.tile),
      opaqueFirstTilePixels: opaque,
    });
  };
  state.fetch = async (request) => {
    if (holdDetail && request.tile.lod === 0 && !state.paused) {
      state.paused = true;
      await gate;
    }
    const value = unwrap(await window.campaign.atlasMaterialTile(state.token, request));
    state.calls.push({ tile: request.tile, cache: value.cache });
    return value;
  };
  state.input = (mpp) => ({
    box: { x: 0, y: 0, width: 512, height: 512 },
    metersPerPixel: mpp,
    revision: state.revision,
    source: state.source,
  });
  state.summary = async () => {
    const hashes = {};
    for (const value of state.last.tiles) {
      const key = `${value.tile.lod}/${value.tile.x}/${value.tile.y}`;
      hashes[key] = {};
      for (const [name, bytes] of Object.entries(value.channels)) {
        const digest = await crypto.subtle.digest('SHA-256', bytes);
        hashes[key][name] = Array.from(new Uint8Array(digest), (byte) =>
          byte.toString(16).padStart(2, '0'),
        ).join('');
      }
    }
    return {
      revision: state.revision,
      frames: state.frames,
      calls: state.calls,
      hashes,
      initialCache: state.initialCache,
      error: state.error,
    };
  };
  window.__materialStream = state;
  state.done = state.stream.load(state.input(1), state.fetch, state.publish).catch((error) => {
    state.error = error.stack ?? String(error);
  });
  return { revision, source: state.source };
}
function verifyFrames(run) {
  assert.equal(run.error, null);
  for (const frame of run.frames) assertNoOverlap(frame.tiles);
  const last = run.frames.at(-1);
  assert(last.complete);
  assert.equal(last.tiles.length, 4);
  assert(last.tiles.every((tile) => tile.lod === 0));
  assert.equal(new Set(last.tiles.map(tileKey)).size, 4);
  assert(
    run.frames.some(
      (frame) =>
        frame.tiles.length === 1 && frame.tiles[0].lod === 2 && frame.opaqueFirstTilePixels > 0,
    ),
  );
}
try {
  const compressed = await stat(fixtureGzip);
  assert.equal(compressed.size, frozenFixture.compressedBytes);
  await pipeline(
    createReadStream(fixtureGzip),
    createGunzip(),
    createWriteStream(databasePath, { flags: 'wx' }),
  );
  const sourceHash = await hashStream(databasePath),
    sourceBytes = (await stat(databasePath)).size;
  assert.equal(sourceHash, frozenFixture.sha256);
  assert.equal(sourceBytes, frozenFixture.bytes);
  const db = new Database(databasePath, { readonly: true }),
    campaign = db.prepare('SELECT id,name FROM campaign ORDER BY rowid LIMIT 1').get();
  const inventory = {
    roomGroups: db.prepare('SELECT count(*) n FROM room_group WHERE campaign_id=?').get(campaign.id)
      .n,
    rooms: db.prepare('SELECT count(*) n FROM room WHERE campaign_id=?').get(campaign.id).n,
  };
  db.close();
  assert(inventory.roomGroups >= 5000 && inventory.rooms >= 4000);
  const before = await hashes(),
    canonicalBefore = canonicalSnapshot(campaign.id),
    errors = [];
  let page = await native.launch();
  page.on('pageerror', (error) => errors.push(error.stack ?? String(error)));
  await page.evaluate(startProbe, { campaignId: campaign.id, holdDetail: true });
  await page.waitForFunction(
    () => window.__materialStream.paused || window.__materialStream.error,
    null,
    { timeout: 30000 },
  );
  const held = await page.evaluate(() => ({
    frames: window.__materialStream.frames,
    error: window.__materialStream.error,
  }));
  assert.equal(held.error, null);
  assert.deepEqual(held.frames.at(-1).tiles, [{ lod: 2, x: 0, y: 0 }]);
  assert(held.frames.at(-1).opaqueFirstTilePixels > 0);
  const extent = await page.locator('#stage').boundingBox();
  assert.equal(extent.width, 512);
  assert.equal(extent.height, 512);
  await native.capture(page, 'parent-before-detail.png');
  await page.evaluate(() => window.__materialStream.resume());
  await page.evaluate(() => window.__materialStream.done);
  const cold = await page.evaluate(() => window.__materialStream.summary());
  verifyFrames(cold);
  assert.equal(
    cold.frames.at(-1).generation,
    held.frames.at(-1).generation,
    'refinement stays inside the same camera generation',
  );
  await native.capture(page, 'detail-complete.png');
  const coarse = await page.evaluate(async () => {
    const s = window.__materialStream,
      before = s.calls.length;
    await s.stream.load(s.input(4), s.fetch, s.publish);
    return { requests: s.calls.slice(before), frame: s.frames.at(-1) };
  });
  assert.deepEqual(
    coarse.requests.map((call) => call.tile),
    [{ lod: 4, x: 0, y: 0 }],
  );
  assert.deepEqual(coarse.frame.tiles, [{ lod: 2, x: 0, y: 0 }]);
  assert(coarse.frame.complete);
  await native.capture(page, 'coarse-revisit.png');
  await page.evaluate(() => window.__materialStream.stream.dispose());
  await native.close();
  page = await native.launch();
  page.on('pageerror', (error) => errors.push(error.stack ?? String(error)));
  await page.evaluate(startProbe, { campaignId: campaign.id, holdDetail: false });
  await page.evaluate(() => window.__materialStream.done);
  const warm = await page.evaluate(() => window.__materialStream.summary());
  verifyFrames(warm);
  assert.equal(warm.revision, cold.revision);
  assert.equal(warm.calls.length, 5);
  assert(warm.calls.every((call) => Object.values(call.cache).every((state) => state === 'hit')));
  assert.deepEqual(warm.hashes, cold.hashes);
  await native.capture(page, 'fresh-process-detail.png');
  await page.evaluate(() => window.__materialStream.stream.dispose());
  const after = await hashes(),
    canonicalAfter = canonicalSnapshot(campaign.id);
  assert.deepEqual(canonicalAfter, canonicalBefore);
  assert.deepEqual(after, before);
  assert.deepEqual(errors, []);
  await native.close();
  await native.finish({
    complete: true,
    scope:
      'Native raw-material publication and persistent reuse on full M0 source. Coarse baseColor remains visible while detail is gated; four children replace it atomically; coarse revisit reuses its detail; fresh process reuses all five channels. Not GPU composition, conservation of coverage across LODs, normal Atlas or full M2 acceptance.',
    fixture: { sha256: sourceHash, bytes: sourceBytes, campaign, inventory },
    cold,
    coarse,
    warm,
    canonical: { before: canonicalBefore, after: canonicalAfter },
    errors,
    hashes: { before, after },
  });
  console.log(JSON.stringify({ complete: true, output }));
} catch (error) {
  if (native.app) {
    const bytes = await native.app.evaluate(async ({ BrowserWindow }) =>
      (
        await BrowserWindow.getAllWindows()
          .find((w) => w.webContents.getURL().endsWith('/index.html'))
          .webContents.capturePage()
      ).toPNG(),
    );
    await writeFile(path.join(output, 'diagnostic-capture.png'), Buffer.from(bytes));
    const debug = await (
      await native.app.firstWindow()
    ).evaluate(() => {
      const panel = document.getElementById('material-stream-probe'),
        stage = document.getElementById('stage');
      return {
        panel: panel?.getBoundingClientRect().toJSON(),
        stage: stage?.getBoundingClientRect().toJSON(),
        bodyText: document.body.innerText.slice(-300),
        state: window.__materialStream?.frames,
        foreground: document.elementFromPoint(50, 50)?.outerHTML.slice(0, 400),
        style: panel
          ? {
              display: getComputedStyle(panel).display,
              visibility: getComputedStyle(panel).visibility,
              opacity: getComputedStyle(panel).opacity,
            }
          : null,
      };
    });
    await writeFile(path.join(output, 'diagnostic.json'), JSON.stringify(debug, null, 2));
  }
  await native.fail(error);
  throw error;
} finally {
  await native.dispose();
}
