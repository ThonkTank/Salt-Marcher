import { createNativeSession } from './native-session.mjs';
import { createRequire } from 'node:module';
import assert from 'node:assert/strict';
import path from 'node:path';
import { randomUUID, createHash } from 'node:crypto';
import { writeFile, mkdir } from 'node:fs/promises';
const zoom = 1,
  root = process.cwd(),
  require = createRequire(root + '/package.json');
const output = process.env.QA_EVIDENCE_DIR ?? path.join(root, '.build/npc-portrait-evidence');
const native = await createNativeSession({ root, output, name: 'gm-npc-portrait' });
require('esbuild').buildSync({
  entryPoints: ['src/app/storage/store.ts'],
  outfile: '.build/portrait-store.cjs',
  bundle: true,
  platform: 'node',
  format: 'cjs',
  external: ['better-sqlite3'],
});
const { CampaignStore } = require(root + '/.build/portrait-store.cjs'),
  { PNG } = require('pngjs');
const png = new PNG({ width: 480, height: 600 });
for (let y = 0; y < 600; y++)
  for (let x = 0; x < 480; x++) {
    let c = [28, 50, 61];
    if ((x - 240) ** 2 / 130 ** 2 + (y - 280) ** 2 / 180 ** 2 < 1) c = [204, 158, 109];
    if (y > 420 && Math.abs(x - 240) < (y - 350) * 0.7) c = [42, 106, 104];
    if (y > 110 && y < 205 && Math.abs(x - 240) < 140) c = [85, 57, 36];
    if (y > 255 && y < 270 && (Math.abs(x - 195) < 15 || Math.abs(x - 285) < 15)) c = [30, 34, 35];
    if (y > 355 && y < 363 && Math.abs(x - 240) < 45) c = [113, 58, 43];
    if (x < 12 || x > 467 || y < 12 || y > 587) c = [204, 173, 104];
    const i = (y * 480 + x) * 4;
    png.data.set([...c, 255], i);
  }
const bytes = PNG.sync.write(png),
  sha256 = createHash('sha256').update(bytes).digest('hex'),
  portrait = native.profile + '/siv.png';
await writeFile(portrait, bytes);
await mkdir(native.profile + '/player-images');
await writeFile(native.profile + '/player-images/' + sha256 + '.png', bytes);
const store = new CampaignStore(native.profile + '/workbench.sqlite'),
  campaign = store.create('Porträt beim Fährgespräch'),
  w = store.activate(campaign.id),
  cmd = (action) => ({ commandId: randomUUID(), token: w.token, campaignId: campaign.id, action });
store.executeLive(cmd({ kind: 'initialize', expectedRosterRevision: 0 }));
const hero = store.executeLive(
  cmd({ kind: 'create-character', profile: { name: 'Ada' } }),
).character;
let live = store.live(w.token);
store.executeLive(
  cmd({
    kind: 'membership',
    characterId: hero.id,
    expectedRevision: 0,
    expectedRosterRevision: live.rosterRevision,
    active: true,
    targetSceneId: live.focusId,
    expectedFocusRevision: live.focusRevision,
  }),
);
const npc = {
  version: 1,
  id: randomUUID(),
  revision: 1,
  kind: 'npc',
  title: 'Siv die Fährfrau',
  readAloud: 'Eine Fährfrau mit kupferner Brosche begrüßt euch.',
  gmNotes: 'GM-GEHEIM: Siv versteckt den Schlüssel im Schilf.',
  relations: [],
  creatureId: null,
  deleted: false,
};
store.changePreparation({
  ...cmd(null),
  change: { kind: 'note', expectedRevision: null, note: npc },
});
const imageId = randomUUID();
store.registerPlayerAsset(w.token, {
  id: imageId,
  kind: 'npc',
  subjectId: npc.id,
  title: '',
  sha256,
  extension: '.png',
  bytes: bytes.length,
});
live = store.live(w.token);
const originalScene = live.scene.id;
const two = store.executeLive(
  cmd({ kind: 'create-character', profile: { name: 'Borin' } }),
).character;
live = store.live(w.token);
store.executeLive(
  cmd({
    kind: 'membership',
    characterId: two.id,
    expectedRevision: 0,
    expectedRosterRevision: live.rosterRevision,
    active: true,
    targetSceneId: live.focusId,
    expectedFocusRevision: live.focusRevision,
  }),
);
live = store.live(w.token);
store.executeLive(
  cmd({
    kind: 'move',
    sceneId: live.scene.id,
    expectedRosterRevision: live.rosterRevision,
    expectedFocusRevision: live.focusRevision,
    expectedClockRevision: live.scene.clock.revision,
    expectedSceneMembershipRevision: live.scene.membershipRevision,
    memberIds: [two.id],
    target: { kind: 'new', title: 'Andere Gruppe', expectedContentRevision: live.scene.revision },
  }),
);
live = store.live(w.token);
const otherScene = live.scenes.find((s) => s.id !== originalScene).id;
const view = store.playerView(w.token);
store.executePlayer({
  ...cmd({
    kind: 'settings',
    settings: {
      blank: true,
      mode: 'image',
      imageId: null,
      title: '',
      labels: false,
      light: 'daylight',
      displayId: null,
      fullscreen: false,
    },
  }),
  expectedRevision: view.settings.revision,
  expectedFocusId: view.focusId,
  expectedFocusRevision: view.focusRevision,
  expectedFocusMembershipRevision: view.focusMembershipRevision,
  expectedFocusLocationId: view.focusLocationId,
});
store.tutorial('skipped');
store.close();

