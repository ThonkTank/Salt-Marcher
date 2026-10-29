import test from 'node:test';
import { EventEmitter } from 'node:events';
import { runInNewContext } from 'node:vm';
import assert from 'node:assert/strict';
import { mkdtempSync, rmSync, readFileSync } from 'node:fs';
import { tmpdir } from 'node:os';
import path from 'node:path';
import { createRequire } from 'node:module';
import { buildSync } from '../helpers/build.mjs';
import { parseHTML } from '../helpers/dom.mjs';
import { readWorkspaceMarkup } from '../../tools/desktop-markup.mjs';
const require = createRequire(import.meta.url);
for (const [entry, name] of [
  ['src/app/campaign/npc-ui.ts', 'npc'],
  ['src/app/runtime/music-ui.ts', 'music'],
  ['src/app/catalog/items-ui.ts', 'items'],
  ['src/app/storage/store.ts', 'store'],
])
  buildSync({
    entryPoints: [entry],
    outfile: `.build/tool-instances-${name}.cjs`,
    bundle: true,
    platform: 'node',
    format: 'cjs',
    external: ['better-sqlite3'],
  });
const { createNpcEditor } = require('../../.build/tool-instances-npc.cjs');
const { createMusicEditor } = require('../../.build/tool-instances-music.cjs');
const { createItemsEditor } = require('../../.build/tool-instances-items.cjs');
const { CampaignStore } = require('../../.build/tool-instances-store.cjs');
const ok = (value) => ({ ok: true, value });
function fixture(t, name) {
  const root = mkdtempSync(path.join(tmpdir(), 'tool-instances-'));
  const store = new CampaignStore(root + '/workbench.sqlite');
  const w = store.activate(store.create(name).id);
  const { document, window } = parseHTML(readWorkspaceMarkup());
  Object.defineProperty(window.HTMLSelectElement.prototype, 'value', {
    configurable: true,
    get() {
      return this._value ?? this.options[0]?.value ?? '';
    },
    set(v) {
      this._value = String(v);
    },
  });
  const create = document.createElement.bind(document);
  document.createElement = (tag) => {
    const node = create(tag);
    if (tag === 'audio') {
      node.pause = () => {};
      node.load = () => {};
    }
    return node;
  };
  const transfers = new Set(),
    calls = [];
  const api = new Proxy(
    {
      onAudioTransfer: (fn) => {
        transfers.add(fn);
        return () => transfers.delete(fn);
      },
    },
    {
      get(target, key) {
        if (key in target) return target[key];
        return async (...args) => {
          calls.push([key, ...args]);
          try {
            return ok(store[key](...args));
          } catch (error) {
            return { ok: false, error: error.message };
          }
        };
      },
    },
  );
  const get = (id) => document.getElementById(id);
  t.after(() => {
    store.close();
    rmSync(root, { recursive: true, force: true });
  });
  return { store, w, document, window, api, get, transfers, calls };
}
const silent = () => {};
const noop = async () => {};

test('two NPC editors keep queries, generations, delayed reads and disposal on their own surfaces', async (t) => {
  const a = fixture(t, 'A'),
    b = fixture(t, 'B');
  const first = createNpcEditor({ roots: [a.get('groups')], api: a.api });
  const second = createNpcEditor({ roots: [b.get('groups')], api: b.api });
  first.initNpcs(silent, noop, noop);
  second.initNpcs(silent, noop, noop);
  first.activateNpcs(a.w);
  second.activateNpcs(b.w);
  a.get('npc-search').value = 'Alpha';
  b.get('npc-search').value = 'Beta';
  await Promise.all([first.openNpcs(), second.openNpcs()]);
  assert.equal(a.get('npc-search').value, 'Alpha');
  assert.equal(b.get('npc-search').value, 'Beta');
  assert.notEqual(first.editorSession, second.editorSession);
  assert.ok(a.calls.some(([key, token]) => key === 'npcs' && token === a.w.token));
  let release;
  const original = a.api.npcs;
  a.api.npcs = () =>
    new Promise((resolve) => {
      release = resolve;
    });
  const pending = first.openNpcs();
  while (!release) await new Promise((resolve) => setImmediate(resolve));
  const retained = a.get('npc-list');
  assert.equal(await first.dispose(), true);
  release(ok({ items: [], total: 0 }));
  await pending;
  assert.equal(retained.isConnected, false);
  assert.equal(a.get('npcs'), null);
  assert.throws(() => first.activateNpcs(a.w), /disposed/);
  await second.openNpcs();
  assert.equal(b.get('npc-search').value, 'Beta');
  assert.equal(await second.dispose(), true);
  a.api.npcs = original;
});

