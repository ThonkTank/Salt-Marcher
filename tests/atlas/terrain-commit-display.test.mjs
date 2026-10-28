import { atlasFixture, landscapeFixture } from '../helpers/atlas-workbench.mjs';
import { test } from 'node:test';
import assert from 'node:assert/strict';
import { buildSync } from 'esbuild';
import { createRequire } from 'node:module';
buildSync({
  stdin: {
    contents:
      "export * from './src/app/atlas/campaign-atlas-ui';export * from './src/app/atlas/atlas-landscape-ui';export * from './src/app/atlas/terrain-frame';export * from './src/app/atlas/atlas-surface-reuse';",
    resolveDir: process.cwd(),
  },
  outfile: '.build/terrain-commit-display-test.cjs',
  bundle: true,
  platform: 'node',
  format: 'cjs',
  external: ['obsidian'],
});
const {
  CampaignAtlasWorkbench,
  LandscapeWorkbench,
  terrainFrameDelta,
  applyTerrainFrame,
  reuseAtlasSurfaceTile,
} = createRequire(import.meta.url)('../../.build/terrain-commit-display-test.cjs');
test('released direct strokes retain their author fence while releasing camera input', () => {
  const ui = Object.assign(landscapeFixture(LandscapeWorkbench), {
    live: {},
    pointer: 7,
    saving: false,
    tool: 'height',
    points: [{ x: 0, y: 0 }],
    dirty: false,
    calibration: null,
  });
  assert.equal(ui.blocksNavigation(), true);
  assert.equal(ui.hasDraft(), true);
  ui.pointer = null;
  ui.saving = true;
  assert.equal(ui.blocksNavigation(), false);
  assert.equal(ui.hasDraft(), true);
  ui.live = null;
  assert.equal(ui.blocksNavigation(), true, 'ordinary unfinished author drafts stay protected');
  ui.saving = false;
  ui.points = [];
  assert.equal(ui.blocksNavigation(), false);
  ui.routeOpening = true;
  assert.equal(ui.blocksNavigation(), true);
  assert.equal(ui.blocksNavigation(false), false);
});
test('hand mode during released direct writes preserves the author owner and bypasses draft flush', async () => {
  let flushed = 0,
    synced = 0;
  const ui = Object.assign(atlasFixture(CampaignAtlasWorkbench), {
    root: { dataset: { family: 'terrain' } },
    landscape: {
      livePainting: true,
      blocksNavigation: () => false,
      setActive(active) {
        assert.equal(active, false);
      },
    },
    camera: { redrawOverlay() {} },
    flush: async () => {
      flushed++;
      return false;
    },
    layout: {
      sync() {
        synced++;
      },
    },
  });
  await ui.setNavigationMode(true);
  assert.equal(ui.root.dataset.panMode, 'true');
  assert.equal(ui.root.dataset.family, 'terrain');
  assert.equal(flushed, 0);
  assert.equal(synced, 1);
  ui.landscape.blocksNavigation = () => true;
  await ui.setNavigationMode(true);
  assert.equal(flushed, 1);
});
test('external refresh requests cannot read the full Atlas in the middle of a direct gesture', async () => {
  const ui = Object.assign(atlasFixture(CampaignAtlasWorkbench), {
    landscape: { livePainting: true },
    terrainPresentation: {},
  });
  assert.equal(await ui.refresh(), false);
  assert.equal(await ui.refresh(true), false);
});
test('save-state rendering retains the GPU brush scene until the gesture finishes', () => {
  const seen = [],
    sceneReached = Error('ordinary scene path');
  const ui = Object.assign(
    Object.assign(atlasFixture(CampaignAtlasWorkbench), { projection: { revision: 10 } }),
    {
      root: { hidden: false },
      owner: { token: 't' },
      landscape: { livePainting: true },
      terrainPresentation: {},
      spatial: { active: true },
      syncBrushSizes() {
        assert.fail('save-state updates must defer radius measurement to the shared frame');
      },
      renderPanel() {
        seen.push('panel');
      },
      renderTravel() {
        seen.push('travel');
      },
      layout: {
        sync() {
          seen.push('layout');
        },
      },
      territories: {
        sync() {
          seen.push('territories');
        },
      },
      camera: {
        redrawOverlay() {
          seen.push('overlay');
        },
        get view() {
          throw sceneReached;
        },
      },
    },
  );
  ui.render();
  assert.deepEqual(seen, ['overlay']);
  ui.landscape.livePainting = false;
  assert.throws(
    () => ui.render(),
    (e) => e === sceneReached,
    'ordinary edits must rebuild',
  );
});
test('commits advance author identity without relabelling the Atlas or awaiting display; finish refreshes once', async (t) => {
  const old = { document: global.document, window: global.window, CustomEvent: global.CustomEvent },
    status = { dataset: {} },
    shown = [];
  global.CustomEvent = class extends Event {
    constructor(name, options) {
      super(name);
      this.detail = options.detail;
    }
  };
  global.document = { getElementById: () => status, dispatchEvent() {} };
  let writes = 0,
    refreshes = 0,
    finishes = 0;
  global.window = {
    campaign: {
      executeAtlasCommit: async (c) => ({
        ok: true,
        value: {
          commandId: c.commandId,
          campaignId: 'c',
          revision: ++writes + 10,
          sourceFence: 'f' + writes,
          canUndo: true,
          canRedo: false,
        },
      }),
    },
  };
  t.after(() => Object.assign(global, old));
  const atlas = { revision: 10, region: { revision: 10, fence: 'original' } },
    owner = { token: 'token', campaign: { id: 'c' } };
  const ui = Object.assign(
    Object.assign(atlasFixture(CampaignAtlasWorkbench), { projection: atlas }),
    {
      owner,
      projection: atlas,
      svg: { dataset: {} },
      busy: false,
      opts: { status() {} },
      playback: { stop() {} },
      render() {},
      terrainPresentation: {
        update: (s) => shown.push(s),
        async finish() {
          finishes++;
        },
        stop() {},
      },
      spatial: { gesture() {}, pauseReads() {} },
      async refresh() {
        refreshes++;
      },
      error: (e) => {
        throw e;
      },
    },
  );
  const action = { kind: 'landscape-height-stroke', stroke: {} };
  const first = await ui.write(action, false, true, {
    id: 'g',
    expectedRevision: 10,
    sourceFence: 'original',
  });
  assert.equal(first.ack.revision, 11);
  assert.equal(ui.data, atlas);
  assert.equal(ui.data.region.revision, 10);
  assert.equal(refreshes, 0);
  const second = await ui.write(action, false, true, {
    id: 'g',
    expectedRevision: 11,
    sourceFence: 'f1',
  });
  assert.equal(second.ack.revision, 12);
  assert.deepEqual(ui.regions.authorSource, { revision: 12, fence: 'f2' });
  assert.equal(ui.data.revision, 10);
  assert.equal(ui.busy, false);
  ui.spatial.active = true;
  ui.spatial.reconcile = (revision, fence) => shown.push({ revision, fence });
  ui.strokeOwner = owner.token;
  ui.strokeQueue = {
    pending: false,
    failed: false,
    confirmedSource: { expectedRevision: 12, sourceFence: 'f2' },
  };
  await ui.terrainGesture(false);
  assert.deepEqual(shown, [{ revision: 12, fence: 'f2' }]);
  assert.equal(refreshes, 1);
});

