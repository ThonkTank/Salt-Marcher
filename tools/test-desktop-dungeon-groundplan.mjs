// Full native ground-plan task; only empty isolated campaigns are seeded.
import { createRequire } from 'node:module';
import { mkdir, readFile, writeFile, rm } from 'node:fs/promises';
import { createNativeSession } from './native-session.mjs';
import { createHash } from 'node:crypto';
import { execFileSync } from 'node:child_process';
import assert from 'node:assert/strict';
import { atlasCanvasReady, atlasCanvasPoint } from './atlas-canvas-probe.mjs';
const root = process.cwd(),
  out = process.env.QA_EVIDENCE_DIR ?? root + '/.build/dungeon-groundplan';
await mkdir(out, { recursive: true });
await rm(out + '/result.json', { force: true });
if (process.argv.length > 2)
  throw Error('The ground-plan probe runs the complete current workflow without mode switches.');
const source = execFileSync('git', ['rev-parse', 'HEAD'], { encoding: 'utf8' }).trim(),
  dirty = !!execFileSync('git', ['status', '--porcelain'], { encoding: 'utf8' }).trim();
const require = createRequire(root + '/package.json'),
  Database = require('better-sqlite3'),
  { PNG } = require('pngjs');
require('esbuild').buildSync({
  entryPoints: ['src/app/storage/store.ts'],
  outfile: '.build/groundplan-store.cjs',
  bundle: true,
  platform: 'node',
  format: 'cjs',
  external: ['better-sqlite3'],
});
const { CampaignStore } = require(root + '/.build/groundplan-store.cjs');
const workerArtifact = createHash('sha256')
  .update(await readFile(root + '/.build/desktop/atlas-region-worker.cjs'))
  .digest('hex');
const exportDoorY = -6.096,
  launches = [],
  results = [];