test('music instances own subscriptions, polling, audio elements and listeners', async (t) => {
  const a = fixture(t, 'A'),
    b = fixture(t, 'B');
  const intervals = new Map();
  let next = 0;
  const prior = { setInterval: globalThis.setInterval, clearInterval: globalThis.clearInterval };
  globalThis.setInterval = (fn) => {
    intervals.set(++next, fn);
    return next;
  };
  globalThis.clearInterval = (id) => intervals.delete(id);
  t.after(() => Object.assign(globalThis, prior));
  const first = createMusicEditor({ roots: [a.get('music'), a.get('music-mini')], api: a.api });
  const second = createMusicEditor({ roots: [b.get('music'), b.get('music-mini')], api: b.api });
  first.initMusic(silent, noop);
  second.initMusic(silent, noop);
  first.activateMusic(a.w);
  second.activateMusic(b.w);
  let notices = 0;
  const off = second.onMusicChanged(() => notices++);
  await Promise.all([first.refreshMusic(), second.refreshMusic()]);
  assert.equal(intervals.size, 2);
  assert.equal(a.transfers.size, 1);
  assert.equal(b.transfers.size, 1);
  assert.equal(a.document.querySelectorAll('audio').length, 2);
  assert.equal(b.document.querySelectorAll('audio').length, 2);
  assert.ok(notices > 0);
  off();
  const before = notices;
  await second.refreshMusic();
  assert.equal(notices, before);
  let release;
  const snapshot = a.store.music(a.w.token);
  a.api.music = () =>
    new Promise((resolve) => {
      release = resolve;
    });
  const delayed = first.refreshMusic();
  while (!release) await new Promise((resolve) => setImmediate(resolve));
  assert.equal(await first.dispose(), true);
  release(ok(snapshot));
  await delayed;
  assert.equal(intervals.size, 1);
  assert.equal(a.transfers.size, 0);
  assert.equal(b.transfers.size, 1);
  assert.equal(a.document.querySelectorAll('audio').length, 0);
  await second.refreshMusic();
  assert.equal(b.document.querySelectorAll('audio').length, 2);
  assert.equal(await second.dispose(), true);
  assert.equal(intervals.size, 0);
  assert.equal(b.transfers.size, 0);
});

test('items share booking authority explicitly without sharing selection or overwriting owner callbacks', async (t) => {
  const a = fixture(t, 'A'),
    b = fixture(t, 'B');
  const pending = new Set(),
    state = new Set(),
    resolved = new Set();
  const commits = {
    hasPendingCommit: (id) => pending.has(id),
    onCommitState: (fn) => {
      state.add(fn);
      return () => state.delete(fn);
    },
    onCommitResolved: (fn) => {
      resolved.add(fn);
      return () => resolved.delete(fn);
    },
    updateCommitControls: () => {
      for (const fn of state) fn();
    },
    writeConfirmed: async () => {
      throw Error('Unexpected booking');
    },
  };
  const first = createItemsEditor({
    roots: [a.get('items')],
    api: a.api,
    commits,
    refreshProgress: noop,
  });
  const second = createItemsEditor({
    roots: [b.get('items')],
    api: b.api,
    commits,
    refreshProgress: noop,
  });
  first.initItems(silent, noop);
  second.initItems(silent, noop);
  first.activateItems(a.w);
  second.activateItems(b.w);
  a.get('item-search').value = 'Alpha';
  b.get('item-search').value = 'Beta';
  await Promise.all([first.openItems(), second.openItems()]);
  let release;
  a.api.itemDefinitions = (query) =>
    new Promise((resolve) => {
      release = () => resolve(ok(a.store.itemDefinitions(query)));
    });
  const delayed = first.openItems();
  while (!release) await new Promise((resolve) => setImmediate(resolve));
  pending.add(a.w.campaign.id);
  assert.equal(await first.dispose(), false);
  assert.equal(first.editorSession.status.attached, true);
  assert.equal(await second.flushItems(), true);
  second.activateItems(a.w);
  assert.equal(
    await second.flushItems(),
    false,
    'another surface cannot bypass the same campaign booking',
  );
  second.activateItems(b.w);
  b.get('item-search').value = 'Beta';
  assert.equal(a.get('item-search').value, 'Alpha');
  assert.equal(b.get('item-search').value, 'Beta');
  assert.equal(state.size, 2);
  assert.equal(resolved.size, 2);
  pending.clear();
  assert.equal(await first.dispose(), true);
  release();
  await delayed;
  assert.equal(state.size, 1);
  assert.equal(resolved.size, 1);
  assert.equal(b.get('item-search').value, 'Beta');
  assert.equal(await second.dispose(), true);
  assert.equal(state.size, 0);
  assert.equal(resolved.size, 0);
});

