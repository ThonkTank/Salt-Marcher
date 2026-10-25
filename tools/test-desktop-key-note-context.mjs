import { openDesktopKeyReferences } from './qa-key-entry.mjs';
import { createRequire } from 'node:module';
import { mkdtemp, mkdir, readFile, writeFile, stat } from 'node:fs/promises';
import { spawn } from 'node:child_process';
import { randomUUID, createHash } from 'node:crypto';
import assert from 'node:assert/strict';
import path from 'node:path';

const root = process.cwd(),
  before = process.argv.includes('--before'),
  unlink = process.argv.includes('--unlink') && !before,
  nested = (process.argv.includes('--nested') || unlink) && !before,
  phase = before ? 'before' : unlink ? 'after-thread-unlink' : nested ? 'after-thread' : 'after',
  output = path.join(root, '.build/key-note-context', phase);
await mkdir(output, { recursive: true });
const require = createRequire(import.meta.url),
  { _electron } = require('playwright-core');
require('esbuild').buildSync({
  entryPoints: ['src/app/storage/store.ts'],
  outfile: '.build/key-note-store.cjs',
  bundle: true,
  platform: 'node',
  format: 'cjs',
  external: ['better-sqlite3'],
});
const { CampaignStore } = require(root + '/.build/key-note-store.cjs');
const profile = await mkdtemp('/tmp/gm-key-note-'),
  file = path.join(profile, 'workbench.sqlite');
const rooms = ['Torhalle', 'Wachstube'].map((name, i) => ({
  id: randomUUID(),
  scopeId: 'local',
  floorId: 'ground',
  number: String(i + 1),
  name,
  revision: 0,
  polygons: [
    {
      outer: [
        { x: i * 9, y: 0 },
        { x: i * 9 + 6, y: 0 },
        { x: i * 9 + 6, y: 6 },
        { x: i * 9, y: 6 },
      ],
      holes: [],
    },
  ],
  sections: [
    { id: randomUUID(), kind: 'markdown', markdown: 'Original ' + name + '\r\n  Raumtext.' },
  ],
}));
const store = new CampaignStore(file),
  campaign = store.create('Neras Motiv am Raum-Key', rooms),
  w = store.activate(campaign.id),
  noteId = randomUUID(),
  clueId = randomUUID();
const command = (action) => ({
  commandId: randomUUID(),
  token: w.token,
  campaignId: campaign.id,
  action,
});
if (unlink)
  store.changePreparation({
    ...command(null),
    change: {
      kind: 'note',
      expectedRevision: null,
      note: {
        version: 1,
        id: clueId,
        revision: 1,
        kind: 'rumor',
        title: 'Kellergerücht',
        readAloud: '',
        gmNotes: 'Diese falsche Spur gehört nicht zu Nera.',
        relations: [],
        creatureId: null,
        deleted: false,
      },
    },
  });
store.changePreparation({
  ...command(null),
  change: {
    kind: 'note',
    expectedRevision: null,
    note: {
      version: 1,
      id: noteId,
      revision: 1,
      kind: 'npc',
      title: 'Nera die Quartiermeisterin',
      readAloud: 'Die müde Wächterin hält ihren Becher fest.',
      gmNotes: 'Nera kennt den Zugang zum Keller.',
      relations: unlink ? [{ targetId: clueId, label: 'Quelle' }] : [],
      creatureId: null,
      deleted: false,
    },
  },
});
store.executeDrawing(
  command({
    kind: 'key-batch',
    rooms: [{ id: rooms[1].id, expectedRevision: 0, keyRevision: null }],
    patch: { references: [{ kind: 'npc', id: noteId, label: 'Nera die Quartiermeisterin' }] },
  }),
);
store.close();
const keyText = 'Nera verlangt ihren ausstehenden Sold. Noch klären: Was weiß sie über den Keller?',
  noteText = 'Nera kennt den Zugang zum Keller. Sie fordert Sold, bevor sie den Keller erwähnt.';
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
  await new Promise((resolve) => setTimeout(resolve, 20));
}
let app,
  closed = true;
const results = {},
  launches = [],
  errors = [],
  artifactHashes = {};
for (const relative of ['main.cjs', 'preload.cjs', 'ui/renderer.js', 'ui/index.html', 'ui/app.css'])
  artifactHashes[relative] = createHash('sha256')
    .update(await readFile(path.join('.build/desktop', relative)))
    .digest('hex');
