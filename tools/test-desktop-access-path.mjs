// Native access-path correction: original building, one bend, Undo/Redo, campaign package, PNG and Fresh.
import { createRequire } from 'node:module';
import { mkdtemp, mkdir, readFile, writeFile, rm } from 'node:fs/promises';
import { execFileSync } from 'node:child_process';
import { randomUUID, createHash } from 'node:crypto';
import assert from 'node:assert/strict';
import { createNativeSession } from './native-session.mjs';
import { atlasCanvasReady, atlasCanvasPoint } from './atlas-canvas-probe.mjs';
const root = process.cwd(),
  out = process.env.QA_EVIDENCE_DIR ?? (await mkdtemp(root + '/.build/access-path-evidence-'));
await mkdir(out, { recursive: true });
await rm(out + '/result.json', { force: true });
const require = createRequire(root + '/package.json'),
  Database = require('better-sqlite3'),
  { PNG } = require('pngjs');
require('esbuild').buildSync({
  stdin: {
    contents:
      "export {CampaignStore} from './src/app/storage/store';export {newElement} from './src/app/atlas/drawing-model';",
    resolveDir: root,
  },
  outfile: `.build/access-path-store-${process.pid}.cjs`,
  bundle: true,
  platform: 'node',
  format: 'cjs',
  external: ['better-sqlite3'],
});
const { CampaignStore, newElement } = require(
    root + `/.build/access-path-store-${process.pid}.cjs`,
  ),
  source = execFileSync('git', ['rev-parse', 'HEAD'], { encoding: 'utf8' }).trim(),
  dirty = !!execFileSync('git', ['status', '--porcelain'], { encoding: 'utf8' }).trim(),
  workerArtifact = createHash('sha256')
    .update(await readFile(root + '/.build/desktop/atlas-region-worker.cjs'))
    .digest('hex');
const launches = [],
  results = [];
