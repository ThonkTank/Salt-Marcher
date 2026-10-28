import { runNativeProbe } from './native-session.mjs';
import { createRequire } from 'node:module';
import { readFile, writeFile, mkdtemp, mkdir, stat, copyFile } from 'node:fs/promises';
import { spawn, execFileSync } from 'node:child_process';
import { createHash } from 'node:crypto';
import path from 'node:path';
const root = process.cwd(),
  require = createRequire(root + '/package.json'),
  { _electron } = require('playwright-core');
const out =
  process.env.QA_EVIDENCE_DIR ??
  path.resolve(process.env.GM_QA_OUT ?? '/tmp/gm-session-followup-after');
await runNativeProbe(
  { output: out, name: 'note-existing-excerpts', resultName: 'result.json' },
  async (native) => {
    await mkdir(out, { recursive: true });
    if (!process.env.GM_QA_START_RESULT)
      throw Error(
        'GM_QA_START_RESULT must identify a closed, completed first-session native fixture.',
      );
    const resultPath = path.resolve(process.env.GM_QA_START_RESULT),
      completed = JSON.parse(await readFile(resultPath, 'utf8')),
      initial = JSON.parse(await readFile(path.dirname(resultPath) + '/fixture.json', 'utf8'));
    if (!completed.complete || completed.launches?.some((l) => !l.pidAbsent || l.exit?.code !== 0))
      throw Error('First-session fixture was not normally closed.');
    const profile = native.profile,
      file = profile + '/workbench.sqlite';
    await copyFile(completed.file, file);
    const campaign = initial.campaign,
      rooms = initial.rooms,
      sourceNote = initial.sourceNote,
      raw = initial.raw;
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
      await app.evaluate(
        ({ BrowserWindow }, zoom) =>
          BrowserWindow.getAllWindows()
            .find((w) => w.webContents.getURL().endsWith('/index.html'))
            .webContents.setZoomFactor(zoom),
        1,
      );
      await page.waitForFunction(() => document.body.dataset.tutorialReady === 'true');
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
      launches.at(-1).exit = await exited;
      launches.at(-1).mainPidAbsent = await stat('/proc/' + launches.at(-1).pid)
        .then(() => false)
        .catch(() => true);
      await writeFile(out + '/processes.json', JSON.stringify({ launches, errors }, null, 2));
      return launches.at(-1);
    }

    try {
      await launch();

      // Full GM task phase 0
      {
        globalThis.raw2 =
          '# Zweite Nacht am Grauen Ufer · Rohprotokoll\n\n20:15 – Siv berichtet: Ihr Bruder lebt und hat das Signalfeuer freiwillig verlassen. Sie bleibt am Fährsteg und verlangt, dass sein Versteck geheim bleibt.\n\n20:40 – Die Bruderschaft fordert die Kupfermarke zurück. Ihr Sprecher Varo bietet einen Tausch an der Salzscheune an; die Gruppe traut seinem Versprechen noch nicht.\n\n21:05 – Ada übernimmt den Auftrag, den verschlossenen Schrank in der Salzscheune zu öffnen. Darin soll eine versiegelte Schatulle liegen. Die Entscheidung über den Tausch fällt vor der nächsten Flut.\n';
        const db = require('better-sqlite3')(file, { readonly: true });
        const start = {
          notes: db
            .prepare('SELECT payload FROM world_note WHERE campaign_id=?')
            .all(campaign.id)
            .map((r) => JSON.parse(r.payload)),
          plans: db.prepare('SELECT * FROM plan WHERE campaign_id=?').all(campaign.id),
          visits: db.prepare('SELECT * FROM planned_visit WHERE campaign_id=?').all(campaign.id),
          details: db.prepare('SELECT * FROM session_visit WHERE campaign_id=?').all(campaign.id),
        };
        db.close();
        await writeFile(out + '/starting-state.json', JSON.stringify(start, null, 2));
        await page.getByRole('button', { name: 'Fortsetzen', exact: true }).click();
        await tab('#preparation-tab');
        await page.locator('#preparation-knowledge').click();
        await page.locator('#world-new').click();
        await page.locator('#world-kind').selectOption('note');
        await page.locator('#world-name').fill('Zweite Nacht am Grauen Ufer · Rohprotokoll');
        await page.locator('#world-create').click();
        await page.waitForFunction(
          () =>
            document.getElementById('note-title').value ===
            'Zweite Nacht am Grauen Ufer · Rohprotokoll',
        );
        await page.locator('#note-gm').fill(raw2);
        await page.locator('#note-title').click();
      }
      // Full GM task phase 1
      {
        globalThis.findNote = async (title, query = title) => {
          await page.locator('#world-search').fill(query);
          await page
            .locator('#world-list')
            .getByRole('button', { name: new RegExp('^' + title) })
            .click();
          await page.waitForFunction(
            (t) => document.getElementById('note-title').value === t,
            title,
          );
        };
        globalThis.followupUpdates = [];
        for (const [j, title] of [
          [0, 'Siv die Fährfrau'],
          [1, 'Bruderschaft vom Grauen Ufer'],
        ]) {
          const a = page.locator('#note-gm');
          await a.click();
          await a.press('Control+Home');
          for (let k = 0; k < 2 + 2 * j; k++) await a.press('Control+ArrowDown');
          await a.press('Control+Shift+ArrowDown');
          await page.locator('#note-excerpt').click();
          await page.locator('#note-excerpt-title').fill(title);
          await page
            .locator('#note-excerpt-choices')
            .getByRole('button', { name: new RegExp('^' + title) })
            .click();
          await page.locator('#note-excerpt-existing').waitFor({ state: 'visible' });
          await page.locator('#note-excerpt-existing summary').click();
          const prior = await page.locator('#note-excerpt-existing-text').textContent(),
            addition = await page.locator('#note-excerpt-text').inputValue();
          if (
            !prior.includes(
              j ? 'Die Bruderschaft bewacht das Signalfeuer' : 'hat Ada heimlich übergesetzt',
            ) ||
            !addition.includes(j ? 'Sprecher Varo' : 'freiwillig')
          )
            throw Error('Wrong original or selected supplement');
          await page.locator('#note-excerpt-save').scrollIntoViewIfNeeded();
          await shot('existing-original-choice-' + j);
          await page.locator('#note-excerpt-save').click();
          await page.locator('#note-excerpt-dialog').waitFor({ state: 'hidden' });
          await page
            .locator('#note-excerpt-status')
            .getByRole('button', { name: 'Originalnotiz öffnen', exact: true })
            .waitFor();
          if (
            (await page.locator('#note-title').inputValue()) !==
              'Zweite Nacht am Grauen Ufer · Rohprotokoll' ||
            (await a.inputValue()) !== raw2
          )
            throw Error('Source editor or raw text changed');
          await page
            .locator('#note-relations')
            .getByRole('button', { name: 'Auszug: ' + title, exact: true })
            .waitFor();
          followupUpdates.push({
            title,
            prior,
            addition,
            receipt: await page.locator('#note-excerpt-status').innerText(),
          });
          await writeFile(
            out + '/existing-note-updates.json',
            JSON.stringify(followupUpdates, null, 2),
          );
        }
      }
      // Full GM task phase 2
      {
        const a = page.locator('#note-gm');
        await a.click();
        await a.press('Control+Home');
        for (let k = 0; k < 6; k++) await a.press('Control+ArrowDown');
        await a.press('Control+Shift+ArrowDown');
        await page.locator('#note-excerpt').click();
        await page.locator('#note-excerpt-kind').selectOption('quest');
        await page.locator('#note-excerpt-title').fill('Der Schrank in der Salzscheune');
        await page.locator('#note-excerpt-save').click();
        await page.locator('#note-excerpt-dialog').waitFor({ state: 'hidden' });
        await page
          .locator('#note-excerpt-status')
          .getByText('Neue Notiz öffnen', { exact: true })
          .waitFor();
        await page.locator('#note-thread-prepare').click();
        const review = page.locator('#note-thread-review');
        if ((await review.isVisible()) && !(await review.evaluate((node) => node.open)))
          await review.locator(':scope > summary').click();
        await page
          .locator('#note-thread-sources')
          .getByText('Der Schrank in der Salzscheune', { exact: true })
          .waitFor();
        await shot('followup-three-originals');
        await page.locator('#note-thread-plan').selectOption('');
        await page.locator('#note-thread-plan-name').fill('Die Salzscheune');
        await page
          .locator('#note-thread-visit-title')
          .fill('Siv, Varo und der verschlossene Schrank');
        await page.locator('#note-thread-use').click();
        await page.locator('#note-thread-dialog').waitFor({ state: 'hidden' });
        await page.locator('#session-packet-open').click();
        await page.locator('#session-packet-dialog').waitFor({ state: 'visible' });
        const text = await page.locator('#session-packet-dialog').innerText();
        for (const expected of [
          'hat Ada heimlich übergesetzt',
          'Ihr Bruder lebt',
          'Die Bruderschaft bewacht das Signalfeuer',
          'Sprecher Varo',
          'versiegelte Schatulle',
        ])
          if (!text.includes(expected)) throw Error('Missing original/followup ' + expected);
        await writeFile(out + '/next-evening-before-fresh.txt', text);
        await page.locator('#session-packet-close').click();
        console.log(await close());
        console.log((await launch()).slice(0, 1000));
      }
      // Full GM task phase 3
      {
        await page.getByRole('button', { name: 'Fortsetzen', exact: true }).click();
        await tab('#preparation-tab');
        await page.locator('#preparation-knowledge').click();
        globalThis.followupFresh = [];
        for (const [title, query, extra] of [
          [
            'Siv die Fährfrau',
            'freiwillig',
            'Dritte Nacht: Siv will Varo nur in einer Gruppe begegnen.',
          ],
          [
            'Bruderschaft vom Grauen Ufer',
            'Sprecher Varo',
            'Dritte Nacht: Den Tausch mit Varo am Fährsteg besprechen.',
          ],
          [
            'Der Schrank in der Salzscheune',
            'versiegelte Schatulle',
            'Dritte Nacht: Schloss und Schatulle getrennt untersuchen.',
          ],
        ]) {
          await findNote(title, query);
          const a = page.locator('#note-gm');
          await a.press('Control+End');
          await a.press('Enter');
          await a.press('Enter');
          await page.keyboard.type(extra, { delay: 5 });
          await page.locator('#note-title').click();
          followupFresh.push({
            title,
            query,
            extra,
            body: await a.inputValue(),
            relations: await page.locator('#note-relations').innerText(),
          });
          await writeFile(out + '/fresh-edits.json', JSON.stringify(followupFresh, null, 2));
        }
        await page
          .locator('#note-relations')
          .getByRole('button', {
            name: 'Quelle: Zweite Nacht am Grauen Ufer · Rohprotokoll',
            exact: true,
          })
          .click();
        await page.waitForFunction(
          () =>
            document.getElementById('note-title').value ===
            'Zweite Nacht am Grauen Ufer · Rohprotokoll',
        );
        if ((await page.locator('#note-gm').inputValue()) !== raw2)
          throw Error('Second original log changed');
        await page.locator('#preparation-planning').click();
        await page.locator('#plans').selectOption({ label: 'Die Salzscheune' });
        await page.locator('#session-packet-open').click();
        await page.locator('#session-packet-dialog').waitFor({ state: 'visible' });
        const text = await page.locator('#session-packet-dialog').innerText();
        for (const x of followupFresh)
          if (!text.includes(x.extra)) throw Error('Missing updated reuse ' + x.title);
        await writeFile(out + '/fresh-next-evening.txt', text);
        await shot('fresh-next-evening');
        await page.locator('#session-packet-close').click();
        await page.locator('#plans').selectOption({ label: 'Nächste Flut' });
        await page.locator('#session-packet-open').click();
        await page.locator('#session-packet-dialog').waitFor({ state: 'visible' });
        const old = await page.locator('#session-packet-dialog').innerText();
        if (!old.includes(followupFresh[0].extra) || !old.includes(followupFresh[1].extra))
          throw Error('Old usage lost originals');
        await writeFile(out + '/fresh-old-visit-live-originals.txt', old);
        await page.locator('#session-packet-close').click();
        console.log(await close());
        console.log({ fullTask: true, oldVisitLiveOriginals: true, errors });
      }
      // Full GM task phase 4
      {
        const before = JSON.parse(await readFile(out + '/starting-state.json', 'utf8')),
          db = require('better-sqlite3')(file, { readonly: true });
        let audit;
        try {
          const notes = db
              .prepare('SELECT payload FROM world_note WHERE campaign_id=? AND trashed=0')
              .all(campaign.id)
              .map((r) => JSON.parse(r.payload)),
            rawNew = notes.find((n) => n.title === 'Zweite Nacht am Grauen Ufer · Rohprotokoll'),
            quest = notes.find((n) => n.title === 'Der Schrank in der Salzscheune'),
            sourceOld = notes.find((n) => n.id === sourceNote.id);
          if (notes.length !== 7 || sourceOld.gmNotes !== raw || rawNew.gmNotes !== raw2)
            throw Error('Original log/identity audit mismatch');
          for (const title of ['Siv die Fährfrau', 'Bruderschaft vom Grauen Ufer']) {
            const old = before.notes.find((n) => n.title === title),
              now = notes.filter((n) => n.title === title);
            if (
              now.length !== 1 ||
              now[0].id !== old.id ||
              !now[0].gmNotes.startsWith(old.gmNotes) ||
              !now[0].relations.some((r) => r.targetId === sourceNote.id) ||
              !now[0].relations.some((r) => r.targetId === rawNew.id)
            )
              throw Error('Original reuse/provenance mismatch ' + title);
          }
          for (const row of before.plans) {
            const now = db
              .prepare('SELECT * FROM plan WHERE campaign_id=? AND id=?')
              .get(campaign.id, row.id);
            if (JSON.stringify(row) !== JSON.stringify(now)) throw Error('Old plan changed');
          }
          for (const row of before.visits) {
            const now = db
              .prepare('SELECT * FROM planned_visit WHERE campaign_id=? AND id=?')
              .get(campaign.id, row.id);
            if (JSON.stringify(row) !== JSON.stringify(now)) throw Error('Old visit changed');
          }
          for (const row of before.details) {
            const now = db
              .prepare('SELECT * FROM session_visit WHERE campaign_id=? AND id=?')
              .get(campaign.id, row.id);
            if (JSON.stringify(row) !== JSON.stringify(now))
              throw Error('Old visit references changed');
          }
          const plans = db.prepare('SELECT * FROM plan WHERE campaign_id=?').all(campaign.id),
            details = db
              .prepare('SELECT payload FROM session_visit WHERE campaign_id=?')
              .all(campaign.id)
              .map((r) => JSON.parse(r.payload));
          if (
            plans.length !== 2 ||
            details.length !== 2 ||
            !details.some(
              (d) =>
                d.noteIds.length === 4 &&
                d.noteIds.includes(rawNew.id) &&
                d.noteIds.includes(quest.id),
            )
          )
            throw Error('New evening sources mismatch');
          audit = {
            notes: notes.map((n) => ({
              id: n.id,
              title: n.title,
              kind: n.kind,
              revision: n.revision,
              relations: n.relations,
            })),
            twoRawLogsExact: true,
            oldNpcAndFactionIdentityAndRawPrefixPreserved: true,
            oldPlanVisitAndBindingsExact: true,
            newEvening4Sources: true,
          };
        } finally {
          db.close();
        }
        const result = {
          complete: true,
          source,
          dirty,
          hashes,
          profile,
          file,
          task: 'Secondsessionlog updatesexistingNPC/faction withdatedchanges andprovenance,keepsoldlog/statements/visitreferences,createsnewquest,nextplan,Freshcontentfind/edit andbothold/newliveuses',
          raw2,
          followupUpdates,
          followupFresh,
          audit,
          launches,
          errors,
          humanAcceptance: false,
          installedPackageAcceptance: false,
          zoom: 1,
          completedAt: new Date().toISOString(),
        };
        if (errors.length || launches.some((l) => l.exit?.code !== 0 || !l.mainPidAbsent))
          throw Error('Native UI/process error');
        await native.recordResult(result);
        console.log({ complete: true, audit, launches, errors });
      }
    } catch (error) {
      if (nativeProcess?.exitCode === null) await shot('failure-visible-state').catch(() => {});
      await writeFile(
        out + '/failure.json',
        JSON.stringify({ error: error.stack, source, dirty, profile, launches, errors }, null, 2),
      );
      throw error;
    } finally {
      if (nativeProcess?.exitCode === null) await close();
    }
  },
);
