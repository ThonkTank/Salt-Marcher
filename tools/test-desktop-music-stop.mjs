import { currentProcessGroup } from './process-group.mjs';
import { createRequire } from 'node:module';
import { mkdtemp, readFile, writeFile, mkdir, stat } from 'node:fs/promises';
import { spawn } from 'node:child_process';
import { randomUUID, createHash } from 'node:crypto';
import assert from 'node:assert/strict';
import path from 'node:path';
const source = process.cwd(),
  before = process.argv.includes('--before'),
  phase = before ? 'before' : 'after',
  output = process.env.QA_EVIDENCE_DIR ?? path.join(source, '.build/music-stop-evidence');
const group = await currentProcessGroup();
await mkdir(output, { recursive: true });
const require = createRequire(source + '/package.json'),
  { _electron } = require('playwright-core');
require('esbuild').buildSync({
  entryPoints: ['src/app/storage/store.ts'],
  outfile: '.build/music-native-store.cjs',
  bundle: true,
  platform: 'node',
  format: 'cjs',
  external: ['better-sqlite3'],
});
const { CampaignStore } = require(source + '/.build/music-native-store.cjs');
const profile = await mkdtemp('/tmp/gm-music-stop-'),
  file = profile + '/workbench.sqlite',
  store = new CampaignStore(file),
  campaign = store.create('Eine Szene in Ruhe wechseln'),
  w = store.activate(campaign.id),
  command = (action) => ({
    commandId: randomUUID(),
    token: w.token,
    campaignId: campaign.id,
    action,
  });
await mkdir(profile + '/audio', { recursive: true });
const assets = [];
for (const [name, kind, hz] of [
  ['Bühne', 'song', 220],
  ['Regen', 'ambience', 330],
  ['Wind', 'ambience', 80],
]) {
  const samples = 8000 * 60,
    bytes = Buffer.alloc(44 + samples * 2);
  bytes.write('RIFF');
  bytes.writeUInt32LE(bytes.length - 8, 4);
  bytes.write('WAVE', 8);
  bytes.write('fmt ', 12);
  bytes.writeUInt32LE(16, 16);
  bytes.writeUInt16LE(1, 20);
  bytes.writeUInt16LE(1, 22);
  bytes.writeUInt32LE(8000, 24);
  bytes.writeUInt32LE(16000, 28);
  bytes.writeUInt16LE(2, 32);
  bytes.writeUInt16LE(16, 34);
  bytes.write('data', 36);
  bytes.writeUInt32LE(samples * 2, 40);
  for (let i = 0; i < samples; i++)
    bytes.writeInt16LE(Math.round(64 * Math.sin((2 * Math.PI * hz * i) / 8000)), 44 + i * 2);
  const sha256 = createHash('sha256').update(bytes).digest('hex');
  await writeFile(profile + '/audio/' + sha256 + '.wav', bytes);
  let asset = store.ingestAudio(w.token, {
    sha256,
    extension: '.wav',
    bytes: bytes.length,
    mime: 'audio/wav',
    originalName: name + '.wav',
  });
  asset = { ...asset, kind, notes: '  Eigene Probe\r\n' };
  store.executeMusic(command({ kind: 'asset', asset, expectedRevision: asset.revision }));
  assets.push(store.audioAsset(asset.id));
}
const people = ['Iri', 'Dorn'].map(
    (name) => store.executeLive(command({ kind: 'create-character', profile: { name } })).character,
  ),
  definition = store.executeItemShop(
    command({
      kind: 'definition',
      expectedRevision: null,
      definition: {
        id: randomUUID(),
        revision: 0,
        name: 'Seil',
        category: 'equipment',
        magic: false,
        rarity: '',
        attunement: 'no',
        unitCopper: '100',
        weightText: '',
        properties: [],
        description: '',
        source: { kind: 'authored', label: 'Eigene Vorlage', license: null, url: null },
        trashed: false,
      },
    }),
  ).definition;
