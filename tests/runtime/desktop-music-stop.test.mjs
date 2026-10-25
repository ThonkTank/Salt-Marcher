import { test } from 'node:test';
import assert from 'node:assert/strict';
import { mkdtempSync, mkdirSync, writeFileSync, readFileSync, rmSync } from 'node:fs';
import path from 'node:path';
import { tmpdir } from 'node:os';
import { randomUUID, createHash } from 'node:crypto';
import { createRequire } from 'node:module';
import { buildSync } from '../helpers/build.mjs';
import { parseHTML } from '../helpers/dom.mjs';
const require = createRequire(import.meta.url),
  tick = () => new Promise((r) => setImmediate(r));
for (const [source, name] of [
  ['src/app/storage/store.ts', 'music-stop-store'],
  ['src/app/runtime/music-ui.ts', 'music-stop-ui'],
])
  buildSync({
    entryPoints: [source],
    outfile: '.build/' + name + '.cjs',
    bundle: true,
    platform: 'node',
    format: 'cjs',
    external: ['better-sqlite3'],
  });
async function until(check) {
  for (let i = 0; i < 70; i++) {
    if (check()) return;
    await tick();
  }
  assert.ok(check(), 'Expected music choice did not arrive');
}
async function fixture() {
  const root = mkdtempSync(path.join(tmpdir(), 'music-stop-')),
    { CampaignStore } = require('../../.build/music-stop-store.cjs'),
    store = new CampaignStore(root + '/store.sqlite'),
    campaign = store.create('Ruhige Szene'),
    w = store.activate(campaign.id),
    command = (action) => ({
      commandId: randomUUID(),
      token: w.token,
      campaignId: campaign.id,
      action,
    });
  mkdirSync(root + '/audio');
  const assets = [];
  for (const [name, kind] of [
    ['Bühne', 'song'],
    ['Regen', 'ambience'],
    ['Wind', 'ambience'],
  ]) {
    const bytes = Buffer.from('Own state fixture ' + name),
      sha256 = createHash('sha256').update(bytes).digest('hex');
    writeFileSync(root + '/audio/' + sha256 + '.wav', bytes);
    let asset = store.ingestAudio(w.token, {
      sha256,
      extension: '.wav',
      bytes: bytes.length,
      mime: 'audio/wav',
      originalName: name + '.wav',
    });
    store.executeMusic(
      command({
        kind: 'asset',
        asset: { ...asset, kind, notes: '  Original\r\nZweite Zeile\r\n' },
        expectedRevision: asset.revision,
      }),
    );
    assets.push(store.audioAsset(asset.id));
  }
  const execute = (action) =>
    store.executeMusic(
      command({ ...action, expectedRevision: store.music(w.token).state.revision }),
    );
  const [song, rain, wind] = assets;
  const state = store.music(w.token).state;
  execute({ kind: 'settings', ...state, fadeSeconds: 0 });
  execute({ kind: 'ambience', assetId: wind.id, operation: 'add' });
  const saved = Object.fromEntries(
    [
      'window',
      'document',
      'setTimeout',
      'clearTimeout',
      'setInterval',
      'clearInterval',
      'requestAnimationFrame',
      'cancelAnimationFrame',
    ].map((k) => [k, globalThis[k]]),
  );
  const { window, document } = parseHTML(readFileSync('src/app/workspace/index.html', 'utf8'));
  Object.assign(globalThis, {
    window,
    document,
    setTimeout: () => 1,
    clearTimeout: () => {},
    setInterval: () => 1,
    clearInterval: () => {},
    requestAnimationFrame: () => 1,
    cancelAnimationFrame: () => {},
  });
  const create = document.createElement.bind(document);
  document.createElement = (tag) => {
    const a = create(tag);
    if (tag === 'audio') {
      for (const [key, value] of Object.entries({
        paused: true,
        ended: false,
        volume: 1,
        currentTime: 0,
        duration: 60,
        readyState: 1,
      }))
        Object.defineProperty(a, key, { value, writable: true, configurable: true });
      a.play = async () => {
        a.paused = false;
      };
      a.pause = () => {
        a.paused = true;
      };
      a.load = () => {
        a.currentTime = 0;
      };
    }
    return a;
  };
  const result = (fn) => {
    try {
      return { ok: true, value: fn() };
    } catch (error) {
      return { ok: false, error: error.message };
    }
  };
  let hold = null,
    reply = null,
    positionFailure = false,
    positionCalls = 0;
  const commands = [];
  window.campaign = {
    onAudioTransfer: () => {},
    music: async (token) => result(() => store.music(token)),
    musicPosition: async () => {
      positionCalls++;
      return positionFailure
        ? { ok: false, error: 'Positionsspeicherung nicht erreichbar' }
        : { ok: true };
    },
    preparation: async (token) => result(() => store.preparation(token)),
    audioAssets: async (q) => result(() => store.audioAssets(q)),
    audioAsset: async (id) => result(() => store.audioAsset(id)),
    executeMusic: async (c) => {
      commands.push(c);
      const r = result(() => store.executeMusic(c));
      if (c.action.kind === hold || c.action.operation === hold) {
        hold = null;
        return new Promise((resolve) => {
          reply = () => {
            resolve(r);
            reply = null;
          };
        });
      }
      return r;
    },
  };
  delete require.cache[require.resolve('../../.build/music-stop-ui.cjs')];
  const ui = require('../../.build/music-stop-ui.cjs');
  ui.initMusic(
    () => {},
    async () => {},
  );
  for (const select of document.querySelectorAll('select'))
    Object.defineProperty(select, 'value', { value: '', writable: true });
  ui.activateMusic(w);
  await ui.openMusic();
  const audible = () => Array.from(document.querySelectorAll('audio')).filter((a) => !a.paused),
    click = (name, button) =>
      Array.from(document.querySelectorAll('#audio-list article'))
        .find((a) => a.querySelector('h4').textContent === name)
        .querySelectorAll('button')
        .forEach((b) => {
          if (b.textContent === button) b.click();
        }),
    transport = (operation) =>
      document.querySelector('#music-mini [data-music-transport=' + operation + ']').click();
  return {
    root,
    store,
    w,
    ui,
    song,
    rain,
    wind,
    document,
    execute,
    commands,
    failPosition: (value) => {
      positionFailure = value;
    },
    positionCalls: () => positionCalls,
    audible,
    click,
    transport,
    hold: (op) => {
      hold = op;
    },
    hasReply: () => !!reply,
    release: () => reply(),
    async cleanup() {
      if (reply) reply();
      await tick();
      ui.deactivateMusic();
      store.close();
      Object.assign(globalThis, saved);
      rmSync(root, { recursive: true, force: true });
    },
  };
}
async function startAndStop(x) {
  x.click('Bühne', 'Abspielen');
  await until(() => x.audible().some((a) => a.dataset.musicSlot));
  x.click('Wind', 'Sound hinzufügen');
  await until(() => x.audible().some((a) => a.dataset.ambienceId === x.wind.id));
  x.transport('stop');
  await until(
    () => x.store.music(x.w.token).state.manualHold === 'stop' && x.audible().length === 0,
  );
}
function onlyRain(x) {
  assert.equal(x.audible().length, 1);
  assert.equal(x.audible()[0].dataset.ambienceId, x.rain.id);
  assert(Math.abs(x.audible()[0].volume - 0.3) < 0.00001);
  assert.equal(x.store.music(x.w.token).state.status, 'stopped');
  assert.match(x.document.getElementById('music-mini-title').textContent, /1 Sound aktiv/);
}
test('Stop followed by an explicit sound plays only that layer at the configured ambience gain', async () => {
  const x = await fixture();
  try {
    await startAndStop(x);
    x.click('Regen', 'Sound hinzufügen');
    await until(() => x.audible().length === 1);
    onlyRain(x);
    await x.ui.refreshMusic();
    onlyRain(x);
    assert.match(x.document.getElementById('music-layers').textContent, /Bereit/);
  } finally {
    await x.cleanup();
  }
});
test('Stop applies to a pending Play without another read and its late reply cannot authorize old output', async () => {
  const x = await fixture();
  try {
    x.hold('select');
    x.click('Bühne', 'Abspielen');
    await until(x.hasReply);
    x.transport('stop');
    await until(() => x.store.music(x.w.token).state.manualHold === 'stop');
    x.click('Regen', 'Sound hinzufügen');
    await until(() => x.audible().length === 1);
    x.release();
    await tick();
    await tick();
    onlyRain(x);
  } finally {
    await x.cleanup();
  }
});
test('a late Stop reply cannot revoke rain explicitly chosen after that confirmed stop', async () => {
  const x = await fixture();
  try {
    x.click('Bühne', 'Abspielen');
    await until(() => x.audible().length === 2);
    x.hold('stop');
    x.transport('stop');
    await until(x.hasReply);
    await x.ui.refreshMusic();
    assert.equal(x.audible().length, 0);
    x.click('Regen', 'Sound hinzufügen');
    await until(() => x.audible().length === 1);
    x.release();
    await tick();
    await tick();
    onlyRain(x);
  } finally {
    await x.cleanup();
  }
});
test('fresh activation stays silent and a single explicit sound keeps other stored choices dormant', async () => {
  const x = await fixture();
  try {
    await startAndStop(x);
    x.click('Regen', 'Sound hinzufügen');
    await until(() => x.audible().length === 1);
    x.ui.activateMusic(x.w);
    await x.ui.openMusic();
    assert.equal(x.audible().length, 0);
    x.click('Regen', 'Sound hinzufügen');
    await until(() => x.audible().length === 1);
    onlyRain(x);
  } finally {
    await x.cleanup();
  }
});
test('adding or unmuting an explicit layer after Stop keeps autoplay music stopped', async () => {
  const x = await fixture();
  try {
    const s = x.store.music(x.w.token).state;
    x.execute({ kind: 'settings', ...s, autoplay: true, autoAmbience: true, fadeSeconds: 0 });
    x.execute({ kind: 'select', assetId: x.song.id });
    x.execute({ kind: 'transport', operation: 'stop' });
    const rain = x.execute({ kind: 'ambience', operation: 'add', assetId: x.rain.id });
    assert.equal(rain.state.status, 'stopped');
    assert.equal(rain.state.manualHold, 'track');
    assert.equal(rain.state.autoplay, true);
    x.execute({ kind: 'ambience', operation: 'mute', assetId: x.wind.id });
    x.execute({ kind: 'transport', operation: 'stop' });
    const wind = x.execute({ kind: 'ambience', operation: 'unmute', assetId: x.wind.id });
    assert.equal(wind.state.status, 'stopped');
    assert.equal(wind.state.manualHold, 'track');
  } finally {
    await x.cleanup();
  }
});