test('NPC disposal refuses a failed draft save, preserves literal input, and drains the accepted retry', async (t) => {
  const a = fixture(t, 'A');
  const editor = createNpcEditor({ roots: [a.get('groups')], api: a.api });
  editor.initNpcs(silent, noop, noop);
  editor.activateNpcs(a.w);
  await editor.openNpcs();
  a.get('npc-new').click();
  for (let i = 0; i < 100 && a.get('npc-editor').hidden; i++)
    await new Promise((resolve) => setImmediate(resolve));
  assert.equal(a.get('npc-editor').hidden, false);
  a.get('npc-name').value = '  Unfertig  ';
  a.get('npc-hp').value = 'keine Zahl';
  a.get('npc-editor').dispatchEvent(new a.window.Event('input'));
  a.api.keepNpcDraft = async () => ({ ok: false, error: 'Draft medium unavailable' });
  assert.equal(await editor.dispose(), false);
  assert.equal(a.get('npc-hp').value, 'keine Zahl');
  assert.equal(a.get('npc-name').value, '  Unfertig  ');
  assert.equal(editor.editorSession.status.attached, true);
  let release,
    count = 0;
  a.api.keepNpcDraft = async (...args) => {
    count++;
    await new Promise((resolve) => {
      release = resolve;
    });
    return ok(a.store.keepNpcDraft(...args));
  };
  const pending = editor.dispose();
  while (!release) await new Promise((resolve) => setImmediate(resolve));
  assert.ok(a.get('npcs'));
  release();
  assert.equal(await pending, true);
  assert.equal(count, 1);
  assert.equal(a.get('npcs'), null);
});

test('repeated mounts remove generated controls and all music subscriptions', async (t) => {
  const a = fixture(t, 'A');
  for (let n = 0; n < 3; n++) {
    const npc = createNpcEditor({ roots: [a.get('groups')], api: a.api });
    const music = createMusicEditor({ roots: [a.get('music'), a.get('music-mini')], api: a.api });
    npc.initNpcs(silent, noop, noop);
    music.initMusic(silent, noop);
    assert.equal(a.document.querySelectorAll('#npcs').length, 1);
    assert.equal(a.transfers.size, 1);
    assert.equal(await npc.dispose(), true);
    assert.equal(await music.dispose(), true);
    assert.equal(a.transfers.size, 0);
    assert.equal(a.document.querySelectorAll('audio').length, 0);
    assert.equal(await music.dispose(), true);
  }
});

test('the real preload removes only the subscribing music instance listener', () => {
  const file = `.build/tool-instances-preload.cjs`;
  buildSync({
    entryPoints: ['desktop/preload.ts'],
    outfile: file,
    bundle: true,
    platform: 'node',
    format: 'cjs',
    external: ['electron'],
  });
  const ipcRenderer = new EventEmitter();
  let api;
  runInNewContext(readFileSync(file, 'utf8'), {
    require: (name) => {
      assert.equal(name, 'electron');
      return {
        ipcRenderer,
        contextBridge: {
          exposeInMainWorld: (name, value) => {
            assert.equal(name, 'campaign');
            api = value;
          },
        },
      };
    },
  });
  const a = [],
    b = [];
  const offA = api.onAudioTransfer((value) => a.push(value));
  const offB = api.onAudioTransfer((value) => b.push(value));
  ipcRenderer.emit('music:progress', {}, 'first');
  offA();
  offA();
  ipcRenderer.emit('music:progress', {}, 'second');
  assert.deepEqual(a, ['first']);
  assert.deepEqual(b, ['first', 'second']);
  assert.equal(ipcRenderer.listenerCount('music:progress'), 1);
  offB();
  assert.equal(ipcRenderer.listenerCount('music:progress'), 0);
});

