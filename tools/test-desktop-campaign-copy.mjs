// Real Main/preload/SQLite transfer; only file selection and local cleanup failures are instrumented.
import { createRequire } from 'node:module';
import { mkdtemp, mkdir, stat, readFile, writeFile } from 'node:fs/promises';
import { spawn } from 'node:child_process';
import { randomUUID } from 'node:crypto';
import assert from 'node:assert/strict';
const root = process.cwd(),
  require = createRequire(import.meta.url),
  { _electron } = require('playwright-core'),
  Database = require('better-sqlite3');
require('esbuild').buildSync({
  entryPoints: ['src/app/storage/store.ts'],
  outfile: '.build/campaign-copy-store.cjs',
  bundle: true,
  platform: 'node',
  format: 'cjs',
  external: ['better-sqlite3'],
});
const { CampaignStore } = require(root + '/.build/campaign-copy-store.cjs'),
  profile = await mkdtemp('/tmp/campaign-copy-ui-'),
  file = profile + '/workbench.sqlite',
  out = root + '/.build/campaign-copy-ui';
await mkdir(out, { recursive: true });
const room = {
  id: randomUUID(),
  scopeId: 'local',
  floorId: 'ground',
  number: '1',
  name: 'Torhalle',
  revision: 0,
  polygons: [
    {
      outer: [
        { x: 0, y: 0 },
        { x: 8, y: 0 },
        { x: 8, y: 8 },
        { x: 0, y: 8 },
      ],
      holes: [],
    },
  ],
  sections: [
    {
      id: randomUUID(),
      kind: 'markdown',
      markdown: '  Alter Torplan\r\n- Mauer aus Basalt',
    },
  ],
};
const store = new CampaignStore(file),
  original = store.create('Nebelmark Original', [room]),
  w = store.activate(original.id),
  npcId = randomUUID(),
  authorId = randomUUID(),
  npcText = '  Original Nera\r\n- Sie bewacht das Tor',
  authorText = `Sprich mit [Torwache](dungeon-ref:note/${npcId}).\r\n\`[Beispiel](dungeon-ref:note/${npcId})\``;
for (const note of [
  { id: npcId, title: 'Nera', gmNotes: npcText, relations: [] },
  {
    id: authorId,
    title: 'Auftrag am Tor',
    gmNotes: authorText,
    relations: [{ id: randomUUID(), targetId: npcId, label: 'beauftragt' }],
  },
])
  store.changePreparation({
    commandId: randomUUID(),
    token: w.token,
    campaignId: original.id,
    change: {
      kind: 'note',
      expectedRevision: null,
      note: {
        version: 1,
        revision: 1,
        kind: 'npc',
        readAloud: '',
        creatureId: null,
        deleted: false,
        ...note,
      },
    },
  });
store.executeDrawing({
  commandId: randomUUID(),
  token: w.token,
  campaignId: original.id,
  action: {
    kind: 'key-batch',
    rooms: [{ id: room.id, expectedRevision: 0, keyRevision: null }],
    patch: { references: [{ kind: 'npc', id: npcId, label: 'Nera' }] },
  },
});
store.tutorial('skipped');
store.close();
const bus = profile + '/bus',
  proxy = spawn(
    'xdg-dbus-proxy',
    [
      process.env.DBUS_SESSION_BUS_ADDRESS,
      bus,
      '--filter',
      '--talk=org.freedesktop.portal.Desktop',
      '--talk=org.freedesktop.Notifications',
    ],
    { stdio: 'ignore' },
  );
for (let i = 0; i < 100 && !(await stat(bus).catch(() => null)); i++)
  await new Promise((r) => setTimeout(r, 20));
let app,
  page,
  closed = true;
const exits = [],
  errors = [];
