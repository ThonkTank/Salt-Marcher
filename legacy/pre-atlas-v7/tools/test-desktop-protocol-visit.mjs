import { runNativeProbe } from './native-session.mjs';
// Native GM task: protocol excerpts -> existing/new originals -> chosen existing
// evening visit -> normal close/fresh launch -> edit the original from its packet.
// Requires npm run build:desktop and npm run desktop:runtime.
// Run through python3 tools/ui-session.py node tools/test-desktop-protocol-visit.mjs;
// Native UI probes use 100%. Uses only a disposable campaign/profile.
import path from 'node:path';
import assert from 'node:assert/strict';
import { createRequire } from 'node:module';
import { readFile, writeFile, mkdtemp, mkdir, stat, rm } from 'node:fs/promises';
import { spawn, execFileSync } from 'node:child_process';
import { randomUUID, createHash } from 'node:crypto';
const root = process.cwd(),
  require = createRequire(root + '/package.json'),
  { _electron } = require('playwright-core');
const out =
  process.env.QA_EVIDENCE_DIR ??
  process.env.GM_QA_OUT ??
  path.resolve('.build/protocol-visit-' + 1);
await runNativeProbe(
  { output: out, name: 'protocol-visit', resultName: 'result.json' },
  async (native) => {
    await mkdir(out, { recursive: true });
    await rm(path.join(out, 'result.json'), { force: true });
    require('esbuild').buildSync({
      entryPoints: ['src/app/storage/store.ts'],
      outfile: '.build/note-excerpts-native-store.cjs',
      bundle: true,
      platform: 'node',
      format: 'cjs',
      external: ['better-sqlite3'],
    });
    const { CampaignStore } = require(root + '/.build/note-excerpts-native-store.cjs');
    const profile = native.profile,
      file = profile + '/workbench.sqlite';
    const rooms = [
      {
        id: randomUUID(),
        scopeId: 'local',
        floorId: 'ground',
        number: '1',
        name: 'Fährsteg',
        revision: 0,
        polygons: [
          {
            outer: [
              { x: 0, y: 0 },
              { x: 6, y: 0 },
              { x: 6, y: 6 },
              { x: 0, y: 6 },
            ],
            holes: [],
          },
        ],
        sections: [],
      },
    ];
    const store = new CampaignStore(file),
      campaign = store.create('Das erloschene Ufer', rooms),
      w = store.activate(campaign.id);
    const raw =
      '# Zweite Nacht am Grauen Ufer · Rohprotokoll\r\n\r\n20:15 – Siv berichtet: Ihr Bruder lebt und hat das Signalfeuer freiwillig verlassen. Sie bleibt am Fährsteg und verlangt, dass sein Versteck geheim bleibt.\r\n\r\n20:40 – Varo der Listenhüter fordert die Kupfermarke zurück. Er bietet einen Tausch an der Salzscheune an; die Gruppe traut seinem Versprechen noch nicht.\r\n\r\n21:05 – Ada übernimmt den Auftrag, den verschlossenen Schrank in der Salzscheune zu öffnen. Darin soll eine versiegelte Schatulle liegen. Die Entscheidung über den Tausch fällt vor der nächsten Flut.\r\n';
    const sourceNote = {
      version: 1,
      id: randomUUID(),
      revision: 1,
      title: 'Zweite Nacht am Grauen Ufer · Rohprotokoll',
      kind: 'note',
      readAloud: '',
      gmNotes: raw,
      relations: [],
      creatureId: null,
      deleted: false,
    };
    store.changePreparation({
      commandId: randomUUID(),
      token: w.token,
      campaignId: campaign.id,
      change: { kind: 'note', expectedRevision: null, note: sourceNote },
    });
    const npc = {
      ...sourceNote,
      id: randomUUID(),
      title: 'Siv die Fährfrau',
      kind: 'npc',
      gmNotes: '  Siv verwahrt den alten Fährschlüssel.\r\n',
      readAloud: 'Eine Frau im ölgetränkten Mantel.\r\n',
      relations: [],
    };
    store.changePreparation({
      commandId: randomUUID(),
      token: w.token,
      campaignId: campaign.id,
      change: { kind: 'note', expectedRevision: null, note: npc },
    });
    const previous = {
      version: 1,
      id: randomUUID(),
      revision: 1,
      name: 'Abend 11 · Erstes Treffen',
      scenes: [
        {
          id: randomUUID(),
          title: 'Fährschlüssel besorgen',
          notes: 'Historische Planung bleibt unverändert.\r\n',
          locationId: null,
        },
      ],
    };
    const plan = {
      version: 1,
      id: randomUUID(),
      revision: 1,
      name: 'Abend 13 · Die Salzscheune',
      scenes: [
        {
          id: randomUUID(),
          title: 'Das alte Tor',
          notes: 'Am Tor nichts ändern.\r\n',
          locationId: null,
        },
        {
          id: randomUUID(),
          title: 'Siv vor der Flut befragen',
          notes: '  Bisherige Planung\r\n',
          locationId: null,
        },
      ],
    };
    for (const p of [previous, plan])
      store.changePreparation({
        commandId: randomUUID(),
        token: w.token,
        campaignId: campaign.id,
        change: { kind: 'plan', expectedRevision: null, plan: p },
      });
    const background = Array.from({ length: 250 }, (_, i) => ({
      ...sourceNote,
      id: randomUUID(),
      title: 'Hintergrundnotiz ' + i,
      gmNotes: 'Unbeteiligter Kampagnentext. '.repeat(300),
      relations: [],
    }));
    store.db.transaction(() => {
      const insert = store.db.prepare('INSERT INTO world_note VALUES(?,?,1,0,?,?)'),
        index = store.db.prepare(
          'INSERT INTO note_search(campaign_id,note_id,title,body) VALUES(?,?,?,?)',
        );
      for (const n of background) {
        const payload = JSON.stringify(n);
        insert.run(campaign.id, n.id, payload, createHash('sha256').update(payload).digest('hex'));
        index.run(campaign.id, n.id, n.title, n.gmNotes);
      }
    })();
    store.close();
    const source = execFileSync('git', ['rev-parse', 'HEAD'], { encoding: 'utf8' }).trim(),
      dirty = execFileSync('git', ['status', '--short'], { encoding: 'utf8' }).trim(),
      hashes = {};
    for (const n of ['main.cjs', 'preload.cjs', 'ui/renderer.js', 'ui/index.html', 'ui/app.css'])
      hashes[n] = createHash('sha256')
        .update(await readFile(root + '/.build/desktop/' + n))
        .digest('hex');
    const fixture = { source, dirty, profile, file, campaign, rooms, sourceNote, raw, hashes };
    await writeFile(out + '/fixture.json', JSON.stringify(fixture, null, 2));

    let app, page, nativeProcess;
    const launches = [],
      errors = [];
    let packetCounts, targetReads;
    async function launch() {
      app = await native.launchConfigured({
        executablePath: root + '/node_modules/electron/dist/electron',
        args: [root + '/.build/desktop/main.cjs', '--ozone-platform=x11', '--data-dir', profile],
      });
      nativeProcess = app.process();
      launches.push({ pid: nativeProcess.pid });
      page = await app.firstWindow();
      page.setDefaultTimeout(20000);
      page.on('pageerror', (e) => errors.push(e.stack));
      await page.waitForFunction(() => document.body.dataset.tutorialReady === 'true');
      await app.evaluate(
        ({ BrowserWindow }, zoom) =>
          BrowserWindow.getAllWindows()
            .find((w) => w.webContents.getURL().endsWith('/index.html'))
            .webContents.setZoomFactor(zoom),
        1,
      );
      if (await page.locator('#tutorial-dialog').isVisible())
        await page.locator('#tutorial-skip').click();
      return await snapshot();
    }
    async function tab(id) {
      await page.waitForFunction(
        () =>
          document.body.classList.contains('has-workspace') &&
          !document.querySelector('#workspace-navigation').inert,
      );
      if (
        !(await page.locator(id).isVisible()) &&
        (await page.locator('#atlas-navigation').isVisible())
      )
        await page.locator('#atlas-navigation').click();
      if (!(await page.locator(id).isVisible()))
        await page.locator('#workspace-nav-summary').click();
      await page.locator(id).click();
    }
    async function shot(name) {
      await page.evaluate(
        () => new Promise((r) => requestAnimationFrame(() => requestAnimationFrame(r))),
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
    async function snapshot() {
      return await page.locator('body').innerText();
    }
    async function close() {
      const exited = new Promise((r) =>
        nativeProcess.once('exit', (code, signal) => r({ code, signal })),
      );
      await native.close();
      let timer;
      try {
        launches.at(-1).exit = await Promise.race([
          exited,
          new Promise((_, reject) => {
            timer = setTimeout(() => reject(Error('Normal close timed out')), 10000);
          }),
        ]);
        assert.deepEqual(launches.at(-1).exit, { code: 0, signal: null });
      } finally {
        clearTimeout(timer);
      }
      launches.at(-1).mainPidAbsent = await stat('/proc/' + launches.at(-1).pid)
        .then(() => false)
        .catch(() => true);
      await writeFile(out + '/processes.json', JSON.stringify({ launches, errors }, null, 2));
      return launches.at(-1);
    }
    async function openCampaign() {
      await page.getByRole('button', { name: 'Fortsetzen', exact: true }).click();
      await tab('#preparation-tab');
    }

    async function selectParagraph(j) {
      const a = page.locator('#note-gm');
      await a.click();
      await a.press('Control+Home');
      for (let k = 0; k < 2 + 2 * j; k++) await a.press('Control+ArrowDown');
      await a.press('Control+Shift+ArrowDown');
      await page.locator('#note-excerpt').click();
      await page.locator('#note-excerpt-dialog').waitFor({ state: 'visible' });
    }
    try {
      assert(npc.gmNotes.includes(String.fromCharCode(13)));
      await launch();
      await openCampaign();
      await page.locator('#preparation-knowledge').click();
      await page.locator('#world-search').fill(sourceNote.title);
      await page
        .locator('#world-list')
        .getByRole('button', { name: sourceNote.title, exact: true })
        .click();
      await page.waitForFunction(
        (t) => document.querySelector('#note-title').value === t,
        sourceNote.title,
      );
      await selectParagraph(0);
      await page.locator('#note-excerpt-title').fill('Siv');
      await page
        .locator('#note-excerpt-choices')
        .getByRole('button', { name: /^Siv die Fährfrau/ })
        .waitFor();
      await app.evaluate(({ ipcMain }) => {
        globalThis.protocolReads = [];
        let fail = true;
        for (const channel of ['campaign:preparation', 'campaign:desk-content']) {
          const original = ipcMain._invokeHandlers.get(channel);
          ipcMain.removeHandler(channel);
          ipcMain.handle(channel, async (event, ...args) => {
            const result =
              channel === 'campaign:desk-content' && fail
                ? ((fail = false),
                  { ok: false, error: 'QA: Gewähltes Original vorübergehend nicht lesbar' })
                : await original(event, ...args);
            globalThis.protocolReads.push({
              channel,
              args,
              bytes: Buffer.byteLength(JSON.stringify(result)),
            });
            return result;
          });
        }
      });
      await page
        .locator('#note-excerpt-choices')
        .getByRole('button', { name: /^Siv die Fährfrau/ })
        .click();
      await page
        .getByText('QA: Gewähltes Original vorübergehend nicht lesbar', { exact: true })
        .waitFor();
      assert.equal(await page.locator('#note-excerpt-existing').isVisible(), false);
      await shot('target-read-failure');
      await page
        .locator('#note-excerpt-choices')
        .getByRole('button', { name: /^Siv die Fährfrau/ })
        .click();
      await page.locator('#note-excerpt-existing').waitFor({ state: 'visible' });
      targetReads = await app.evaluate(() => globalThis.protocolReads);
      assert.equal(targetReads.length, 2);
      assert(
        targetReads.every(
          (r) =>
            r.channel === 'campaign:desk-content' &&
            r.args[1].kind === 'note' &&
            r.args[1].id === npc.id &&
            r.bytes < 4096,
        ),
      );
      await page.locator('#note-excerpt-existing summary').click();
      assert(
        (await page.locator('#note-excerpt-existing-text').textContent()).includes('Fährschlüssel'),
      );
      await page.locator('#note-excerpt-save').click();
      await page.locator('#note-excerpt-dialog').waitFor({ state: 'hidden' });
      for (const [i, title, kind] of [
        [1, 'Varo der Listenhüter', 'npc'],
        [2, 'Der Schrank in der Salzscheune', 'quest'],
      ]) {
        await selectParagraph(i);
        await page.locator('#note-excerpt-title').fill(title);
        await page.locator('#note-excerpt-kind').selectOption(kind);
        await page.locator('#note-excerpt-save').click();
        await page.locator('#note-excerpt-dialog').waitFor({ state: 'hidden' });
      }
      assert.equal(await page.locator('#note-gm').inputValue(), raw.replace(/\r\n/g, '\n'));
      await page.locator('#note-thread-prepare').click();
      await page.waitForFunction(
        () => document.querySelectorAll('#note-thread-sources article').length === 3,
      );
      assert.equal(await page.locator('#note-thread-plan').inputValue(), '');
      assert.equal(await page.locator('#note-thread-visit').inputValue(), '');
      assert.equal(await page.locator('#note-thread-plan-name').inputValue(), '');
      assert.equal(await page.locator('#note-thread-visit-title').inputValue(), '');
      await page
        .locator('#note-thread-plan')
        .evaluate((el) => el.scrollIntoView({ block: 'start' }));
      await shot('explicit-target');
      await page.locator('#note-thread-use').click();
      await page.waitForFunction(() =>
        document.querySelector('#note-thread-target-hint').textContent.includes('benennen'),
      );
      assert(await page.locator('#note-thread-dialog').isVisible());
      await page.locator('#note-thread-include-root').uncheck();
      await page.locator('#note-thread-plan').selectOption(plan.id);
      assert.equal(await page.locator('#note-thread-visit').inputValue(), '');
      await page.locator('#note-thread-use').click();
      assert(await page.locator('#note-thread-dialog').isVisible());
      await page.locator('#note-thread-visit').selectOption(plan.scenes[1].id);
      assert.equal(await page.locator('#note-thread-target-hint').isVisible(), false);
      assert(!(await page.locator('#note-thread-status').innerText()).includes('benennen'));
      const review = page.locator('#note-thread-review');
      assert.equal(await review.evaluate((e) => e.open), false);
      assert.equal(await page.locator('#note-thread-root').isVisible(), false);
      await review.locator(':scope > summary').click();
      await page
        .locator('#note-thread-sources article[data-note-id=\"' + npc.id + '\"] details[open]')
        .getByText('Ihr Bruder lebt', { exact: false })
        .waitFor();
      assert((await review.innerText()).includes('Fährschlüssel'));
      await shot('review-originals');
      await review.locator(':scope > summary').click();
      assert.equal(await page.locator('#note-thread-plan').inputValue(), plan.id);
      assert.equal(await page.locator('#note-thread-visit').inputValue(), plan.scenes[1].id);
      await page.locator('#note-thread-plan').scrollIntoViewIfNeeded();
      await shot('chosen-existing-visit');
      await page.locator('#note-thread-use').click();
      await page.locator('#note-thread-dialog').waitFor({ state: 'hidden' });
      await page.locator('#session-packet-open').click();
      await page.waitForFunction(
        () =>
          document.querySelector('#session-packet-dialog').open &&
          document.querySelector('#session-packet-dialog').getAttribute('aria-busy') === 'false',
      );
      const compact = await page.evaluate(() => window.innerWidth <= 750),
        index = page.locator('#session-packet-index');
      assert.equal(await index.evaluate((e) => e.open), !compact);
      if (compact) await index.locator('summary').click();
      await page.locator('#session-packet-search').fill('versiegelte Schatulle');
      await page.waitForFunction(
        () => document.querySelector('#session-packet-count').textContent === '1 von 2 Besuchen',
      );
      assert(
        (await page.locator('#session-packet-content').innerText()).includes(
          'versiegelte Schatulle',
        ),
      );
      await page.locator('#session-packet-search').fill('');
      if (compact) await index.locator('summary').click();
      packetCounts = {
        cards: await page.locator('#session-packet-content .packet-block').count(),
        originalActions: await page
          .locator('#session-packet-content .packet-source-actions button')
          .count(),
        sivCards: await page
          .locator('#session-packet-content .packet-block')
          .filter({ hasText: 'Siv die Fährfrau' })
          .count(),
      };
      assert.deepEqual(packetCounts, { cards: 4, originalActions: 3, sivCards: 1 });
      let text = await page.locator('#session-packet-content').innerText();
      for (const str of [
        'Fährschlüssel',
        'Ihr Bruder lebt',
        '20:40 – Varo',
        'versiegelte Schatulle',
        'Bisherige Planung',
      ])
        assert(text.includes(str));
      await page
        .locator('#session-packet-content .packet-runway-steps')
        .getByRole('button', { name: '2. Siv die Fährfrau', exact: true })
        .click();
      await shot('usable-existing-evening');
      await page.locator('#session-packet-close').click();
      await close();
      await launch();
      await openCampaign();
      await page.locator('#preparation-planning').click();
      await page.locator('#plans').selectOption(plan.id);
      await page.locator('#scene-list button').filter({ hasText: plan.scenes[1].title }).click();
      await page.locator('#session-packet-open').click();
      await page.waitForFunction(
        () =>
          document.querySelector('#session-packet-dialog').getAttribute('aria-busy') === 'false',
      );
      const card = page
        .locator('#session-packet-content .packet-block')
        .filter({ hasText: '20:40 – Varo' });
      await card.getByRole('button', { name: 'Original bearbeiten…', exact: true }).click();
      await page.waitForFunction(
        () =>
          document.querySelector('#packet-note-editor:not([hidden]) #note-title')?.value ===
          'Varo der Listenhüter',
      );
      await page.locator('#note-gm').press('Control+End');
      await page.locator('#note-gm').press('Enter');
      await page.keyboard.type('Nächster Abend: Varo wartet am nördlichen Scheunentor.');
      await page.locator('#packet-note-return').click();
      await page.waitForFunction(
        () =>
          document.querySelector('#packet-note-editor').hidden &&
          document
            .querySelector('#session-packet-content')
            .textContent.includes('nördlichen Scheunentor'),
      );
      await shot('fresh-further-edit');
      const sivCard = page
        .locator('#session-packet-content .packet-block')
        .filter({ hasText: '20:15 – Siv berichtet' });
      const publicCue = await sivCard.locator('.packet-read-aloud').innerText();
      assert(publicCue.includes('Eine Frau im ölgetränkten Mantel.'));
      assert(!publicCue.includes('Fährschlüssel') && !publicCue.includes('Ihr Bruder lebt'));
      await sivCard.getByRole('button', { name: 'Original bearbeiten…', exact: true }).click();
      await page.waitForFunction(
        () =>
          document.querySelector('#packet-note-editor:not([hidden]) #note-title')?.value ===
          'Siv die Fährfrau',
      );
      assert.equal(
        await page.locator('#note-read-aloud').inputValue(),
        npc.readAloud.replace(/\r\n/g, '\n'),
      );
      assert(
        (await page.locator('#note-gm').inputValue()).startsWith(
          npc.gmNotes.replace(/\r\n/g, '\n'),
        ),
      );
      await page.locator('#packet-note-return').click();
      await page.waitForFunction(() => document.querySelector('#packet-note-editor').hidden);
      await page.locator('#session-packet-close').click();
      await page.locator('#preparation-knowledge').click();
      await page.locator('#world-search').fill(sourceNote.title);
      await page
        .locator('#world-list')
        .getByRole('button', { name: sourceNote.title, exact: true })
        .click();
      await page.waitForFunction(
        (t) => document.querySelector('#note-title').value === t,
        sourceNote.title,
      );
      await page.locator('#note-thread-prepare').click();
      await page.waitForFunction(() => !document.querySelector('#note-thread-use').disabled);
      assert.equal(await page.locator('#note-thread-plan').inputValue(), plan.id);
      assert.equal(await page.locator('#note-thread-visit').inputValue(), plan.scenes[1].id);
      await page.locator('#note-thread-plan').selectOption(previous.id);
      assert.equal(await page.locator('#note-thread-visit').inputValue(), '');
      await page
        .locator('#note-thread-dialog')
        .getByRole('button', { name: 'Schließen', exact: true })
        .click();
      await close();
      const audit = new CampaignStore(file);
      let canonical;
      try {
        const aw = audit.activate(campaign.id),
          prep = audit.preparation(aw.token),
          notes = prep.notes.map((r) => r.note),
          visits = audit.session(aw.token, plan.id).visits;
        assert.equal(notes.length, background.length + 4);
        for (const n of background)
          assert.deepEqual(
            notes.find((saved) => saved.id === n.id),
            n,
          );
        assert.equal(notes.find((n) => n.id === sourceNote.id).gmNotes, raw);
        assert.deepEqual(
          prep.plans.find((p) => p.id === previous.id),
          previous,
        );
        assert.deepEqual(
          prep.plans.find((p) => p.id === plan.id),
          plan,
        );
        const siv = notes.find((n) => n.id === npc.id);
        assert.equal(siv.readAloud, npc.readAloud);
        assert(siv.gmNotes.startsWith(npc.gmNotes));
        assert.equal(notes.find((n) => n.title === 'Varo der Listenhüter').kind, 'npc');
        assert.equal(notes.find((n) => n.title === 'Der Schrank in der Salzscheune').kind, 'quest');
        assert.deepEqual(
          new Set(visits[1].noteIds),
          new Set(
            notes
              .filter((n) => n.id !== sourceNote.id && !background.some((b) => b.id === n.id))
              .map((n) => n.id),
          ),
        );
        assert.equal(visits[0].noteIds.length, 0);
        for (const n of notes.filter(
          (n) => n.id !== sourceNote.id && !background.some((b) => b.id === n.id),
        ))
          assert(n.relations.some((r) => r.targetId === sourceNote.id && r.label === 'Quelle'));
        canonical = {
          notes: notes.filter((n) => !background.some((b) => b.id === n.id)),
          backgroundCount: background.length,
          backgroundUnchanged: true,
          plans: prep.plans,
          visits,
        };
      } finally {
        audit.close();
      }
      assert.deepEqual(errors, []);
      assert(launches.every((l) => l.exit?.code === 0 && l.mainPidAbsent));
      await native.recordResult({
        fixture,
        npc,
        previous,
        plan,
        canonical,
        packetCounts,
        targetReads,
        launches,
        errors,
        complete: true,
        explicitTarget: true,
        knownDestinationPreserved: true,
        zoom: 1,
      });
      console.log(
        'COMPLETE protocol, existing original, explicit visit, fresh and further edit at ' + 1,
      );
    } catch (error) {
      await writeFile(
        out + '/failure.json',
        JSON.stringify({ error: error.stack, launches, errors, profile }, null, 2),
      );
      if (nativeProcess?.exitCode === null) await shot('failure').catch(() => {});
      throw error;
    } finally {
      try {
      } finally {
      }
    }
  },
);
