import { readFileSync as readWorkspaceSource } from 'node:fs';
import { test } from 'node:test';
import assert from 'node:assert/strict';
import { mkdtempSync, mkdirSync, writeFileSync, rmSync } from 'node:fs';
import path from 'node:path';
import { tmpdir } from 'node:os';
import { randomUUID, createHash } from 'node:crypto';
import { createRequire } from 'node:module';
import { buildSync, build } from '../helpers/build.mjs';
import { parseHTML } from '../helpers/dom.mjs';
const base = '.build/realist-soundboard',
  require = createRequire(import.meta.url),
  tick = async () => {
    for (let i = 0; i < 8; i++) await new Promise((r) => setImmediate(r));
  };
buildSync({
  entryPoints: ['src/app/storage/store.ts'],
  outfile: base + '/store.cjs',
  bundle: true,
  platform: 'node',
  format: 'cjs',
  external: ['better-sqlite3'],
});
await build({
  entryPoints: ['src/app/runtime/live-soundboard-ui.ts'],
  outfile: base + '/ui.cjs',
  bundle: true,
  platform: 'node',
  format: 'cjs',
});
async function fixture(t) {
  const root = mkdtempSync(path.join(tmpdir(), 'soundboard-')),
    { CampaignStore } = require('../../' + base + '/store.cjs'),
    store = new CampaignStore(root + '/store.sqlite'),
    campaign = store.create('A'),
    w = store.activate(campaign.id),
    bytes = Buffer.from('Own audio fixture'),
    sha256 = createHash('sha256').update(bytes).digest('hex');
  mkdirSync(root + '/audio');
  writeFileSync(root + '/audio/' + sha256 + '.wav', bytes);
  const a = store.ingestAudio(w.token, {
    sha256,
    extension: '.wav',
    bytes: bytes.length,
    mime: 'audio/wav',
    originalName: 'Alpha.wav',
  });
  const saved = Object.fromEntries(
      ['window', 'document', 'setTimeout', 'clearTimeout', 'soundboardMusic'].map((k) => [
        k,
        globalThis[k],
      ]),
    ),
    { window, document } = parseHTML(readWorkspaceSource('src/app/workspace/index.html', 'utf8'));
  Object.assign(globalThis, { window, document, setTimeout: () => 1, clearTimeout: () => {} });
  Object.defineProperty(window.HTMLSelectElement.prototype, 'value', {
    configurable: true,
    get() {
      return this._value ?? this.options[0]?.value ?? '';
    },
    set(v) {
      this._value = String(v);
    },
  });
  const host = document.createElement('button');
  host.id = 'music-mini-open';
  document.body.append(host);
  let listener;
  const x = { store, w, window, document, commands: [], el: (id) => document.getElementById(id) };
  globalThis.soundboardMusic = {
    listen: (f) => (listener = f),
    refresh: async () => listener(store.music(x.w.token)),
    run: async (token, build) => {
      const cmd = {
        commandId: randomUUID(),
        campaignId: x.w.campaign.id,
        token,
        action: build(store.music(token)),
      };
      x.commands.push(cmd);
      store.executeMusic(cmd);
      listener(store.music(token));
      return true;
    },
  };
  window.campaign = {
    audioAssets: async (q) => ({ ok: true, value: store.audioAssets(q) }),
    musicFavorites: async (token, after) => ({
      ok: true,
      value: store.musicFavorites(token, after),
    }),
  };
  delete require.cache[require.resolve('../../' + base + '/ui.cjs')];
  x.ui = require('../../' + base + '/ui.cjs').createSoundboard({
    roots: [document.body],
    api: window.campaign,
    music: {
      onMusicChanged: (f) => {
        listener = f;
        return () => {
          listener = () => {};
        };
      },
      refreshMusic: globalThis.soundboardMusic.refresh,
      runLiveMusic: globalThis.soundboardMusic.run,
    },
  });
  x.ui.initSoundboard(
    () => {},
    async () => {},
    async () => {},
  );
  x.ui.activateSoundboard(w);
  await globalThis.soundboardMusic.refresh();
  const board = x.el('live-soundboard');
  Object.defineProperty(board, 'open', { value: true, writable: true });
  board.dispatchEvent(new window.Event('toggle'));
  await tick();
  assert.equal(x.el('soundboard-library').querySelectorAll('article').length, 1);
  x.assetId = a.id;
  t.after(() => {
    Object.assign(globalThis, saved);
    store.close();
    rmSync(root, { recursive: true, force: true });
  });
  return x;
}
test('current soundboard selection changes the canonical queue once', async (t) => {
  const x = await fixture(t);
  x.el('soundboard-library').querySelectorAll('button')[1].click();
  await tick();
  assert.equal(x.commands.length, 1);
  assert.deepEqual(
    x.store.music(x.w.token).state.queue.map((e) => e.assetId),
    [x.assetId],
  );
});
test('a changed soundboard query removes playable stale results immediately', async (t) => {
  const x = await fixture(t),
    button = x.el('soundboard-library').querySelector('button'),
    before = x.store.db.serialize();
  x.el('soundboard-search').value = 'No match';
  x.el('soundboard-search').oninput();
  button.onclick();
  await tick();
  assert.equal(x.commands.length, 0);
  assert.equal(x.el('soundboard-library').querySelectorAll('article').length, 0);
  assert.ok(x.store.db.serialize().equals(before));
});
test('removed soundboard controls cannot act in another campaign', async (t) => {
  const x = await fixture(t),
    button = x.el('soundboard-library').querySelector('button'),
    next = x.store.create('B');
  x.w = x.store.activate(next.id);
  x.ui.activateSoundboard(x.w);
  await globalThis.soundboardMusic.refresh();
  const before = x.store.db.serialize();
  button.onclick();
  await tick();
  assert.equal(x.commands.length, 0);
  assert.ok(x.store.db.serialize().equals(before));
});