let app, page, native, db;
async function until(check) {
  const end = Date.now() + 20000;
  while (!check() && Date.now() < end) await new Promise((r) => setTimeout(r, 25));
  assert(check(), 'Expected confirmed source state');
}
try {
  for (const scale of [1, 2]) {
    const evidenceDir = out + '/' + scale;
    native = await createNativeSession({ root, output: evidenceDir, name: 'dungeon-groundplan' });
    const profile = native.profile,
      store = new CampaignStore(profile + '/workbench.sqlite'),
      campaign = store.create('Torhalle, Wache und Archiv'),
      other = store.create('Anderer Kartenstand');
    store.tutorial('skipped');
    store.close();
    assert.equal(native.source, source);
    assert.equal(native.dirty, dirty);
    async function launch() {
      page = await native.launch(scale);
      app = native.app;
      assert.equal(
        createHash('sha256')
          .update(await readFile(root + '/.build/desktop/atlas-region-worker.cjs'))
          .digest('hex'),
        workerArtifact,
      );
      await app.evaluate(({ BrowserWindow }) => {
        const w = BrowserWindow.getAllWindows().find((w) =>
          w.webContents.getURL().endsWith('/index.html'),
        );
        w.unmaximize();
        w.setContentSize(1400, 1000);
      });
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
      await page.evaluate(() => {
        const original = CanvasRenderingContext2D.prototype.fillText;
        window.qaPaintedText = [];
        window.qaPaintedLabels = [];
        CanvasRenderingContext2D.prototype.fillText = function (text, ...args) {
          if (!this.canvas.isConnected) {
            window.qaPaintedText.push(String(text));
            const m = this.getTransform();
            window.qaPaintedLabels.push({
              text: String(text),
              pixels: parseFloat(this.font) * Math.hypot(m.a, m.b),
            });
          }
          return original.call(this, text, ...args);
        };
      });
      await page.locator('#atlas-section').selectOption('interior');
      await page.waitForFunction(() => !document.querySelector('#atlas-section').disabled);
      await atlasCanvasReady(page);
    }
    await launch();
    db = new Database(profile + '/workbench.sqlite', { readonly: true });
    const rooms = () =>
        db
          .prepare('SELECT * FROM room ORDER BY id')
          .all()
          .map((r) => ({ ...r, ...JSON.parse(r.payload) })),
      room = (name) => rooms().find((r) => r.name === name),
      doors = () =>
        db
          .prepare("SELECT payload FROM drawing_element WHERE kind='door' ORDER BY id")
          .all()
          .map((r) => JSON.parse(r.payload));
    const bindingsBefore = db
      .prepare("SELECT count(*) n FROM atlas_binding WHERE kind='dungeon'")
      .get().n;
    await page.locator('#atlas-create-dungeon').click();
    let b = await page.locator('#campaign-map').boundingBox();
    await page.mouse.click(b.x + b.width * 0.5, b.y + b.height * 0.5);
    await page.locator('.room-group-dialog [value=empty]').click();
    await page.locator('.room-group-dialog').waitFor({ state: 'hidden' });
    await until(
      () =>
        db.prepare("SELECT count(*) n FROM atlas_binding WHERE kind='dungeon'").get().n ===
        bindingsBefore + 1,
    );
    await atlasCanvasReady(page);
    await page.waitForFunction(
      () => JSON.parse(document.querySelector('#campaign-map').dataset.atlasView).width < 150,
    );
    for (let i = 0; i < 24; i++) {
      if (
        JSON.parse(await page.locator('#campaign-map').getAttribute('data-atlas-view')).width < 70
      )
        break;
      await page.getByRole('button', { name: 'Vergrößern', exact: true }).click();
    }
    await atlasCanvasReady(page);
    const binding = db
        .prepare("SELECT * FROM atlas_binding WHERE kind='dungeon' ORDER BY rowid DESC LIMIT 1")
        .get(),
      world = (p) => ({ x: binding.x + p.x, y: binding.y + p.y });
    const screen = async (p) => atlasCanvasPoint(page, world(p), false);
    const choose = async (name) => {
      await page.locator('#atlas-search').fill(name);
      await page.locator('#atlas-search-results button').filter({ hasText: name }).click();
      await page.waitForFunction((n) => document.querySelector('#room-name')?.value === n, name);
      await atlasCanvasReady(page);
    };
    const tool = async (name) => {
      if (name === 'Auswahl / Eckpunkte') await page.locator('#atlas-select').click();
      else {
        const [group, id] =
          name === 'Raumrechteck' ? ['rooms', 'room-rectangle'] : ['walls', 'door'];
        if (
          (await page.locator('#atlas-group-tools').getAttribute('data-group')) !== group ||
          !(await page.locator('[data-atlas-tool="' + id + '"]').isVisible())
        )
          await page.locator('[data-tool-group="' + group + '"]').click();
        await page.locator('[data-atlas-tool="' + id + '"]').click();
      }
      await page.waitForFunction(() => !document.querySelector('#atlas-section').disabled);
      if (name === 'Raumrechteck')
        assert(
          await page.locator('#atlas-secondary').isHidden(),
          'Choosing room drawing clears obstructing properties',
        );
      else if (await page.locator('#atlas-secondary').isVisible())
        await page.locator('#atlas-secondary-close').click();
      await page.evaluate(
        () => new Promise((r) => requestAnimationFrame(() => requestAnimationFrame(r))),
      );
      await atlasCanvasReady(page);
    };
    for (const [index, name, left, right] of [
      [0, 'Torhalle', -15.24, -6.096],
      [1, 'Wachstube', -6.096, 3.048],
      [2, 'Archiv', 3.048, 12.192],
    ]) {
      if (index === 0) await tool('Raumrechteck');
      else
        assert.equal(
          await page.locator('#drawing-tool').inputValue(),
          'room-rectangle',
          'The chosen tool stays active between rooms',
        );
      assert.equal(
        await page.locator('#atlas-new-name').isVisible(),
        false,
        'Only the owning room-name field is offered',
      );
      await page.locator('#drawing-room-name').fill(name);
      const a = await screen({ x: left, y: -4.572 }),
        z = await screen({ x: right, y: 4.572 });
      if (index === 1) {
        await page.mouse.click(a.x, a.y);
        await page.mouse.click(z.x, z.y);
      } else {
        await page.mouse.move(a.x, a.y);
        await page.mouse.down();
        await page.mouse.move(z.x, z.y, { steps: 8 });
        await page.mouse.up();
      }
      await until(() => !!room(name));
      await page.waitForFunction(
        (name) =>
          document.querySelector('#campaign-atlas').dataset.roomDraw === 'true' &&
          document.querySelector('#drawing-tool').value === 'room-rectangle' &&
          document.querySelector('#room-name').value === name &&
          document.querySelector('#drawing-room-name').selectionStart === 0 &&
          document.querySelector('#drawing-room-name').selectionEnd === name.length,
        name,
      );
      await atlasCanvasReady(page);
      assert(
        await page.locator('#atlas-secondary').isHidden(),
        'Room creation leaves the next drawing position uncovered',
      );
    }
    await native.capture(page, 'rooms-painted');
    await tool('Auswahl / Eckpunkte');
    assert.equal(rooms().length, 3);
    assert.deepEqual(
      rooms()
        .map((r) => r.name)
        .sort(),
      ['Archiv', 'Torhalle', 'Wachstube'],
    );
    for (const [name, x, y] of [
      ['Torhalle', -10.668, -4.572],
      ['Wachstube', 3.048, 0],
    ]) {
      await choose(name);
      await tool('Tür / Portal');
      const p = await screen({ x, y }),
        count = doors().length;
      await page.mouse.click(p.x, p.y);
      await until(() => doors().length === count + 1);
      await atlasCanvasReady(page);
    }
    assert.equal(doors().length, 2);
    assert(doors().every((d) => d.anchor && d.roomId));
    const output = async (suffix, size = 1536) => {
      // Capture actual Canvas text calls without changing their rendering; inspect the saved PNG too.
      // Fit the complete authored ground plan through the public camera controls.

      await atlasCanvasReady(page);
      await page.locator('#atlas-output-open').click();
      if (suffix === 'before') await page.locator('#atlas-output-dungeon').click();
      await atlasCanvasReady(page);
      await page.waitForFunction(
        () =>
          document.querySelector('#atlas-output-dungeon').getAttribute('aria-pressed') === 'true',
      );
      assert.match(
        await page.locator('#atlas-output-area').textContent(),
        /Dungeon-Grundriss.*Erdgeschoss/,
      );
      const points = rooms().flatMap((r) => r.polygons.flatMap((p) => p.outer.map(world))),
        xs = points.map((p) => p.x),
        ys = points.map((p) => p.y),
        width = Math.max(...xs) - Math.min(...xs),
        height = Math.max(...ys) - Math.min(...ys),
        margin = Math.max(1.524, Math.max(width, height) * 0.05);
      const box = {
        x: Math.min(...xs) - margin,
        y: Math.min(...ys) - margin,
        width: width + 2 * margin,
        height: height + 2 * margin,
      };
      box.height += Math.max((72 * box.width) / 1024, (72 * box.height) / (1024 - 72));
      if (!(await page.locator('#atlas-export-size').isVisible()))
        await page.locator('#atlas-output details summary').click();
      await page.locator('#atlas-export-size').fill(String(size));
      await page.locator('#atlas-export-grid').uncheck();
      const file = profile + '/' + suffix + '.png';
      await app.evaluate(({ dialog }, file) => {
        dialog.showSaveDialog = async () => ({ canceled: false, filePath: file });
      }, file);
      const before = JSON.stringify({ rooms: rooms(), doors: doors() });
      await page.evaluate(() => {
        window.qaPaintedText = [];
        window.qaPaintedLabels = [];
      });
      await page.locator('#atlas-export-png').click();
      await page.waitForFunction(
        () => document.querySelector('#atlas-save-status').textContent === 'Atlas-PNG gespeichert',
      );
      const painted = await page.evaluate(() => window.qaPaintedText),
        labelPixels = await page.evaluate(() =>
          window.qaPaintedLabels.filter((l) => l.text.includes('Torhalle')).map((l) => l.pixels),
        );
      assert(labelPixels.length > 0);
      for (const name of ['Torhalle', 'Wachstube', 'Archiv'])
        assert(
          painted.some((text) => text.includes(name)),
          'The actual output paints ' + name,
        );
      assert(
        !painted.includes('Neue Zeichnung'),
        'The empty drawing caption cannot replace the room key',
      );
      await page.evaluate(
        () => new Promise((r) => requestAnimationFrame(() => requestAnimationFrame(r))),
      );
      await native.capture(page, 'output-' + suffix);
      const bytes = await readFile(file);
      assert.equal(
        JSON.stringify({ rooms: rooms(), doors: doors() }),
        before,
        'Export never writes author geometry',
      );
      const png = PNG.sync.read(bytes);
      const labelRoom = room('Torhalle'),
        labelRing = labelRoom.polygons[0].outer.map(world),
        lx = labelRing.map((p) => p.x),
        ly = labelRing.map((p) => p.y),
        cx = (Math.min(...lx) + Math.max(...lx)) / 2,
        cy = (Math.min(...ly) + Math.max(...ly)) / 2;
      let labelInk = 0,
        minInkX = Infinity,
        minInkY = Infinity,
        maxInkX = -Infinity,
        maxInkY = -Infinity;
      const sx = ((cx - box.x) / box.width) * png.width,
        sy = ((cy - box.y) / box.height) * png.height,
        rx = (((Math.max(...lx) - Math.min(...lx)) * 0.4) / box.width) * png.width,
        ry = (((Math.max(...ly) - Math.min(...ly)) * 0.25) / box.height) * png.height;
      for (let y = Math.ceil(sy - ry); y < sy + ry; y++)
        for (let x = Math.ceil(sx - rx); x < sx + rx; x++) {
          const i = (y * png.width + x) * 4;
          if (png.data[i] < 110 && png.data[i + 1] < 125 && png.data[i + 2] < 125) {
            labelInk++;
            minInkX = Math.min(minInkX, x);
            maxInkX = Math.max(maxInkX, x);
            minInkY = Math.min(minInkY, y);
            maxInkY = Math.max(maxInkY, y);
          }
        }
      assert(labelInk > 20, 'The exported room name has visible ink');
      assert(png.width > 500 && png.height > 500);
      assert.equal(
        png.width / png.height > 1.5,
        true,
        'The wide ground plan is framed independently of the tall export sidebar',
      );
      await writeFile(out + '/' + suffix + '-' + scale + '.png', bytes);
      const p = world({ x: -10.668, y: -6.096 }),
        x = Math.floor(((p.x - box.x) / box.width) * png.width),
        y = Math.floor(((p.y - box.y) / box.height) * png.height),
        pixel = [...png.data.slice((y * png.width + x) * 4, (y * png.width + x) * 4 + 4)];
      const doorPixels = (point) => {
        const p = world(point),
          cx = Math.round(((p.x - box.x) / box.width) * png.width),
          cy = Math.round(((p.y - box.y) / box.height) * png.height);
        let count = 0;
        for (let y = cy - 3; y <= cy + 3; y++)
          for (let x = cx - 3; x <= cx + 3; x++) {
            const i = (y * png.width + x) * 4;
            if (
              png.data[i] > 100 &&
              png.data[i] < 140 &&
              png.data[i + 1] > 75 &&
              png.data[i + 1] < 110 &&
              png.data[i + 2] > 55 &&
              png.data[i + 2] < 100
            )
              count++;
          }
        return count;
      };
      const doorAtOld = doorPixels({ x: -10.668, y: -4.572 }),
        doorAtNew = doorPixels({ x: -10.668, y: exportDoorY });
      await page.locator('#atlas-output-back').click();
      return {
        labelInk,
        labelBounds: { width: maxInkX - minInkX + 1, height: maxInkY - minInkY + 1 },
        bytes,
        pixel,
        doorAtOld,
        doorAtNew,
        labelPixels,
        width: png.width,
        height: png.height,
      };
    };
    const beforePng = await output('before'),
      original = structuredClone(room('Torhalle')),
      originalDoors = structuredClone(doors());
    await choose('Torhalle');
    await tool('Auswahl / Eckpunkte');
    const a = await screen({ x: -10.668, y: -4.572 }),
      z = await screen({ x: -10.668, y: -6.7 });
    await page.mouse.move(a.x, a.y);
    await page.mouse.down();
    await page.mouse.move(z.x, z.y, { steps: 8 });
    await page.mouse.up();
    await until(() => room('Torhalle').revision > original.revision);
    await atlasCanvasReady(page);
    const enlarged = structuredClone(room('Torhalle'));
    assert.equal(enlarged.id, original.id);
    assert.equal(enlarged.name, 'Torhalle');
    assert.deepEqual(enlarged.sections, original.sections);
    assert(
      Math.min(...enlarged.polygons[0].outer.map((p) => p.y)) <
        Math.min(...original.polygons[0].outer.map((p) => p.y)),
    );
    assert(doors().every((d) => d.anchor && d.roomId));
    assert.deepEqual(
      doors().map((d) => d.id),
      originalDoors.map((d) => d.id),
    );
    {
      const door = doors().find((d) => d.roomId === original.id);
      assert(
        Math.abs(door.points.reduce((n, p) => n + p.y, 0) / door.points.length - exportDoorY) <
          1e-6,
        'Moved wall carries its own door',
      );
    }
    await page.locator('#atlas-undo').click();
    await until(
      () => JSON.stringify(room('Torhalle').polygons) === JSON.stringify(original.polygons),
    );
    await page.locator('#atlas-redo').click();
    await until(
      () => JSON.stringify(room('Torhalle').polygons) === JSON.stringify(enlarged.polygons),
    );
    await atlasCanvasReady(page);
    const afterPng = await output('after');
    assert(!afterPng.bytes.equals(beforePng.bytes), 'Updated geometry reaches the actual PNG');
    assert.notDeepEqual(
      afterPng.pixel,
      beforePng.pixel,
      'The newly enlarged area is painted in the exported image',
    );
    {
      assert(beforePng.doorAtOld > 0);
      assert.equal(beforePng.doorAtNew, 0);
      assert(afterPng.doorAtNew > 0, 'The actual PNG paints the door on the moved wall');
      assert.equal(afterPng.doorAtOld, 0, 'The old door location contains no floating door');
    }
    const hiresPng = await output('after-hires', 3072);
    assert.equal(hiresPng.width, afterPng.width * 2);
    assert(Math.abs(hiresPng.height - afterPng.height * 2) <= 1);
    for (const dimension of ['width', 'height'])
      assert(
        Math.abs(hiresPng.labelBounds[dimension] / afterPng.labelBounds[dimension] - 2) < 0.15,
        'Doubled image resolution doubles the visible room name dimensions',
      );
    await native.capture(page, 'map');
    {
      await page.locator('#atlas-section').selectOption('terrain');
      await page.waitForFunction(() => !document.querySelector('#atlas-section').disabled);
      await page.locator('#atlas-output-open').click();
      assert.match(await page.locator('#atlas-output-area').textContent(), /^Aktuelle Ansicht/);
      assert(await page.locator('#atlas-output-dungeon').isHidden());
      await page.locator('#atlas-output-back').click();
    }
    const saved = { rooms: rooms(), doors: doors() };
    // Hold real export replies while switching through the actual campaign chooser.
    await app.evaluate(({ ipcMain }) => {
      const read = ipcMain._invokeHandlers.get('atlas:geometry-region'),
        save = ipcMain._invokeHandlers.get('atlas:export-png');
      globalThis.qaExportReplies = [];
      globalThis.qaExportSaves = [];
      let reads = 0;
      ipcMain.removeHandler('atlas:geometry-region');
      ipcMain.handle('atlas:geometry-region', async (e, ...args) => {
        const result = await read(e, ...args);
        if (args[2] === 'export' && ++reads <= 2)
          return new Promise((resolve) => globalThis.qaExportReplies.push(() => resolve(result)));
        return result;
      });
      ipcMain.removeHandler('atlas:export-png');
      ipcMain.handle('atlas:export-png', async (e, ...args) => {
        globalThis.qaExportSaves.push(args[0]);
        return save(e, ...args);
      });
    });
    const waitReplies = async (n) => {
      for (let i = 0; i < 300; i++) {
        if ((await app.evaluate(() => globalThis.qaExportReplies.length)) === n) return;
        await new Promise((r) => setTimeout(r, 25));
      }
      assert.equal(await app.evaluate(() => globalThis.qaExportReplies.length), n);
    };
    const switchCampaign = async (id) => {
      await page.locator('#atlas-navigation').click();
      await page.locator('#atlas-exit').click();
      await page
        .locator('.campaign-card[data-campaign-id="' + id + '"]')
        .getByRole('button', { name: /Öffnen|Fortsetzen/ })
        .click();
      await page.waitForFunction(() => !document.querySelector('main').inert);
      if (await page.locator('#campaign-atlas').isHidden()) {
        if (!(await page.locator('#atlas-tab').isVisible()))
          await page.locator('#workspace-nav-summary').click();
        await page.locator('#atlas-tab').click();
      }
      await atlasCanvasReady(page);
    };
    await page.locator('#atlas-output-open').click();
    await page.locator('#atlas-export-png').click();
    await waitReplies(1);
    await switchCampaign(other.id);
    if (!(await page.locator('#atlas-export-png').isVisible()))
      await page.locator('#atlas-output-open').click();
    assert(await page.locator('#atlas-export-png').isEnabled());
    const otherFile = profile + '/other.png';
    await app.evaluate(({ dialog }, file) => {
      dialog.showSaveDialog = async () => ({ canceled: false, filePath: file });
    }, otherFile);
    await page.locator('#atlas-export-png').click();
    await waitReplies(2);
    await app.evaluate(() => globalThis.qaExportReplies.shift()());
    await page.evaluate(
      () => new Promise((r) => requestAnimationFrame(() => requestAnimationFrame(r))),
    );
    assert(await page.locator('#atlas-export-png').isDisabled());
    assert(await page.locator('#atlas-export-cancel').isVisible());
    assert.deepEqual(await app.evaluate(() => globalThis.qaExportSaves), []);
    await native.capture(page, 'current-export-pending');
    await app.evaluate(() => globalThis.qaExportReplies.shift()());
    await page.waitForFunction(
      () => document.querySelector('#atlas-save-status').textContent === 'Atlas-PNG gespeichert',
    );
    assert.equal(await app.evaluate(() => globalThis.qaExportSaves.length), 1);
    assert((await readFile(otherFile)).length > 1000);
    assert.deepEqual(await readFile(profile + '/after.png'), afterPng.bytes);
    assert.deepEqual({ rooms: rooms(), doors: doors() }, saved);
    await page.locator('#atlas-output-back').click();
    await switchCampaign(campaign.id);
    await choose('Torhalle');
    assert.deepEqual({ rooms: rooms(), doors: doors() }, saved);
    db.close();
    db = null;
    await native.close();
    await launch();
    await choose('Torhalle');
    db = new Database(profile + '/workbench.sqlite', { readonly: true });
    assert.deepEqual({ rooms: rooms(), doors: doors() }, saved);
    db.close();
    db = null;
    await native.close();
    launches.push(...native.launches);
    results.push({
      scale,
      profile,
      rooms: 3,
      doors: 2,
      movedWall: true,
      offsetGrip: true,
      consecutiveRooms: true,
      paintedRoomNames: ['Torhalle', 'Wachstube', 'Archiv'],
      dragAndTwoClick: true,
      nameAndGrid: true,
      resizeUndoRedo: true,
      exportUpdated: true,
      labelResolutionScaling: true,
      reopened: true,
      dungeonFrame: true,
      contextSwitchDuringExport: true,
      retiredExportSaves: 0,
      currentExportSaves: 1,
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
  console.log(JSON.stringify({ launches, results }));
} catch (e) {
  await native?.fail(e);
  throw e;
} finally {
  db?.close();
  await native?.dispose();
}