test('a failed ambience layer recovers through explicit asset retry while another sound keeps playing', async () => {
  const x = await fixture();
  try {
    x.click('Wind', 'Sound hinzufügen');
    await until(() => x.audible().some((a) => a.dataset.ambienceId === x.wind.id));
    x.click('Regen', 'Sound hinzufügen');
    await until(() => x.audible().length === 2);
    const broken = x.audible().find((a) => a.dataset.ambienceId === x.wind.id);
    broken.onerror();
    await until(() => x.store.audioAsset(x.wind.id).problem && x.audible().length === 1);
    assert.equal(x.audible()[0].dataset.ambienceId, x.rain.id);
    assert.equal(broken.parentNode === null, true);
    const retry = x.execute({ kind: 'retry-asset', id: x.wind.id });
    assert.equal(retry.state.forcedAmbience.includes(x.wind.id), true);
    await x.ui.refreshMusic();
    await until(() => x.audible().length === 2);
    assert.notEqual(
      x.audible().find((a) => a.dataset.ambienceId === x.wind.id),
      broken,
    );
    broken.onerror();
    await tick();
    assert.equal(x.store.audioAsset(x.wind.id).problem, null);
    assert.equal(x.audible().length, 2);
  } finally {
    await x.cleanup();
  }
});

for (const control of ['console', 'mini', 'soundboard'])
  test(
    control +
      ' Stop ignores invalid metadata and a failed position checkpoint without discarding the draft',
    async () => {
      const x = await fixture();
      try {
        x.click('Bühne', 'Abspielen');
        await until(() => x.audible().length === 2);
        const playing = x.store.music(x.w.token).state.current;
        x.store.musicPosition(x.w.token, playing.playbackId, 21.5);
        assert.equal(x.store.music(x.w.token).state.current.positionSeconds, 21.5);
        x.click('Bühne', 'Beschreibung bearbeiten');
        await until(() => x.document.getElementById('audio-name').value === 'Bühne');
        const name = x.document.getElementById('audio-name'),
          notes = x.document.getElementById('audio-notes');
        name.value = '';
        notes.value = x.song.notes.replace(/\r\n/g, '\n');
        x.document.getElementById('audio-editor').oninput();
        assert.equal(await x.ui.flushMusic(), false);
        const calls = x.positionCalls();
        x.failPosition(true);
        if (control === 'soundboard')
          assert.equal(
            await x.ui.runLiveMusic(x.w.token, (v) => ({
              kind: 'transport',
              operation: 'stop',
              expectedRevision: v.state.revision,
            })),
            true,
          );
        else
          x.document
            .querySelector(
              (control === 'console' ? '#music' : '#music-mini') + ' [data-music-transport=stop]',
            )
            .click();
        await until(
          () => x.store.music(x.w.token).state.manualHold === 'stop' && x.audible().length === 0,
        );
        assert.equal(x.positionCalls(), calls);
        assert.equal(name.value, '');
        assert.equal(notes.value, x.song.notes.replace(/\r\n/g, '\n'));
        assert.deepEqual(x.store.audioAsset(x.song.id), x.song);
        assert.equal(x.store.music(x.w.token).state.current.positionSeconds, 0);
        assert.equal(x.commands.filter((c) => c.action.operation === 'stop').length, 1);
        assert.equal(await x.ui.flushMusic(), false);
        name.value = 'Bühne korrigiert';
        x.failPosition(false);
        assert.equal(await x.ui.flushMusic(), true);
        assert.equal(x.store.audioAsset(x.song.id).name, 'Bühne korrigiert');
        assert.equal(x.store.audioAsset(x.song.id).notes, x.song.notes);
        x.ui.activateMusic(x.w);
        await x.ui.openMusic();
        assert.equal(x.audible().length, 0);
        x.transport('play');
        await until(() => x.audible().some((a) => a.dataset.musicSlot));
      } finally {
        await x.cleanup();
      }
    },
  );

