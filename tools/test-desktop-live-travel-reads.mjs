import { createRequire } from 'node:module';
import { mkdtemp, mkdir, readFile, writeFile, stat } from 'node:fs/promises';
import { spawn, execFileSync } from 'node:child_process';
import { randomUUID, createHash } from 'node:crypto';
import assert from 'node:assert/strict';
import path from 'node:path';
const root = process.cwd(),
  out = path.resolve(process.argv[2] ?? '.build/live-travel-read-evidence');
await mkdir(out, { recursive: true });
const require = createRequire(import.meta.url),
  { _electron } = require('playwright-core');
require('esbuild').buildSync({
  entryPoints: ['src/app/storage/store.ts'],
  outfile: '.build/live-travel-read-store.cjs',
  bundle: true,
  platform: 'node',
  format: 'cjs',
  external: ['better-sqlite3'],
});
const { CampaignStore } = require(root + '/.build/live-travel-read-store.cjs'),
  profile = await mkdtemp('/tmp/live-travel-'),
  file = profile + '/workbench.sqlite',
  store = new CampaignStore(file),
  campaign = store.create('Eine Reise · ein Gruppenstand'),
  w = store.activate(campaign.id),
  command = (action) => ({
    commandId: randomUUID(),
    campaignId: campaign.id,
    token: w.token,
    action,
  });
const scene = store.executeLive(command({ kind: 'initialize', expectedRosterRevision: 0 })).scene,
  pc = store.executeLive(
    command({ kind: 'create-character', profile: { name: 'Iri', speedFeet: 30 } }),
  ).character,
  live = store.live(w.token);
store.executeLive(
  command({
    kind: 'membership',
    characterId: pc.id,
    expectedRevision: pc.membershipRevision,
    expectedRosterRevision: live.rosterRevision,
    active: true,
    targetSceneId: scene.id,
    expectedFocusRevision: live.focusRevision,
  }),
);
const map = store.world(w.token).maps[0];
store.executeWorld(
  command({
    kind: 'place-scene',
    sceneId: scene.id,
    expectedSceneRevision: scene.revision,
    expectedPositionRevision: 0,
    position: { mapId: map.id, q: 0, r: 0, locationId: null },
  }),
);
store.executeWorld(
  command({
    kind: 'calendar-event',
    expectedRevision: null,
    event: {
      id: randomUUID(),
      revision: 0,
      name: 'Markt am Reiseweg',
      startMs: '0',
      durationMs: '86400000',
      repeatMs: null,
      locationId: null,
      notes: 'Ein einziges Ereignis.',
      trashed: false,
    },
  }),
);
store.changePreparation({
  ...command(null),
  change: {
    kind: 'note',
    expectedRevision: null,
    note: {
      version: 1,
      id: randomUUID(),
      revision: 1,
      kind: 'note',
      title: 'Wissen am Nordtor',
      readAloud: '',
      gmNotes: 'Wachen warten.',
      relations: [],
      creatureId: null,
      deleted: false,
    },
  },
});
store.close();
const busPath = profile + '/bus',
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
  closed = true;
const errors = [],
  results = [],
  openings = [],
  artifacts = {},
  notes = '  Eine aktuelle Spielnotiz\nmit zweiter Zeile  ';
for (const p of ['main.cjs', 'preload.cjs', 'ui/renderer.js'])
  artifacts[p] = createHash('sha256')
    .update(await readFile('.build/desktop/' + p))
    .digest('hex');
