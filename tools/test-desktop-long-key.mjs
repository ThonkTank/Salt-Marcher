import { revealWorkspaceNavigation } from './native-navigation.mjs';
import { runNativeProbe } from './native-session.mjs';
import { createRequire } from 'node:module';
import { mkdtemp, mkdir, readFile, writeFile, stat } from 'node:fs/promises';
import { spawn } from 'node:child_process';
import { randomUUID, createHash } from 'node:crypto';
import assert from 'node:assert/strict';
import path from 'node:path';
const root = process.cwd(),
  before = process.argv.includes('--before'),
  phase = before ? 'before' : 'after',
  out = process.env.QA_EVIDENCE_DIR ?? path.join(root, '.build/long-key', phase);
await runNativeProbe(
  { output: out, name: 'long-key', resultName: 'result.json' },
  async (native) => {
    await mkdir(out, { recursive: true });
    const require = createRequire(import.meta.url),
      { _electron } = require('playwright-core');
    require('esbuild').buildSync({
      entryPoints: ['src/app/storage/store.ts'],
      outfile: '.build/long-key-store.cjs',
      bundle: true,
      platform: 'node',
      format: 'cjs',
      external: ['better-sqlite3'],
    });
    const { CampaignStore } = require(root + '/.build/long-key-store.cjs');
    const clue = 'Der Bernsteinhebel löst erst nach drei Glockenschlägen die Falltür aus.',
      changedClue =
        'Der Bernsteinhebel ist gesichert; die Falltür bleibt auch nach drei Glockenschlägen geschlossen.';
    const longText = [
        '# Uhrwerkkammer',
        '## Ankunft',
        'Öliger Staub und ein leises Ticken füllen den Raum.',
        ...Array.from(
          { length: 8 },
          (_, i) =>
            `## Schrank ${i + 1}\n\n${i === 2 ? 'Eine Skizze zeigt den Bernsteinhebel, aber nicht seine Bedienung. ' : ' '}Zahnräder, Werkzeuge und nummerierte Messingschalen.\n\nEin unauffälliger Absatz hält die übrige Ausstattung fest.`,
        ),
        '## Auslösefolge',
        clue,
        'Ein Druck auf den roten Knopf hält die Feder fest.',
        '## Wartung',
        'Der Bernsteinhebel muss jeden Neumond geölt werden.',
        '## Rückweg',
        'Die Wartungstür führt zur Torhalle.',
      ].join('\n\n'),
      updated = longText.replace(clue, changedClue);
    const profile = native.profile,
      file = profile + '/workbench.sqlite',
      rooms = ['Uhrwerkkammer', 'Bernsteinlager'].map((name, i) => ({
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
        sections: [
          {
            id: randomUUID(),
            kind: 'markdown',
            markdown: i === 0 ? longText : 'Hier lagert das Material für einen Bernsteinhebel.',
          },
          {
            id: randomUUID(),
            kind: 'markdown',
            markdown: '  Unberührter Nachtrag\r\nMit eigenem Wortlaut.\r\n',
          },
        ],
      }));
    const store = new CampaignStore(file),
      campaign = store.create('Langen Raum-Key am Spieltisch lesen', rooms),
      w = store.activate(campaign.id);
    store.executeDrawing({
      commandId: randomUUID(),
      token: w.token,
      campaignId: campaign.id,
      action: {
        kind: 'key-batch',
        rooms: [{ id: rooms[0].id, expectedRevision: 0, keyRevision: null }],
        patch: { gmNotes: { mode: 'replace', text: 'Beim Verlassen die Werkzeuge zählen.' } },
      },
    });
    let templateId = null,
      templateBlockId = null,
      ownBlockId = null;
    if (!before) {
      const key = store.drawing(w.token).keyContent.find((k) => k.id === rooms[0].id);
      ownBlockId = key.blocks.find((b) => b.kind === 'text' && b.visibility === 'gm').id;
      templateId = randomUUID();
      templateBlockId = randomUUID();
      const template = {
        ...structuredClone(key),
        id: templateId,
        kind: 'template',
        name: 'Wartungszettel',
        blocks: [
          {
            ...key.blocks.find((b) => b.id === ownBlockId),
            id: templateBlockId,
            text: '## Wartungsprotokoll\n\nEine Stahlfeder wird nachgezogen.',
          },
        ],
      };
      store.executeDrawing({
        commandId: randomUUID(),
        token: w.token,
        campaignId: campaign.id,
        action: { kind: 'key-content', expectedRevision: null, content: template },
      });
      store.executeDrawing({
        commandId: randomUUID(),
        token: w.token,
        campaignId: campaign.id,
        action: {
          kind: 'key-content',
          expectedRevision: key.revision,
          content: {
            ...key,
            blocks: [
              ...key.blocks,
              {
                ...key.blocks.find((b) => b.id === ownBlockId),
                id: randomUUID(),
                kind: 'template',
                text: '',
                templateId,
              },
            ],
          },
        },
      });
    }
    const originalKeys = store.drawing(w.token).keyContent;
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
      await page.locator('#atlas-analysis-open').click();
      await page.locator('#dungeon-binder-open').click();
      await page.locator('#dungeon-binder-search').fill('Bernsteinhebel');
      await page.waitForFunction(
        () => document.querySelectorAll('#dungeon-binder-list button').length === 2,
      );
      await page
        .locator('#dungeon-binder-list button')
        .filter({ hasText: 'Uhrwerkkammer' })
        .click();
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
      results.roomResults = await page.locator('#dungeon-binder-list button').allTextContents();
      results.markedMatches = await page.locator('#dungeon-binder-document mark').count();
      results.documentHeadings = await page
        .locator('#dungeon-binder-document h4,#dungeon-binder-document h5')
        .allTextContents();
      await page.screenshot({ path: path.join(out, 'reader.png') });
      if (before) {
        assert((await page.locator('#dungeon-binder-document').innerText()).includes(clue));
        await page
          .locator('#dungeon-binder-document')
          .getByRole('button', { name: 'Key bearbeiten', exact: true })
          .click();
        await page.locator('#key-dialog').waitFor({ state: 'visible' });
        results.binderClosedForEditing = !(await page.locator('#dungeon-binder').isVisible());
        await page
          .locator('#key-dialog summary')
          .filter({ hasText: 'Vorhandener Raumkey' })
          .click();
        results.importedTextInputs = await page.locator('#key-original textarea').count();
        await page.screenshot({ path: path.join(out, 'editor.png') });
        await page.locator('#key-close').click();
        await page.locator('#key-0').fill(updated);
        await page.locator('#apply').click();
        await page.waitForFunction(
          () => document.querySelector('#status').textContent === 'Gespeichert.',
        );
        await page.locator('#atlas-analysis-open').click();
        await page.locator('#dungeon-binder-open').click();
        results.returnedSearch = await page.locator('#dungeon-binder-search').inputValue();
        assert((await page.locator('#dungeon-binder-document').innerText()).includes(changedClue));
      } else {
        await page.waitForFunction(
          () => document.querySelectorAll('#dungeon-binder-document mark').length === 3,
        );
        results.threePassagesHighlighted = true;
        await page.locator('#key-document-search').press('Enter');
        await page.locator('#key-document-search').press('Shift+Enter');
        await page.locator('#key-document-search').press('Enter');
        assert.equal(
          await page.locator('#key-document-search').evaluate((e) => document.activeElement === e),
          true,
        );
        results.keyboardFindKeepsQueryFocus = true;
        assert(
          (
            await page
              .locator('#dungeon-binder-document mark.active')
              .evaluate((e) => e.parentElement.textContent)
          ).includes(clue),
        );
        await page.locator('#key-document-edit').click();
        await page.locator('#key-dialog').waitFor({ state: 'visible' });
        assert(await page.locator('#dungeon-binder').isVisible());
        const area = page.locator('#key-original textarea').first();
        assert.equal(
          await area.evaluate((e) => e.value.slice(e.selectionStart, e.selectionEnd)),
          clue,
        );
        assert.equal(await area.evaluate((e) => document.activeElement === e), true);
        assert(await area.evaluate((e) => e.scrollTop > e.clientHeight));
        results.exactImportedParagraphSelected = true;
        results.editorScrolledToSelectedPassage = true;
        await page.screenshot({ path: path.join(out, 'editor.png') });
        await area.dispatchEvent('compositionstart');
        await page.keyboard.insertText(changedClue);
        await page.locator('#key-close').click();
        assert(await page.locator('#key-dialog').isVisible());
        results.compositionKeepsImportedEditorOpen = true;
        await area.dispatchEvent('compositionend');
        await page.waitForFunction(
          () => document.querySelector('#key-save-status').dataset.state === 'saved',
        );
        await page.locator('#key-close').click();
        await page.locator('#key-dialog').waitFor({ state: 'hidden' });
        await page.waitForFunction(
          (text) => document.querySelector('#dungeon-binder-document').textContent.includes(text),
          changedClue,
        );
        assert.equal(await page.locator('#dungeon-binder-search').inputValue(), 'Bernsteinhebel');
        assert(
          (
            await page
              .locator('#dungeon-binder-document mark.active')
              .evaluate((e) => e.parentElement.textContent)
          ).includes(changedClue),
        );
        results.returnedToUpdatedPassageWithSearch = true;
        await page.screenshot({ path: path.join(out, 'returned.png') });
        await app.evaluate(({ BrowserWindow }) =>
          BrowserWindow.getAllWindows()[0].webContents.setZoomFactor(1),
        );
        await page.locator('#key-document-next').click();
        await page.locator('#key-document-prev').click();
        const mark = page.locator('#dungeon-binder-document mark.active');
        assert(
          await mark.evaluate((e) => {
            const r = e.getBoundingClientRect();
            return e.contains(document.elementFromPoint(r.x + r.width / 2, r.y + r.height / 2));
          }),
        );
        results.zoom100PassageUnobscured = true;
        await writeFile(
          path.join(out, 'reader-100percent.png'),
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
      await close();
      const check = new CampaignStore(file);
      try {
        const active = check.activate(campaign.id),
          saved = check.workspace().rooms.find((r) => r.id === rooms[0].id);
        assert.equal(saved.sections[0].markdown, updated);
        assert.deepEqual(saved.sections.slice(1), rooms[0].sections.slice(1));
        assert.deepEqual(
          check.workspace().rooms.find((r) => r.id === rooms[1].id),
          rooms[1],
        );
        assert.deepEqual(
          check.drawing(active.token).keyContent.map((k) => ({ ...k, revision: 0 })),
          originalKeys.map((k) => ({ ...k, revision: 0 })),
        );
        results.onlyIntendedImportedParagraphChanged = true;
      } finally {
        check.close();
      }
      if (!before) {
        page = await launch();
        await page.locator('#key-document-next').click();
        assert(
          (
            await page
              .locator('#dungeon-binder-document mark.active')
              .evaluate((e) => e.parentElement.textContent)
          ).includes(changedClue),
        );
        results.freshProcessFindsSavedPassage = true;
        await page.locator('#dungeon-binder-search').fill('Stahlfeder');
        await page.waitForFunction(
          () => document.querySelectorAll('#dungeon-binder-list button').length === 1,
        );
        await page.locator('#dungeon-binder-list button').first().click();
        await page.locator('#key-document-edit').click();
        await page.locator('#key-dialog').waitFor({ state: 'visible' });
        assert.equal(await page.locator('#key-owner').inputValue(), templateId);
        const sourceArea = page.locator(
          '#key-blocks textarea[data-block-id="' + templateBlockId + '"]',
        );
        assert.equal(
          await sourceArea.evaluate((e) => e.value.slice(e.selectionStart, e.selectionEnd)),
          'Eine Stahlfeder wird nachgezogen.',
        );
        await page.keyboard.insertText('Eine Stahlfeder wurde nachgezogen.');
        await page.waitForFunction(
          () => document.querySelector('#key-save-status').dataset.state === 'saved',
        );
        await page.locator('#key-close').click();
        await page.waitForFunction(() =>
          document
            .querySelector('#dungeon-binder-document')
            .textContent.includes('Eine Stahlfeder wurde nachgezogen.'),
        );
        results.templatePassageEditsItsActualSource = true;
        await page.locator('#dungeon-binder-search').fill('Beim Verlassen');
        await page.waitForFunction(
          () => document.querySelectorAll('#dungeon-binder-list button').length === 1,
        );
        await page.locator('#dungeon-binder-list button').first().click();
        await page.locator('#key-document-edit').click();
        const ownArea = page.locator('#key-blocks textarea[data-block-id="' + ownBlockId + '"]');
        assert.equal(
          await ownArea.evaluate((e) => e.value.slice(e.selectionStart, e.selectionEnd)),
          'Beim Verlassen die Werkzeuge zählen.',
        );
        await page.keyboard.insertText('Beim Verlassen wurden die Werkzeuge gezählt.');
        await page.waitForFunction(
          () => document.querySelector('#key-save-status').dataset.state === 'saved',
        );
        await page.locator('#key-close').click();
        await page.waitForFunction(() =>
          document
            .querySelector('#dungeon-binder-document')
            .textContent.includes('Beim Verlassen wurden die Werkzeuge gezählt.'),
        );
        results.ownKeyPassageEditsItsActualBlock = true;
        await page.locator('#dungeon-binder-search').fill('Bernsteinhebel');
        await page.waitForFunction(
          () => document.querySelectorAll('#dungeon-binder-list button').length === 2,
        );
        await page
          .locator('#dungeon-binder-list button')
          .filter({ hasText: 'Uhrwerkkammer' })
          .click();
        await page.locator('#key-document-next').click();
        await page.locator('#key-document-edit').click();
        const revisedClue = changedClue.replace('Bernsteinhebel', 'Hebel');
        await page.keyboard.insertText(revisedClue);
        await page.waitForFunction(
          () => document.querySelector('#key-save-status').dataset.state === 'saved',
        );
        await page.locator('#key-close').click();
        await page.waitForFunction(
          (text) => document.activeElement?.textContent.includes(text),
          revisedClue,
        );
        assert.equal(await page.locator('#dungeon-binder-search').inputValue(), 'Bernsteinhebel');
        results.returnWithoutSearchWordKeepsReadingPosition = true;
        await close();
        const final = new CampaignStore(file);
        try {
          const active = final.activate(campaign.id),
            keys = final.drawing(active.token).keyContent;
          assert.equal(
            keys.find((k) => k.id === templateId).blocks[0].text,
            '## Wartungsprotokoll\n\nEine Stahlfeder wurde nachgezogen.',
          );
          assert.equal(
            keys.find((k) => k.id === rooms[0].id).blocks.find((b) => b.id === ownBlockId).text,
            'Beim Verlassen wurden die Werkzeuge gezählt.',
          );
          assert.equal(
            final.workspace().rooms.find((r) => r.id === rooms[0].id).sections[0].markdown,
            updated.replace(changedClue, changedClue.replace('Bernsteinhebel', 'Hebel')),
          );
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