test('Stop does not wait for an applied metadata reply and that late reply cannot restart playback', async () => {
  const x = await fixture();
  try {
    x.click('Bühne', 'Abspielen');
    await until(() => x.audible().length === 2);
    x.click('Bühne', 'Beschreibung bearbeiten');
    await until(() => x.document.getElementById('audio-name').value === 'Bühne');
    x.document.getElementById('audio-name').value = 'Bühne spät';
    x.document.getElementById('audio-editor').oninput();
    x.hold('asset');
    const saving = x.ui.flushMusic();
    await until(x.hasReply);
    x.transport('stop');
    await until(
      () => x.store.music(x.w.token).state.manualHold === 'stop' && x.audible().length === 0,
    );
    assert.equal(x.hasReply(), true);
    assert.equal(x.document.getElementById('audio-name').value, 'Bühne spät');
    x.release();
    assert.equal(await saving, true);
    await x.ui.refreshMusic();
    assert.equal(x.audible().length, 0);
    assert.equal(x.store.audioAsset(x.song.id).notes, x.song.notes);
    assert.equal(x.store.music(x.w.token).state.status, 'stopped');
  } finally {
    await x.cleanup();
  }
});

test('editing music notes preserves literal untouched prefixes and original line endings', async () => {
  const x = await fixture();
  try {
    x.click('Bühne', 'Beschreibung bearbeiten');
    await until(() => x.document.getElementById('audio-name').value === 'Bühne');
    x.document.getElementById('audio-notes').value = '  Original\nNeue zweite Zeile\n';
    x.document.getElementById('audio-editor').oninput();
    assert.equal(await x.ui.flushMusic(), true);
    assert.equal(x.store.audioAsset(x.song.id).notes, '  Original\r\nNeue zweite Zeile\r\n');
  } finally {
    await x.cleanup();
  }
});

