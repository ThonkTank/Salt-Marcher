import { revealWorkspaceNavigation } from './native-navigation.mjs';
import { runNativeProbe } from './native-session.mjs';
import { openDesktopKeyFromAtlas } from './qa-key-entry.mjs';
import { createRequire } from 'node:module';
import { mkdtemp, mkdir, readFile, writeFile, stat } from 'node:fs/promises';
import { spawn } from 'node:child_process';
import { randomUUID, createHash } from 'node:crypto';
import assert from 'node:assert/strict';
import path from 'node:path';
const root = process.cwd(),
  before = process.argv.includes('--before'),
  phase = before ? 'before' : 'after',
  out = process.env.QA_EVIDENCE_DIR ?? path.join(root, '.build/note-room-uses', phase);
await runNativeProbe(
  { output: out, name: 'note-room-uses', resultName: 'result.json' },
  async (native) => {
    await mkdir(out, { recursive: true });
    const require = createRequire(import.meta.url),
      { _electron } = require('playwright-core');
    require('esbuild').buildSync({
      entryPoints: ['src/app/storage/store.ts'],
      outfile: '.build/note-room-store.cjs',
      bundle: true,
      platform: 'node',
      format: 'cjs',
      external: ['better-sqlite3'],
    });
    const { CampaignStore } = require(root + '/.build/note-room-store.cjs');
    const profile = native.profile,
      file = profile + '/workbench.sqlite',
      rooms = ['Torhalle', 'Wachstube', 'Archiv'].map((name, i) => ({
        id: randomUUID(),
        scopeId: 'local',
        floorId: 'ground',
        number: String(i + 1),
        name,
        revision: 0,
        polygons: [
          {
            outer: [
              { x: i * 8, y: 0 },
              { x: i * 8 + 6, y: 0 },
              { x: i * 8 + 6, y: 6 },
              { x: i * 8, y: 6 },
            ],
            holes: [],
          },
        ],
        sections: [{ id: randomUUID(), kind: 'markdown', markdown: '  Original ' + name + '\r\n' }],
      })),
      store = new CampaignStore(file),
      campaign = store.create('Wo wird Nera gebraucht?', rooms),
      w = store.activate(campaign.id),
      noteId = randomUUID();
    const command = (action) => ({
        commandId: randomUUID(),
        token: w.token,
        campaignId: campaign.id,
        action,
      }),
      note = {
        version: 1,
        id: noteId,
        revision: 1,
        kind: 'npc',
        title: 'Nera die Quartiermeisterin',
        readAloud: 'Eine erschöpfte Wächterin.',
        gmNotes: 'Nera kennt den Schmuggelgang und fordert ihren Sold.',
        relations: [],
        creatureId: null,
        deleted: false,
      };
    store.changePreparation({
      ...command(null),
      change: { kind: 'note', expectedRevision: null, note },
    });
    for (const room of rooms.slice(1))
      store.executeDrawing(
        command({
          kind: 'key-batch',
          rooms: [{ id: room.id, expectedRevision: 0, keyRevision: null }],
          patch: {
            references: [{ kind: 'npc', id: noteId, label: note.title }],
            gmNotes: {
              mode: 'replace',
              text:
                room.name === 'Wachstube'
                  ? 'Nera erwartet die Gruppe.'
                  : 'Hier lagert Nera alte Listen.',
            },
          },
        }),
      );
    store.close();

    let app,
      closed = true;
    const results = {},
      launches = [],
      errors = [],
      artifactHashes = {};
    for (const rel of ['main.cjs', 'preload.cjs', 'ui/renderer.js', 'ui/index.html', 'ui/app.css'])
      artifactHashes[rel] = createHash('sha256')
        .update(await readFile(path.join('.build/desktop', rel)))
        .digest('hex');
    async function launch() {
      app = await native.launchConfigured({
        executablePath: root + '/node_modules/electron/dist/electron',
        args: [root + '/.build/desktop/main.cjs', '--ozone-platform=x11', '--data-dir', profile],
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
        .locator('.campaign-card[data-campaign-id="' + campaign.id + '"]')
        .getByRole('button', { name: 'Fortsetzen', exact: true })
        .click();
      await revealWorkspaceNavigation(page);
      if (!(await page.locator('#atlas-tab').isVisible()))
        await page.locator('#workspace-nav-summary').click();
      await page.locator('#preparation-tab').click();
      await page.locator('#preparation-knowledge').click();
      await page.locator('#world-search').fill('Nera');
      await page.locator('#world-list button').filter({ hasText: note.title }).click();
      return page;
    }
    async function close() {
      const exited = new Promise((r) =>
        app.process().once('exit', (code, signal) => r({ code, signal })),
      );
      await native.close();
      const exit = await exited;
      assert.deepEqual(exit, { code: 0, signal: null });
      launches.at(-1).exit = exit;
      closed = true;
    }
    try {
      let page = await launch();
      results.currentIncoming = await page.locator('#note-incoming').innerText();
      results.incomingButtons = await page.locator('#note-incoming button').allTextContents();
      if (before) {
        await page.locator('#note-incoming').scrollIntoViewIfNeeded();
        await page.screenshot({ path: path.join(out, 'incoming.png') });
        await page.locator('#atlas-tab').click();
        await openDesktopKeyFromAtlas(page, 'Torhalle');
        await page.locator('#key-search').fill('Nera');
        results.manualRoomSearch = await page.locator('#key-room-list button').allTextContents();
        assert.equal(results.manualRoomSearch.length, 2);
        await page.locator('#key-room-list button').filter({ hasText: 'Archiv' }).click();
      } else {
        await page.waitForFunction(
          () => document.querySelectorAll('#note-room-uses-list button').length === 2,
        );
        results.roomUses = await page.locator('#note-room-uses-list button').allTextContents();
        await page.locator('#note-room-uses').evaluate((e) => e.scrollIntoView({ block: 'start' }));
        await page.screenshot({ path: path.join(out, 'incoming.png') });
        await page.locator('#note-room-uses-list button').filter({ hasText: 'Archiv' }).click();
        await page.locator('#key-dialog').waitFor({ state: 'visible' });
        assert.equal(await page.locator('#key-name').inputValue(), 'Archiv');
        results.directRoomOpen = true;
      }
      const updated = 'Nera zeigt der Gruppe den Schmuggelgang hinter den Listen.';
      await page.locator('#key-gm-notes').fill(updated);
      await page.waitForFunction(
        () => document.querySelector('#key-save-status').dataset.state === 'saved',
      );
      await page.locator('#key-close').click();
      if (before) await page.locator('#preparation-tab').click();
      await page.locator('#note-editor').waitFor({ state: 'visible' });
      assert.equal(await page.locator('#note-title').inputValue(), note.title);
      assert.equal(await page.locator('#note-gm').inputValue(), note.gmNotes);
      results.returnedToUnchangedNote = true;
      if (!before) {
        await page.waitForFunction(
          (text) => document.querySelector('#note-room-uses-list').textContent.includes(text),
          updated,
        );
        results.returnedExcerptUpdated = true;
        await page.screenshot({ path: path.join(out, 'returned.png') });
      }
      await close();
      const check = new CampaignStore(file);
      try {
        const active = check.activate(campaign.id);
        assert.deepEqual(
          check.preparation(active.token).notes.find((r) => r.note.id === noteId).note,
          note,
        );
        assert.deepEqual(
          check.workspace().rooms.map((r) => r.sections),
          rooms.map((r) => r.sections),
        );
        const key = check.drawing(active.token).keyContent.find((k) => k.id === rooms[2].id);
        assert(key.blocks.some((b) => b.text === updated));
        results.onlyIntendedRoomKeyChanged = true;
      } finally {
        check.close();
      }
      if (!before) {
        page = await launch();
        await page.waitForFunction(
          () => document.querySelectorAll('#note-room-uses-list button').length === 2,
        );
        await app.evaluate(({ BrowserWindow }) =>
          BrowserWindow.getAllWindows()[0].webContents.setZoomFactor(2),
        );
        await page
          .locator('#note-room-uses-list button')
          .filter({ hasText: 'Archiv' })
          .evaluate((e) => e.scrollIntoView({ block: 'center' }));
        const hit = await page
          .locator('#note-room-uses-list button')
          .filter({ hasText: 'Archiv' })
          .evaluate((e) => {
            const r = e.getBoundingClientRect();
            return e.contains(document.elementFromPoint(r.x + r.width / 2, r.y + r.height / 2));
          });
        assert(hit);
        results.zoom200LinkUnobscured = true;
        await writeFile(
          path.join(out, 'zoom200.png'),
          Buffer.from(
            await app.evaluate(async ({ BrowserWindow }) =>
              (await BrowserWindow.getAllWindows()[0].webContents.capturePage())
                .toPNG()
                .toString('base64'),
            ),
            'base64',
          ),
        );
        await page.locator('#note-gm').fill(note.gmNotes + ' Elle kennt auch den Hinterausgang.');
        await page.locator('#note-room-uses-list button').filter({ hasText: 'Archiv' }).click();
        assert.equal(await page.locator('#key-gm-notes').inputValue(), updated);
        await page.locator('#key-close').click();
        await page.locator('#note-editor').waitFor({ state: 'visible' });
        assert.equal(
          await page.locator('#note-gm').inputValue(),
          note.gmNotes + ' Elle kennt auch den Hinterausgang.',
        );
        await close();
        results.freshProcessFindsBothRoomsAndSavedKey = true;
        const persisted = new CampaignStore(file);
        try {
          const active = persisted.activate(campaign.id);
          assert.equal(
            persisted.preparation(active.token).notes.find((r) => r.note.id === noteId).note
              .gmNotes,
            note.gmNotes + ' Elle kennt auch den Hinterausgang.',
          );
          results.dirtyNoteSavedBeforeRoomOpen = true;
        } finally {
          persisted.close();
        }
      }
      assert.deepEqual(errors, []);
      await native.recordResult({
        phase,
        profile,
        results,
        launches,
        artifactHashes,
        errors,
        normalClose: true,
      });
      console.log(JSON.stringify({ phase, results, normalClose: true }));
    } catch (error) {
      await writeFile(
        path.join(out, 'failure.json'),
        JSON.stringify({ error: error.stack, results, launches, errors }, null, 2),
      );
      if (app && !closed)
        try {
          await (await app.firstWindow()).screenshot({ path: path.join(out, 'failure.png') });
        } catch {}
      throw error;
    } finally {
    }
  },
);
