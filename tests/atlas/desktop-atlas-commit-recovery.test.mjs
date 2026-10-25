import { test } from 'node:test';
import assert from 'node:assert/strict';
import { randomUUID } from 'node:crypto';
import { createRequire } from 'node:module';
import { buildSync } from '../helpers/build.mjs';
import { parseHTML } from '../helpers/dom.mjs';
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