for (const control of ['console', 'mini', 'soundboard'])
  test(control + ' Stop completes while an older player read is pending', async () => {
    const x = await fixture();
    let release, reading;
    try {
      x.click('Bühne', 'Abspielen');
      await until(() => x.audible().length === 2);
      const read = window.campaign.music;
      window.campaign.music = async (token) => {
        const value = await read(token);
        return new Promise((resolve) => {
          release = async () => {
            resolve(value);
            release = null;
          };
        });
      };
      reading = x.ui.refreshMusic();
      await until(() => !!release);
      let stopping;
      if (control === 'soundboard')
        stopping = x.ui.runLiveMusic(x.w.token, (v) => ({
          kind: 'transport',
          operation: 'stop',
          expectedRevision: v.state.revision,
        }));
      else
        x.document
          .querySelector(
            (control === 'console' ? '#music' : '#music-mini') + ' [data-music-transport=stop]',
          )
          .click();
      await until(
        () => x.store.music(x.w.token).state.manualHold === 'stop' && x.audible().length === 0,
      );
      assert(release, 'Stop must finish before the held read');
      if (stopping) assert.equal(await stopping, true);
      await release();
      await reading;
      assert.equal(x.audible().length, 0);
      assert.equal(x.commands.filter((c) => c.action.operation === 'stop').length, 1);
    } finally {
      if (release) await release();
      if (reading) await reading;
      await x.cleanup();
    }
  });

