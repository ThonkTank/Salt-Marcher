import { test } from 'node:test';
import assert from 'node:assert/strict';
import { randomUUID } from 'node:crypto';
import { createRequire } from 'node:module';
import { build, buildSync } from '../helpers/build.mjs';
import { parseHTML } from '../helpers/dom.mjs';
import { copyFileSync, mkdirSync, mkdtempSync, readFileSync, rmSync } from 'node:fs';
import path from 'node:path';
import { tmpdir } from 'node:os';
buildSync({
  entryPoints: ['src/app/storage/store.ts'],
  outfile: '.build/atlas-commit-recovery-store.cjs',
  bundle: true,
  platform: 'node',
  format: 'cjs',
  external: ['better-sqlite3'],
});
buildSync({
  stdin: {
    contents:
      "export {AtlasWriteActivity} from './desktop/atlas-write-activity';export * from './src/app/atlas/campaign-atlas-author';",
    resolveDir: process.cwd(),
  },
  outfile: '.build/atlas-commit-recovery-client.cjs',
  bundle: true,
  platform: 'node',
  format: 'cjs',
});
const require = createRequire(import.meta.url),
  { CampaignStore } = require('../../.build/atlas-commit-recovery-store.cjs'),
  { AtlasWriteActivity, ...author } = require('../../.build/atlas-commit-recovery-client.cjs');