test('a failed final display refresh releases the brush lock and preserves the saved-prefix status', async () => {
  const errors = [],
    messages = [],
    locks = [];
  let redraws = 0;
  const ui = Object.assign(landscapeFixture(LandscapeWorkbench), {
    token: 'finish-test',
    live: { hasCommittedChanges: true, async finish() {} },
    saving: false,
    points: [{ x: 0, y: 0 }],
    brushStrokes: [],
    endLiveInput() {},
    sampleLive() {},
    clearMask() {},
    disable: (value) => locks.push(value),
    say: (text) => messages.push(text),
    host: {
      terrainGesture: async () => {
        throw Error('Anzeige nicht erreichbar');
      },
      error: (e) => errors.push(e.message),
      redraw() {
        redraws++;
      },
    },
  });
  await ui.finishLive();
  assert.equal(ui.livePainting, false);
  assert.equal(ui.saving, false);
  assert.deepEqual(ui.points, []);
  assert.deepEqual(locks, [false]);
  assert.deepEqual(errors, ['Anzeige nicht erreichbar']);
  assert.match(messages[0], /Gespeicherte Änderungen bleiben/);
  assert.equal(redraws, 1);
});

test('confirmed head survives reload failure and requires explicit retry after an intervening source change', async (t) => {
  const old = { document: global.document, window: global.window, CustomEvent: global.CustomEvent };
  const status = { dataset: {} },
    commands = [],
    resolutions = [],
    shown = [],
    errors = [];
  global.CustomEvent = class extends Event {
    constructor(name, options) {
      super(name);
      this.detail = options.detail;
    }
  };
  global.document = { getElementById: () => status, dispatchEvent() {} };
  let sourceReads = 0,
    released = 0;
  global.window = {
    campaign: {
      executeAtlasCommit: async (c) => {
        commands.push(structuredClone(c));
        return commands.length === 1
          ? { ok: false, error: 'Lost answer', errorKind: 'store-outcome-unknown' }
          : {
              ok: true,
              value: {
                commandId: c.commandId,
                campaignId: 'held-c',
                revision: c.terrainStroke.expectedRevision + 1,
                sourceFence: 'canonical-' + (c.terrainStroke.expectedRevision + 1),
                canUndo: true,
                canRedo: false,
              },
            };
      },
      reconcileAtlasCommit: async (c) => {
        resolutions.push(structuredClone(c));
        return {
          ok: true,
          value: {
            outcome: 'applied',
            ack: {
              commandId: c.commandId,
              campaignId: 'held-c',
              revision: 11,
              sourceFence: 'canonical-11',
              canUndo: true,
              canRedo: false,
            },
          },
        };
      },
      atlasTerrainSource: async () =>
        ++sourceReads === 1
          ? { ok: false, error: 'Controlled source read failure' }
          : { ok: true, value: { revision: 11, fence: 'canonical-11' } },
    },
  };
  t.after(() => Object.assign(global, old));
  const owner = { token: 'held-source-token', campaign: { id: 'held-c' } },
    atlas = { revision: 10, region: { revision: 10, fence: 'base' } };
  const ui = Object.assign(atlasFixture(CampaignAtlasWorkbench), {
    owner,
    terrainRecovery: { schedule() {}, stop() {} },
    automaticRetries: new Set(),
    automaticRetryHead: null,
    svg: { dataset: {} },
    projection: atlas,
    opts: { status() {} },
    render() {},
    error: (e) => errors.push(e.message),
    landscape: {
      livePainting: false,
      releaseHeld() {
        released++;
      },
    },
    spatial: {
      active: true,
      pauseReads() {},
      reconcile: (revision, fence) => shown.push({ revision, fence }),
    },
    async refresh() {
      return true;
    },
  });
  ui.journey.invalidatePreview = () => {};
  const action = {
    kind: 'landscape-height-stroke',
    stroke: {
      samples: [
        { x: 0, y: 0, t: 0 },
        { x: 1, y: 0, t: 100 },
      ],
    },
  };
  const failed = assert.rejects(ui.enqueueRasterStroke(action, 'held-first'), /Lost answer/);
  let completed = false;
  const dependent = ui.enqueueRasterStroke(action, 'held-second').then(() => {
    completed = true;
  });
  await failed;
  await assert.rejects(ui.strokeQueue.finish());
  assert.equal(await ui.flush(), false);
  assert.throws(
    () => ui.activate({ token: 'different', campaign: { id: 'other' } }),
    /vor dem Kampagnenwechsel klären/,
  );
  assert.equal(ui.owner, owner);
  await ui.continueTerrainQueue();
  assert.equal(ui.strokeQueue.failureKind, 'source');
  assert.equal(ui.strokeQueue.pending, 1);
  assert.equal(ui.strokeQueue.head.id, 'held-second');
  assert.equal(completed, false);
  assert.equal(commands.length, 1);
  assert.equal(resolutions.length, 1);
  assert.deepEqual(
    errors,
    [],
    'uncertain saves remain an unobtrusive status, without an error dialog',
  );
  assert.equal(await ui.flush(), false);
  assert.equal(
    await ui.write({ kind: 'landscape-sea-level', seaLevelM: 3 }),
    null,
    'sea settings cannot overtake held terrain',
  );
  global.window.campaign.atlasTerrainSource = async () => ({
    ok: true,
    value: { revision: 12, fence: 'canonical-12' },
  });
  await ui.continueTerrainQueue();
  assert.equal(
    ui.strokeQueue.failureKind,
    'rejected',
    'confirmed original is safe; unsent successors need an explicit choice on the changed source',
  );
  assert.equal(ui.strokeQueue.pending, 1);
  assert.equal(commands.length, 1, 'source change cannot silently replay a successor');
  assert.equal(await ui.write({ kind: 'landscape-sea-level', seaLevelM: 3 }), null);
  await ui.continueTerrainQueue(true);
  await dependent;
  assert.equal(ui.strokeQueue.pending, 0);
  assert.equal(commands.length, 2);
  assert.deepEqual(
    commands.map((c) => c.commandId),
    ['held-first', 'held-second'],
  );
  assert.equal(commands[1].sourceFence, 'canonical-12');
  assert.equal(commands[1].terrainStroke.expectedRevision, 12);
  assert.equal(resolutions.length, 1, 'failed read cannot replay receipt lookup or original write');
  assert.equal(released, 1);
  assert(shown.some((s) => s.revision === 13 && s.fence === 'canonical-13'));
});