store.executeProgress(
  command({
    kind: 'manual-item',
    characterId: people[0].id,
    expectedMembershipRevision: people[0].membershipRevision,
    origin: 'manual',
    item: {
      name: 'Seil',
      category: 'equipment',
      quantity: 2,
      valueGold: '1',
      reference: { kind: 'authored', definitionId: definition.id, revision: definition.revision },
    },
    note: '  Originalbeleg\r\n',
  }),
);
store.executeItemShop(
  command({
    kind: 'definition',
    expectedRevision: definition.revision,
    definition: { ...definition, unitCopper: '300' },
  }),
);
const originalLedger = store.db.prepare('SELECT * FROM character_ledger ORDER BY id').all();
const state = store.music(w.token).state;
store.executeMusic(
  command({
    kind: 'settings',
    expectedRevision: state.revision,
    autoplay: false,
    autoAmbience: false,
    volume: 0.7,
    ambienceVolume: 0.3,
    fadeSeconds: 0,
    loop: 'track',
  }),
);
store.close();
const [song, rain, wind] = assets;
const busPath = profile + '/qa-bus',
  proxy = spawn(
    'xdg-dbus-proxy',
    [
      process.env.DBUS_SESSION_BUS_ADDRESS,
      busPath,
      '--filter',
      '--talk=org.freedesktop.portal.Desktop',
      '--talk=org.freedesktop.Notifications',
    ],
    { stdio: 'ignore' },
  );
for (let i = 0; i < 100; i++) {
  if (
    await stat(busPath)
      .then(() => true)
      .catch(() => false)
  )
    break;
  await new Promise((r) => setTimeout(r, 20));
}
let app,
  pid,
  closed = false;
const errors = [],
  launches = [],
  results = {};
async function launch() {
  closed = false;
  app = await _electron.launch({
    executablePath: source + '/node_modules/electron/dist/electron',
    args: [source + '/.build/desktop/main.cjs', '--data-dir', profile],
    env: { ...process.env, DBUS_SESSION_BUS_ADDRESS: 'unix:path=' + busPath },
    timeout: 20000,
  });
  pid = app.process().pid;
  assert((await readFile(`/proc/${pid}/cmdline`, 'utf8')).includes(profile));
  assert.equal((await readFile(`/proc/${pid}/cgroup`, 'utf8')).trim().split('::')[1], group);
  launches.push({ pid, cgroup: group });
  const page = await app.firstWindow();
  page.on('pageerror', (e) => errors.push(e.stack));
  await page.waitForFunction(() => document.body.dataset.tutorialReady === 'true', null, {
    timeout: 20000,
  });
  if (await page.locator('#tutorial-dialog').isVisible())
    await page.locator('#tutorial-skip').click();
  await page.locator('#campaigns').selectOption(campaign.id);
  await page.locator('#music-tab').click();
  await page.waitForFunction(() => document.querySelectorAll('#audio-list article').length === 3);
  return page;
}
async function close() {
  assert.deepEqual(errors, []);
  const exit = new Promise((r) =>
    app.process().once('exit', (code, signal) => r({ code, signal })),
  );
  await app.evaluate(({ BrowserWindow }) =>
    BrowserWindow.getAllWindows()
      .find((w) => w.getTitle() === 'SaltMarcher')
      .close(),
  );
  assert.deepEqual(await exit, { code: 0, signal: null });
  closed = true;
}
const sounding = () =>
  Array.from(document.querySelectorAll('audio'))
    .filter((a) => !a.paused && a.readyState >= 2)
    .map((a) => ({
      slot: a.dataset.musicSlot,
      ambience: a.dataset.ambienceId,
      seconds: a.currentTime,
      volume: a.volume,
      duration: a.duration,
    }));