function fixture(t) {
  const store = new CampaignStore(':memory:'),
    cam = store.create('Recovery'),
    w = store.activate(cam.id),
    activity = new AtlasWriteActivity(),
    dom = parseHTML(
      '<html><body><textarea id="draft">Unveröffentlichter Entwurf</textarea></body></html>',
    );
  const before = {
    window: globalThis.window,
    document: globalThis.document,
    Event: globalThis.Event,
    CustomEvent: globalThis.CustomEvent,
  };
  Object.assign(globalThis, {
    window: dom.window,
    document: dom.document,
    Event: dom.window.Event,
    CustomEvent: dom.window.CustomEvent,
  });
  t.after(() => {
    Object.assign(globalThis, before);
    store.close();
  });
  const command = () => ({
      commandId: randomUUID(),
      campaignId: cam.id,
      token: w.token,
      action: { kind: 'city-create', name: 'Neu', x: 0, y: 0, width: 200, height: 200 },
    }),
    calls = { writes: 0, checks: 0 };
  window.campaign = {
    executeAtlasCommit: async (c) =>
      activity.run(c.commandId, () => {
        calls.writes++;
        try {
          return { ok: true, value: store.executeAtlasCommit(c) };
        } catch (e) {
          return { ok: false, error: e.message };
        }
      }),
    reconcileAtlasCommit: async (c) => {
      calls.checks++;
      try {
        return { ok: true, value: store.reconcileAtlasCommit(c, activity.has(c.commandId)) };
      } catch (e) {
        return { ok: false, error: e.message };
      }
    },
  };
  return {
    store,
    cam,
    w,
    activity,
    command,
    calls,
    api: window.campaign,
    draft: () => document.getElementById('draft').value,
  };
}
test('unknown write followed by confirmed rejection unlocks without replay and retains input', async (t) => {
  const x = fixture(t),
    c = x.command(),
    write = x.api.executeAtlasCommit;
  x.api.executeAtlasCommit = async () => {
    throw Error('Antwortverlust vor Anwendung');
  };
  assert.equal((await author.writeAtlasCommit(c)).ok, false);
  assert.deepEqual(author.pendingAtlasWrite(c.token), c);
  // A retry would be rejected; status inspection must not execute even a rejected command.
  x.api.executeAtlasCommit = async () => {
    x.calls.writes++;
    return { ok: false, error: 'Konflikt: Ausgangsstand veraltet' };
  };
  const bytes = x.store.db.serialize();
  const recovered = await author.recoverAtlasCommit(c.token);
  assert.equal(recovered.ok, false);
  assert.match(recovered.error, /nicht gespeichert/);
  assert.equal(author.pendingAtlasWrite(c.token), null);
  assert.equal(x.calls.writes, 0);
  assert.deepEqual(x.store.db.serialize(), bytes);
  assert.equal(x.draft(), 'Unveröffentlichter Entwurf');
  x.api.executeAtlasCommit = write;
  assert.equal((await author.writeAtlasCommit(x.command())).ok, true);
});
test('lost post-commit acknowledgement resolves by receipt without rerunning the command', async (t) => {
  const x = fixture(t),
    c = x.command(),
    write = x.api.executeAtlasCommit;
  x.api.executeAtlasCommit = async (command) => {
    await write(command);
    throw Error('Antwortverlust nach Commit');
  };
  assert.equal((await author.writeAtlasCommit(c)).ok, false);
  const bytes = x.store.db.serialize(),
    recovered = await author.recoverAtlasCommit(c.token);
  assert.equal(recovered.ok, true);
  assert.equal(recovered.value.commandId, c.commandId);
  assert.equal(author.pendingAtlasWrite(c.token), null);
  assert.equal(x.calls.writes, 1);
  assert.deepEqual(x.store.db.serialize(), bytes);
});
test('recovery keeps unknown state during asynchronous preparation, then resolves its receipt', async (t) => {
  const x = fixture(t),
    c = x.command();
  let release, task;
  const gate = new Promise((resolve) => (release = resolve));
  x.api.executeAtlasCommit = async (command) => {
    task = x.activity.run(command.commandId, async () => {
      await gate;
      x.store.executeAtlasCommit(command);
    });
    throw Error('Transport beendet, Main arbeitet weiter');
  };
  await author.writeAtlasCommit(c);
  assert.equal(x.activity.has(c.commandId), true);
  const response = await author.recoverAtlasCommit(c.token);
  assert.equal(response.ok, false);
  assert.match(response.error, /läuft noch/);
  assert.deepEqual(author.pendingAtlasWrite(c.token), c);
  release();
  await task;
  assert.equal(x.activity.has(c.commandId), false);
  assert.equal((await author.recoverAtlasCommit(c.token)).ok, true);
  assert.equal(author.pendingAtlasWrite(c.token), null);
});
test('failed, unavailable, mismatched and transport-lost status never clear the pending command', async (t) => {
  const x = fixture(t),
    c = x.command();
  x.api.executeAtlasCommit = async () => {
    throw Error('Antwortverlust');
  };
  await author.writeAtlasCommit(c);
  const read = x.api.reconcileAtlasCommit;
  for (const check of [
    async () => ({ ok: false, error: 'Lesefehler' }),
    async () => {
      throw Error('Statusantwort verloren');
    },
  ]) {
    x.api.reconcileAtlasCommit = check;
    assert.equal((await author.recoverAtlasCommit(c.token)).ok, false);
    assert.deepEqual(author.pendingAtlasWrite(c.token), c);
  }
  x.store.executeAtlasCommit({ ...c, action: { ...c.action, name: 'Andere Verwendung' } });
  x.api.reconcileAtlasCommit = read;
  const response = await author.recoverAtlasCommit(c.token);
  assert.equal(response.ok, false);
  assert.match(response.error, /anders verwendet/);
  assert.deepEqual(author.pendingAtlasWrite(c.token), c);
});
test('activity keeps concurrent invocations pending until every invocation settles, including rejection', async () => {
  const activity = new AtlasWriteActivity();
  let releaseA, releaseB;
  const a = activity.run('same', () => new Promise((resolve) => (releaseA = resolve))),
    b = activity.run('same', () => new Promise((_, reject) => (releaseB = reject)));
  assert(activity.has('same'));
  releaseA();
  await a;
  assert(activity.has('same'));
  releaseB(Error('Nicht gespeichert'));
  await assert.rejects(b);
  assert.equal(activity.has('same'), false);
  await assert.rejects(
    activity.run('sync', () => {
      throw Error('Synchron abgelehnt');
    }),
  );
  assert.equal(activity.has('sync'), false);
});
test('receipt inspection binds exact identity and payload and does not run post-commit presentation reads', (t) => {
  const x = fixture(t),
    c = x.command();
  assert.deepEqual(x.store.reconcileAtlasCommit(c), { outcome: 'not-applied' });
  x.store.executeAtlasCommit(c);
  const bytes = x.store.db.serialize();
  x.store.atlasRegionSource = () => {
    throw Error('Darstellung nicht verfügbar');
  };
  assert.equal(x.store.reconcileAtlasCommit(c).outcome, 'applied');
  assert.deepEqual(x.store.db.serialize(), bytes);
  assert.throws(
    () => x.store.reconcileAtlasCommit({ ...c, action: { ...c.action, name: 'Geändert' } }),
    /anders verwendet/,
  );
  assert.throws(() => x.store.reconcileAtlasCommit({ ...c, token: 'stale' }));
  assert.deepEqual(x.store.reconcileAtlasCommit({ ...c, commandId: randomUUID() }, true), {
    outcome: 'unknown',
  });
});