test('absolute Stop preserves newer choices and its receipt cannot stop a later explicit Play again', async () => {
  const x = await fixture();
  try {
    const basis = x.store.music(x.w.token).state.revision;
    x.execute({ kind: 'select', assetId: x.song.id });
    const current = x.store.music(x.w.token).state;
    for (const expectedRevision of [-1, NaN, current.revision + 1])
      assert.throws(() =>
        x.store.executeMusic({
          commandId: randomUUID(),
          campaignId: x.w.campaign.id,
          token: x.w.token,
          action: { kind: 'transport', operation: 'stop', expectedRevision },
        }),
      );
    const command = {
      commandId: randomUUID(),
      campaignId: x.w.campaign.id,
      token: x.w.token,
      action: { kind: 'transport', operation: 'stop', expectedRevision: basis },
    };
    const stopped = x.store.executeMusic(command);
    assert.equal(stopped.state.manualHold, 'stop');
    assert.deepEqual(stopped.state.queue, current.queue);
    assert.deepEqual(stopped.state.forcedAmbience, current.forcedAmbience);
    assert.deepEqual(stopped.state.current.assetId, current.current.assetId);
    assert.throws(() =>
      x.store.executeMusic({
        ...command,
        commandId: randomUUID(),
        action: { kind: 'transport', operation: 'skip', expectedRevision: basis },
      }),
    );
    x.execute({ kind: 'transport', operation: 'play' });
    const resumed = x.store.music(x.w.token).state;
    assert.equal(x.store.executeMusic(command).state.status, 'playing');
    assert.equal(x.store.music(x.w.token).state.revision, resumed.revision);
  } finally {
    await x.cleanup();
  }
});

test('a sound choice waiting on an older checkpoint cannot undo a newer Stop', async () => {
  const x = await fixture();
  let release;
  try {
    x.click('Bühne', 'Abspielen');
    await until(() => x.audible().length === 2);
    const position = window.campaign.musicPosition;
    window.campaign.musicPosition = async (...args) => {
      const result = await position(...args);
      return new Promise((resolve) => {
        release = () => {
          resolve(result);
          release = null;
        };
      });
    };
    x.click('Regen', 'Sound hinzufügen');
    await until(() => !!release);
    x.transport('stop');
    await until(
      () => x.store.music(x.w.token).state.manualHold === 'stop' && x.audible().length === 0,
    );
    release();
    await tick();
    await tick();
    assert.equal(
      x.commands.filter((c) => c.action.kind === 'ambience' && c.action.assetId === x.rain.id)
        .length,
      0,
    );
    assert.equal(x.audible().length, 0);
    assert.equal(x.store.music(x.w.token).state.current.positionSeconds, 0);
  } finally {
    if (release) release();
    await tick();
    await x.cleanup();
  }
});