async function openKey(page) {
  await page.locator('#atlas-tab').click();
  if (await page.locator('#campaign-atlas').isVisible()) {
    await page.locator('#atlas-families button[data-family=interior]').click();
    const advanced = page.locator('#atlas-advanced');
    if ((await advanced.getAttribute('open')) === null)
      await advanced.locator(':scope > summary').click();
  }
  await page.locator('#key-open').click();
}
async function launch() {
  app = await _electron.launch({
    executablePath: root + '/node_modules/electron/dist/electron',
    args: [root + '/.build/desktop/main.cjs', '--ozone-platform=x11', '--data-dir', profile],
    env: { ...process.env, DBUS_SESSION_BUS_ADDRESS: 'unix:path=' + busPath },
    timeout: 25000,
  });
  closed = false;
  launches.push({ pid: app.process().pid });
  const page = await app.firstWindow();
  page.setDefaultTimeout(10000);
  page.on('pageerror', (e) => errors.push(e.stack));
  await page.waitForFunction(() => document.body.dataset.tutorialReady === 'true');
  if (await page.locator('#tutorial-dialog').isVisible())
    await page.locator('#tutorial-skip').click();
  await page
    .locator('#campaign-screen-list article')
    .filter({ hasText: campaign.name })
    .getByRole('button', { name: 'Fortsetzen', exact: true })
    .click();
  await openKey(page);
  await page.locator('#key-room-list button').filter({ hasText: 'Wachstube' }).click();
  await page.locator('#key-search').fill('Wachstube');
  return page;
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
  launches.at(-1).exit = exit;
  closed = true;
}
try {
  let page = await launch();
  await page.locator('#key-gm-notes').fill(keyText);
  await page.waitForFunction(
    () => document.querySelector('#key-save-status').dataset.state === 'saved',
  );
  await openDesktopKeyReferences(page);
  results.referenceText = await page.locator('#key-references').innerText();
  results.referenceButtons = await page.locator('#key-references button').allTextContents();
  await page.locator('#key-references').scrollIntoViewIfNeeded();
  await page.screenshot({ path: path.join(output, 'reference.png') });
  if (before) {
    await page.locator('#key-close').click();
    await page.locator('#preparation-tab').click();
    await page.locator('#preparation-knowledge').click();
    await page.locator('#world-search').fill('Nera');
    await page
      .locator('#world-list button')
      .filter({ hasText: 'Nera die Quartiermeisterin' })
      .click();
    assert.equal(await page.locator('#note-gm').inputValue(), 'Nera kennt den Zugang zum Keller.');
    await page.locator('#note-gm').fill(noteText);
    await page.locator('#preparation-apply').click();
    await page.waitForFunction(
      () => document.querySelector('#status').textContent === 'Gespeichert.',
    );
    await openKey(page);
    results.manualRoutePreservesKey =
      (await page.locator('#key-gm-notes').inputValue()) === keyText;
    results.manualRouteSearch = await page.locator('#key-search').inputValue();
  } else {
    await page
      .locator('#key-references')
      .getByRole('button', { name: 'Nera die Quartiermeisterin', exact: true })
      .click();
    await page.locator('#note-editor').waitFor({ state: 'visible' });
    assert.equal(await page.locator('#note-gm').inputValue(), 'Nera kennt den Zugang zum Keller.');
    assert(await page.locator('#key-name').isVisible());
    assert(await page.locator('#key-gm-notes').isVisible());
    results.roomAndNoteVisibleTogether = true;
    if (nested) {
      await page.locator('#note-editor').evaluate((e) => (e.dataset.qaIdentity = 'same-editor'));
      await page.locator('#note-thread-open').click();
      await page.locator('#note-thread-dialog').waitFor({ state: 'visible' });
      if (unlink) {
        const source = page
          .locator('#note-thread-sources article')
          .filter({ hasText: 'Kellergerücht' });
        await source
          .locator('summary')
          .filter({ hasText: 'Quelle aus dieser Mappe lösen…' })
          .click();
        await source.getByRole('button', { name: 'Verknüpfungen hier lösen', exact: true }).click();
        await page.waitForFunction(
          () =>
            document.querySelector('#note-thread-editor').hidden &&
            !document.querySelector('#note-thread-sources article'),
        );
        assert.equal(
          await page.locator('#note-editor').getAttribute('data-qa-identity'),
          'same-editor',
        );
        results.nestedUnlinkUsesOriginalWriterAndReturnsEditor = true;
      }
      await page.locator('#note-thread-edit-root').click();
      await page.waitForFunction(
        () =>
          !document.querySelector('#note-thread-editor').hidden &&
          !document.querySelector('#note-thread-return').disabled,
      );
      assert.equal(
        await page.locator('#note-thread-editor #note-editor').getAttribute('data-qa-identity'),
        'same-editor',
      );
      assert.equal(
        await page.locator('#note-thread-editor #note-gm').inputValue(),
        'Nera kennt den Zugang zum Keller.',
      );
      await page.locator('#note-thread-return').click();
      await page.waitForFunction(() => document.querySelector('#note-thread-editor').hidden);
      await page
        .locator('#note-thread-dialog')
        .getByRole('button', { name: 'Schließen', exact: true })
        .click();
      await page.locator('#note-thread-dialog').waitFor({ state: 'hidden' });
      assert.equal(
        await page.locator('#key-reference-panel #note-editor').getAttribute('data-qa-identity'),
        'same-editor',
      );
      assert.equal(await page.locator('#note-editor').count(), 1);
      results.nestedThreadReturnsSameEditorToRoomContext = true;
    }

    await page.locator('#note-gm').dispatchEvent('compositionstart');
    await page.locator('#note-gm').fill(noteText);
    await page.locator('#key-reference-return').click();
    await page.waitForFunction(() => !document.querySelector('#key-reference-return').disabled);
    assert(await page.locator('#key-reference-panel').isVisible());
    results.compositionBlocksPrematureClose = true;
    await page.locator('#note-gm').dispatchEvent('compositionend');
    await page.locator('#key-reference-panel').scrollIntoViewIfNeeded();
    await page.screenshot({ path: path.join(output, 'alongside.png') });
    await page.locator('#key-reference-return').click();
    await page.locator('#key-reference-panel').waitFor({ state: 'hidden' });
    assert.equal(await page.locator('#key-name').inputValue(), 'Wachstube');
    assert.equal(await page.locator('#key-gm-notes').inputValue(), keyText);
    assert.equal(await page.locator('#key-search').inputValue(), 'Wachstube');
    results.directEditAndReturn = true;
    await page.locator('#key-references').scrollIntoViewIfNeeded();
    await page.screenshot({ path: path.join(output, 'returned.png') });
  }
  await close();
  const check = new CampaignStore(file);
  try {
    const current = check.activate(campaign.id),
      data = check.preparation(current.token);
    assert.equal(data.notes.find((r) => r.note.id === noteId).note.gmNotes, noteText);
    assert.deepEqual(data.notes.find((r) => r.note.id === noteId).note.relations, []);
    if (unlink) {
      assert.equal(
        data.notes.find((r) => r.note.id === clueId).note.gmNotes,
        'Diese falsche Spur gehört nicht zu Nera.',
      );
      assert(
        check
          .drawing(current.token)
          .keyContent.find((k) => k.id === rooms[1].id)
          .references.some((r) => r.id === noteId),
      );
      results.nestedUnlinkPreservesSourceAndRoomReference = true;
    }
    assert.deepEqual(
      check.workspace().rooms.map((r) => r.sections),
      rooms.map((r) => r.sections),
    );
    results.noteSavedAndOriginalRoomProseRetained = true;
  } finally {
    check.close();
  }
  if (!before) {
    page = await launch();
    await openDesktopKeyReferences(page);
    await page
      .locator('#key-references')
      .getByRole('button', { name: 'Nera die Quartiermeisterin', exact: true })
      .click();
    await page.waitForFunction(
      (text) => document.querySelector('#note-gm').value === text,
      noteText,
    );
    await app.evaluate(({ BrowserWindow }) =>
      BrowserWindow.getAllWindows()[0].webContents.setZoomFactor(2),
    );
    await page.locator('#note-gm').scrollIntoViewIfNeeded();
    await page.locator('#note-gm').click();
    await page.locator('#key-reference-return').scrollIntoViewIfNeeded();
    assert(await page.locator('#key-reference-return').isVisible());
    assert(await page.locator('#note-gm').isVisible());
    results.zoomLayout = await page.locator('#key-reference-return').evaluate((button) => {
      const r = button.getBoundingClientRect();
      return {
        left: r.left,
        right: r.right,
        top: r.top,
        bottom: r.bottom,
        width: window.innerWidth,
        height: window.innerHeight,
        uncovered: button.contains(
          document.elementFromPoint((r.left + r.right) / 2, (r.top + r.bottom) / 2),
        ),
      };
    });
    assert(
      results.zoomLayout.left >= 0 && results.zoomLayout.right <= results.zoomLayout.width + 1,
    );
    assert(
      results.zoomLayout.top >= 0 && results.zoomLayout.bottom <= results.zoomLayout.height + 1,
    );
    assert.equal(results.zoomLayout.uncovered, true);
    assert(
      await page
        .locator('#key-reference-panel')
        .evaluate((panel) => panel.scrollWidth <= panel.clientWidth + 1),
    );
    await writeFile(
      path.join(output, 'context-200percent.png'),
      Buffer.from(
        await app.evaluate(async ({ BrowserWindow }) =>
          (await BrowserWindow.getAllWindows()[0].webContents.capturePage())
            .toPNG()
            .toString('base64'),
        ),
        'base64',
      ),
    );
    await page.locator('#key-reference-return').click();
    await page.locator('#key-reference-panel').waitFor({ state: 'hidden' });
    assert.equal(
      await page.locator('#key-gm-notes').evaluate((field) => document.activeElement === field),
      true,
    );
    await page.locator('#key-gm-notes').click();
    results.contextReachableAt200Percent = true;
    await close();
    results.freshProcessRetainsRelatedNote = true;
  }
  assert.deepEqual(errors, []);
  await writeFile(
    path.join(output, 'result.json'),
    JSON.stringify(
      { phase, profile, results, launches, artifactHashes, errors, normalClose: closed },
      null,
      2,
    ),
  );
  console.log(JSON.stringify({ phase, results, normalClose: closed }));
} catch (error) {
  await writeFile(
    path.join(output, 'failure.json'),
    JSON.stringify({ error: error.stack, results, errors, launches }, null, 2),
  );
  if (app && !closed)
    try {
      await (await app.firstWindow()).screenshot({ path: path.join(output, 'failure.png') });
    } catch {}
  throw error;
} finally {
  if (app && !closed) await app.close();
  proxy.kill();
}