const boundaryRoot = path.resolve('.build/atlas-commit-boundary');
mkdirSync(path.join(boundaryRoot, 'catalog'), { recursive: true });
copyFileSync(
  'src/features/catalog/data/srd-5.1.generated.json',
  path.join(boundaryRoot, 'catalog/srd-5.1.generated.json'),
);
await build({
  stdin: {
    resolveDir: process.cwd(),
    contents: `export {HostIpc} from './desktop/host-ipc';
export {registerAtlasHost} from './desktop/atlas-host';
export {StoreClient} from './desktop/store-client';
export {TerrainStrokeQueue} from './src/app/atlas/terrain-stroke-queue';
export * from './src/app/atlas/campaign-atlas-author';`,
  },
  outfile: path.join(boundaryRoot, 'host.cjs'),
  bundle: true,
  platform: 'node',
  format: 'cjs',
  external: ['better-sqlite3'],
  plugins: [
    {
      name: 'electron-transport',
      setup(b) {
        b.onResolve({ filter: /^electron$/ }, () => ({ path: 'electron', namespace: 'boundary' }));
        b.onLoad({ filter: /.*/, namespace: 'boundary' }, () => ({
          contents: 'module.exports=globalThis.__atlasBoundaryElectron',
        }));
      },
    },
  ],
});
await build({
  entryPoints: ['desktop/preload.ts'],
  outfile: path.join(boundaryRoot, 'preload.cjs'),
  bundle: true,
  platform: 'node',
  format: 'cjs',
  external: ['electron'],
  plugins: [
    {
      name: 'electron-preload',
      setup(b) {
        b.onResolve({ filter: /^electron$/ }, () => ({ path: 'electron', namespace: 'boundary' }));
        b.onLoad({ filter: /.*/, namespace: 'boundary' }, () => ({
          contents: 'module.exports=globalThis.__atlasBoundaryElectron',
        }));
      },
    },
  ],
});
buildSync({
  entryPoints: ['desktop/atlas-region-worker.ts'],
  outfile: path.join(boundaryRoot, 'atlas-region-worker.cjs'),
  bundle: true,
  platform: 'node',
  format: 'cjs',
  external: ['better-sqlite3'],
});
for (const fault of ['projection', 'encoding'])
  buildSync({
    stdin: {
      resolveDir: process.cwd(),
      contents: `import {CampaignStore} from './src/app/storage/store';
import {appendFileSync} from 'node:fs';
import {workerData} from 'node:worker_threads';
let command, used=false;
const execute=CampaignStore.prototype.executeAtlasCommit;
CampaignStore.prototype.executeAtlasCommit=function(c,...args){
 command=c;
 try{
  const result=execute.call(this,c,...args);
  if(${JSON.stringify(fault)}==='encoding'&&!used){used=true;result.untransferable=()=>{};}
  return result;
 }finally{command=undefined;}
};
const source=CampaignStore.prototype.atlasRegionSource;
CampaignStore.prototype.atlasRegionSource=function(...args){
 const receipt=command&&this.db.prepare('SELECT 1 FROM atlas_receipt WHERE command_id=?').get(command.commandId);
 if(${JSON.stringify(fault)}==='projection'&&!used&&receipt&&!this.db.inTransaction){
  used=true;appendFileSync(workerData.filename+'.fault',JSON.stringify({commandId:command.commandId,receipt:!!receipt,inTransaction:this.db.inTransaction}));
  throw Error('Controlled postcommit source read failure');
 }
 return source.apply(this,args);
};
require('./desktop/store-worker');`,
    },
    outfile: path.join(boundaryRoot, fault + '.cjs'),
    bundle: true,
    platform: 'node',
    format: 'cjs',
    external: ['better-sqlite3'],
  });

