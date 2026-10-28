import { revealWorkspaceNavigation } from './native-navigation.mjs';
import { runNativeProbe } from './native-session.mjs';
import { openDesktopKeyReferences } from './qa-key-entry.mjs';
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
  out = process.env.QA_EVIDENCE_DIR ?? path.join(root, '.build/note-reuse', phase);
await runNativeProbe(
  { output: out, name: 'note-reuse', resultName: 'result.json' },
  async (native) => {
    await mkdir(out, { recursive: true });
    const require = createRequire(import.meta.url),
      { _electron } = require('playwright-core');
    require('esbuild').buildSync({
      entryPoints: ['src/app/storage/store.ts'],
      outfile: '.build/note-reuse-store.cjs',
      bundle: true,
      platform: 'node',
      format: 'cjs',
      external: ['better-sqlite3'],
    });
    const { CampaignStore } = require(root + '/.build/note-reuse-store.cjs');
    const profile = native.profile,
      file = profile + '/workbench.sqlite',
      title = 'Nera die Quartiermeisterin',
      body = '  Nera verwahrt den Messingschlüssel.\r\nSie verlangt ihren ausstehenden Sold.  ',
      addition = 'Nera verrät im Archiv den Zugang zum Lastenaufzug.',
      rooms = ['Torhalle', 'Archiv'].map((name, i) => ({
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
      }));
    const store = new CampaignStore(file),
      campaign = store.create('Dieselbe Nera im zweiten Raum', rooms),
      w = store.activate(campaign.id),
      noteId = randomUUID(),
      command = (action) => ({
        commandId: randomUUID(),
        token: w.token,
        campaignId: campaign.id,
        action,
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
          title,
          readAloud: 'Eine müde Wächterin.',
          gmNotes: body,
          relations: [],
          creatureId: null,
          deleted: false,
        },
      },
    });
    store.executeDrawing(
      command({
        kind: 'key-batch',
        rooms: [{ id: rooms[0].id, expectedRevision: 0, keyRevision: null }],
        patch: { references: [{ id: noteId, kind: 'npc', label: title }] },
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
      if (!(await page.locator('#atlas-tab').isVisible()))
        await page.locator('#workspace-nav-summary').click();
      await page.locator('#atlas-tab').click();
      await openDesktopKeyFromAtlas(page, 'Archiv');
      await page.locator('#key-room-list button').filter({ hasText: 'Archiv' }).click();
      return page;
    }
    async function close() {
      const ended = new Promise((r) =>
        app.process().once('exit', (code, signal) => r({ code, signal })),
      );
      await native.close();
      const exit = await ended;
      assert.deepEqual(exit, { code: 0, signal: null });
      launches.at(-1).exit = exit;
      closed = true;
    }
    try {
      let page = await launch();
      await page.locator('#key-gm-notes').fill(addition);
      await page.locator('#key-gm-notes').evaluate((e) => e.setSelectionRange(0, e.value.length));
      await page.locator('#key-note-create').click();
      await page.locator('#key-note-title').fill(title);
      await page.locator('#key-note-kind').selectOption('npc');
      await page.locator('#key-note-gm').fill(addition);
      if (before) {
        results.existingChoiceCount = await page.locator('#key-note-existing button').count();
        await page.screenshot({ path: path.join(out, 'capture.png') });
        await page.locator('#key-note-submit').click();
      } else {
        const choice = page.locator('#key-note-existing button').filter({ hasText: title });
        await choice.waitFor();
        await page.screenshot({ path: path.join(out, 'existing.png') });
        await choice.click();
        assert.equal(await page.locator('#key-note-kind').inputValue(), 'npc');
        assert.equal(
          await page.locator('#key-note-submit').textContent(),
          'Verknüpfen und ergänzen',
        );
        await app.evaluate(({ BrowserWindow }) =>
          BrowserWindow.getAllWindows()[0].webContents.setZoomFactor(1),
        );
        await page.locator('#key-note-submit').scrollIntoViewIfNeeded();
        assert(
          await page.locator('#key-note-submit').evaluate((e) => {
            const r = e.getBoundingClientRect();
            return e.contains(document.elementFromPoint(r.x + r.width / 2, r.y + r.height / 2));
          }),
        );
        await page.evaluate(
          () => new Promise((r) => requestAnimationFrame(() => requestAnimationFrame(r))),
        );
        await writeFile(
          path.join(out, 'reuse-100percent.png'),
          Buffer.from(
            await app.evaluate(async ({ BrowserWindow }) =>
              (await BrowserWindow.getAllWindows()[0].webContents.capturePage())
                .toPNG()
                .toString('base64'),
            ),
            'base64',
          ),
        );
        await page.locator('#key-note-submit').click();
        await page.locator('#key-note-capture-dialog').waitFor({ state: 'hidden' });
        await app.evaluate(({ BrowserWindow }) =>
          BrowserWindow.getAllWindows()[0].webContents.setZoomFactor(1),
        );
        results.existingChoiceAnd200PercentSubmit = true;
      }
      await page.locator('#key-note-capture-dialog').waitFor({ state: 'hidden' });
      await page.waitForFunction(
        (text) => document.querySelector('#note-title').value === text,
        title,
      );
      await page.locator('#note-room-uses').scrollIntoViewIfNeeded();
      results.visibleRoomUses = await page.locator('#note-room-uses-list button').allTextContents();
      await page.screenshot({ path: path.join(out, 'note.png') });
      await close();
      const check = new CampaignStore(file);
      try {
        const active = check.activate(campaign.id),
          notes = check.preparation(active.token).notes.filter((r) => r.note.title === title),
          keys = check.drawing(active.token).keyContent;
        results.sameTitleNotes = notes.map((r) => ({
          id: r.note.id,
          kind: r.note.kind,
          gmNotes: r.note.gmNotes,
        }));
        results.roomReferences = rooms.map((r) => ({
          room: r.name,
          notes: keys.find((k) => k.id === r.id)?.references.map((ref) => ref.id) ?? [],
        }));
        for (const r of rooms)
          assert.deepEqual(
            check.workspace().rooms.find((actual) => actual.id === r.id).sections,
            r.sections,
          );
        if (before) {
          assert.equal(notes.length, 2);
          assert.equal(notes.find((r) => r.note.id === noteId).note.gmNotes, body);
          assert.notEqual(results.roomReferences[0].notes[0], results.roomReferences[1].notes[0]);
          results.unintendedDuplicateIdentityObserved = true;
        } else {
          assert.equal(notes.length, 1);
          assert.equal(notes[0].note.id, noteId);
          assert.equal(notes[0].note.gmNotes, body + '\n\n' + addition);
          assert.equal(notes[0].note.readAloud, 'Eine müde Wächterin.');
          assert.equal(results.roomReferences[0].notes[0], noteId);
          assert.equal(results.roomReferences[1].notes[0], noteId);
          results.oneIdentityForBothRooms = true;
        }
      } finally {
        check.close();
      }
      if (!before) {
        page = await launch();
        await openDesktopKeyReferences(page);
        await page
          .locator('#key-references')
          .getByRole('button', { name: title, exact: true })
          .click();
        await page.waitForFunction(
          (text) => document.querySelector('#note-gm').value === text,
          body.replace(/\r\n/g, '\n') + '\n\n' + addition,
        );
        await page.waitForFunction(
          () => document.querySelectorAll('#note-room-uses-list button').length === 2,
        );
        await page.locator('#note-room-uses').scrollIntoViewIfNeeded();
        await page.screenshot({ path: path.join(out, 'fresh-two-rooms.png') });
        await page.locator('#key-reference-return').click();
        await page.locator('#key-gm-notes').evaluate((e) => e.setSelectionRange(0, 0));
        await page.locator('#key-note-create').click();
        await page.locator('#key-note-title').fill(title);
        await page.locator('#key-note-existing button').filter({ hasText: title }).click();
        assert.equal(await page.locator('#key-note-submit').textContent(), 'Verknüpfen und öffnen');
        await page.locator('#key-note-submit').click();
        await page.locator('#key-note-capture-dialog').waitFor({ state: 'hidden' });
        await close();
        results.freshAndLinkOnlyReuse = true;
        const last = new CampaignStore(file);
        try {
          const a = last.activate(campaign.id);
          assert.equal(last.preparation(a.token).notes.length, 1);
          assert.equal(last.preparation(a.token).notes[0].note.gmNotes, body + '\n\n' + addition);
          assert.equal(
            last.drawing(a.token).keyContent.find((k) => k.id === rooms[1].id).references.length,
            1,
          );
        } finally {
          last.close();
        }
      }
      for (const launch of launches) {
        let alive = false;
        try {
          process.kill(launch.pid, 0);
          alive = true;
        } catch {}
        assert.equal(alive, false);
        launch.mainPidAbsent = true;
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