async function launch(scale) {
  app = await _electron.launch({
    executablePath: root + '/node_modules/electron/dist/electron',
    args: [
      root + '/.build/desktop/main.cjs',
      '--ozone-platform=x11',
      '--force-device-scale-factor=' + scale,
      '--data-dir',
      profile,
    ],
    env: { ...process.env, DBUS_SESSION_BUS_ADDRESS: 'unix:path=' + busPath },
    timeout: 30000,
  });
  closed = false;
  const page = await app.firstWindow();
  page.on('pageerror', (e) => errors.push(e.stack));
  page.setDefaultTimeout(20000);
  await page.waitForFunction(() => document.body.dataset.tutorialReady === 'true');
  if (await page.locator('#tutorial-dialog').isVisible())
    await page.locator('#tutorial-skip').click();
  await page
    .locator('.campaign-card[data-campaign-id="' + campaign.id + '"]')
    .getByRole('button', { name: 'Fortsetzen', exact: true })
    .click();
  await page.locator('#workspace-navigation').waitFor({ state: 'visible' });
  await app.evaluate(({ ipcMain }, scale) => {
    globalThis.__preparationMode = scale === 1 ? 'error' : 'ready';
    globalThis.__preparationReads = 0;
    const reader = ipcMain._invokeHandlers.get('campaign:preparation');
    ipcMain.removeHandler('campaign:preparation');
    ipcMain.handle('campaign:preparation', async (event, ...args) => {
      globalThis.__preparationReads++;
      if (globalThis.__preparationMode === 'error')
        return { ok: false, error: 'Kontrollierte unlesbare Vorbereitung' };
      const result = await reader(event, ...args);
      if (globalThis.__preparationMode === 'hold') {
        globalThis.__preparationMode = 'ready';
        globalThis.__preparationHeld = true;
        await new Promise((resolve) => (globalThis.__releasePreparation = resolve));
      }
      return result;
    });
  }, scale);
  await app.evaluate(({ ipcMain }) => {
    globalThis.__travelReadCounts = { scene: 0, agenda: 0 };
    globalThis.__liveCommands = [];
    for (const [channel, key] of [
      ['world:scene', 'scene'],
      ['world:agenda', 'agenda'],
    ]) {
      const handler = ipcMain._invokeHandlers.get(channel);
      ipcMain.removeHandler(channel);
      ipcMain.handle(channel, (event, ...args) => {
        globalThis.__travelReadCounts[key]++;
        return handler(event, ...args);
      });
    }
    const writer = ipcMain._invokeHandlers.get('campaign:execute-live');
    ipcMain.removeHandler('campaign:execute-live');
    ipcMain.handle('campaign:execute-live', async (event, command) => {
      const result = await writer(event, command);
      if (command.action.kind === 'profile' && globalThis.__holdProfile) {
        globalThis.__holdProfile = false;
        globalThis.__profileHeld = true;
        await new Promise((resolve) => {
          globalThis.__releaseProfile = resolve;
        });
      }
      globalThis.__liveCommands.push({ kind: command.action.kind, ok: result.ok });
      if (command.action.kind === 'profile' && globalThis.__loseProfile) {
        globalThis.__loseProfile = false;
        globalThis.__lostProfile = true;
        throw Error('Kontrollierter Verlust der bereits gespeicherten Profilantwort');
      }
      return result;
    });
  });
  if (!(await page.locator('#live-tab').isVisible()))
    await page.locator('#workspace-nav-summary').click();
  await page.locator('#live-tab').click();
  if (await page.locator('#live-continue').isVisible())
    await page.locator('#live-continue').click();
  if (scale === 1) {
    await page.locator('#live-sources-retry').waitFor({ state: 'visible' });
    assert.match(await page.locator('#live-knowledge-result').textContent(), /nicht verfügbar/);
    assert.equal(await page.locator('#running-notes').isEditable(), true);
    await page.locator('#running-notes').scrollIntoViewIfNeeded();
    await page.screenshot({ path: path.join(out, 'preparation-unavailable-100.png') });
  } else {
    await page.locator('#live-sources-state').waitFor({ state: 'hidden' });
    assert.match(await page.locator('#live-knowledge-results').textContent(), /Wissen am Nordtor/);
  }
  await page.locator('#live-travel-toggle').waitFor({ state: 'visible' });
  const counts = await oneContext(page);
  openings.push({ scale, counts });
  await resetReads();
  return page;
}
async function resetReads() {
  await app.evaluate(() => {
    globalThis.__travelReadCounts = { scene: 0, agenda: 0 };
  });
}
async function oneContext(page, written = false) {
  let state;
  for (let i = 0; i < 200; i++) {
    state = await app.evaluate(() => ({
      counts: globalThis.__travelReadCounts,
      commands: globalThis.__liveCommands,
    }));
    if (
      state.counts.scene >= 1 &&
      state.counts.agenda >= 1 &&
      (!written || state.commands.some((c) => c.kind === 'scene-content' && c.ok))
    )
      break;
    await new Promise((resolve) => setTimeout(resolve, 50));
  }
  await page.waitForFunction(
    () => document.querySelector('#live-agenda-upcoming').getAttribute('aria-busy') === 'false',
  );
  await page.evaluate(
    () => new Promise((resolve) => requestAnimationFrame(() => requestAnimationFrame(resolve))),
  );
  const counts = await app.evaluate(() => globalThis.__travelReadCounts);
  assert.deepEqual(counts, { scene: 1, agenda: 1 });
  return counts;
}
async function profileWhileReplyPending(page) {
  if (!(await page.locator('#character-name').isVisible()))
    await page.locator('#live-party-details > summary').click();
  await page.locator('#party-shortcut').click();
  const card = page.locator('#party-active [data-character-id="' + pc.id + '"]');
  await card.locator('.party-member-toggle').click();
  await card.getByRole('button', { name: 'Profil bearbeiten', exact: true }).click();
  await page.locator('#party-name').fill('Party-Iri');
  await app.evaluate(() => {
    globalThis.__holdProfile = true;
  });
  await page
    .locator('#party-profile-form')
    .getByRole('button', { name: 'Profil speichern', exact: true })
    .click();
  let held = false;
  for (let i = 0; i < 200; i++) {
    held = await app.evaluate(() => !!globalThis.__profileHeld);
    if (held) break;
    await new Promise((resolve) => setTimeout(resolve, 25));
  }
  assert.equal(held, true);
  await page.keyboard.press('Escape');
  await page.locator('#character-name').fill('Neuere Iri');
  await app.evaluate(() => globalThis.__releaseProfile());
  let writes = [];
  for (let i = 0; i < 200; i++) {
    writes = await app.evaluate(() =>
      globalThis.__liveCommands.filter((c) => c.kind === 'profile' && c.ok),
    );
    if (writes.length >= 2) break;
    await new Promise((resolve) => setTimeout(resolve, 25));
  }
  assert.equal(writes.length, 2);
  assert.equal(await page.locator('#character-name').inputValue(), 'Neuere Iri');
  await page.waitForFunction(
    () => document.querySelector('#live-agenda-upcoming').getAttribute('aria-busy') === 'false',
  );
  await page.evaluate(
    () => new Promise((resolve) => requestAnimationFrame(() => requestAnimationFrame(resolve))),
  );
  const counts = await app.evaluate(() => globalThis.__travelReadCounts);
  assert.deepEqual(counts, { scene: 2, agenda: 2 });
  await page.screenshot({ path: path.join(out, 'profile-newer-intent.png') });
  return counts;
}
async function recoverPartyProfile(page) {
  await page.locator('#party-shortcut').click();
  const card = page.locator('#party-active [data-character-id="' + pc.id + '"]');
  const edit = card.getByRole('button', { name: 'Profil bearbeiten', exact: true });
  if (!(await edit.isVisible())) await card.locator('.party-member-toggle').click();
  await edit.click();
  await page.locator('#party-name').fill('Recovered Iri');
  await app.evaluate(() => {
    globalThis.__loseProfile = true;
  });
  await page
    .locator('#party-profile-form')
    .getByRole('button', { name: 'Profil speichern', exact: true })
    .click();
  await page.locator('#live-reconcile').waitFor({ state: 'visible' });
  assert.equal(await app.evaluate(() => globalThis.__lostProfile), true);
  await page.keyboard.press('Escape');
  await page.locator('#live-reconcile').click();
  const counts = await oneContext(page);
  assert.equal(await page.locator('#live-reconcile').isVisible(), false);
  assert.equal(await page.locator('#character-name').inputValue(), 'Recovered Iri');
  await page.screenshot({ path: path.join(out, 'profile-receipt-confirmed.png') });
  return counts;
}
async function openTravel(page) {
  await page.locator('#live-travel-toggle').click();
  await page.waitForFunction(
    () =>
      document.querySelector('#live-travel-toggle').getAttribute('aria-expanded') === 'true' &&
      !document.querySelector('#live-travel-toggle').disabled &&
      document.querySelector('#live-agenda-upcoming').getAttribute('aria-busy') === 'false',
  );
  const counts = await app.evaluate(() => globalThis.__travelReadCounts);
  assert.deepEqual(counts, { scene: 1, agenda: 1 });
  assert.equal(await page.locator('#live-agenda-upcoming p').count(), 1);
  assert.match(await page.locator('#live-agenda-upcoming').textContent(), /Markt am Reiseweg/);
  assert.equal(await page.locator('#live-center-scene').isVisible(), true);
  assert.equal(await page.locator('#live-center-map').isVisible(), false);
  return counts;
}
async function close() {
  const ended = new Promise((resolve) =>
    app.process().once('exit', (code, signal) => resolve({ code, signal })),
  );
  await app.evaluate(({ BrowserWindow }) =>
    BrowserWindow.getAllWindows()
      .find((w) => w.webContents.getURL().endsWith('/index.html'))
      .close(),
  );
  const exit = await ended;
  assert.deepEqual(exit, { code: 0, signal: null });
  closed = true;
  return exit;
}
try {
  let page = await launch(1);
  const materialReads = await app.evaluate(() => globalThis.__preparationReads);
  await app.evaluate(() => {
    globalThis.__preparationMode = 'hold';
  });
  await page.locator('#live-sources-retry').click();
  for (let i = 0; i < 200; i++) {
    if (await app.evaluate(() => !!globalThis.__preparationHeld)) break;
    await new Promise((r) => setTimeout(r, 25));
  }
  assert.equal(await app.evaluate(() => !!globalThis.__preparationHeld), true);
  assert.equal(await app.evaluate(() => globalThis.__preparationReads), materialReads + 1);
  await page.locator('#running-notes').fill(notes);
  await page.locator('#running-notes').evaluate((el) => el.setSelectionRange(3, 3));
  const savedCounts = await oneContext(page, true);
  assert.deepEqual(
    await page.locator('#running-notes').evaluate((el) => ({
      focused: document.activeElement === el,
      caret: el.selectionStart,
      text: el.value,
    })),
    { focused: true, caret: 3, text: notes },
  );
  assert.equal(
    await app.evaluate(
      () => globalThis.__liveCommands.filter((c) => c.kind === 'scene-content' && c.ok).length,
    ),
    1,
  );
  await app.evaluate(() => {
    globalThis.__preparationMode = 'ready';
    globalThis.__releasePreparation();
  });
  await page.locator('#live-sources-state').waitFor({ state: 'hidden' });
  assert.match(await page.locator('#live-knowledge-results').textContent(), /Wissen am Nordtor/);
  assert.deepEqual(
    await page.locator('#running-notes').evaluate((el) => ({
      focused: document.activeElement === el,
      caret: el.selectionStart,
      text: el.value,
    })),
    { focused: true, caret: 3, text: notes },
  );
  assert.deepEqual(await app.evaluate(() => globalThis.__travelReadCounts), savedCounts);
  await page.screenshot({ path: path.join(out, 'live-notes-100.png') });
  await resetReads();
  const profileCounts = await profileWhileReplyPending(page);
  await resetReads();
  const recoveredCounts = await recoverPartyProfile(page);
  await resetReads();
  const legacy = await page.locator('#world-map').innerHTML();
  let counts = await openTravel(page);
  await page.locator('#live-travel-map-open').click();
  await page.locator('#live-center-map #campaign-map').waitFor({ state: 'visible' });
  if (!(await page.locator('#travel-q').isVisible()))
    await page.locator('#travel-advanced > summary').click();
  await page.locator('#travel-q').fill('1');
  await page.locator('#travel-r').fill('0');
  await page.locator('#travel-final-hours').fill('0.01');
  await page.locator('#travel-preview-open').click();
  await page.waitForFunction(() => document.querySelectorAll('#travel-evaluation dd').length === 3);
  await page.locator('#journey-play').click();
  await page.waitForFunction(() =>
    document.querySelector('#world-journey-status').textContent.startsWith('Angekommen'),
  );
  assert.equal(
    await page.locator('#world-map').innerHTML(),
    legacy,
    'shared map navigation must not repaint the hidden legacy scene',
  );
  await page.locator('#live-travel-weather > summary').click();
  await page.locator('#live-agenda-upcoming').scrollIntoViewIfNeeded();
  await page.screenshot({ path: path.join(out, 'travel-arrived.png') });
  results.push({
    scale: 1,
    counts,
    savedCounts,
    profileCounts,
    recoveredCounts,
    exit: await close(),
  });
  page = await launch(2);
  assert.equal(await page.locator('#running-notes').inputValue(), notes);
  await page.locator('#running-notes').scrollIntoViewIfNeeded();
  await page.screenshot({ path: path.join(out, 'live-notes-200.png') });
  counts = await openTravel(page);
  assert.match(await page.locator('#world-journey-status').innerText(), /Angekommen/);
  await page.locator('#live-travel-weather > summary').click();
  await page.locator('#live-agenda-upcoming').scrollIntoViewIfNeeded();
  await page.screenshot({ path: path.join(out, 'reopened-200.png') });
  results.push({ scale: 2, counts, exit: await close() });
  const fresh = new CampaignStore(file);
  let state;
  try {
    const token = fresh.activate(campaign.id).token,
      p = fresh.sceneWorld(token, scene.id);
    const character = fresh.live(token).roster.find((c) => c.id === pc.id);
    assert.equal(character.profile.name, 'Recovered Iri');
    assert.equal(character.profileRevision, pc.profileRevision + 3);
    assert.equal(p.scene.notes, notes);
    assert.equal(p.position.q, 1);
    assert.equal(p.scene.clock.instantMs, '36000');
    assert.equal(p.journey.status, 'arrived');
    assert.equal(
      fresh.db
        .prepare('SELECT count(*) n FROM scene_time_step WHERE campaign_id=? AND scene_id=?')
        .get(campaign.id, scene.id).n,
      1,
    );
    state = {
      q: p.position.q,
      instant: p.scene.clock.instantMs,
      status: p.journey.status,
      profileRevision: character.profileRevision,
      profileName: character.profile.name,
    };
  } finally {
    fresh.close();
  }
  assert.deepEqual(errors, []);
  await writeFile(
    path.join(out, 'result.json'),
    JSON.stringify(
      {
        head: execFileSync('git', ['rev-parse', 'HEAD'], { encoding: 'utf8' }).trim(),
        workingTree: execFileSync('git', ['status', '--porcelain'], { encoding: 'utf8' }).trim(),
        profile,
        openings,
        results,
        state,
        notes,
        errors,
        artifacts,
      },
      null,
      2,
    ),
  );
  console.log(JSON.stringify({ openings, results, state }));
} catch (error) {
  await writeFile(
    path.join(out, 'failure.json'),
    JSON.stringify({ error: error.stack, profile, results, errors }, null, 2),
  );
  if (app && !closed)
    try {
      await (await app.firstWindow()).screenshot({ path: path.join(out, 'failure.png') });
    } catch {}
  throw error;
} finally {
  if (app && !closed) {
    await app
      .evaluate(() => {
        globalThis.__releaseProfile?.();
        globalThis.__releasePreparation?.();
      })
      .catch(() => {});
    await app.close();
  }
  proxy.kill();
}