test('muted sounds retain their names and allow releasing exactly one without library lookups', async () => {
  const x = await fixture();
  try {
    for (const a of [x.wind, x.rain])
      x.execute({ kind: 'ambience', operation: 'mute', assetId: a.id });
    await x.ui.refreshMusic();
    const view = x.store.music(x.w.token);
    assert.deepEqual(new Set(view.assets.map((a) => a.id)), new Set([x.wind.id, x.rain.id]));
    const root = x.document.getElementById('music-layers');
    assert.match(root.textContent, /Wind.*Unterdrückt/);
    assert.match(root.textContent, /Regen.*Unterdrückt/);
    window.campaign.audioAsset = async () =>
      assert.fail('No individual library request is needed for an already visible muted sound');
    window.campaign.audioAssets = async () =>
      assert.fail('No library search is needed for an already visible muted sound');
    const before = x.store.db.prepare('SELECT * FROM audio_asset ORDER BY id').all();
    root.querySelector('button[aria-label="Wind wieder freigeben"]').click();
    await until(() => !x.store.music(x.w.token).state.mutedAmbience.includes(x.wind.id));
    assert.deepEqual(x.store.music(x.w.token).state.mutedAmbience, [x.rain.id]);
    assert.match(root.textContent, /Regen.*Unterdrückt/);
    assert.deepEqual(x.store.db.prepare('SELECT * FROM audio_asset ORDER BY id').all(), before);
  } finally {
    await x.cleanup();
  }
});
test('a damaged muted sound is isolated and remains explicitly identifiable without rewriting it', async () => {
  const x = await fixture();
  try {
    for (const a of [x.wind, x.rain])
      x.execute({ kind: 'ambience', operation: 'mute', assetId: a.id });
    x.store.db.prepare('UPDATE audio_asset SET checksum=? WHERE id=?').run('damaged', x.wind.id);
    const before = x.store.db.prepare('SELECT * FROM audio_asset WHERE id=?').get(x.wind.id);
    await x.ui.refreshMusic();
    const root = x.document.getElementById('music-layers');
    assert.match(root.textContent, /Regen.*Unterdrückt/);
    assert(root.textContent.includes(x.wind.id));
    assert.match(
      x.document.getElementById('music-error').textContent,
      /Prüfsumme|Checksum|Integrität|beschädigt/i,
    );
    assert.deepEqual(
      x.store.db.prepare('SELECT * FROM audio_asset WHERE id=?').get(x.wind.id),
      before,
    );
    assert.deepEqual(x.store.music(x.w.token).state.mutedAmbience, [x.wind.id, x.rain.id]);
  } finally {
    await x.cleanup();
  }
});

test('copy description opens the confirmed copy, even beside a homonym, and saves only its metadata', async () => {
  const x = await fixture();
  try {
    const existing = x.store.ingestAudio(x.w.token, { ...x.song.media, originalName: 'Other.wav' });
    x.store.executeMusic({
      commandId: randomUUID(),
      campaignId: x.w.campaign.id,
      token: x.w.token,
      action: {
        kind: 'asset',
        asset: { ...existing, name: 'Bühne – Kopie' },
        expectedRevision: existing.revision,
      },
    });
    const original = x.store.audioAsset(x.song.id),
      homonym = x.store.audioAsset(existing.id);
    x.click('Bühne', 'Beschreibung bearbeiten');
    await until(() => x.document.getElementById('audio-name').value === 'Bühne');
    x.document.getElementById('audio-name').scrollIntoView = () => {};
    x.document.getElementById('audio-clone').click();
    await until(() => x.commands.some((c) => c.action.kind === 'clone'));
    await tick();
    await tick();
    assert.equal(x.document.getElementById('audio-name').value, 'Bühne – Kopie');
    const command = x.commands.find((c) => c.action.kind === 'clone');
    assert.ok(command.action.copyId);
    assert.notEqual(command.action.copyId, original.id);
    assert.notEqual(command.action.copyId, homonym.id);
    x.document.getElementById('audio-name').value = 'Meine Hafenmusik';
    x.document.getElementById('audio-vibes').value = 'Hafen, Abend';
    x.document.getElementById('audio-editor').oninput();
    assert.equal(await x.ui.flushMusic(), true);
    assert.deepEqual(x.store.audioAsset(original.id), original);
    assert.deepEqual(x.store.audioAsset(homonym.id), homonym);
    const copy = x.store.audioAsset(command.action.copyId);
    assert.equal(copy.name, 'Meine Hafenmusik');
    assert.deepEqual(copy.vibes, ['Hafen', 'Abend']);
    assert.deepEqual(copy.media, original.media);
    assert.equal(copy.notes, original.notes);
    const before = x.store.db.prepare('SELECT count(*) n FROM audio_asset').get().n;
    x.store.executeMusic(command);
    assert.equal(x.store.db.prepare('SELECT count(*) n FROM audio_asset').get().n, before);
    assert.equal(x.store.audioAsset(copy.id).name, 'Meine Hafenmusik');
  } finally {
    await x.cleanup();
  }
});