const results = {};
async function launch() {
  const page = await native.launch(zoom);
  await page
    .locator('#campaign-screen-list article')
    .filter({ hasText: campaign.name })
    .getByRole('button', { name: 'Fortsetzen', exact: true })
    .click();
  await page.waitForFunction(() => !document.querySelector('#workspace-navigation').inert);
  if (await page.locator('#atlas-navigation').isVisible())
    await page.locator('#atlas-navigation').click();
  if (!(await page.locator('#live-tab').isVisible()))
    await page.locator('#workspace-nav-summary').click();
  await page.locator('#live-tab').click();
  if (await page.locator('#live-continue').isVisible())
    await page.locator('#live-continue').click();
  return page;
}
async function dossier(page) {
  await page.locator('#desk-search').fill('Siv');
  await page.locator('#desk-search-form button').click();
  await page
    .locator('#desk-results')
    .getByRole('button', { name: 'NPC · Siv die Fährfrau', exact: true })
    .click();
  await page.locator('#desk-player-actions').waitFor({ state: 'visible' });
}
async function playerPage() {
  for (let i = 0; i < 100; i++) {
    const page = native.app.windows().find((p) => p.url().includes('player-display.html'));
    if (page) return page;
    await new Promise((r) => setTimeout(r, 20));
  }
  throw Error('Player window missing');
}
async function portraitVisible(player) {
  await player.waitForFunction(
    () => document.querySelector('#player-stage img')?.naturalWidth === 480,
  );
  const frame = await player.evaluate(() => window.playerDisplay.frame());
  assert.equal(frame.value.frame.mode, 'image');
  assert.equal(frame.value.frame.imageId, imageId);
  assert.equal(frame.value.frame.title, '');
  assert.doesNotMatch(JSON.stringify(frame), /GM-GEHEIM|Schlüssel|Fährfrau|Silberstücke/);
  assert.deepEqual(
    await player
      .locator('#player-stage img')
      .evaluate((i) => ({ w: i.naturalWidth, h: i.naturalHeight })),
    { w: 480, h: 600 },
  );
  assert.deepEqual(await player.evaluate(() => Object.keys(window.playerDisplay).sort()), [
    'frame',
    'onFrame',
  ]);
  assert.equal(await player.evaluate(() => typeof window.campaign), 'undefined');
  return frame;
}
async function blank(player) {
  await player.waitForFunction(() =>
    document.querySelector('#player-stage').classList.contains('player-blank'),
  );
  assert.equal(await player.locator('#player-stage').innerText(), '');
}
try {
  let page = await launch();
  await dossier(page);
  await native.capture(page, 'dossier-entry-' + zoom, '#desk-player-actions');
  assert.equal(
    await page.locator('#live-display-details').getAttribute('open'),
    null,
    'The separate image picker is unnecessary',
  );
  // Reject a second preview read after the real authorization read and confirmed write.
  await native.app.evaluate(({ ipcMain }) => {
    const read = ipcMain._invokeHandlers.get('player:view');
    globalThis.qaPortraitRead = read;
    globalThis.qaPortraitReads = 0;
    ipcMain.removeHandler('player:view');
    ipcMain.handle('player:view', (e, ...args) =>
      ++globalThis.qaPortraitReads === 1
        ? read(e, ...args)
        : { ok: false, error: 'QA redundant preview unavailable' },
    );
  });
  await page.locator('#desk-player-show').click();
  let player = await playerPage();
  results.shown = await portraitVisible(player);
  await writeFile(
    path.join(output, 'player-portrait-' + zoom + '.png'),
    Buffer.from(
      await native.app.evaluate(async ({ BrowserWindow }) =>
        (
          await BrowserWindow.getAllWindows()
            .find((w) => w.webContents.getURL().includes('player-display.html'))
            .webContents.capturePage()
        ).toPNG(),
      ),
    ),
  );
  await page.waitForFunction(() =>
    /geöffnet|nicht freigegeben/.test(document.querySelector('#desk-player-status').textContent),
  );
  await native.capture(page, 'confirmed-portrait-status-' + zoom, '#desk-player-actions');
  assert.match(await page.locator('#desk-player-status').innerText(), /geöffnet/);
  assert.equal(await native.app.evaluate(() => globalThis.qaPortraitReads), 1);
  results.confirmedWithoutSecondRead = true;
  await native.app.evaluate(({ ipcMain }) => {
    ipcMain.removeHandler('player:view');
    ipcMain.handle('player:view', globalThis.qaPortraitRead);
    delete globalThis.qaPortraitRead;
  });
  await page.locator('#desk-edit-summary').click();
  const prose = npc.gmNotes + ' Sie fordert zwei Silberstücke.';
  await page.getByRole('textbox', { name: 'GM-Notizen', exact: true }).fill(prose);
  // Showing the already open NPC also commits its pending private edits.
  await page.locator('#desk-player-show').click();
  await page.waitForFunction(() =>
    document.querySelector('#desk-note-preview').textContent.includes('zwei Silberstücke'),
  );
  await portraitVisible(player);
  await native.capture(page, 'private-note-and-portrait-' + zoom, '#desk-player-actions');
  await page.locator('#desk-player-blank').click();
  await blank(player);
  await page.waitForFunction(() =>
    document.querySelector('#desk-player-status').textContent.includes('geleert'),
  );
  await native.close();
  page = await launch();
  player = await playerPage();
  await blank(player);
  await dossier(page);
  assert.match(
    await page.locator('#desk-note-preview').innerText(),
    /Schlüssel.*zwei Silberstücke/s,
  );
  results.freshStayedBlank = true;
  await page.locator('#desk-player-show').click();
  await portraitVisible(player);
  await native.capture(page, 'fresh-explicit-portrait-' + zoom, '#desk-player-actions');
  // Emergency blanking must still work when unrelated player preview reads fail.
  await native.app.evaluate(({ ipcMain }) => {
    globalThis.qaPortraitRead = ipcMain._invokeHandlers.get('player:view');
    ipcMain.removeHandler('player:view');
    ipcMain.handle('player:view', () => ({ ok: false, error: 'QA preview read unavailable' }));
  });
  await page.locator('#desk-player-blank').click();
  await blank(player);
  results.blankWithoutRead = true;
  await native.app.evaluate(({ ipcMain }) => {
    ipcMain.removeHandler('player:view');
    ipcMain.handle('player:view', globalThis.qaPortraitRead);
    delete globalThis.qaPortraitRead;
  });
  // Hold an actual image authorization read while the GM changes the focus group.
  await native.app.evaluate(({ ipcMain }) => {
    const read = ipcMain._invokeHandlers.get('player:view');
    globalThis.qaPortraitRead = read;
    globalThis.qaPortraitHeld = false;
    globalThis.qaPortraitReleased = false;
    let once = true;
    ipcMain.removeHandler('player:view');
    ipcMain.handle('player:view', async (e, ...args) => {
      const result = await read(e, ...args);
      if (once) {
        once = false;
        globalThis.qaPortraitHeld = true;
        const held = await new Promise(
          (resolve) => (globalThis.qaPortraitRelease = () => resolve(result)),
        );
        globalThis.qaPortraitReleased = true;
        return held;
      }
      return result;
    });
  });
  await page.locator('#desk-player-show').click();
  for (let i = 0; i < 100 && !(await native.app.evaluate(() => globalThis.qaPortraitHeld)); i++)
    await new Promise((r) => setTimeout(r, 20));
  assert(await native.app.evaluate(() => globalThis.qaPortraitHeld));
  await page.locator('#scene-focus').selectOption(otherScene);
  await page.waitForFunction(
    (id) =>
      document.querySelector('#scene-focus').value === id &&
      document.querySelector('#desk-editor').hidden,
    otherScene,
  );
  await blank(player);
  await native.app.evaluate(({ ipcMain }) => {
    globalThis.qaPortraitRelease();
    ipcMain.removeHandler('player:view');
    ipcMain.handle('player:view', globalThis.qaPortraitRead);
  });
  // Observe the released authorization read, then settle renderer IPC work.
  assert(await native.app.evaluate(() => globalThis.qaPortraitReleased));
  await page.evaluate(
    () => new Promise((resolve) => requestAnimationFrame(() => requestAnimationFrame(resolve))),
  );
  await blank(player);
  results.changedGroupStayedBlank = true;
  await page.locator('#scene-focus').selectOption(originalScene);
  await dossier(page);
  await page.locator('#desk-player-show').click();
  await portraitVisible(player);
  await page.locator('#desk-player-blank').click();
  await blank(player);
  await native.close();
  const check = new CampaignStore(native.profile + '/workbench.sqlite');
  try {
    const cw = check.activate(campaign.id),
      saved = check.deskContent(cw.token, { kind: 'note', id: npc.id }).note;
    assert.equal(saved.gmNotes, prose);
    assert.equal(saved.readAloud, npc.readAloud);
    assert.equal(saved.title, npc.title);
    assert.deepEqual(saved.relations, []);
    assert.equal(check.playerView(cw.token).settings.blank, true);
    results.privateCanonicalNotePreserved = true;
  } finally {
    check.close();
  }
  await native.finish({ complete: true, zoom, results });
  console.log(
    JSON.stringify({
      complete: true,
      source: native.source,
      zoom,
      launches: native.launches,
      results,
    }),
  );
} catch (error) {
  await native.fail(error);
  throw error;
} finally {
  await native.dispose();
}