test('late audio change after an acknowledged autosave does not rewrite identical metadata', async (t) => {
  const a = fixture(t, 'Musikbeschreibung');
  const asset = a.store.ingestAudio(a.w.token, {
    sha256: 'a'.repeat(64),
    extension: '.wav',
    bytes: 128,
    mime: 'audio/wav',
    originalName: 'Original.wav',
  });
  const music = createMusicEditor({ roots: [a.get('music'), a.get('music-mini')], api: a.api });
  music.initMusic(silent, noop);
  music.activateMusic(a.w);
  try {
    await music.openMusic();
    [...a.get('audio-list').querySelectorAll('button')]
      .find((button) => button.textContent === 'Beschreibung bearbeiten')
      .onclick();
    await new Promise((resolve) => setImmediate(resolve));
    assert.equal(a.get('audio-editor').hidden, false);
    a.get('audio-name').value = 'Neue Beschreibung';
    a.get('audio-editor').oninput();
    assert.equal(await music.flushMusic(), true);
    const saved = a.store.audioAsset(asset.id);
    a.get('audio-editor').onchange();
    assert.equal(await music.flushMusic(), true);
    assert.deepEqual(a.store.audioAsset(asset.id), saved);
    a.get('audio-name').value = 'Noch eine Änderung';
    a.get('audio-editor').oninput();
    assert.equal(await music.flushMusic(), true);
    const next = a.store.audioAsset(asset.id);
    assert.equal(next.name, 'Noch eine Änderung');
    assert.equal(next.revision, saved.revision + 1);
  } finally {
    await music.dispose();
  }
});

test('audio edits made before a prior acknowledgement remain pending and commit once', async (t) => {
  const a = fixture(t, 'Überlappende Musikbeschreibung');
  const asset = a.store.ingestAudio(a.w.token, {
    sha256: 'b'.repeat(64),
    extension: '.wav',
    bytes: 128,
    mime: 'audio/wav',
    originalName: 'Original.wav',
  });
  const music = createMusicEditor({ roots: [a.get('music'), a.get('music-mini')], api: a.api });
  music.initMusic(silent, noop);
  music.activateMusic(a.w);
  let release;
  const gate = new Promise((resolve) => (release = resolve));
  try {
    await music.openMusic();
    [...a.get('audio-list').querySelectorAll('button')]
      .find((button) => button.textContent === 'Beschreibung bearbeiten')
      .onclick();
    await new Promise((resolve) => setImmediate(resolve));
    assert.equal(a.get('audio-editor').hidden, false);
    const original = a.api.executeMusic;
    let held = false;
    a.api.executeMusic = async (command) => {
      const result = await original(command);
      if (command.action.kind === 'asset' && !held) {
        held = true;
        await gate;
      }
      return result;
    };
    a.get('audio-name').value = 'Erste Änderung';
    a.get('audio-editor').oninput();
    const first = music.flushMusic();
    await new Promise((resolve) => setImmediate(resolve));
    assert.equal(held, true);
    a.get('audio-name').value = 'Während der Bestätigung geändert';
    a.get('audio-editor').oninput();
    a.get('audio-editor').onchange();
    release();
    assert.equal(await first, true);
    assert.equal(await music.flushMusic(), true);
    const saved = a.store.audioAsset(asset.id);
    assert.equal(saved.name, 'Während der Bestätigung geändert');
    assert.equal(saved.revision, asset.revision + 2);
    a.get('audio-editor').onchange();
    assert.equal(await music.flushMusic(), true);
    assert.deepEqual(a.store.audioAsset(asset.id), saved);
  } finally {
    release();
    await music.dispose();
  }
});

test('correcting a rejected audio draft back to its canonical text still confirms exactly one write', async (t) => {
  const a = fixture(t, 'Korrigierte Musikbeschreibung');
  const asset = a.store.ingestAudio(a.w.token, {
    sha256: 'c'.repeat(64),
    extension: '.wav',
    bytes: 128,
    mime: 'audio/wav',
    originalName: 'Original.wav',
  });
  const music = createMusicEditor({ roots: [a.get('music'), a.get('music-mini')], api: a.api });
  music.initMusic(silent, noop);
  music.activateMusic(a.w);
  try {
    await music.openMusic();
    [...a.get('audio-list').querySelectorAll('button')]
      .find((button) => button.textContent === 'Beschreibung bearbeiten')
      .onclick();
    await new Promise((resolve) => setImmediate(resolve));
    const before = a.store.audioAsset(asset.id);
    a.get('audio-name').value = '';
    a.get('audio-editor').oninput();
    assert.equal(await music.flushMusic(), false);
    assert.deepEqual(a.store.audioAsset(asset.id), before);
    a.get('audio-name').value = before.name;
    a.get('audio-editor').oninput();
    assert.equal(await music.flushMusic(), true);
    const corrected = a.store.audioAsset(asset.id);
    assert.equal(corrected.revision, before.revision + 1);
    assert.equal(corrected.name, before.name);
    a.get('audio-editor').onchange();
    assert.equal(await music.flushMusic(), true);
    assert.deepEqual(a.store.audioAsset(asset.id), corrected);
  } finally {
    await music.dispose();
  }
});