test('a copy target cannot overwrite an existing audio identity or change its source', async () => {
  const x = await fixture();
  try {
    const before = x.store.db.serialize();
    assert.throws(
      () =>
        x.store.executeMusic({
          commandId: randomUUID(),
          campaignId: x.w.campaign.id,
          token: x.w.token,
          action: {
            kind: 'clone',
            id: x.song.id,
            expectedRevision: x.song.revision,
            copyId: x.rain.id,
          },
        }),
      /Kopierziel/,
    );
    assert.ok(x.store.db.serialize().equals(before));
  } finally {
    await x.cleanup();
  }
});

for (const next of ['edit', 'select'])
  test('a delayed copy answer preserves a newer original ' + next, async () => {
    const x = await fixture();
    try {
      x.click('Bühne', 'Beschreibung bearbeiten');
      await until(() => x.document.getElementById('audio-name').value === 'Bühne');
      x.hold('clone');
      x.document.getElementById('audio-clone').click();
      await until(x.hasReply);
      if (next === 'edit') {
        x.document.getElementById('audio-name').value = 'Neue Originaleingabe';
        x.document.getElementById('audio-editor').oninput();
      } else {
        x.click('Regen', 'Beschreibung bearbeiten');
        await until(() => x.document.getElementById('audio-name').value === 'Regen');
      }
      x.release();
      await tick();
      await tick();
      assert.equal(
        x.document.getElementById('audio-name').value,
        next === 'edit' ? 'Neue Originaleingabe' : 'Regen',
      );
      if (next === 'edit') {
        assert.equal(await x.ui.flushMusic(), true);
        assert.equal(x.store.audioAsset(x.song.id).name, 'Neue Originaleingabe');
      }
      const copyId = x.commands.find((c) => c.action.kind === 'clone').action.copyId;
      assert.equal(x.store.audioAsset(copyId).name, 'Bühne – Kopie');
    } finally {
      await x.cleanup();
    }
  });
test('a delayed copy metadata read cannot replace a newer original draft', async () => {
  const x = await fixture();
  try {
    x.click('Bühne', 'Beschreibung bearbeiten');
    await until(() => x.document.getElementById('audio-name').value === 'Bühne');
    let release;
    const read = window.campaign.audioAsset;
    window.campaign.audioAsset = async (id) => {
      const result = await read(id);
      if (id !== x.song.id) await new Promise((r) => (release = r));
      return result;
    };
    x.document.getElementById('audio-clone').click();
    await until(() => !!release);
    x.document.getElementById('audio-name').value = 'Spätere Originaleingabe';
    x.document.getElementById('audio-editor').oninput();
    release();
    await tick();
    await tick();
    assert.equal(x.document.getElementById('audio-name').value, 'Spätere Originaleingabe');
    assert.equal(await x.ui.flushMusic(), true);
    assert.equal(x.store.audioAsset(x.song.id).name, 'Spätere Originaleingabe');
  } finally {
    await x.cleanup();
  }
});

test('existing clone requests without an explicit target keep their once-only writer behavior', async () => {
  const x = await fixture();
  try {
    const command = {
        commandId: randomUUID(),
        campaignId: x.w.campaign.id,
        token: x.w.token,
        action: { kind: 'clone', id: x.song.id, expectedRevision: x.song.revision },
      },
      before = x.store.db.prepare('SELECT count(*) n FROM audio_asset').get().n;
    x.store.executeMusic(command);
    assert.equal(x.store.db.prepare('SELECT count(*) n FROM audio_asset').get().n, before + 1);
    x.store.executeMusic(command);
    assert.equal(x.store.db.prepare('SELECT count(*) n FROM audio_asset').get().n, before + 1);
    assert.deepEqual(x.store.audioAsset(x.song.id), x.song);
  } finally {
    await x.cleanup();
  }
});
