import { revealWorkspaceNavigation } from './native-navigation.mjs';
import { runNativeProbe } from './native-session.mjs';
import { openDesktopKeyReferences, linkDesktopKeyReference } from './qa-key-entry.mjs';
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
  out = process.env.QA_EVIDENCE_DIR ?? path.join(root, '.build/key-note-capture', phase);
await runNativeProbe(
  { output: out, name: 'key-note-capture', resultName: 'result.json' },
  async (native) => {
    await mkdir(out, { recursive: true });
    const require = createRequire(import.meta.url),
      { _electron } = require('playwright-core');
    require('esbuild').buildSync({
      entryPoints: ['src/app/storage/store.ts'],
      outfile: '.build/key-capture-store.cjs',
      bundle: true,
      platform: 'node',
      format: 'cjs',
      external: ['better-sqlite3'],
    });
    const { CampaignStore } = require(root + '/.build/key-capture-store.cjs');
    const profile = native.profile,
      file = profile + '/workbench.sqlite',
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
      campaign = store.create('Neue Spur beim Raumvorbereiten', rooms),
      w = store.activate(campaign.id),
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
          id: randomUUID(),
          revision: 1,
          kind: 'npc',
          title: 'Nera die Quartiermeisterin',
          readAloud: '',
          gmNotes: 'Kennt den Schlüssel.',
          relations: [],
          creatureId: null,
          deleted: false,
        },
      },
    });
    store.close();
    const title = 'Die flüsternden Listen',
      excerpt =
        'Die flüsternden Listen nennen nachts den nächsten Schuldner. Nera hat ihren eigenen Namen gehört.',
      noteText = excerpt + '\nVor dem nächsten Spielabend klären: Wer hat die Liste geschrieben?',
      keyText =
        Array.from(
          { length: 12 },
          (_, i) =>
            `Abschnitt ${i + 1}: Schubladen, Siegel und zerbrechliche Akten bleiben als Raumkontext erhalten.`,
        ).join('\n\n') +
        '\n\n' +
        excerpt +
        '\n\nAusgang: Hinter den Akten liegt der alte Lastenaufzug.';
    const finalKeyText = before
      ? keyText
      : keyText + '\n\nWeiter vorbereitet: Den Lastenaufzug für den Rückweg freihalten.';

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
      await page.locator('#atlas-tab').click();
      await openDesktopKeyFromAtlas(page, 'Archiv');
      await page.locator('#key-room-list button').filter({ hasText: 'Archiv' }).click();
      await page.locator('#key-search').fill('Archiv');
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
      await page.locator('#key-gm-notes').fill(keyText);
      await openDesktopKeyReferences(page);
      results.referenceChoices = await page.locator('#key-references button').allTextContents();
      if (before) {
        await page.locator('#key-reference-section').scrollIntoViewIfNeeded();
        await page.screenshot({ path: path.join(out, 'capture-route.png') });
        await page.locator('#key-close').click();
        await page.locator('#preparation-tab').click();
        await page.locator('#preparation-knowledge').click();
        await page.locator('#world-new').click();
        await page.locator('#world-kind').selectOption('rumor');
        await page.locator('#world-name').fill(title);
        await page.locator('#world-create').click();
        await page.waitForFunction(
          (text) => document.querySelector('#note-title').value === text,
          title,
        );
        await page.locator('#note-gm').fill(noteText);
        await page.locator('#preparation-apply').click();
        await page.waitForFunction(
          () => document.querySelector('#status').textContent === 'Gespeichert.',
        );
        await page.locator('#atlas-tab').click();
        await openDesktopKeyFromAtlas(page, 'Archiv');
        assert.equal(await page.locator('#key-gm-notes').inputValue(), keyText);
        assert.equal(await page.locator('#key-search').inputValue(), 'Archiv');
        await linkDesktopKeyReference(page, 'Gerücht: ' + title);
        await page.waitForFunction(
          () => document.querySelector('#key-save-status').dataset.state === 'saved',
        );
        results.manualCreateThenReturnAndLink = true;
      } else {
        await page.locator('#key-gm-notes').evaluate((area, text) => {
          const start = area.value.indexOf(text);
          area.setSelectionRange(start, start + text.length);
        }, excerpt);
        await page.locator('#key-note-create').click();
        await page.locator('#key-note-capture-dialog').waitFor({ state: 'visible' });
        assert.equal(await page.locator('#key-note-gm').inputValue(), excerpt);
        results.selectionPrefillsNewNote = true;
        await page.locator('#key-note-title').fill(title);
        await page.locator('#key-note-kind').selectOption('rumor');
        await page.locator('#key-note-gm').fill(noteText);
        await page.screenshot({ path: path.join(out, 'capture-route.png') });
        await app.evaluate(({ BrowserWindow }) =>
          BrowserWindow.getAllWindows()[0].webContents.setZoomFactor(1),
        );
        await page
          .locator('#key-note-submit')
          .evaluate((e) => e.scrollIntoView({ block: 'center' }));
        assert(
          await page.locator('#key-note-submit').evaluate((e) => {
            const r = e.getBoundingClientRect();
            return e.contains(document.elementFromPoint(r.x + r.width / 2, r.y + r.height / 2));
          }),
        );
        await writeFile(
          path.join(out, 'capture-100percent.png'),
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
        await page.waitForFunction(
          (text) => document.querySelector('#note-title').value === text,
          title,
        );
        await page.locator('#note-editor').waitFor({ state: 'visible' });
        assert.equal(await page.locator('#key-name').inputValue(), 'Archiv');
        assert.equal(await page.locator('#key-gm-notes').inputValue(), keyText);
        assert.equal(await page.locator('#key-search').inputValue(), 'Archiv');
        assert.equal(await page.locator('#note-gm').inputValue(), noteText);
        results.noteCreatedLinkedAndOpenedWithoutLeavingKey = true;
        results.zoom100CaptureButtonReachable = true;
        await app.evaluate(({ BrowserWindow }) =>
          BrowserWindow.getAllWindows()[0].webContents.setZoomFactor(1),
        );
      }
      await page
        .locator('#key-references')
        .getByRole('button', { name: title, exact: true })
        .click();
      await page.locator('#note-editor').waitFor({ state: 'visible' });
      assert.equal(await page.locator('#note-gm').inputValue(), noteText);
      await page
        .locator('#key-reference-panel')
        .evaluate((e) => e.scrollIntoView({ block: 'start' }));
      await page.screenshot({ path: path.join(out, 'linked.png') });
      await page.locator('#key-reference-return').click();
      await page.locator('#key-reference-panel').waitFor({ state: 'hidden' });
      if (!before) {
        assert.equal(
          await page.locator('#key-gm-notes').evaluate((e) => document.activeElement === e),
          true,
        );
        await page.locator('#key-gm-notes').fill(finalKeyText);
        await page.waitForFunction(
          () => document.querySelector('#key-save-status').dataset.state === 'saved',
        );
        results.continueEditingRoomAfterCapture = true;
      }
      await close();
      const check = new CampaignStore(file);
      try {
        const active = check.activate(campaign.id),
          notes = check.preparation(active.token).notes.filter((r) => r.note.title === title);
        assert.equal(notes.length, 1);
        assert.equal(notes[0].note.kind, 'rumor');
        assert.equal(notes[0].note.gmNotes, noteText);
        const key = check.drawing(active.token).keyContent.find((k) => k.id === rooms[1].id);
        assert(key.blocks.some((b) => b.text === finalKeyText));
        assert.equal(key.references.filter((r) => r.id === notes[0].note.id).length, 1);
        assert.deepEqual(
          check.workspace().rooms.map((r) => r.sections),
          rooms.map((r) => r.sections),
        );
        results.oneNoteLinkedAndOriginalRoomTextPreserved = true;
      } finally {
        check.close();
      }
      if (!before) {
        page = await launch();
        assert.equal(await page.locator('#key-gm-notes').inputValue(), finalKeyText);
        await openDesktopKeyReferences(page);
        assert.equal(
          await page
            .locator('#key-references')
            .getByRole('button', { name: title, exact: true })
            .count(),
          1,
        );
        await page
          .locator('#key-references')
          .getByRole('button', { name: title, exact: true })
          .click();
        await page.waitForFunction(
          (text) => document.querySelector('#note-gm').value === text,
          noteText,
        );
        await page.locator('#key-reference-return').click();
        await page.locator('#key-reference-panel').waitFor({ state: 'hidden' });
        await page.locator('#key-gm-notes').evaluate((e) => e.setSelectionRange(0, 0));
        await page.locator('#key-note-create').click();
        await page.locator('#key-note-capture-dialog').waitFor({ state: 'visible' });
        assert.equal(await page.locator('#key-note-gm').inputValue(), '');
        await page.locator('#key-note-title').fill('Nicht anlegen');
        await page.locator('#key-note-cancel').click();
        await page.locator('#key-note-capture-dialog').waitFor({ state: 'hidden' });
        await close();
        results.freshProcessRetainsCaptureAndCancelIsHarmless = true;
        const final = new CampaignStore(file);
        try {
          const active = final.activate(campaign.id);
          assert.equal(final.preparation(active.token).notes.length, 2);
        } finally {
          final.close();
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
