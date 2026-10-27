// Owned native task: Atlas → two scene music contexts → Stop → restart → explicit Play.
import { createRequire } from 'node:module';
import { mkdir, writeFile, rm } from 'node:fs/promises';
import { execFileSync } from 'node:child_process';
import { randomUUID, createHash } from 'node:crypto';
import assert from 'node:assert/strict';
import { createNativeSession } from './native-session.mjs';
import { atlasCanvasReady } from './atlas-canvas-probe.mjs';
const root = process.cwd(),
  require = createRequire(root + '/package.json'),
  Database = require('better-sqlite3');
const out = process.env.QA_EVIDENCE_DIR ?? root + '/.build/scene-music-native';
await mkdir(out, { recursive: true });
// A failed rerun must not leave an earlier run's success as its result.
await rm(out + '/result.json', { force: true });
await rm(out + '/failure.json', { force: true });
require('esbuild').buildSync({
  entryPoints: ['src/app/storage/store.ts'],
  outfile: '.build/scene-music-native-store.cjs',
  bundle: true,
  platform: 'node',
  format: 'cjs',
  external: ['better-sqlite3'],
});
const { CampaignStore } = require(root + '/.build/scene-music-native-store.cjs');
async function fixture(profile) {
  const store = new CampaignStore(
      profile + '/workbench.sqlite',
      require(root + '/package.json').version,
    ),
    campaign = store.create('Musik für Hafen und Turm'),
    w = store.activate(campaign.id),
    command = (action) => ({
      commandId: randomUUID(),
      token: w.token,
      campaignId: campaign.id,
      action,
    });
  await mkdir(profile + '/audio', { recursive: true });
  for (const [name, hz, intensity] of [
    ['Hafen bei Nacht', 220, 20],
    ['Sturm am Turm', 330, 80],
    ['Freie Wahl', 440, 50],
  ]) {
    const samples = 8000 * 120,
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
    const asset = store.ingestAudio(w.token, {
      sha256,
      extension: '.wav',
      bytes: bytes.length,
      mime: 'audio/wav',
      originalName: name + '.wav',
    });
    store.executeMusic(
      command({
        kind: 'asset',
        asset: { ...asset, intensity, notes: '  Original\r\n' },
        expectedRevision: asset.revision,
      }),
    );
  }
  const heroes = ['Iri', 'Dorn'].map(
    (name) => store.executeLive(command({ kind: 'create-character', profile: { name } })).character,
  );
  let live = store.live(w.token);
  store.executeLive(command({ kind: 'initialize', expectedRosterRevision: live.rosterRevision }));
  for (const hero of heroes) {
    live = store.live(w.token);
    const c = live.roster.find((c) => c.id === hero.id);
    store.executeLive(
      command({
        kind: 'membership',
        characterId: c.id,
        expectedRevision: c.membershipRevision,
        expectedRosterRevision: live.rosterRevision,
        active: true,
        targetSceneId: live.scene.id,
        expectedFocusRevision: live.focusRevision,
      }),
    );
  }
  live = store.live(w.token);
  store.executeLive(
    command({
      kind: 'scene-content',
      sceneId: live.scene.id,
      expectedRevision: live.scene.revision,
      title: 'Hafen bei Nacht',
      notes: '  Hafenoriginal\r\n',
      locationId: null,
    }),
  );
  live = store.live(w.token);
  store.executeLive(
    command({
      kind: 'move',
      sceneId: live.scene.id,
      expectedRosterRevision: live.rosterRevision,
      expectedFocusRevision: live.focusRevision,
      expectedClockRevision: live.scene.clock.revision,
      expectedSceneMembershipRevision: live.scene.membershipRevision,
      memberIds: [heroes[1].id],
      target: { kind: 'new', title: 'Sturm am Turm', expectedContentRevision: live.scene.revision },
    }),
  );
  const state = store.music(w.token).state;
  store.executeMusic(
    command({
      kind: 'settings',
      expectedRevision: state.revision,
      autoplay: false,
      autoAmbience: false,
      volume: 0.2,
      ambienceVolume: 0.2,
      fadeSeconds: 0,
      loop: 'track',
    }),
  );
  store.tutorial('skipped');
  store.close();
  return { profile, campaign };
}
let app, page, native, db;
const launches = [],
  results = [];
