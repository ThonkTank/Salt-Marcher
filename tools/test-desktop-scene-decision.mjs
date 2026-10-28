import { revealWorkspaceNavigation } from './native-navigation.mjs';
import { runNativeProbe } from './native-session.mjs';
import { openDesktopKeyReferences } from './qa-key-entry.mjs';
import { createRequire } from 'node:module';
import { readFile, writeFile, mkdtemp, mkdir, stat } from 'node:fs/promises';
import { spawn, execFileSync } from 'node:child_process';
import { createHash } from 'node:crypto';
import path from 'node:path';
import os from 'node:os';
import {
  selectDesktopKeyRoom,
  searchDesktopKeyRooms,
  openDesktopKeyFromAtlas,
} from './qa-key-entry.mjs';
const root = process.cwd(),
  require = createRequire(root + '/package.json'),
  { _electron } = require('playwright-core');
if (!process.env.GM_QA_OUT || !process.env.GM_QA_START_RESULT)
  throw Error(
    'Set GM_QA_OUT to a new directory and GM_QA_START_RESULT to the normally closed case27 room-key result.',
  );
const out = process.env.QA_EVIDENCE_DIR ?? path.resolve(process.env.GM_QA_OUT);
await runNativeProbe(
  { output: out, name: 'scene-decision', resultName: 'result.json' },
  async (native) => {
    await mkdir(out, { recursive: true });
    const resultPath = path.resolve(process.env.GM_QA_START_RESULT),
      completed = JSON.parse(await readFile(resultPath, 'utf8')),
      initial = JSON.parse(await readFile(path.dirname(resultPath) + '/fixture.json', 'utf8'));
    if (!completed.complete || completed.launches?.some((l) => !l.pidAbsent || l.exit?.code !== 0))
      throw Error('Starting fixture was not normally closed.');
    const profile = native.profile,
      file = profile + '/workbench.sqlite';
    // A normal exit can leave committed pages in WAL; copy the complete snapshot.
    const incoming = require('better-sqlite3')(completed.file, { readonly: true });
    try {
      await incoming.backup(file);
    } finally {
      incoming.close();
    }
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
    await writeFile(
      out + '/fixture.json',
      JSON.stringify(
        { source, dirty, profile, file, campaign, rooms, sourceNote, raw, hashes },
        null,
        2,
      ),
    );

    let app, page, nativeProcess;
    const launches = [],
      errors = [],
      captures = [],
      freshUses = [],
      finalUses = [],
      searchChecks = [];
    const zoom = 1,
      title = 'Abmachung am Schrank · Dritte Nacht',
      decision =
        '23:10 – Die Gruppe lässt den Schrank verschlossen. Beim nächsten Treffen soll Siv ohne Varo befragt werden. Das Siegel bleibt unbestätigt.',
      publicLine = 'Siv schiebt die Laterne zur Seite. „Erst ohne Varo.“',
      followup = '23:25 – Ada übernimmt die Nachricht; Varo bleibt an der Salzscheune.';
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
    }
    async function launch() {
      app = await native.launchConfigured({
        executablePath: root + '/node_modules/electron/dist/electron',
        args: [root + '/.build/desktop/main.cjs', '--ozone-platform=x11', '--data-dir', profile],
      });
      nativeProcess = app.process();
      launches.push({ pid: nativeProcess.pid });
      page = await app.firstWindow();
      page.setDefaultTimeout(25000);
      page.on('pageerror', (e) => errors.push(e.stack));
      await app.evaluate(
        ({ BrowserWindow }, z) =>
          BrowserWindow.getAllWindows()
            .find((w) => w.webContents.getURL().endsWith('/index.html'))
            .webContents.setZoomFactor(z),
        zoom,
      );
      await page.waitForFunction(() => document.body.dataset.tutorialReady === 'true');
      if (await page.locator('#tutorial-dialog').isVisible())
        await page.locator('#tutorial-skip').click();
      await page.getByRole('button', { name: 'Fortsetzen', exact: true }).click();
      await revealWorkspaceNavigation(page);
    }
    async function tab(id) {
      await revealWorkspaceNavigation(page);
      if (!(await page.locator(id).isVisible()))
        await page.locator('#workspace-nav-summary').click();
      await page.locator(id).click();
    }
    async function key() {
      await tab('#atlas-tab');
      await openDesktopKeyFromAtlas(page, 'Fährsteg');
      await page.locator('#key-dialog').waitFor({ state: 'visible' });
    }
    async function room(name) {
      await selectDesktopKeyRoom(page, name);
      await page.waitForFunction((t) => document.getElementById('key-name').value === t, name);
    }
    async function referencePanel() {
      await openDesktopKeyReferences(page);
    }
    async function back() {
      await page.locator('#key-reference-return').click();
      await page.locator('#key-reference-panel').waitFor({ state: 'hidden' });
    }
    async function note() {
      await referencePanel();
      await page
        .locator('#key-references')
        .getByRole('button', { name: title, exact: true })
        .click();
      await page.waitForFunction((t) => document.getElementById('note-title').value === t, title);
    }
    async function packet(prefix, expected) {
      await tab('#preparation-tab');
      await page.locator('#preparation-planning').click();
      await page.locator('#plans').selectOption({ label: 'Unter vier Augen' });
      await page.locator('#session-packet-open').click();
      await page.waitForFunction(
        (t) => document.getElementById('session-packet-dialog').innerText.includes(t),
        expected,
      );
      const text = await page.locator('#session-packet-dialog').innerText();
      for (const t of [
        title,
        decision,
        publicLine,
        'Siv die Fährfrau',
        'Der Schrank in der Salzscheune',
      ])
        if (!text.includes(t)) throw Error('Packet incomplete: ' + t);
      await writeFile(out + '/' + prefix + '-evening.txt', text);
      await page
        .locator('#session-packet-content .packet-runway button')
        .filter({ hasText: title })
        .click();
      await page.waitForFunction((t) => {
        const e = [...document.querySelectorAll('#session-packet-content h4')]
          .find((e) => e.textContent === t)
          ?.closest('.packet-block');
        return (
          !!e &&
          e.textContent.includes('GM · Notiz') &&
          e.getBoundingClientRect().top >= 0 &&
          e.getBoundingClientRect().top < innerHeight
        );
      }, title);
      await shot(prefix + '-evening');
      await page.locator('#session-packet-close').click();
    }
    async function bothRooms(prefix, expected, checks) {
      await key();
      searchChecks.push(
        await searchDesktopKeyRooms(page, 'Abmachung', ['Fährsteg', 'Salzscheune']),
      );
      for (const name of ['Fährsteg', 'Salzscheune']) {
        await room(name);
        await note();
        const body = await page.locator('#note-gm').inputValue();
        if (
          body !== expected ||
          (await page.locator('#note-read-aloud').inputValue()) !== publicLine
        )
          throw Error('Room original mismatch: ' + name);
        checks.push({ room: name, body });
        await page.locator('#note-gm').click();
        await page.locator('#note-gm').press('Control+End');
        await shot(prefix + '-' + (name === 'Fährsteg' ? 'faehrsteg' : 'salzscheune'));
        await back();
      }
      await page.locator('#key-close').click();
    }
    function audit() {
      const db = require('better-sqlite3')(file, { readonly: true }),
        old = require('better-sqlite3')(completed.file, { readonly: true });
      try {
        const rows = (d, t) => d.prepare('SELECT * FROM ' + t + ' ORDER BY id').all(),
          before = rows(old, 'world_note'),
          after = rows(db, 'world_note'),
          added = after.filter((r) => !before.some((p) => p.id === r.id));
        if (after.length !== 8 || added.length !== 1) throw Error('Expected one decision original');
        for (const b of before)
          if (after.find((n) => n.id === b.id)?.payload !== b.payload)
            throw Error('Prior note changed');
        const originals = ['Siv die Fährfrau', 'Der Schrank in der Salzscheune'].map((title, i) => {
          const matches = before
            .map((row) => JSON.parse(row.payload))
            .filter((note) => note.title === title && note.kind === (i ? 'quest' : 'npc'));
          if (matches.length !== 1)
            throw Error('Starting fixture original is not unique: ' + title);
          return matches[0];
        });
        const n = JSON.parse(added[0].payload);
        if (
          n.kind !== 'note' ||
          n.title !== title ||
          n.readAloud !== publicLine ||
          n.gmNotes !== decision + '\n\n' + followup ||
          n.relations.length !== 2 ||
          !originals.every((note) => n.relations.some((relation) => relation.targetId === note.id))
        )
          throw Error('Decision payload mismatch');
        for (const t of ['room', 'plan', 'planned_visit', 'session_visit'])
          for (const b of rows(old, t)) {
            const now = rows(db, t).find((r) => r.id === b.id);
            if (
              JSON.stringify(t === 'room' ? { ...now, revision: b.revision } : now) !==
              JSON.stringify(b)
            )
              throw Error('Old row changed ' + t);
          }
        for (const b of rows(old, 'dungeon_key_content')) {
          const now = JSON.parse(
              rows(db, 'dungeon_key_content').find((r) => r.id === b.id).payload,
            ),
            prior = JSON.parse(b.payload);
          if (
            now.references.length !== prior.references.length + 1 ||
            !now.references.some((r) => r.id === n.id && r.kind === 'note')
          )
            throw Error('Missing typed room reference');
          if (
            JSON.stringify({ ...now, revision: prior.revision, references: prior.references }) !==
              JSON.stringify(prior) ||
            JSON.stringify(now.references.filter((r) => r.id !== n.id)) !==
              JSON.stringify(prior.references)
          )
            throw Error('Prior key content changed');
        }
        const plans = rows(db, 'plan').filter((r) => !rows(old, 'plan').some((o) => o.id === r.id)),
          visits = rows(db, 'session_visit').filter(
            (r) => !rows(old, 'session_visit').some((o) => o.id === r.id),
          );
        if (
          plans.length !== 1 ||
          plans[0].name !== 'Unter vier Augen' ||
          visits.length !== 1 ||
          !visits[0].payload.includes(n.id)
        )
          throw Error('Next evening original binding mismatch');
        return {
          decisionNote: n,
          sevenPriorNotesExact: true,
          oneGenericDecisionOriginal: true,
          existingRoomGeometryAndKeyProseExact: true,
          onlyDecisionRefAddedToEachKey: true,
          oldPlansVisitsExact: true,
          newPlanVisitLinksOriginal: true,
          schema: db.pragma('user_version', { simple: true }),
        };
      } finally {
        db.close();
        old.close();
      }
    }
    try {
      await launch();
      await key();
      await room('Salzscheune');
      await page.getByRole('button', { name: 'Notiz zum Raum…', exact: true }).click();
      if ((await page.locator('#key-note-kind').inputValue()) !== 'note')
        throw Error('General note is not the neutral capture type');
      await page.locator('#key-note-title').fill(title);
      await page.locator('#key-note-gm').fill(decision);
      await shot('direct-generic-capture');
      await page.locator('#key-note-submit').click();
      await page.locator('#key-note-capture-dialog').waitFor({ state: 'hidden' });
      await page.waitForFunction((t) => document.getElementById('note-title').value === t, title);
      if (!(await page.locator('#note-read-aloud').isVisible()))
        await page.locator('#note-read-aloud-summary').click();
      await page.locator('#note-read-aloud').fill(publicLine);
      for (const target of ['Siv die Fährfrau', 'Der Schrank in der Salzscheune']) {
        await page.locator('#relation-target').selectOption({ label: target });
        await page.locator('#relation-label').fill('betrifft');
        await page.locator('#relation-add').click();
        await page
          .locator('#note-relations')
          .getByRole('button', { name: 'betrifft: ' + target, exact: true })
          .waitFor();
      }
      captures.push({ room: 'Salzscheune', createdDirectly: true, kind: 'note' });
      await back();
      await room('Fährsteg');
      await page.getByRole('button', { name: 'Notiz zum Raum…', exact: true }).click();
      await page.locator('#key-note-title').fill(title);
      await page.locator('#key-note-existing button').filter({ hasText: title }).click();
      if ((await page.locator('#key-note-kind').inputValue()) !== 'note')
        throw Error('Existing general note lost its type');
      await page.locator('#key-note-gm').fill('');
      await shot('reuse-same-generic-original');
      await page.locator('#key-note-submit').click();
      await page.locator('#key-note-capture-dialog').waitFor({ state: 'hidden' });
      await page.waitForFunction((t) => document.getElementById('note-title').value === t, title);
      if (
        (await page.locator('#note-gm').inputValue()) !== decision ||
        (await page.locator('#note-read-aloud').inputValue()) !== publicLine
      )
        throw Error('Reuse modified original');
      captures.push({ room: 'Fährsteg', reusedOriginal: true, kind: 'note' });
      await page.getByRole('button', { name: 'Notizmappe öffnen…', exact: true }).click();
      await page.locator('#note-thread-dialog').waitFor({ state: 'visible' });
      await page.locator('#note-thread-plan').selectOption('');
      await page.locator('#note-thread-plan-name').fill('Unter vier Augen');
      await page.locator('#note-thread-visit-title').fill('Gespräch am Fährsteg');
      await page.locator('#note-thread-use').click();
      await page.locator('#note-thread-dialog').waitFor({ state: 'hidden' });
      await back();
      await page.locator('#key-close').click();
      await packet('before-fresh', decision);
      await close();
      await launch();
      await tab('#preparation-tab');
      await page.locator('#preparation-knowledge').click();
      await page.locator('#world-search').fill('Beim nächsten Treffen');
      await page
        .locator('#world-list')
        .getByRole('button', { name: new RegExp('^' + title) })
        .click();
      await page.waitForFunction((t) => document.getElementById('note-title').value === t, title);
      if ((await page.locator('#note-gm').inputValue()) !== decision)
        throw Error('Fresh original mismatch');
      await page.locator('#note-gm').click();
      await page.locator('#note-gm').press('Control+End');
      await page.locator('#note-gm').press('Enter');
      await page.locator('#note-gm').press('Enter');
      await page.keyboard.type(followup);
      await bothRooms('fresh', decision + '\n\n' + followup, freshUses);
      await packet('fresh', followup);
      await close();
      await launch();
      await bothRooms('reopened', decision + '\n\n' + followup, finalUses);
      await packet('reopened', followup);
      await close();
      const checked = audit();
      if (errors.length || launches.some((l) => l.exit?.code !== 0 || !l.mainPidAbsent))
        throw Error('UI/process lifecycle mismatch');
      const result = {
        complete: true,
        source,
        dirty,
        hashes,
        profile,
        file,
        campaign,
        rooms,
        task: 'Record session decision directly in room as a general note; reuse same original in second room and next evening; normalFresh content refind and append; both rooms and session use update; second normalFresh confirms persistence.',
        title,
        decision,
        publicLine,
        followup,
        captures,
        freshUses,
        finalUses,
        searchChecks,
        launches,
        errors,
        audit: checked,
        zoom,
        humanAcceptance: false,
        installedPackageAcceptance: false,
        completedAt: new Date().toISOString(),
      };
      await native.recordResult(result);
      console.log(
        JSON.stringify({ complete: true, out, source, launches, errors, audit: checked }),
      );
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
