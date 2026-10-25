import { test } from 'node:test';
import assert from 'node:assert/strict';
import { mkdtempSync, mkdirSync, writeFileSync, rmSync } from 'node:fs';
import { tmpdir } from 'node:os';
import path from 'node:path';
import { randomUUID, createHash } from 'node:crypto';
import { createRequire } from 'node:module';
import { buildSync } from './helpers/build.mjs';

buildSync({
  entryPoints: ['src/app/storage/store.ts'],
  outfile: '.build/music-history-store.cjs',
  bundle: true,
  platform: 'node',
  format: 'cjs',
  external: ['better-sqlite3'],
});
const { CampaignStore } = createRequire(import.meta.url)('../.build/music-history-store.cjs');
function fixture(t) {
  const root = mkdtempSync(path.join(tmpdir(), 'music-history-')),
    file = path.join(root, 'workbench.sqlite');
  let store = new CampaignStore(file);
  const campaign = store.create('Rückweg durch die Musik'),
    workspace = store.activate(campaign.id),
    command = (action) => ({
      commandId: randomUUID(),
      campaignId: campaign.id,
      token: workspace.token,
      action,
    });
  mkdirSync(path.join(root, 'audio'));
  const assets = ['Hafen', 'Turm', 'Freie Wahl'].map((name) => {
    const bytes = Buffer.from('Own music history fixture ' + name),
      sha256 = createHash('sha256').update(bytes).digest('hex');
    writeFileSync(path.join(root, 'audio', sha256 + '.wav'), bytes);
    return store.ingestAudio(workspace.token, {
      sha256,
      extension: '.wav',
      bytes: bytes.length,
      mime: 'audio/wav',
      originalName: name + '.wav',
    });
  });
  const x = {
    assets,
    campaign,
    workspace,
    command,
    get store() {
      return store;
    },
    execute(action) {
      return store.executeMusic(
        command({ ...action, expectedRevision: store.music(workspace.token).state.revision }),
      );
    },
    reopen() {
      store.close();
      store = new CampaignStore(file);
      workspace.token = store.activate(campaign.id).token;
    },
  };
  t.after(() => {
    store.close();
    rmSync(root, { recursive: true, force: true });
  });
  return x;
}

test('Back consumes earlier selections across restart and replay without changing the manual queue', (t) => {
  const x = fixture(t),
    [a, b, c] = x.assets;
  for (const asset of x.assets) x.execute({ kind: 'select', assetId: asset.id });
  x.execute({
    kind: 'settings',
    autoplay: true,
    autoAmbience: false,
    volume: 0.2,
    ambienceVolume: 0.2,
    fadeSeconds: 0,
    loop: 'none',
  });
  x.execute({ kind: 'queue-add', assetIds: [a.id] });
  const before = x.store.music(x.workspace.token),
    queue = structuredClone(before.state.queue),
    descriptions = x.assets.map((asset) => x.store.audioAsset(asset.id));
  assert.deepEqual(before.state.history, [a.id, b.id]);
  const back = x.command({
      kind: 'transport',
      operation: 'back',
      expectedRevision: before.state.revision,
    }),
    first = x.store.executeMusic(back);
  assert.equal(first.state.current.assetId, b.id);
  assert.deepEqual(first.state.history, [a.id]);
  assert.deepEqual(first.state.queue, queue);
  assert.equal(first.state.manualHold, 'track');
  x.reopen();
  const restored = x.store.music(x.workspace.token);
  assert.equal(restored.state.current.assetId, b.id);
  assert.deepEqual(restored.state.history, [a.id]);
  const second = x.execute({ kind: 'transport', operation: 'back' });
  assert.equal(second.state.current.assetId, a.id);
  assert.deepEqual(second.state.history, []);
  assert.deepEqual(second.state.queue, queue);
  assert.equal(second.state.autoplay, true);
  const bytes = x.store.db.serialize();
  x.store.executeMusic({ ...back, token: x.workspace.token });
  assert.ok(
    bytes.equals(x.store.db.serialize()),
    'replaying the earlier Back must not consume another entry',
  );
  const exhausted = x.execute({ kind: 'transport', operation: 'back' });
  assert.equal(exhausted.state.current.playbackId, second.state.current.playbackId);
  assert.deepEqual(exhausted.state.history, []);
  assert.deepEqual(
    x.assets.map((asset) => x.store.audioAsset(asset.id)),
    descriptions,
  );
});

test('new selections and forward queue transitions still contribute to the history after going back', (t) => {
  const x = fixture(t),
    [a, b, c] = x.assets;
  x.execute({ kind: 'select', assetId: a.id });
  x.execute({ kind: 'select', assetId: b.id });
  x.execute({ kind: 'transport', operation: 'back' });
  x.execute({ kind: 'queue-add', assetIds: [c.id] });
  const forward = x.execute({ kind: 'transport', operation: 'skip' });
  assert.equal(forward.state.current.assetId, c.id);
  assert.deepEqual(forward.state.history, [a.id]);
  const back = x.execute({ kind: 'transport', operation: 'back' });
  assert.equal(back.state.current.assetId, a.id);
  assert.deepEqual(back.state.history, []);
});