let app, page, native, db;
try {
  for (const variant of [1, 2]) {
    const scale = 1;
    native = await createNativeSession({
      root,
      output: out + '/variant-' + variant,
      name: 'access-path',
    });
    assert.equal(native.source, source);
    assert.equal(native.dirty, dirty);
    const profile = native.profile,
      store = new CampaignStore(profile + '/workbench.sqlite'),
      room = {
        id: randomUUID(),
        scopeId: 'local',
        floorId: 'ground',
        number: '1',
        name: 'Zollhaus',
        revision: 0,
        polygons: [
          {
            outer: [
              { x: 0, y: 0 },
              { x: 12.192, y: 0 },
              { x: 12.192, y: 12.192 },
              { x: 0, y: 12.192 },
            ],
            holes: [],
          },
        ],
        sections: [
          {
            id: randomUUID(),
            kind: 'markdown',
            markdown: '  Erhaltener Grundriss\r\n- Zollschalter',
          },
        ],
      },
      campaign = store.create('Zugangsweg am Zollhaus', [room]),
      w = store.activate(campaign.id),
      command = (action) => ({
        commandId: randomUUID(),
        campaignId: campaign.id,
        token: w.token,
        action,
      });
    const path = {
      ...newElement('path', 'local', 'ground', null, [
        { x: -6.096, y: 6.096 },
        { x: 18.288, y: 6.096 },
      ]),
      name: 'Zugangsweg',
      notes: '  Am Zollhaus entlang\r\n',
      width: 0.6,
      color: '#b44b22',
    };
    store.executeDrawing(command({ kind: 'element', element: path, expectedRevision: null }));
    const binding = store
      .campaignAtlas(w.token)
      .bindings.find((b) => b.kind === 'dungeon' && b.ownerId === 'local');
    assert(binding && binding.x === 0 && binding.y === 0 && binding.angle === 0);
    store.tutorial('skipped');
    store.close();
    const choose = async () => {
      await page.locator('#atlas-search').fill('Zollhaus');
      await page.locator('#atlas-search-results button').filter({ hasText: 'Zollhaus' }).click();
      await page.waitForFunction(() => document.getElementById('room-name')?.value === 'Zollhaus');
      await page.waitForFunction(
        () => JSON.parse(document.getElementById('campaign-map').dataset.atlasView).height < 100,
      );
      await atlasCanvasReady(page);
      if (await page.locator('#atlas-secondary').isVisible())
        await page.locator('#atlas-secondary-close').click();
      await page.evaluate(
        () => new Promise((r) => requestAnimationFrame(() => requestAnimationFrame(r))),
      );
      await atlasCanvasReady(page);
      const snapshot = new Database(profile + '/workbench.sqlite', { readonly: true });
      const points = JSON.parse(
        snapshot.prepare('SELECT payload FROM drawing_element WHERE id=?').get(path.id).payload,
      ).points;
      snapshot.close();
      const p = await atlasCanvasPoint(
        page,
        {
          x: points[0].x + (points[1].x - points[0].x) * 0.15,
          y: points[0].y + (points[1].y - points[0].y) * 0.15,
        },
        false,
      );
      await page.mouse.click(p.x, p.y);
      await page.waitForFunction(
        () =>
          document.getElementById('campaign-atlas').dataset.elementSelected === 'true' &&
          document.getElementById('drawing-element-name').value === 'Zugangsweg',
      );
      await atlasCanvasReady(page);
    };
    async function launch() {
      page = await native.launch(scale);
      app = native.app;
      assert.equal(
        createHash('sha256')
          .update(await readFile(root + '/.build/desktop/atlas-region-worker.cjs'))
          .digest('hex'),
        workerArtifact,
      );
      await app.evaluate(({ BrowserWindow }, compact) => {
        const w = BrowserWindow.getAllWindows().find((w) =>
          w.webContents.getURL().endsWith('/index.html'),
        );
        w.unmaximize();
        w.setMinimumSize(320, 240);
        w.setContentSize(compact ? 700 : 1400, compact ? 500 : 1000);
      }, variant === 2);
      await page.emulateMedia({ reducedMotion: 'reduce' });
      await page.waitForFunction(() => document.body.dataset.tutorialReady === 'true');
      await page
        .locator('.campaign-card[data-campaign-id="' + campaign.id + '"]')
        .getByRole('button', { name: /Öffnen|Fortsetzen/ })
        .click();
      await page.waitForFunction(
        () =>
          document.body.classList.contains('has-workspace') &&
          !document.querySelector('main').inert,
      );
      if (await page.locator('#campaign-atlas').isHidden()) {
        if (!(await page.locator('#atlas-tab').isVisible()))
          await page.locator('#workspace-nav-summary').click();
        await page.locator('#atlas-tab').click();
      }
      await page.locator('#atlas-section').selectOption('interior');
      await atlasCanvasReady(page);
      await choose();
    }
    await launch();
    for (let i = 0; i < 3; i++)
      await page.getByRole('button', { name: 'Verkleinern', exact: true }).click();
    await atlasCanvasReady(page);
    db = new Database(profile + '/workbench.sqlite', { readonly: true });
    const readPath = () =>
        JSON.parse(
          db.prepare('SELECT payload FROM drawing_element WHERE id=?').get(path.id).payload,
        ),
      readRoom = () => db.prepare('SELECT * FROM room WHERE id=?').get(room.id),
      originalPath = readPath(),
      originalRoom = readRoom();
    async function until(check) {
      const end = Date.now() + 20000;
      while (!check() && Date.now() < end) await new Promise((r) => setTimeout(r, 25));
      assert(check(), 'Expected confirmed source state');
    }
    async function png(label) {
      const toolsVisible = await page.locator('#atlas-panel').isVisible(),
        layout = await page.evaluate(() => localStorage.getItem('atlas-editor-layout-v4'));
      await page.locator('#atlas-output-open').click();
      await atlasCanvasReady(page);
      assert.equal(await page.locator('#atlas-panel').isVisible(), false);
      assert.equal(
        (await atlasCanvasPoint(page, { x: 6.096, y: 6.096 }, false)).target,
        'campaign-map',
        'the building preview stays uncovered',
      );
      if (!(await page.locator('#atlas-export-size').isVisible()))
        await page.locator('#atlas-output details summary').click();
      await page.locator('#atlas-export-size').fill('1536');
      await page.locator('#atlas-export-format').selectOption('png');
      await page.locator('#atlas-export-audience').selectOption('gm');
      await page.locator('#atlas-export-grid').uncheck();
      const box = JSON.parse(await page.locator('#campaign-map').getAttribute('data-atlas-view')),
        file = out + '/variant-' + variant + '-' + label + '.png';
      await app.evaluate(({ dialog }, file) => {
        dialog.showSaveDialog = async () => ({ canceled: false, filePath: file });
      }, file);
      await page.locator('#atlas-export-png').click();
      await until(() => {
        try {
          return require('node:fs').statSync(file).size > 100;
        } catch {
          return false;
        }
      });
      await page.waitForFunction(() => !document.getElementById('atlas-export-png').disabled);
      const data = PNG.sync.read(await readFile(file)),
        red = (p) => {
          const x = Math.round(((p.x - box.x) / box.width) * data.width),
            y = Math.round(((p.y - box.y) / box.height) * data.height);
          let count = 0;
          for (let dx = -3; dx <= 3; dx++)
            for (let dy = -3; dy <= 3; dy++) {
              const i = ((y + dy) * data.width + x + dx) * 4;
              if (
                data.data[i] > 100 &&
                data.data[i] > data.data[i + 1] * 1.4 &&
                data.data[i + 1] > data.data[i + 2] * 1.2
              )
                count++;
            }
          return count;
        };
      // Sample the crossing inside the building, clear of its centered room label.
      const pixels = { old: red({ x: 1.524, y: 6.096 }), bend: red({ x: 6.096, y: -9.144 }) };
      await page.locator('#atlas-output-back').click();
      assert.equal(await page.locator('#atlas-panel').isVisible(), toolsVisible);
      assert.equal(
        await page.evaluate(() => localStorage.getItem('atlas-editor-layout-v4')),
        layout,
        'export does not overwrite the preferred editing layout',
      );
      return pixels;
    }
    assert(
      await page.locator('#atlas-secondary').isVisible(),
      'selection properties stay available during correction',
    );
    const selectedLayout = await page.evaluate(() => {
      const root = document.querySelector('#campaign-atlas'),
        map = document.querySelector('#campaign-map').getBoundingClientRect();
      return {
        compact: root.dataset.compactSelection,
        width: root.clientWidth,
        mapWidth: map.width,
      };
    });
    assert(
      selectedLayout.mapWidth / selectedLayout.width >= 0.45,
      'map keeps enough room beside selected-object properties',
    );
    assert.equal(await page.locator('#atlas-tool-settings').isVisible(), variant === 1);
    await native.capture(page, 'selected-path');
    if (variant === 2) {
      await page.locator('[data-tool-group=walls]').click();
      await page.waitForFunction(() => !document.querySelector('#atlas-section').disabled);
      assert(await page.locator('#atlas-tool-settings').isVisible());
      assert(await page.locator('#atlas-secondary').isHidden());
      await page.locator('#atlas-select').click();
      await choose();
      assert(await page.locator('#atlas-secondary').isVisible());
      assert(await page.locator('#atlas-tool-settings').isHidden());
    }
    const before = await png('crossing');
    assert(before.old > 0);
    assert.equal(before.bend, 0);
    if (await page.locator('#atlas-secondary').isHidden())
      await page.locator('#atlas-context-toggle').click();
    await atlasCanvasReady(page);
    assert(
      await page.locator('#atlas-secondary').isVisible(),
      'the actual bend gesture uses the natural properties view',
    );
    const start = await atlasCanvasPoint(page, { x: 6.096, y: 6.096 }, false),
      end = await atlasCanvasPoint(page, { x: 6.096, y: -9.144 }, false);
    await page.mouse.move(start.x, start.y);
    await page.mouse.down();
    await page.mouse.move(end.x, end.y, { steps: 12 });
    await page.mouse.up();
    await until(() => readPath().points.length === 3);
    const corrected = readPath();
    assert.deepEqual(corrected.points, [path.points[0], { x: 6.096, y: -9.144 }, path.points[1]]);
    assert.deepEqual(readRoom(), originalRoom);
    for (const key of ['id', 'name', 'notes', 'scopeId', 'floorId', 'width', 'color'])
      assert.deepEqual(corrected[key], originalPath[key]);
    await page.locator('#atlas-undo').click();
    await until(() => JSON.stringify(readPath().points) === JSON.stringify(originalPath.points));
    assert.deepEqual(readRoom(), originalRoom);
    await page.locator('#atlas-redo').click();
    await until(() => JSON.stringify(readPath().points) === JSON.stringify(corrected.points));
    assert.deepEqual(readRoom(), originalRoom);
    await atlasCanvasReady(page);
    assert(await page.locator('#atlas-secondary').isVisible());
    await native.capture(page, 'corrected-with-properties');
    const after = await png('corrected');
    assert.equal(after.old, 0);
    assert(after.bend > 0);
    const beforeBackup = readPath();
    // Backup is a direct export action, independent of public image/archive settings.
    assert.equal(await page.locator('#drawing-public-export').isChecked(), true);
    await page.locator('#atlas-output-open').click();
    await page.locator('#atlas-export-audience').selectOption('public');
    await page.locator('#atlas-export-kind').selectOption('campaign');
    await app.evaluate(({ dialog }) => {
      dialog.showSaveDialog = async () => ({ canceled: true });
    });
    await page.locator('#atlas-output-save-campaign').click();
    await page.waitForFunction(
      () =>
        document.getElementById('atlas-output-save-status').textContent ===
        'Kampagnensicherung abgebrochen.',
    );
    assert.deepEqual(readRoom(), originalRoom);
    assert.deepEqual(readPath(), beforeBackup);
    await page.locator('#atlas-output-back').click();
    await page.locator('#atlas-output-open').click();
    assert.equal(
      await page.evaluate(() =>
        document.getElementById('atlas-output').contains(document.activeElement),
      ),
      true,
      'reopening campaign output puts keyboard focus in its visible controls',
    );
    const editable = out + '/variant-' + variant + '-editable.kwcampaign';
    await app.evaluate(({ dialog }, file) => {
      dialog.showSaveDialog = async () => ({ canceled: false, filePath: file });
    }, editable);
    await page.locator('#atlas-output-save-campaign').click();
    await until(() => {
      try {
        return require('node:fs').statSync(editable).size > 100;
      } catch {
        return false;
      }
    });
    await page.waitForFunction(
      () =>
        document.getElementById('atlas-output-save-status').textContent ===
        'Bearbeitbare Kampagne gesichert.',
    );
    assert.equal(await page.locator('#drawing-public-export').isChecked(), true);
    assert((await readFile(editable)).length > 100);
    assert.deepEqual(readPath(), beforeBackup);
    assert.deepEqual(readRoom(), originalRoom);
    await page.evaluate(
      () => new Promise((r) => requestAnimationFrame(() => requestAnimationFrame(r))),
    );
    await native.capture(page, 'edited');
    const savedPath = readPath();
    db.close();
    db = null;
    await native.close();
    await launch();
    assert.equal(await page.locator('#drawing-element-points').isEnabled(), true);
    db = new Database(profile + '/workbench.sqlite', { readonly: true });
    assert.deepEqual(readPath(), savedPath);
    assert.deepEqual(readRoom(), originalRoom);
    // Restore the actual package through the existing import UI, then edit its path.
    await app.evaluate(({ dialog }, file) => {
      dialog.showOpenDialog = async () => ({ canceled: false, filePaths: [file] });
    }, editable);
    await page.locator('#atlas-navigation').click();
    await page.locator('#campaign-manager').click();
    await page.locator('#campaign-import-package').click();
    await page.locator('#campaign-transfer-dialog').waitFor({ state: 'visible' });
    const restoredName = 'Zollhaus wiederhergestellt ' + variant;
    await page.locator('#campaign-transfer-name').fill(restoredName);
    await page.locator('#campaign-transfer-accept').click();
    await page.locator('#campaign-transfer-dialog').waitFor({ state: 'hidden' });
    const restoredCampaign = db
      .prepare('SELECT id FROM campaign WHERE name=?')
      .get(restoredName).id;
    await page.waitForFunction(
      (id) =>
        document.getElementById('campaigns').value === id && !document.querySelector('main').inert,
      restoredCampaign,
    );
    const restoredPath = () =>
      db
        .prepare('SELECT payload FROM drawing_element WHERE campaign_id=?')
        .all(restoredCampaign)
        .map((r) => JSON.parse(r.payload))
        .find((e) => e.name === 'Zugangsweg');
    const restoredRoom = JSON.parse(
      db.prepare('SELECT payload FROM room WHERE campaign_id=?').get(restoredCampaign).payload,
    );
    assert.deepEqual(restoredRoom.polygons, room.polygons);
    assert.deepEqual(
      restoredRoom.sections.map((s) => s.markdown),
      room.sections.map((s) => s.markdown),
    );
    assert.deepEqual(restoredPath().points, savedPath.points);
    assert.equal(restoredPath().notes, savedPath.notes);
    if (await page.locator('#campaign-atlas').isHidden()) {
      if (!(await page.locator('#atlas-tab').isVisible()))
        await page.locator('#workspace-nav-summary').click();
      await page.locator('#atlas-tab').click();
    }
    await page.locator('#atlas-section').selectOption('interior');
    await choose();
    for (let i = 0; i < 2; i++)
      await page.getByRole('button', { name: 'Verkleinern', exact: true }).click();
    await atlasCanvasReady(page);
    const from = await atlasCanvasPoint(page, savedPath.points[1], false),
      to = await atlasCanvasPoint(page, { x: 6.096, y: -12.192 }, false);
    await page.mouse.move(from.x, from.y);
    await page.mouse.down();
    await page.mouse.move(to.x, to.y, { steps: 8 });
    await page.mouse.up();
    await until(() => restoredPath().points[1].y === -12.192);
    await page.waitForFunction(
      () =>
        document
          .getElementById('drawing-element-points')
          .value.split('\n')[1]
          ?.split(',')[1]
          ?.trim() === '-40',
    );
    assert.deepEqual(
      await page.locator('#drawing-element-points').inputValue(),
      restoredPath()
        .points.map((p) => [p.x, p.y].map((n) => Number((n / 0.3048).toPrecision(12))).join(', '))
        .join('\n'),
      'Point controls display feet while canonical geometry remains metric',
    );
    await atlasCanvasReady(page);
    assert.deepEqual(readPath(), savedPath, 'restored edits never overwrite the source campaign');

    // Hold replies only after the real archive writer has finished.
    await app.evaluate(({ ipcMain }) => {
      const original = ipcMain._invokeHandlers.get('campaign:export');
      globalThis.qaBackupReplies = [];
      ipcMain.removeHandler('campaign:export');
      ipcMain.handle('campaign:export', async (e, ...args) => {
        const result = await original(e, ...args);
        return new Promise((resolve) => globalThis.qaBackupReplies.push(() => resolve(result)));
      });
    });
    const waitBackups = async (n) => {
      for (let i = 0; i < 300; i++) {
        if ((await app.evaluate(() => globalThis.qaBackupReplies.length)) === n) return;
        await new Promise((r) => setTimeout(r, 25));
      }
      assert.equal(await app.evaluate(() => globalThis.qaBackupReplies.length), n);
    };
    const startBackup = async (file) => {
      if (!(await page.locator('#atlas-output').isVisible()))
        await page.locator('#atlas-output-open').click();
      await page.locator('#atlas-export-kind').selectOption('campaign');
      assert(
        await page.locator('#atlas-panel').isHidden(),
        'output keeps the drawing tools out of its preview',
      );
      assert(await page.locator('#atlas-output-save-campaign').isEnabled());
      await app.evaluate(({ dialog }, file) => {
        dialog.showSaveDialog = async () => ({ canceled: false, filePath: file });
      }, file);
      await page.locator('#atlas-output-save-campaign').click();
    };
    const retiredFile = out + '/variant-' + variant + '-retired.kwcampaign',
      currentFile = out + '/variant-' + variant + '-current.kwcampaign';
    await startBackup(retiredFile);
    await waitBackups(1);
    await page.locator('#atlas-export-kind').selectOption('image');
    assert(
      await page.locator('#atlas-export-png').isDisabled(),
      'one output slot prevents an overlapping image export',
    );
    await page.locator('#atlas-navigation').click();
    await page.locator('#atlas-exit').click();
    await page
      .locator('.campaign-card[data-campaign-id="' + campaign.id + '"]')
      .getByRole('button', { name: /Öffnen|Fortsetzen/ })
      .click();
    await page.waitForFunction(() => !document.querySelector('main').inert);
    await atlasCanvasReady(page);
    assert(
      await page.locator('#atlas-output').isHidden(),
      'a new campaign closes the retired export panel',
    );
    await startBackup(currentFile);
    await waitBackups(2);
    await app.evaluate(() => globalThis.qaBackupReplies.shift()());
    await page.evaluate(
      () => new Promise((r) => requestAnimationFrame(() => requestAnimationFrame(r))),
    );
    assert(await page.locator('#atlas-output-save-campaign').isDisabled());
    assert.equal(
      await page.locator('#atlas-output-save-status').textContent(),
      'Kampagne wird gesichert…',
    );
    await native.capture(page, 'current-backup-pending');
    await app.evaluate(() => globalThis.qaBackupReplies.shift()());
    await page.waitForFunction(
      () =>
        document.getElementById('atlas-output-save-status').textContent ===
        'Bearbeitbare Kampagne gesichert.',
    );
    assert(await page.locator('#atlas-output-save-campaign').isEnabled());
    assert((await readFile(retiredFile)).length > 100);
    assert((await readFile(currentFile)).length > 100);
    assert.deepEqual(readPath(), savedPath);
    assert.deepEqual(readRoom(), originalRoom);
    assert.equal(restoredPath().points[1].y, -12.192);

    db.close();
    db = null;
    await native.close();
    launches.push(...native.launches);
    results.push({
      scale,
      variant,
      profile,
      before,
      after,
      points: corrected.points,
      buildingBytesPreserved: true,
      metadataPreserved: true,
      undoRedo: true,
      editableExport: true,
      packageRestoredAndEdited: true,
      exportPreviewUncovered: true,
      selectedPropertiesKeptOpen: true,
      compactToolReturn: variant === 2,
      exportFocusOnReopen: true,
      editingLayoutPreferenceRetained: true,
      backupIndependentOfPublicSettings: true,
      cancelledBackupReadonly: true,
      retiredBackupReplyIgnored: true,
      outputSlotShared: true,
      fresh: true,
    });
    await native.finish({ result: results.at(-1), workerArtifact });
    await native.dispose();
    native = null;
  }
  assert.equal(
    createHash('sha256')
      .update(await readFile(root + '/.build/desktop/atlas-region-worker.cjs'))
      .digest('hex'),
    workerArtifact,
  );
  await writeFile(
    out + '/result.json',
    JSON.stringify({ source, dirty, workerArtifact, launches, results }, null, 2),
  );
  console.log(JSON.stringify({ source, launches, results }));
} catch (e) {
  await native?.fail(e);
  throw e;
} finally {
  db?.close();
  await native?.dispose();
}