async function launch() {
  app = await _electron.launch({
    executablePath: root + '/node_modules/electron/dist/electron',
    args: [root + '/.build/desktop/main.cjs', '--ozone-platform=x11', '--data-dir', profile],
    env: { ...process.env, DBUS_SESSION_BUS_ADDRESS: 'unix:path=' + bus },
  });
  closed = false;
  page = await app.firstWindow();
  page.setDefaultTimeout(15000);
  page.on('pageerror', (e) => errors.push(e.stack));
  await page.waitForFunction(() => document.body.dataset.tutorialReady === 'true');
  await app.evaluate(({ ipcMain }) => {
    globalThis.qaTransferCounts = { accept: 0, status: 0 };
    for (const [channel, key] of [
      ['campaign:transfer-accept', 'accept'],
      ['campaign:transfer-status', 'status'],
    ]) {
      const original = ipcMain._invokeHandlers.get(channel);
      ipcMain.removeHandler(channel);
      ipcMain.handle(channel, async (e, ...args) => {
        globalThis.qaTransferCounts[key]++;
        const result = await original(e, ...args);
        if (key === 'accept' && globalThis.qaLoseTransferAnswer) {
          globalThis.qaLoseTransferAnswer = false;
          return { ok: false, error: 'QA: Antwort nach Commit verloren' };
        }
        return result;
      });
    }
  });
}
async function close() {
  assert.deepEqual(errors, []);
  const done = new Promise((r) =>
    app.process().once('exit', (code, signal) => r({ code, signal })),
  );
  await app.evaluate(({ BrowserWindow }) => BrowserWindow.getAllWindows()[0].close());
  const exit = await done;
  assert.deepEqual(exit, { code: 0, signal: null });
  exits.push(exit);
  closed = true;
}
async function open(id) {
  if (!(await page.locator('#campaign-screen').isVisible()))
    await page.locator('#campaign-header-name').click();
  await page
    .locator('.campaign-card[data-campaign-id="' + id + '"]')
    .getByRole('button', { name: /Fortsetzen|Öffnen/ })
    .click();
  await page.waitForFunction(
    (id) =>
      document.querySelector('#campaigns').value === id &&
      document.body.classList.contains('has-workspace') &&
      !document.querySelector('main').inert,
    id,
  );
}
async function manager() {
  if (!(await page.locator('#campaign-manager').isVisible())) {
    if (await page.locator('#atlas-navigation').isVisible())
      await page.locator('#atlas-navigation').click();
    else await page.locator('#workspace-tools > summary').click();
  }
  await page.locator('#campaign-manager').click();
  await page.locator('#campaign-manager-dialog').waitFor({ state: 'visible' });
}
async function cleanupBlocked(blocked) {
  await page.evaluate((blocked) => {
    if (!window.qaOriginalRemove) window.qaOriginalRemove = Storage.prototype.removeItem;
    Storage.prototype.removeItem = function (key) {
      if (blocked && key === 'campaign-pending-transfer')
        throw Error('QA: lokales Entfernen blockiert');
      return window.qaOriginalRemove.call(this, key);
    };
  }, blocked);
}
async function note(title) {
  if (!(await page.locator('#preparation-tab').isVisible()))
    await page.locator('#atlas-navigation').click();
  await page.locator('#preparation-tab').click();
  await page.locator('#preparation-knowledge').click();
  await page.locator('#world-list button').filter({ hasText: title }).click();
  await page.locator('#note-editor').waitFor({ state: 'visible' });
}
function databaseBytes() {
  const db = new Database(file, { readonly: true });
  try {
    return db.serialize();
  } finally {
    db.close();
  }
}
async function statusReadOnly() {
  const bytes = databaseBytes(),
    counts = await app.evaluate(() => globalThis.qaTransferCounts);
  await page.locator('#campaign-transfer-check').click();
  // Wait for this IPC read as well as the async UI completion, not an older status label.
  const deadline = Date.now() + 15000;
  while ((await app.evaluate(() => globalThis.qaTransferCounts.status)) === counts.status) {
    assert(Date.now() < deadline, 'transfer status read did not arrive');
    await new Promise((resolve) => setTimeout(resolve, 20));
  }
  await page.waitForFunction(
    () =>
      document
        .querySelector('#campaign-transfer-progress')
        .textContent.includes('Übernahme bestätigt') &&
      !document.querySelector('#campaign-transfer-check').disabled,
  );
  assert.deepEqual(databaseBytes(), bytes);
  const after = await app.evaluate(() => globalThis.qaTransferCounts);
  assert.equal(after.accept, counts.accept);
  assert.equal(after.status, counts.status + 1);
}
async function screenshot(name) {
  await writeFile(
    out + '/' + name + '.png',
    Buffer.from(
      await app.evaluate(async ({ BrowserWindow }) =>
        (await BrowserWindow.getAllWindows()[0].webContents.capturePage())
          .toPNG()
          .toString('base64'),
      ),
      'base64',
    ),
  );
}
let copy, imported, archiveBytes;
try {
  await launch();
  await open(original.id);
  await manager();
  await page.locator('#campaign-copy').click();
  await page.locator('#campaign-transfer-dialog').waitFor({ state: 'visible' });
  await page.locator('#campaign-transfer-name').fill('Nebelmark Kopie');
  await cleanupBlocked(true);
  await page.locator('#campaign-transfer-accept').click();
  await page.locator('#campaign-transfer-dialog').waitFor({ state: 'hidden' });
  await page.waitForFunction(
    () => document.querySelector('#campaign-header-name').textContent === 'Nebelmark Kopie',
  );
  copy = await page.locator('#campaigns').inputValue();
  assert.notEqual(copy, original.id);
  await page.waitForFunction(() =>
    document
      .querySelector('#status')
      .textContent.includes('Auftragsvermerk konnte lokal nicht entfernt'),
  );
  assert(await page.evaluate(() => localStorage.getItem('campaign-pending-transfer')));
  await manager();
  assert(await page.locator('#campaign-copy').isDisabled());
  await statusReadOnly();
  await screenshot('accepted-cleanup-pending');
  await cleanupBlocked(false);
  await statusReadOnly();
  assert.equal(await page.evaluate(() => localStorage.getItem('campaign-pending-transfer')), null);
  await page.locator('#campaign-manager-close').click();
  await note('Auftrag am Tor');
  assert.match(await page.locator('#note-gm').inputValue(), /Torwache/);
  await page.locator('#note-relations button').filter({ hasText: 'beauftragt: Nera' }).click();
  assert.equal(await page.locator('#note-title').inputValue(), 'Nera');
  await page.locator('#note-gm').fill('Nur in der Kopie: Nera öffnet das Tor.');
  await page.locator('#note-room-uses-list button').filter({ hasText: 'Torhalle' }).click();
  await page.locator('#key-dialog').waitFor({ state: 'visible' });
  assert.equal(await page.locator('#key-name').inputValue(), 'Torhalle');
  await page.locator('#key-gm-notes').fill('Nur in der Kopie: Der Basalttunnel ist offen.');
  await page.waitForFunction(
    () => document.querySelector('#key-save-status').dataset.state === 'saved',
  );
  await page.locator('#key-close').click();
  await manager();
  await app.evaluate(({ dialog }, filename) => {
    dialog.showSaveDialog = async () => ({
      canceled: false,
      filePath: filename,
    });
  }, profile + '/copy.kwcampaign');
  await page.locator('#campaign-export').click();
  await page.waitForFunction(
    () =>
      document.querySelector('#status').textContent ===
      'Kampagnenpaket mit Daten und Medien exportiert.',
  );
  archiveBytes = await readFile(profile + '/copy.kwcampaign');
  await app.evaluate(({ dialog }, filename) => {
    dialog.showOpenDialog = async () => ({
      canceled: false,
      filePaths: [filename],
    });
    globalThis.qaLoseTransferAnswer = true;
  }, profile + '/copy.kwcampaign');
  await page.locator('#campaign-import-package').click();
  await page.locator('#campaign-transfer-dialog').waitFor({ state: 'visible' });
  await page.locator('#campaign-transfer-name').fill('Nebelmark Import');
  await cleanupBlocked(true);
  await page.locator('#campaign-transfer-accept').click();
  await page.locator('#campaign-transfer-dialog').waitFor({ state: 'hidden' });
  await page.waitForFunction(() =>
    document
      .querySelector('#campaign-transfer-progress')
      .textContent.includes('Übernahme bestätigt: Nebelmark Import'),
  );
  const overview = await page.evaluate(() => window.campaign.campaignOverview());
  assert(overview.ok);
  assert.equal(overview.value.length, 3);
  imported = overview.value.find((c) => c.name === 'Nebelmark Import').id;
  assert.equal(
    await page.locator('#campaigns').inputValue(),
    copy,
    'recovery refresh must not select a stale context',
  );
  assert.deepEqual(await app.evaluate(() => globalThis.qaTransferCounts), {
    accept: 2,
    status: 3,
  });
  await close();
  await launch();
  await open(original.id);
  await cleanupBlocked(true);
  await manager();
  await statusReadOnly();
  assert(await page.locator('#campaign-copy').isDisabled());
  await cleanupBlocked(false);
  await statusReadOnly();
  assert.equal(await page.evaluate(() => localStorage.getItem('campaign-pending-transfer')), null);
  await page.locator('#campaign-manager-close').click();
  await note('Nera');
  assert.equal(await page.locator('#note-gm').inputValue(), npcText.replaceAll('\r\n', '\n'));
  await open(imported);
  await note('Nera');
  assert.equal(
    await page.locator('#note-gm').inputValue(),
    'Nur in der Kopie: Nera öffnet das Tor.',
  );
  await page.locator('#note-room-uses-list button').filter({ hasText: 'Torhalle' }).click();
  assert.equal(
    await page.locator('#key-gm-notes').inputValue(),
    'Nur in der Kopie: Der Basalttunnel ist offen.',
  );
  await page.locator('#key-close').click();
  await page.locator('#note-gm').fill('Nur im Import: Nera ist abgereist.');
  await open(copy);
  await note('Nera');
  assert.equal(
    await page.locator('#note-gm').inputValue(),
    'Nur in der Kopie: Nera öffnet das Tor.',
  );
  await close();
  await launch();
  for (const [id, text] of [
    [original.id, npcText.replaceAll('\r\n', '\n')],
    [copy, 'Nur in der Kopie: Nera öffnet das Tor.'],
    [imported, 'Nur im Import: Nera ist abgereist.'],
  ]) {
    await open(id);
    await note('Nera');
    assert.equal(await page.locator('#note-gm').inputValue(), text);
  }
  await screenshot('fresh-independent-import');
  await close();
  const check = new CampaignStore(file);
  try {
    const identities = [];
    for (const id of [original.id, copy, imported]) {
      const active = check.activate(id),
        notes = check.preparation(active.token).notes.map((r) => r.note),
        npc = notes.find((n) => n.title === 'Nera'),
        author = notes.find((n) => n.title === 'Auftrag am Tor'),
        rooms = check.workspace().rooms;
      identities.push([npc.id, author.id, rooms[0].id]);
      assert.equal(author.relations[0].targetId, npc.id);
      assert.equal(
        author.gmNotes,
        authorText.replace(
          `[Torwache](dungeon-ref:note/${npcId})`,
          `[Torwache](dungeon-ref:note/${npc.id})`,
        ),
      );
      assert.deepEqual(rooms[0].polygons, room.polygons);
      assert.deepEqual(
        rooms[0].sections.map((s) => s.markdown),
        room.sections.map((s) => s.markdown),
      );
      assert(
        check
          .drawing(active.token)
          .keyContent.find((k) => k.id === rooms[0].id)
          .references.some((r) => r.id === npc.id),
      );
      if (id === original.id) assert.equal(npc.gmNotes, npcText);
    }
    assert.equal(new Set(identities.flat()).size, 9);
  } finally {
    check.close();
  }
  assert.deepEqual(await readFile(profile + '/copy.kwcampaign'), archiveBytes);
  console.log(
    JSON.stringify({
      normalExits: exits.length,
      copyAndImportIndependent: true,
      notesAndMapReferencesRemapped: true,
      sourceProseAndGeometryPreserved: true,
      cleanupStatusReadOnly: true,
      lostAnswerReconciled: true,
      archiveBytesUnchanged: true,
      errors,
    }),
  );
} catch (error) {
  if (app && !closed) await screenshot('failure').catch(() => {});
  throw error;
} finally {
  if (app && !closed) await app.close();
  proxy.kill();
}