async function boundaryFixture(t, fault) {
  const dir = mkdtempSync(path.join(tmpdir(), 'atlas-boundary-'));
  const dom = parseHTML('<html><body></body></html>');
  const previous = Object.fromEntries(
    ['window', 'document', 'Event', 'CustomEvent', '__atlasBoundaryElectron'].map((k) => [
      k,
      globalThis[k],
    ]),
  );
  Object.assign(globalThis, {
    window: dom.window,
    document: dom.document,
    Event: dom.window.Event,
    CustomEvent: dom.window.CustomEvent,
  });
  const handlers = new Map();
  const contents = { mainFrame: { url: 'campaign://app/index.html' } };
  const event = { sender: contents, senderFrame: contents.mainFrame };
  const calls = [];
  globalThis.__atlasBoundaryElectron = {
    contextBridge: {
      exposeInMainWorld: (name, api) => {
        window[name] = api;
      },
    },
    ipcRenderer: {
      invoke: (name, ...args) => {
        calls.push({ name, args: structuredClone(args) });
        return handlers.get(name)(event, ...args);
      },
    },
  };
  delete require.cache[path.join(boundaryRoot, 'host.cjs')];
  const boundary = require(path.join(boundaryRoot, 'host.cjs'));
  const store = new boundary.StoreClient(
    path.join(dir, 'workbench.sqlite'),
    'test',
    path.join(boundaryRoot, fault + '.cjs'),
  );
  const ipc = new boundary.HostIpc(
    {
      handle: (name, fn) => handlers.set(name, fn),
      removeHandler: (name) => handlers.delete(name),
    },
    {
      contents: () => contents,
      origin: contents.mainFrame.url,
      stopping: () => false,
      erasing: () => false,
      syncPlayer: async () => {},
    },
  );
  const atlas = boundary.registerAtlasHost({
    ipc,
    store,
    dataDir: dir,
    win: {},
    dungeonImport: () => undefined,
  });
  t.after(async () => {
    await ipc.drain();
    await atlas.close();
    await store.close();
    Object.assign(globalThis, previous);
    rmSync(dir, { recursive: true, force: true });
  });
  await store.ready;
  const campaign = await store.create('Boundary');
  const active = await store.activate(campaign.id);
  delete require.cache[path.join(boundaryRoot, 'preload.cjs')];
  require(path.join(boundaryRoot, 'preload.cjs'));
  return { boundary, store, campaign, token: active.token, calls, dir };
}