test('an unchanged display adopts the new author snapshot through delta frames and buffer reuse', () => {
  const view = { columns: 2, rows: 2, box: { x: 0, y: 0, width: 1, height: 1 } },
    author = { revision: 1, fence: 'one', pixel: 1, radius: 32, box: view.box, records: [] },
    grid = {
      view,
      seaLevelM: 0,
      heights: new Float32Array(4),
      editing: { ground: new Float32Array(4), water: new Float32Array(4), author },
    },
    before = {
      kind: 'full',
      view: 'tilted',
      target: { key: 'view', revision: 1, fence: 'one' },
      invalidation: { bounds: [], reset: false },
      projection: { grid, pixels: new Uint8Array(16), width: 2, height: 2 },
    },
    after = structuredClone(before);
  after.target = { key: 'view', revision: 2, fence: 'two' };
  after.projection.grid.editing.author = {
    ...author,
    revision: 2,
    fence: 'two',
    pixel: 2,
    radius: 64,
    records: [{ id: 'fine', height: { data: 'new' } }],
  };
  const delta = terrainFrameDelta(before, after, before.target),
    adopted = applyTerrainFrame(before, delta);
  assert.equal(delta.kind, 'delta');
  assert.equal(delta.heights.length, 0);
  assert.deepEqual(adopted.projection.grid.editing.author, after.projection.grid.editing.author);
  const tile = (p) => ({
    tile: { lod: 0, x: 0, y: 0 },
    revision: p.grid.editing.author.revision,
    fence: p.grid.editing.author.fence,
    terrain: { projection: p },
    material: { channels: {} },
  });
  const reused = reuseAtlasSurfaceTile(tile(before.projection), tile(adopted.projection));
  assert.equal(reused.terrain.projection.grid.heights, grid.heights);
  assert.equal(reused.terrain.projection.grid.editing.ground, grid.editing.ground);
  assert.deepEqual(
    reused.terrain.projection.grid.editing.author,
    after.projection.grid.editing.author,
  );
  assert.equal(before.projection.grid.editing.author.revision, 1);
});
