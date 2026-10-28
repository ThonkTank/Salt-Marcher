import { atlasCanvasReady } from './atlas-canvas-probe.mjs';
import { openDesktopKeyReferences } from './qa-key-entry.mjs';
import { createRequire } from 'node:module';
import { createNativeSession } from './native-session.mjs';
import { randomUUID } from 'node:crypto';
import assert from 'node:assert/strict';
import { readFile, writeFile } from 'node:fs/promises';
const root = process.cwd(),
  scale = 1,
  evidenceRoot = process.env.QA_EVIDENCE_DIR ?? root + '/.build/note-trash-recovery';
const runs = [];
for (const loseRestoreReply of [false, true]) {
  const out = evidenceRoot + (loseRestoreReply ? '/reply-loss' : '/normal');
  const native = await createNativeSession({ root, output: out, name: 'note-trash-recovery' });
  try {
    assert([1].includes(scale), 'Native UI probes use 100% only.');
    const require = createRequire(import.meta.url);
    require('esbuild').buildSync({
      entryPoints: ['src/app/storage/store.ts'],
      outfile: '.build/note-trash-recovery-store.cjs',
      bundle: true,
      platform: 'node',
      format: 'cjs',
      external: ['better-sqlite3'],
    });
    const { CampaignStore } = require(root + '/.build/note-trash-recovery-store.cjs');
    const profile = native.profile,
      file = profile + '/workbench.sqlite',
      rooms = ['Torhalle', 'Wachstube'].map((name, i) => ({
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
        sections: [{ id: randomUUID(), kind: 'markdown', markdown: '  Original ' + name + '\r\n' }],
      }));
    const make = (title, kind, gmNotes) => ({
      version: 1,
      id: randomUUID(),
      revision: 1,
      title,
      kind,
      gmNotes,
      readAloud: '  Unverändertes Vorlesen\r\n',
      relations: [],
      creatureId: null,
      deleted: false,
    });
    const npc = make(
        'Nera die Quartiermeisterin',
        'npc',
        'Neras Originalwissen: Die Nachtwache zahlt mit kupfernen Marken.',
      ),
      decoy = make(
        npc.title,
        'npc',
        'Unabhängige Figur aus der Südstadt. Hat keine Verbindung zur Nachtwache.',
      ),
      clue = make('Das blaue Siegel', 'rumor', 'Offen: Wer führt die Küfergilde?'),
      link = '[Nera](dungeon-ref:note/' + npc.id + ')',
      overview = {
        ...make(
          'Die Aufzug-Verschwörung',
          'quest',
          'Auftrag: Den Auftraggeber identifizieren.\nQuelle: ' + link + '\n',
        ),
        relations: [
          { targetId: npc.id, label: 'Quelle' },
          { targetId: clue.id, label: 'Quelle' },
        ],
      },
      other = {
        ...make('Die Torwache', 'quest', 'Andere Verwendung bleibt.'),
        relations: [{ targetId: npc.id, label: 'kennt' }],
      };
    const laterGm =
        overview.gmNotes + '\nSpätere Erkenntnis: Der Auftraggeber kommt über das Nordtor.\n',
      keyText = '  Nera erwartet die Gruppe. Den Sold erfragen.\r\n',
      plan = {
        version: 1,
        id: randomUUID(),
        revision: 1,
        name: 'Abend 12 · Die Nachtwache',
        scenes: [
          {
            id: randomUUID(),
            title: 'Nera nach dem Auftraggeber fragen',
            notes: '  Alten Besuch erhalten.\r\n',
            locationId: null,
          },
        ],
      };
    const store = new CampaignStore(file),
      campaign = store.create('Eine Originalquelle wiederfinden', rooms),
      w = store.activate(campaign.id),
      command = (action) => ({
        commandId: randomUUID(),
        campaignId: campaign.id,
        token: w.token,
        action,
      });
    for (const note of [npc, decoy, clue, overview, other])
      store.changePreparation({
        ...command(null),
        change: { kind: 'note', expectedRevision: null, note },
      });
    store.changePreparation({
      ...command(null),
      change: { kind: 'plan', expectedRevision: null, plan },
    });
    store.executeSession(
      command({
        kind: 'visit',
        planId: plan.id,
        expectedRevision: 0,
        detail: {
          ...store.session(w.token, plan.id).visits[0],
          noteIds: [overview.id, npc.id, clue.id],
        },
      }),
    );
    store.executeDrawing(
      command({
        kind: 'key-batch',
        rooms: [{ id: rooms[1].id, expectedRevision: 0, keyRevision: null }],
        patch: {
          references: [{ kind: 'npc', id: npc.id, label: npc.title }],
          gmNotes: { mode: 'replace', text: keyText },
        },
      }),
    );
    store.close();
    let app;
    const results = {};
    async function openNote(page, search, title) {
      await page.locator('#world-search').fill(search);
      await page.waitForFunction(
        (title) =>
          [...document.querySelectorAll('#world-list button')].filter((b) =>
            b.textContent.includes(title),
          ).length === 1,
        title,
      );
      await page.locator('#world-list button').filter({ hasText: title }).click();
      await page.waitForFunction((t) => document.querySelector('#note-title').value === t, title);
    }
    async function map(page) {
      await openNote(page, overview.title, overview.title);
      await page.locator('#note-thread-open').click();
      await page.waitForFunction(
        () => document.querySelectorAll('#note-thread-sources article').length === 2,
      );
    }
    async function tab(page, id) {
      if (!(await page.locator(id).isVisible())) {
        if (await page.locator('#atlas-navigation').isVisible())
          await page.locator('#atlas-navigation').click();
        if (!(await page.locator(id).isVisible()))
          await page.locator('#workspace-nav-summary').click();
      }
      await page.locator(id).click();
    }
    async function launch() {
      const page = await native.launch(scale);
      app = native.app;
      if (await page.locator('#tutorial-dialog').isVisible())
        await page.locator('#tutorial-skip').click();
      await page
        .locator('#campaign-screen-list article')
        .filter({ hasText: campaign.name })
        .getByRole('button', { name: 'Fortsetzen', exact: true })
        .click();
      await page.waitForFunction(
        () =>
          document.body.classList.contains('has-workspace') &&
          !document.querySelector('main').inert,
      );
      if (await page.locator('#campaign-atlas').isVisible()) await atlasCanvasReady(page);
      await tab(page, '#preparation-tab');
      await page.locator('#preparation-knowledge').click();
      return page;
    }
    async function useExisting(page, suffix) {
      await page
        .locator('#note-thread-dialog')
        .getByRole('button', { name: 'Schließen', exact: true })
        .click();
      await page.locator('#preparation-planning').click();
      await page.locator('#plans').selectOption(plan.id);
      await page.locator('#scene-list button').filter({ hasText: plan.scenes[0].title }).click();
      await page.locator('#session-packet-open').click();
      await page.waitForFunction(
        () =>
          document.querySelector('#session-packet-dialog').open &&
          document.querySelector('#session-packet-dialog').getAttribute('aria-busy') === 'false',
      );
      const packet = await page.locator('#session-packet-content').innerText();
      assert(packet.includes(npc.gmNotes));
      assert(!packet.includes(decoy.gmNotes));
      assert(packet.includes('Spätere Erkenntnis: Der Auftraggeber kommt über das Nordtor.'));
      results['packet' + suffix] = packet;
      await native.capture(page, 'packet' + suffix);
      await page
        .locator('#session-packet-dialog')
        .getByRole('button', { name: 'Schließen', exact: true })
        .click();
      await tab(page, '#atlas-tab');
      await page.locator('#atlas-search').fill('Wachstube');
      await page.getByRole('button', { name: '2 · Wachstube', exact: true }).click();
      await page.locator('#key-open').click();
      await page.waitForFunction(() => document.querySelector('#key-name').value === 'Wachstube');
      await openDesktopKeyReferences(page);
      await page
        .locator('#key-references')
        .getByRole('button', { name: npc.title, exact: true })
        .click();
      await page.locator('#key-reference-panel #note-editor').waitFor({ state: 'visible' });
      assert.equal(await page.locator('#note-gm').inputValue(), npc.gmNotes);
      assert.equal(
        await page.locator('#key-gm-notes').inputValue(),
        keyText.replace(/\r\n/g, '\n'),
      );
      assert.equal(await page.locator('#key-name').inputValue(), 'Wachstube');
      await native.capture(page, 'room' + suffix);
      results['originalRoomReference' + suffix] = true;
    }
    let page = await launch();
    await openNote(page, 'kupfernen Marken', npc.title);
    assert.equal(await page.locator('#note-gm').inputValue(), npc.gmNotes);
    await page.locator('#note-remove').click();
    await page.locator('#note-editor').waitFor({ state: 'hidden' });
    await openNote(page, overview.title, overview.title);
    await page.locator('#note-gm').fill(laterGm);
    await page.locator('#note-title').click();
    await page.locator('#note-thread-open').click();
    await page.waitForFunction(
      () => document.querySelectorAll('#note-thread-sources article').length === 2,
    );
    results.afterTrash = await page.locator('#note-thread-dialog').innerText();
    await native.capture(page, 'missing-source.png');
    await native.close();
    page = await launch();
    await map(page);
    results.afterRestart = await page.locator('#note-thread-dialog').innerText();
    results.offeredButtons = await page.locator('#note-thread-sources button').allTextContents();
    const card = page.locator('#note-thread-sources article').filter({ hasText: 'Papierkorb' });
    assert.equal(await card.getByRole('heading', { name: npc.title, exact: true }).count(), 1);
    assert.equal(await card.locator('input[type=checkbox]').isDisabled(), true);
    await card
      .getByRole('button', { name: 'Original im Papierkorb ansehen…', exact: true })
      .click();
    await page.locator('#note-thread-editor #note-restore').waitFor({ state: 'visible' });
    assert.equal(
      await page.evaluate(() => document.activeElement?.id),
      'note-restore',
      'Opening a trashed original must focus its available restore action',
    );
    const focusBox = await page.locator('#note-restore').evaluate((e) => {
      const r = e.getBoundingClientRect(),
        d = document.querySelector('#note-thread-dialog');
      return {
        top: r.top,
        bottom: r.bottom,
        height: innerHeight,
        scroll: d.scrollTop,
        active: document.activeElement?.id,
      };
    });
    assert(
      focusBox.top >= 0 && focusBox.bottom <= focusBox.height,
      'The focused restore action must be in view without pointer scrolling: ' +
        JSON.stringify(focusBox),
    );
    assert.equal(await page.locator('#note-gm').inputValue(), npc.gmNotes);
    assert.equal(await page.locator('#note-gm').isDisabled(), true);
    await native.capture(page, 'trash-original.png');
    if (loseRestoreReply)
      await app.evaluate(({ ipcMain }) => {
        const execute = ipcMain._invokeHandlers.get('campaign:change-preparation');
        globalThis.qaRestoreWrites = 0;
        ipcMain.removeHandler('campaign:change-preparation');
        ipcMain.handle('campaign:change-preparation', async (e, command) => {
          const value = await execute(e, command);
          if (command.change.kind === 'note-trash' && !command.change.trashed) {
            globalThis.qaRestoreWrites++;
            throw Error('QA: Restore reply lost after commit');
          }
          return value;
        });
      });
    await page.keyboard.press('Enter');
    if (loseRestoreReply) {
      await page.locator('#preparation-reconcile').waitFor({ state: 'visible' });
      assert(await page.locator('#note-gm').isDisabled());
      for (
        let i = 0;
        i < 30 &&
        (await page.evaluate(() => document.activeElement?.id)) !== 'preparation-reconcile';
        i++
      )
        await page.keyboard.press('Tab');
      assert.equal(await page.evaluate(() => document.activeElement?.id), 'preparation-reconcile');
      await page.keyboard.press('Enter');
      await page.waitForFunction(() => document.querySelector('#preparation-reconcile').hidden);
      assert.equal(
        await app.evaluate(() => globalThis.qaRestoreWrites),
        1,
        'Receipt lookup must not repeat the restore writer',
      );
      results.restoreReplyRecoveredWithoutReplay = true;
    }
    await page.waitForFunction(
      () =>
        !document.querySelector('#note-gm').disabled &&
        document.querySelector('#note-restore').hidden,
    );
    assert.equal(
      await page.evaluate(() => document.activeElement?.id),
      'note-title',
      'Restoring the original returns keyboard focus to its editable title',
    );
    await page.locator('#note-thread-return').click();
    await page.waitForFunction(() => document.querySelector('#note-thread-editor').hidden);
    results.directOriginalTrashRecovery = true;
    await page.waitForFunction(
      (text) => document.querySelector('#note-thread-sources').textContent.includes(text),
      npc.gmNotes,
    );
    results.restoredMap = await page.locator('#note-thread-dialog').innerText();
    assert(
      results.restoredMap.includes('Spätere Erkenntnis: Der Auftraggeber kommt über das Nordtor.'),
    );
    await native.capture(page, 'restored-map.png');
    await useExisting(page, '');
    await native.close();
    page = await launch();
    await map(page);
    await page.waitForFunction(
      (text) => document.querySelector('#note-thread-sources').textContent.includes(text),
      npc.gmNotes,
    );
    await useExisting(page, '-fresh');
    await native.close();
    const check = new CampaignStore(file);
    try {
      const a = check.activate(campaign.id),
        prep = check.preparation(a.token);
      assert.equal(prep.notes.length, 5);
      for (const n of [npc, decoy, clue, other]) {
        const row = prep.notes.find((r) => r.note.id === n.id);
        assert.equal(row.trashed, false);
        assert.deepEqual({ ...row.note, revision: 1 }, n);
        assert.equal(row.note.revision, n.id === npc.id ? 3 : 1);
      }
      assert.equal(prep.notes.find((r) => r.note.id === overview.id).note.gmNotes, laterGm);
      assert.deepEqual(prep.plans, [plan]);
      assert.deepEqual(check.session(a.token, plan.id).visits[0].noteIds, [
        overview.id,
        npc.id,
        clue.id,
      ]);
      assert.deepEqual(
        check.workspace().rooms.map((r) => r.sections),
        rooms.map((r) => r.sections),
      );
      const key = check.drawing(a.token).keyContent.find((k) => k.id === rooms[1].id);
      assert(key.blocks.some((b) => b.text === keyText));
      assert(key.references.some((r) => r.id === npc.id));
      results.originalIdentityOtherUsesLaterWorkRoomAndPlanPreserved = true;
    } finally {
      check.close();
    }
    await native.finish({ scale, results, normalClose: true });
    runs.push(JSON.parse(await readFile(out + '/result.json', 'utf8')));
    console.log(
      'COMPLETE ' + scale + ' original source restored and existing packet/room verified',
    );
  } catch (error) {
    await native.fail(error);
    throw error;
  } finally {
    await native.dispose();
  }
}
await writeFile(evidenceRoot + '/result.json', JSON.stringify({ runs }, null, 2));