async function add(page, name) {
  await page
    .locator('#audio-list article')
    .filter({ has: page.getByRole('heading', { name, exact: true }) })
    .getByRole('button', { name: 'Sound hinzufügen', exact: true })
    .click();
}
async function stop(page) {
  await page.locator('#music-mini [data-music-transport=stop]').click();
  await page.waitForFunction(
    () =>
      document.querySelector('#music-now').textContent.includes('Gestoppt') &&
      Array.from(document.querySelectorAll('audio')).every((a) => a.paused),
  );
}
try {
  let page = await launch();
  await page
    .locator('#audio-list article')
    .filter({ has: page.getByRole('heading', { name: 'Bühne', exact: true }) })
    .getByRole('button', { name: 'Abspielen', exact: true })
    .click();
  await page.waitForFunction(() =>
    Array.from(document.querySelectorAll('audio[data-music-slot]')).some(
      (a) => !a.paused && a.currentTime > 0.1,
    ),
  );
  results.initialSongDuration = await page.evaluate(
    () =>
      Array.from(document.querySelectorAll('audio[data-music-slot]')).find((a) => !a.paused)
        .duration,
  );
  results.seekDisabled = await page.locator('#music-seek').isDisabled();
  if (!before) {
    assert.equal(results.initialSongDuration, 60);
    assert.equal(results.seekDisabled, false);
    await page.locator('#music-seek').focus();
    await page.locator('#music-seek').press('Home');
    for (let i = 0; i < 20; i++) await page.locator('#music-seek').press('ArrowRight');
    await page.waitForFunction(() =>
      Array.from(document.querySelectorAll('audio[data-music-slot]')).some(
        (a) => !a.paused && a.currentTime >= 1.9 && a.currentTime < 5,
      ),
    );
    results.nativeSeekUsable = true;
  }
  await add(page, 'Wind');
  await page.waitForFunction(
    (id) =>
      Array.from(document.querySelectorAll('audio[data-ambience-id]')).some(
        (a) => a.dataset.ambienceId === id && !a.paused && a.currentTime > 0.1,
      ),
    wind.id,
  );
  results.initialMusicAndWindDecoded = true;
  await stop(page);
  results.stopSilencesAll = true;
  await add(page, 'Regen');
  if (!before)
    await page.waitForFunction(
      (id) =>
        Array.from(document.querySelectorAll('audio[data-ambience-id]')).some(
          (a) => a.dataset.ambienceId === id && !a.paused && a.currentTime > 0.1,
        ),
      rain.id,
    );
  else await page.waitForTimeout(300);
  results.afterExplicitRain = await page.evaluate(sounding);
  await page.locator('#music-now').scrollIntoViewIfNeeded();
  await page.screenshot({ path: path.join(output, 'music-' + phase + '.png') });
  if (!before) {
    assert.equal(results.afterExplicitRain.length, 1);
    assert.equal(results.afterExplicitRain[0].ambience, rain.id);
    assert(Math.abs(results.afterExplicitRain[0].volume - 0.3) < 0.00001);
    await page.waitForTimeout(5200);
    const refreshed = await page.evaluate(sounding);
    assert.equal(refreshed.length, 1);
    assert.equal(refreshed[0].ambience, rain.id);
    results.afterRefresh = refreshed;
    results.onlyRainSurvivesRefresh = true;
    results.range = await app.evaluate(async ({ net }, id) => {
      const response = await net.fetch('campaign://app/audio/' + id, {
        headers: { Range: 'bytes=0-43' },
      });
      return {
        status: response.status,
        headers: Object.fromEntries(response.headers),
        bytes: (await response.arrayBuffer()).byteLength,
      };
    }, rain.id);
    assert.equal(results.range.status, 206);
    assert.equal(results.range.bytes, 44);
    assert.equal(results.range.headers['content-range'], 'bytes 0-43/' + rain.media.bytes);
    assert.equal(results.afterExplicitRain[0].duration, 60);
    results.sampleRms = await page.evaluate(async (id) => {
      const audio = Array.from(document.querySelectorAll('audio')).find(
          (a) => a.dataset.ambienceId === id && !a.paused,
        ),
        context = new AudioContext(),
        capture = audio.captureStream(),
        source = context.createMediaStreamSource(capture),
        analyser = context.createAnalyser(),
        silent = context.createGain();
      silent.gain.value = 0;
      source.connect(analyser);
      analyser.connect(silent);
      silent.connect(context.destination);
      await context.resume();
      await new Promise((r) => setTimeout(r, 150));
      const samples = new Float32Array(analyser.fftSize);
      analyser.getFloatTimeDomainData(samples);
      const rms = Math.sqrt(samples.reduce((sum, n) => sum + n * n, 0) / samples.length);
      source.disconnect();
      await context.close();
      capture.getTracks().forEach((t) => t.stop());
      return rms;
    }, rain.id);
    assert(results.sampleRms > 0.000001);
    await page.locator('#live-tab').click();
    assert((await page.locator('#music-mini-title').innerText()).includes('1 Sound aktiv'));
    const liveSounds = await page.evaluate(sounding);
    assert.equal(liveSounds.length, 1);
    assert.equal(liveSounds[0].ambience, rain.id);
    results.playingLayerVisibleWhileLeading = true;
    await stop(page);
    await page.locator('#music-tab').click();
  }
  await close();
  const fresh = new CampaignStore(file);
  try {
    for (const asset of assets) {
      const current = fresh.audioAsset(asset.id);
      assert.deepEqual(current, asset);
      assert.equal(
        createHash('sha256')
          .update(await readFile(fresh.audioFile(asset.id)))
          .digest('hex'),
        asset.media.sha256,
      );
    }
    results.mediaAndDescriptionsUnchanged = true;
  } finally {
    fresh.close();
  }
  if (!before) {
    page = await launch();
    assert.deepEqual(await page.evaluate(sounding), []);
    await add(page, 'Regen');
    await page.waitForFunction(
      (id) =>
        Array.from(document.querySelectorAll('audio[data-ambience-id]')).some(
          (a) => a.dataset.ambienceId === id && !a.paused && a.currentTime > 0.1,
        ),
      rain.id,
    );
    const sounds = await page.evaluate(sounding);
    assert.equal(sounds.length, 1);
    assert.equal(sounds[0].ambience, rain.id);
    await stop(page);
    await page.locator('#live-tab').click();
    await page.waitForFunction(() =>
      document.querySelector('#loot-balance-list').textContent.includes('Iri: 6,00 GM'),
    );
    await page.locator('#loot-balance summary').click();
    results.nativeLootBalance = await page.locator('#loot-balance-list').innerText();
    await page.locator('#loot-balance').scrollIntoViewIfNeeded();
    await page.screenshot({ path: path.join(output, 'loot-balance.png') });
    await close();
    results.freshStopAndExplicitSingleLayer = true;
    const ledgerCheck = new CampaignStore(file);
    try {
      assert.deepEqual(
        ledgerCheck.db.prepare('SELECT * FROM character_ledger ORDER BY id').all(),
        originalLedger,
      );
      results.lootLedgerUnchanged = true;
    } finally {
      ledgerCheck.close();
    }
  }
  await writeFile(
    path.join(output, 'music-' + phase + '.json'),
    JSON.stringify({ results, launches, normalClose: true }, null, 2),
  );
  console.log(JSON.stringify({ results, normalClose: true }));
  assert.equal(results.afterExplicitRain.length, 1, 'Explicit rain after Stop must play one sound');
  assert.equal(results.afterExplicitRain[0].ambience, rain.id);
} catch (e) {
  if (app && !closed) {
    await writeFile(
      path.join(output, 'failure.json'),
      JSON.stringify({ error: e.stack, results, pid }, null, 2),
    );
    try {
      await (await app.firstWindow()).screenshot({ path: path.join(output, 'failure.png') });
    } catch {}
  }
  throw e;
} finally {
  if (app && !closed) {
    await Promise.race([app.close().catch(() => {}), new Promise((r) => setTimeout(r, 3000))]);
    if ((await readFile(`/proc/${pid}/cmdline`, 'utf8').catch(() => '')).includes(profile))
      process.kill(pid, 'SIGKILL');
  }
  proxy.kill();
}
