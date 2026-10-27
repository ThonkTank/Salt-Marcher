import { runNativeProbe } from './native-session.mjs';
import assert from 'node:assert/strict';
import { createRequire } from 'node:module';
import { readFile, writeFile, mkdir, mkdtemp, stat } from 'node:fs/promises';
import { spawn, execFileSync } from 'node:child_process';
import { randomUUID, createHash } from 'node:crypto';
const root = process.cwd(),
  require = createRequire(root + '/package.json'),
  { _electron } = require('playwright-core'),
  out =
    process.env.QA_EVIDENCE_DIR ??
    process.env.GM_QA_OUT ??
    (await mkdtemp(root + '/.build/qa-room-rule-'));
await runNativeProbe(
  { output: out, name: 'room-rule-reuse', resultName: 'result.json' },
  async (native) => {
    await mkdir(out, { recursive: true });
    const storeBundle = root + '/.build/room-rule-store.cjs';
    require('esbuild').buildSync({
      entryPoints: ['src/app/storage/store.ts'],
      outfile: storeBundle,
      bundle: true,
      platform: 'node',
      format: 'cjs',
      external: ['better-sqlite3'],
    });
    const { CampaignStore } = require(storeBundle);
    const profile = native.profile,
      file = profile + '/workbench.sqlite';
    const rooms = ['Torhalle', 'Sakristei'].map((name, i) => ({
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
        {
          id: randomUUID(),
          kind: 'markdown',
          markdown: 'Original ' + name + '\r\n  Überreste der alten Abtei.',
        },
      ],
    }));
    const store = new CampaignStore(file),
      campaign = store.create('Die zwei Druckplatten', rooms),
      w = store.activate(campaign.id),
      command = (action) => ({
        commandId: randomUUID(),
        token: w.token,
        campaignId: campaign.id,
        action,
      });
    const rule = {
      version: 1,
      id: randomUUID(),
      revision: 1,
      kind: 'note',
      title: 'Druckplatten – Abwicklung',
      readAloud: '',
      gmNotes:
        'Eine Last von mindestens 20 Pfund löst aus. Geschicklichkeitsrettungswurf SG 12; bei Fehlschlag 1W6 Stichschaden. Der Mechanismus braucht eine Minute zum Rückstellen. Sichtbare Fugen verraten die Druckplatte.',
      relations: [],
      creatureId: null,
      deleted: false,
    };
    const initialNotes = [
      rule,
      ...Array.from({ length: 35 }, (_, i) => ({
        ...rule,
        id: randomUUID(),
        title:
          ['Abteichronik', 'Bruder Pell', 'Kräutergarten', 'Schmugglerversteck', 'Zoll am Fluss'][
            i % 5
          ] +
          ' ' +
          (i + 1),
        kind: i % 2 ? 'npc' : 'note',
        gmNotes: 'Kampagnenmaterial aus einem früheren Abend.',
      })),
    ];
    for (const note of initialNotes)
      store.changePreparation({
        ...command(null),
        change: { kind: 'note', expectedRevision: null, note },
      });
    for (const [i, room] of rooms.entries())
      store.executeDrawing(
        command({
          kind: 'key-batch',
          rooms: [{ id: room.id, expectedRevision: 0, keyRevision: null }],
          patch: {
            gmNotes: {
              mode: 'replace',
              text: i
                ? 'Kupfernadeln hinter der Tür. Die Platte wird mit dem Rad im Nebenraum zurückgestellt.'
                : 'Zwei bronzene Speere hinter dem Relief. Die Platte wird mit dem Hebel hinter dem Relief zurückgestellt.',
            },
          },
        }),
      );
    store.close();
    const source = execFileSync('git', ['rev-parse', 'HEAD'], { encoding: 'utf8' }).trim(),
      dirty = !!execFileSync('git', ['status', '--porcelain'], { encoding: 'utf8' }).trim(),
      hashes = {};
    for (const n of ['main.cjs', 'preload.cjs', 'ui/renderer.js', 'ui/index.html', 'ui/app.css'])
      hashes[n] = createHash('sha256')
        .update(await readFile(root + '/.build/desktop/' + n))
        .digest('hex');
    await writeFile(
      out + '/fixture.json',
      JSON.stringify({ source, dirty, hashes, profile, file, campaign, rooms, rule }, null, 2),
    );

    let app, page, nativeProcess;
    const launches = [],
      errors = [];
    async function launch() {
      app = await native.launchConfigured({
        executablePath: root + '/node_modules/electron/dist/electron',
        args: [root + '/.build/desktop/main.cjs', '--ozone-platform=x11', '--data-dir', profile],
      });
      nativeProcess = app.process();
      launches.push({ pid: nativeProcess.pid });
      page = await app.firstWindow();
      page.setDefaultTimeout(15000);
      page.on('pageerror', (e) => errors.push(e.stack));
      await page.waitForFunction(() => document.body.dataset.tutorialReady === 'true');
      if (await page.locator('#tutorial-dialog').isVisible())
        await page.locator('#tutorial-skip').click();
      return await snapshot();
    }
    async function snapshot() {
      return await page.locator('body').innerText();
    }
    async function shot(name) {
      await page.evaluate(
        () => new Promise((resolve) => requestAnimationFrame(() => requestAnimationFrame(resolve))),
      );
      const png = await app.evaluate(async ({ BrowserWindow }) =>
        (
          await BrowserWindow.getAllWindows()
            .find((w) => w.webContents.getURL().endsWith('/index.html'))
            .webContents.capturePage()
        )
          .toPNG()
          .toString('base64'),
      );
      await writeFile(out + '/' + name + '.png', Buffer.from(png, 'base64'));
      return out + '/' + name + '.png';
    }
    async function close() {
      const done = new Promise((r) =>
        nativeProcess.once('exit', (code, signal) => r({ code, signal })),
      );
      await native.close();
      let timer;
      try {
        launches.at(-1).exit = await Promise.race([
          done,
          new Promise(
            (_, reject) =>
              (timer = setTimeout(() => reject(Error('Normal close timed out')), 10000)),
          ),
        ]);
      } finally {
        clearTimeout(timer);
      }
      launches.at(-1).pidAbsent = await stat('/proc/' + nativeProcess.pid)
        .then(() => false)
        .catch(() => true);
      await writeFile(out + '/processes.json', JSON.stringify(launches, null, 2));
      return launches.at(-1);
    }

    async function enterCampaign() {
      await page.getByRole('button', { name: 'Fortsetzen', exact: true }).click();
      await page.locator('#campaign-atlas').waitFor({ state: 'visible' });
    }
    async function roomKeys(title = 'Torhalle') {
      const search = page.getByPlaceholder('Ort, Haus oder Raum suchen');
      await search.fill(title);
      await page.getByRole('button', { name: new RegExp('^\\d+ · ' + title + '$') }).click();
      await page.getByRole('button', { name: 'Beschreibung bearbeiten…', exact: true }).click();
      await page.locator('#key-dialog').waitFor({ state: 'visible' });
    }
    async function sourceReturned() {
      await page.locator('#key-reference-panel').waitFor({ state: 'visible' });
      await page.locator('#note-gm').waitFor({ state: 'visible' });
      assert(await page.locator('#campaign-atlas').isVisible());
      assert.equal(await page.locator('#key-name').inputValue(), 'Sakristei');
    }
    async function knowledge() {
      if (
        !(await page.locator('#preparation-tab').isVisible()) &&
        (await page.locator('#atlas-navigation').isVisible())
      )
        await page.locator('#atlas-navigation').click();
      if (!(await page.locator('#preparation-tab').isVisible()))
        await page.locator('#workspace-nav-summary').click();
      await page.locator('#preparation-tab').click();
      await page.locator('#preparation-knowledge').click();
      await page.locator('#world-search').waitFor({ state: 'visible' });
    }

    async function saved() {
      await page.waitForFunction(
        () => document.getElementById('key-save-status').dataset.state === 'saved',
      );
    }
    async function openRule() {
      await page
        .locator('#key-references')
        .getByRole('button', { name: rule.title, exact: true })
        .click();
      await page.waitForFunction(
        (t) => document.getElementById('note-title').value === t,
        rule.title,
      );
    }
    try {
      await launch();
      await enterCampaign();
      await roomKeys();
      await page.locator('#key-reference-picker summary').click();
      await page.locator('#key-reference-query').fill('Druckplatten');
      assert.equal(await page.locator('#key-reference-matches button').count(), 1);
      await shot('one-match');
      await page.locator('#key-reference-matches button').click();
      await saved();
      await page.locator('#key-close').click();
      await page.locator('#key-dialog').waitFor({ state: 'hidden' });
      await roomKeys('Sakristei');
      assert.equal(await page.locator('#key-reference-query').inputValue(), 'Druckplatten');
      await page.locator('#key-reference-query').press('Enter');
      await saved();
      await openRule();
      await page.locator('#note-gm').fill(rule.gmNotes.replace('SG 12', 'SG 14'));
      // The source was opened in the Atlas. Visiting either use must return there,
      // including an immediately edited note, an edited room and the next visit.
      await page
        .locator('#note-room-uses-list')
        .getByRole('button')
        .filter({ hasText: 'Torhalle' })
        .click();
      await page.locator('#key-gm-notes').waitFor({ state: 'visible' });
      await page.locator('#key-gm-notes').press('Control+End');
      await page.keyboard.insertText(
        ' Nach der Entschärfung bleibt der Hebel mit rotem Band markiert.',
      );
      await page.getByRole('button', { name: 'Zurück zur Notiz', exact: true }).click();
      await sourceReturned();
      assert.match(await page.locator('#note-gm').inputValue(), /SG 14/);
      await shot('source-return');
      // An IME-blocked visit leaves the source and its return control usable.
      await page.locator('#note-gm').dispatchEvent('compositionstart');
      await page
        .locator('#note-room-uses-list')
        .getByRole('button')
        .filter({ hasText: 'Torhalle' })
        .click();
      await sourceReturned();
      await page.locator('#note-gm').dispatchEvent('compositionend');
      await page.locator('#key-reference-return').click();
      await page.locator('#key-reference-panel').waitFor({ state: 'hidden' });
      await openRule();
      await app.evaluate(({ BrowserWindow }) =>
        BrowserWindow.getAllWindows()
          .find((w) => w.webContents.getURL().endsWith('/index.html'))
          .webContents.setZoomFactor(2),
      );
      await page
        .locator('#note-room-uses-list')
        .getByRole('button')
        .filter({ hasText: 'Sakristei' })
        .click();
      assert.equal(
        (await page.locator('#key-gm-notes').inputValue()).includes('rotem Band'),
        false,
      );
      await page.getByRole('button', { name: 'Zurück zur Notiz', exact: true }).click();
      await sourceReturned();
      assert.equal(await page.locator('#key-gm-notes').isVisible(), false);
      await page.locator('#note-room-uses-list button').last().scrollIntoViewIfNeeded();
      await page.evaluate(
        () => new Promise((resolve) => requestAnimationFrame(() => requestAnimationFrame(resolve))),
      );
      const returnVisible = await page.locator('#key-reference-return').evaluate((button) => {
        const r = button.getBoundingClientRect();
        return button.contains(document.elementFromPoint(r.x + r.width / 2, r.y + r.height / 2));
      });
      assert(returnVisible, 'Return to room remains visible over the scrolled source at 200%');
      await shot('source-return-200');
      await page.locator('#key-reference-return').click();
      await page.locator('#key-reference-panel').waitFor({ state: 'hidden' });
      assert.equal(await page.locator('#key-name').inputValue(), 'Sakristei');
      await page.locator('#key-close').click();
      await page.locator('#key-dialog').waitFor({ state: 'hidden' });
      await close();
      await launch();
      await enterCampaign();
      await knowledge();
      await page.locator('#world-search').fill('mindestens 20 Pfund');
      await page
        .locator('#world-list')
        .getByRole('button', { name: rule.title, exact: true })
        .click();
      await page
        .locator('#note-room-uses-list')
        .getByRole('button')
        .filter({ hasText: 'Sakristei' })
        .waitFor();
      assert.equal(await page.locator('#note-room-uses-list button').count(), 2);
      await app.evaluate(({ BrowserWindow }) =>
        BrowserWindow.getAllWindows()
          .find((w) => w.webContents.getURL().endsWith('/index.html'))
          .webContents.setZoomFactor(1),
      );
      await page.locator('#note-room-uses-list').scrollIntoViewIfNeeded();
      await shot('fresh-two-uses');
      // Ordinary Preparation navigation retains its existing return route.
      for (const title of ['Torhalle', 'Sakristei']) {
        await page
          .locator('#note-room-uses-list')
          .getByRole('button')
          .filter({ hasText: title })
          .click();
        await page.locator('#key-dialog').waitFor({ state: 'visible' });
        const gm = await page.locator('#key-gm-notes').inputValue();
        assert.equal(gm.includes('rotem Band'), title === 'Torhalle');
        await openRule();
        assert.match(await page.locator('#note-gm').inputValue(), /SG 14/);
        await page.locator('#key-reference-return').click();
        await page.locator('#key-reference-panel').waitFor({ state: 'hidden' });
        await page.locator('#key-close').click();
        await page.locator('#key-dialog').waitFor({ state: 'hidden' });
        assert(await page.locator('#world-search').isVisible());
      }

      await close();
      const audit = new CampaignStore(file);
      let content;
      try {
        const w = audit.activate(campaign.id),
          notes = audit.preparation(w.token).notes,
          keys = audit.drawing(w.token).keyContent;
        assert.equal(notes.length, 36);
        for (const note of initialNotes.filter((n) => n.id !== rule.id))
          assert.deepEqual(notes.find((r) => r.note.id === note.id).note, note);
        assert.equal(
          notes.find((r) => r.note.id === rule.id).note.gmNotes,
          rule.gmNotes.replace('SG 12', 'SG 14'),
        );
        for (const room of rooms) {
          assert.deepEqual(
            audit.workspace().rooms.find((r) => r.id === room.id).sections,
            room.sections,
          );
          assert.deepEqual(keys.find((k) => k.id === room.id).references, [
            { kind: 'note', id: rule.id, label: rule.title },
          ]);
        }
        content = {
          rule: notes.find((r) => r.note.id === rule.id).note,
          keys: keys.filter((k) => rooms.some((r) => r.id === k.id)),
          legacySectionsExact: true,
          otherNotesRetained: true,
        };
      } finally {
        audit.close();
      }
      assert.deepEqual(errors, []);
      assert.ok(launches.every((l) => l.exit.code === 0 && l.pidAbsent));
      await native.recordResult({
        complete: true,
        source,
        dirty,
        hashes,
        launches,
        errors,
        profile,
        file,
        content,
        normalAnd200: true,
        contextualAtlasReturn: true,
        blockedImeReturn: true,
        preparationReturn: true,
        task: 'Shared trap source in two room keys; query retained and direct keyboard linking; central correction, two uses, local edit, normal Fresh fulltext refind and both current room sources',
        humanAcceptance: false,
        packageInstallation: false,
      });
      console.log(JSON.stringify({ complete: true, out, source, launches }));
    } catch (error) {
      if (nativeProcess?.exitCode === null) {
        await shot('failure').catch(() => {});
        await writeFile(
          out + '/failure.txt',
          String(error) + '\n' + (await snapshot().catch(() => '')),
        );
      }
      throw error;
    } finally {
      try {
        if (nativeProcess?.exitCode === null)
          await close().catch((error) => console.error('Cleanup: ' + error.message));
      } finally {
      }
    }
  },
);