const source = execFileSync('git', ['rev-parse', 'HEAD'], { encoding: 'utf8' }).trim(),
  dirty = !!execFileSync('git', ['status', '--porcelain'], { encoding: 'utf8' }).trim();
let buildHashes;
async function capture(name) {
  await native.capture(page, name);
}
async function until(check) {
  const end = Date.now() + 20000;
  while (!check() && Date.now() < end) await new Promise((r) => setTimeout(r, 30));
  assert(check(), 'Expected confirmed source state');
}
async function close() {
  await native.close();
  app = null;
}
try {
  for (const scale of [1, 2]) {
    native = await createNativeSession({
      root,
      output: out + '/' + scale,
      name: 'scene-music-native',
    });
    assert.equal(native.source, source);
    assert.equal(native.dirty, dirty);
    if (buildHashes) assert.deepEqual(native.artifacts, buildHashes);
    else buildHashes = native.artifacts;
    const { profile, campaign } = await fixture(native.profile),
      errors = native.errors;
    const audio = () =>
      page
        .locator('audio')
        .evaluateAll((ns) =>
          ns
            .filter((a) => !a.paused && a.readyState >= 2)
            .map((a) => ({ src: a.src, time: a.currentTime })),
        );
    async function launch() {
      page = await native.launch(scale);
      app = native.app;
      await app.evaluate(({ BrowserWindow }) => {
        const w = BrowserWindow.getAllWindows().find((w) =>
          w.webContents.getURL().endsWith('/index.html'),
        );
        w.unmaximize();
        w.setContentSize(1400, 1000);
        w.show();
        w.focus();
      });
      assert.equal(
        await app.evaluate(({ BrowserWindow }) =>
          BrowserWindow.getAllWindows()
            .find((w) => w.webContents.getURL().endsWith('/index.html'))
            .webContents.getZoomFactor(),
        ),
        scale,
      );
      await page
        .locator('.campaign-card[data-campaign-id="' + campaign.id + '"]')
        .getByRole('button', { name: /Fortsetzen|Öffnen/ })
        .click();
      await page.waitForFunction(
        () =>
          document.body.classList.contains('has-workspace') &&
          !document.querySelector('main').inert,
      );
    }
    async function tab(id) {
      if (!(await page.locator(id).isVisible())) {
        if (await page.locator('#atlas-navigation').isVisible())
          await page.locator('#atlas-navigation').click();
        if (!(await page.locator(id).isVisible()))
          await page.locator('#workspace-nav-summary').click();
      }
      await page.locator(id).click();
    }
    async function music() {
      await tab('#music-tab');
      await page.locator('#audio-list article').first().waitFor();
      assert.equal(
        await page.locator('#workspace-navigation').evaluate((n) => n.parentElement.tagName),
        'BODY',
      );
      assert.equal(await page.locator('#music-tab').count(), 1);
    }
    await launch();
    db = new Database(profile + '/workbench.sqlite', { readonly: true });
    const state = () => JSON.parse(db.prepare('SELECT payload FROM music_state').get().payload),
      scenes = () => db.prepare('SELECT * FROM live_scene ORDER BY id').all(),
      assets = () => db.prepare('SELECT * FROM audio_asset ORDER BY id').all(),
      originalScenes = scenes(),
      originalAssets = assets(),
      selected = originalAssets.find((r) => JSON.parse(r.payload).name === 'Freie Wahl').id;
    // The original tab handler still guards an unfinished Atlas edit.
    await page.waitForFunction(
      () => document.querySelector('#campaign-atlas').dataset.regionState === 'ready',
    );
    await atlasCanvasReady(page);
    const atlasRows = () => db.prepare('SELECT * FROM atlas_landscape ORDER BY id').all(),
      originalAtlas = atlasRows();
    await page.locator('[data-tool-group="water"]').click();
    await page.locator('[data-atlas-tool="river"]').click();
    await page.waitForFunction(
      () =>
        document.querySelector('#land-tool').value === 'river' &&
        !document.querySelector('#atlas-section').disabled,
    );
    await atlasCanvasReady(page);
    const map = await page.locator('#campaign-map').boundingBox();
    await page.mouse.click(map.x + map.width * 0.5, map.y + map.height * 0.5);
    await page.locator('#land-cancel').waitFor({ state: 'visible' });
    await page.locator('#atlas-navigation').click();
    if (!(await page.locator('#music-tab').isVisible()))
      await page.locator('#workspace-nav-summary').click();
    await capture('navigation-' + scale);
    await page.locator('#music-tab').click();
    assert.equal(await page.locator('#campaign-atlas').isVisible(), true);
    assert.equal(await page.locator('#music').isVisible(), false);
    assert.match(
      await page
        .locator('#atlas-navigation-popup')
        .innerText()
        .catch(() => ''),
      /Musik und Ambience/,
    );
    await page.locator('#land-cancel').click();
    await page.locator('#land-cancel').waitFor({ state: 'hidden' });
    assert.deepEqual(
      atlasRows(),
      originalAtlas,
      'discarding the guarded gesture must not persist a river',
    );
    await music();
    const options = originalScenes.map((r) => ({ id: r.id, title: r.title })),
      harbor = options.find((s) => s.title === 'Hafen bei Nacht'),
      tower = options.find((s) => s.title === 'Sturm am Turm');
    async function focus(scene) {
      await tab('#live-tab');
      await page.locator('#scene-focus').selectOption(scene.id);
      await page.waitForFunction(
        (id) => document.querySelector('#scene-focus').value === id,
        scene.id,
      );
      await music();
      await page.waitForFunction(
        (title) => document.querySelector('#music-context-description').textContent.includes(title),
        scene.title,
      );
    }
    for (const [scene, intensity] of [
      [harbor, 20],
      [tower, 80],
    ]) {
      await focus(scene);
      const input = page.locator('#music-scene-intensity');
      await input.focus();
      await input.press(intensity === 20 ? 'Home' : 'End');
      for (let i = 0; i < 20; i++) await input.press(intensity === 20 ? 'ArrowRight' : 'ArrowLeft');
      await page.getByRole('button', { name: 'Szenenmusik speichern', exact: true }).click();
      await until(() => {
        const saved = db.prepare('SELECT payload FROM scene_music WHERE scene_id=?').get(scene.id);
        return !!saved && JSON.parse(saved.payload).intensity === intensity;
      });
    }
    async function select(name) {
      const id = originalAssets.find((r) => JSON.parse(r.payload).name === name).id;
      await page
        .locator('#audio-list article')
        .filter({ has: page.getByRole('heading', { name, exact: true }) })
        .getByRole('button', { name: 'Abspielen', exact: true })
        .click();
      await page.waitForFunction(
        (id) =>
          [...document.querySelectorAll('audio')].some(
            (a) => a.src.endsWith('/' + id) && !a.paused && a.currentTime > 0.1,
          ),
        id,
      );
    }
    await select('Freie Wahl');
    await page.locator('#music-autoplay').check();
    await until(() => state().autoplay);
    for (const name of ['Hafen bei Nacht', 'Sturm am Turm', 'Freie Wahl']) await select(name);
    for (const scene of [tower, harbor]) {
      await focus(scene);
      await page.locator('#music [data-music-transport="back"]').click();
      const id = originalAssets.find((r) => JSON.parse(r.payload).name === scene.title).id;
      await until(() => state().current.assetId === id);
      await page.waitForFunction(
        (id) =>
          [...document.querySelectorAll('audio')].some(
            (a) => a.src.endsWith('/' + id) && !a.paused && a.currentTime > 0.1,
          ),
        id,
      );
      assert.equal(state().manualHold, 'track');
    }
    await select('Freie Wahl');
    const playback = state().current.playbackId;
    let expectedAssets = originalAssets;
    await focus(harbor);
    assert.equal(state().current.assetId, selected);
    assert.equal(state().current.playbackId, playback);
    assert.equal((await audio()).length, 1);
    // An invalid library description must not prevent the GM from stopping live audio.
    await page
      .locator('#audio-list article')
      .filter({ has: page.getByRole('heading', { name: 'Freie Wahl', exact: true }) })
      .getByRole('button', { name: 'Beschreibung bearbeiten', exact: true })
      .click();
    await page.locator('#audio-name').fill('');
    await page.getByRole('button', { name: 'Beschreibung speichern', exact: true }).click();
    await page.waitForFunction(() =>
      document.querySelector('#status').textContent.includes('Musikeingabe bleibt offen'),
    );
    await app.evaluate(({ ipcMain }) => {
      const read = ipcMain._invokeHandlers.get('music:view');
      globalThis.qaHoldMusicReads = true;
      globalThis.qaMusicReplies = [];
      ipcMain.removeHandler('music:view');
      ipcMain.handle('music:view', async (e, ...args) => {
        const value = await read(e, ...args);
        if (!globalThis.qaHoldMusicReads) return value;
        return new Promise((resolve) => globalThis.qaMusicReplies.push(() => resolve(value)));
      });
      const position = ipcMain._invokeHandlers.get('music:position'),
        execute = ipcMain._invokeHandlers.get('music:execute');
      globalThis.qaPositionUnavailable = true;
      globalThis.qaStopCommands = [];
      ipcMain.removeHandler('music:position');
      ipcMain.handle('music:position', (e, ...args) =>
        globalThis.qaPositionUnavailable
          ? { ok: false, error: 'Controlled position checkpoint failure' }
          : position(e, ...args),
      );
      ipcMain.removeHandler('music:execute');
      ipcMain.handle('music:execute', (e, c) => {
        if (c.action.kind === 'transport' && c.action.operation === 'stop')
          globalThis.qaStopCommands.push(c);
        return execute(e, c);
      });
    });
    await app.evaluate(async () => {
      for (let i = 0; i < 200; i++) {
        if (globalThis.qaMusicReplies.length) return;
        await new Promise((r) => setTimeout(r, 30));
      }
      throw Error('Expected pending periodic music read');
    });
    await page
      .locator((scale === 1 ? '#music' : '#music-mini') + ' [data-music-transport="stop"]')
      .click();
    await until(() => state().manualHold === 'stop');
    await page.waitForFunction(() =>
      [...document.querySelectorAll('audio')].every((a) => a.paused),
    );
    await app.evaluate(() => {
      globalThis.qaHoldMusicReads = false;
      for (const reply of globalThis.qaMusicReplies.splice(0)) reply();
    });
    await page.evaluate(
      () => new Promise((r) => requestAnimationFrame(() => requestAnimationFrame(r))),
    );
    assert.deepEqual(await audio(), []);
    assert.equal(await page.locator('#audio-name').inputValue(), '');
    assert.deepEqual(assets(), originalAssets);
    assert.equal((await app.evaluate(() => globalThis.qaStopCommands)).length, 1);
    await capture('draft-stop-' + scale);
    await app.evaluate(() => (globalThis.qaPositionUnavailable = false));
    await page.locator('#audio-name').fill('Freie Wahl');
    await page.getByRole('button', { name: 'Beschreibung speichern', exact: true }).click();
    await until(
      () =>
        assets().find((a) => a.id === selected).revision ===
        originalAssets.find((a) => a.id === selected).revision + 1,
    );
    for (const row of assets()) {
      const original = originalAssets.find((a) => a.id === row.id);
      if (row.id !== selected) assert.deepEqual(row, original);
      else
        assert.deepEqual(
          { ...JSON.parse(row.payload), revision: original.revision },
          JSON.parse(original.payload),
        );
    }
    expectedAssets = assets();
    // Exercise the soundboard's shared stop path with its position checkpoint unavailable too.
    await page.locator('#soundboard-shortcut').click();
    await page.getByRole('button', { name: '▶ Start / Fortsetzen', exact: true }).click();
    await page.waitForFunction(() =>
      [...document.querySelectorAll('audio')].some((a) => !a.paused && a.currentTime > 0.1),
    );
    await app.evaluate(() => (globalThis.qaPositionUnavailable = true));
    await page.getByRole('button', { name: 'Alles stoppen', exact: true }).click();
    await until(() => state().manualHold === 'stop');
    await page.waitForFunction(() =>
      [...document.querySelectorAll('audio')].every((a) => a.paused),
    );
    assert.equal((await app.evaluate(() => globalThis.qaStopCommands)).length, 2);
    await app.evaluate(() => (globalThis.qaPositionUnavailable = false));
    await tab('#live-tab');
    await page.locator('#music-mini [data-music-transport="stop"]').click();
    await until(() => state().status === 'stopped');
    await page.waitForFunction(() =>
      [...document.querySelectorAll('audio')].every((a) => a.paused),
    );
    await focus(tower);
    assert.equal(state().manualHold, 'stop');
    assert.equal(state().status, 'stopped');
    assert.deepEqual(await audio(), []);
    await tab('#atlas-tab');
    await page.waitForFunction(() => document.body.classList.contains('atlas-workspace'));
    await music();
    assert.deepEqual(await audio(), []);
    await capture('stopped-' + scale);
    assert.deepEqual(scenes(), originalScenes);
    assert.deepEqual(assets(), expectedAssets);
    db.close();
    db = null;
    await close();
    await launch();
    assert.deepEqual(await audio(), []);
    await music();
    assert.match(await page.locator('#music-now').innerText(), /Freie Wahl.*Gestoppt/);
    assert.deepEqual(await audio(), []);
    await page.locator('#music [data-music-transport="play"]').click();
    await page.waitForFunction(
      (id) =>
        [...document.querySelectorAll('audio')].some(
          (a) => a.src.endsWith('/' + id) && !a.paused && a.currentTime > 0.1,
        ),
      selected,
    );
    assert.equal((await audio()).length, 1);
    await page.locator('#music [data-music-transport="stop"]').click();
    await page.waitForFunction(() =>
      [...document.querySelectorAll('audio')].every((a) => a.paused),
    );
    db = new Database(profile + '/workbench.sqlite', { readonly: true });
    assert.deepEqual(scenes(), originalScenes);
    assert.deepEqual(assets(), expectedAssets);
    db.close();
    db = null;
    await close();
    assert.deepEqual(errors, []);
    results.push({
      scale,
      profile,
      atlasDraftGuard: true,
      singleNavigationOwner: true,
      sceneSettings: [20, 80],
      multiStepBack: true,
      manualTrackPreserved: true,
      draftStop: scale === 1 ? 'console' : 'mini',
      invalidDraftPreserved: true,
      checkpointFailureStop: true,
      soundboardStop: true,
      literalNotesPreserved: true,
      stopPreserved: true,
      restartSilent: true,
      explicitPlayDecoded: true,
      authorDataPreserved: true,
      pendingReadStop: true,
      actualBrowserZoom: scale,
    });
    await native.finish({ result: results.at(-1) });
    launches.push(...native.launches);
    await native.dispose();
    native = null;
  }
  await writeFile(
    out + '/result.json',
    JSON.stringify({ source, dirty, buildHashes, launches, results }, null, 2),
  );
  console.log(JSON.stringify({ launches, results }));
} catch (e) {
  await native?.fail(e);
  throw e;
} finally {
  db?.close();
  await native?.dispose();
}