for (const fault of ['projection', 'encoding'])
  test(`real worker, HostIpc, preload and author retain ${fault} uncertainty without replay`, async (t) => {
    const x = await boundaryFixture(t, fault);
    const source = await x.store.atlasRegionSource(x.token);
    const action = {
      kind: 'landscape-height-stroke',
      stroke: {
        mode: 'raise',
        radius: 8,
        strength: 10,
        feather: 0.8,
        samples: [
          { x: 0, y: 0, t: 0 },
          { x: 0, y: 0, t: 1000 },
        ],
      },
    };
    const queue = new x.boundary.TerrainStrokeQueue(
      { expectedRevision: source.revision, sourceFence: source.fence },
      async (action, context) => {
        const result = await x.boundary.writeAtlasCommit({
          commandId: context.commandId,
          token: x.token,
          campaignId: x.campaign.id,
          action,
          sourceFence: context.sourceFence,
          terrainStroke: { id: context.id, expectedRevision: context.expectedRevision },
        });
        if (!result.ok) {
          assert.equal(result.errorKind, 'store-outcome-unknown');
          throw Error(result.error);
        }
        return result.value;
      },
    );
    const firstFailed = assert.rejects(queue.enqueue(action, 'first'));
    let dependentCompleted = false;
    const dependent = queue.enqueue(action, 'dependent').then(() => {
      dependentCompleted = true;
    });
    await firstFailed;
    await assert.rejects(queue.finish());
    assert.equal(queue.pending, 2);
    assert.equal(dependentCompleted, false);
    assert(queue.failed);
    const writes = () => x.calls.filter((c) => c.name === 'atlas:commit');
    assert.equal(writes().length, 1, 'dependent gesture never reaches the preload');
    const original = writes()[0].args[0];
    assert.deepEqual(x.boundary.pendingAtlasWrite(x.token), original);
    if (fault === 'projection')
      assert.deepEqual(JSON.parse(readFileSync(path.join(x.dir, 'workbench.sqlite.fault'))), {
        commandId: original.commandId,
        receipt: true,
        inTransaction: false,
      });
    const before = await x.store.campaignAtlas(x.token);
    const height = await x.store.atlasHeight(x.token, { x: 0, y: 0 });
    assert.equal(before.revision, source.revision + 1);
    assert.equal(
      (await x.boundary.writeAtlasCommit({ ...original, commandId: randomUUID() })).ok,
      false,
    );
    assert.equal(writes().length, 1);
    const recovered = await x.boundary.recoverAtlasCommit(x.token);
    assert.equal(recovered.ok, true);
    assert.equal(recovered.value.commandId, original.commandId);
    assert.equal(x.boundary.pendingAtlasWrite(x.token), null);
    assert.deepEqual(await x.store.campaignAtlas(x.token), before);
    assert.deepEqual(await x.store.atlasHeight(x.token, { x: 0, y: 0 }), height);
    assert.equal(writes().length, 1, 'receipt inspection cannot replay the commit');
    queue.confirm(recovered.value);
    const freshSource = await x.store.atlasRegionSource(x.token);
    queue.resume({ expectedRevision: freshSource.revision, sourceFence: freshSource.fence });
    await dependent;
    await queue.finish();
    assert.equal(writes().length, 2);
    assert.equal(writes()[1].args[0].commandId, 'dependent');
    assert.equal(writes()[1].args[0].terrainStroke.id, 'dependent');
    const both = await x.store.atlasHeight(x.token, { x: 0, y: 0 });
    assert(both.heightM > height.heightM);
    assert.equal((await x.store.campaignAtlas(x.token)).revision, before.revision + 1);
    const history = async (kind) =>
      x.boundary.writeAtlasCommit({
        commandId: randomUUID(),
        token: x.token,
        campaignId: x.campaign.id,
        action: { kind },
      });
    assert.equal((await history('undo')).ok, true);
    assert.equal((await x.store.atlasHeight(x.token, { x: 0, y: 0 })).heightM, height.heightM);
    assert.equal((await history('redo')).ok, true);
    assert.equal((await x.store.atlasHeight(x.token, { x: 0, y: 0 })).heightM, both.heightM);
    const beforeNext = (await x.store.campaignAtlas(x.token)).revision;
    const safe = await x.boundary.writeAtlasCommit({
      ...original,
      commandId: randomUUID(),
      action: { ...action, stroke: { ...action.stroke, strength: 0 } },
    });
    assert.equal(safe.ok, false);
    assert.equal(safe.errorKind, undefined);
    assert.equal(x.boundary.pendingAtlasWrite(x.token), null);
    const next = await x.boundary.writeAtlasCommit({
      commandId: randomUUID(),
      token: x.token,
      campaignId: x.campaign.id,
      action: { kind: 'landscape-sea-level', seaLevelM: 12 },
    });
    assert.equal(next.ok, true, 'work is usable again after explicit receipt resolution');
    assert.equal(next.value.revision, beforeNext + 1);
  });

test('typed receipt resolution distinguishes still unknown from confirmed not-applied without dispatch', async (t) => {
  const x = fixture(t),
    c = x.command();
  x.api.executeAtlasCommit = async () => ({
    ok: false,
    error: 'Lost result',
    errorKind: 'store-outcome-unknown',
  });
  await author.writeAtlasCommit(c);
  const original = x.api.reconcileAtlasCommit;
  x.api.reconcileAtlasCommit = async () => ({ ok: true, value: { outcome: 'unknown' } });
  assert.deepEqual(await author.reconcilePendingAtlasCommit(c.token), {
    ok: true,
    value: { outcome: 'unknown' },
  });
  assert.deepEqual(author.pendingAtlasWrite(c.token), c);
  x.api.reconcileAtlasCommit = original;
  assert.deepEqual(await author.reconcilePendingAtlasCommit(c.token), {
    ok: true,
    value: { outcome: 'not-applied' },
  });
  assert.equal(author.pendingAtlasWrite(c.token), null);
  assert.equal(x.calls.writes, 0);
});
