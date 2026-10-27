import { revealWorkspaceNavigation } from './native-navigation.mjs';
import { runNativeProbe } from './native-session.mjs';
import { createRequire } from 'node:module';
import { mkdtemp, mkdir, readFile, writeFile, stat } from 'node:fs/promises';
import { spawn, execFileSync } from 'node:child_process';
import { randomUUID, createHash } from 'node:crypto';
import assert from 'node:assert/strict';
import path from 'node:path';
const root = process.cwd();
const zoom = process.argv.includes('--zoom') ? 2 : 1;
const out =
  process.env.QA_EVIDENCE_DIR ??
  process.argv.find((v) => v.startsWith('--out='))?.slice(6) ??
  root + '/.build/qa/packet-original' + (zoom === 2 ? '-zoom' : '');
await runNativeProbe({ output: out, name: 'packet-original' }, async (native) => {
  await mkdir(out, { recursive: true });
  const sourceAtStart = execFileSync('git', ['rev-parse', 'HEAD'], { encoding: 'utf8' }).trim(),
    dirtyAtStart = execFileSync('git', ['status', '--short'], { encoding: 'utf8' }).trim();
  const require = createRequire(root + '/package.json'),
    { _electron } = require('playwright-core');
  require('esbuild').buildSync({
    entryPoints: ['src/app/storage/store.ts'],
    outfile: '.build/note-packet-original-store.cjs',
    bundle: true,
    platform: 'node',
    format: 'cjs',
    external: ['better-sqlite3'],
  });
  const { CampaignStore } = require(root + '/.build/note-packet-original-store.cjs');
  const profile = native.profile,
    file = profile + '/workbench.sqlite',
    make = (title, kind, gmNotes) => ({
      version: 1,
      id: randomUUID(),
      revision: 1,
      title,
      kind,
      gmNotes,
      readAloud: '  Die Glocke über dem Tor schlägt.\r\n',
      relations: [],
      creatureId: null,
      deleted: false,
    });
  const nera = make('Nera · Wachbericht', 'npc', 'Nera kennt den Ablauf des Wachwechsels.'),
    personal = make(
      'Eigene Spielnotiz · Glockentor',
      'rule',
      'Die Gruppe möchte die Warteschlange umgehen.',
    ),
    link = '[Nera](dungeon-ref:note/' + nera.id + ')';
  const raw =
    '# Das Glockentor\r\n\r\n## Lage und Zuständigkeiten\r\n\r\n' +
    Array.from(
      { length: 12 },
      (_, i) =>
        '### Station ' +
        (i + 1) +
        '\r\n\r\nDie Posten prüfen Lieferlisten und sprechen Fremde einzeln an. Die Gruppe kann hier nach dem zuständigen Wachposten fragen.\r\n',
    ).join('\r\n') +
    '\r\n## Dritter Glockenschlag\r\n\r\n| Signal | Zuständig | Reaktion |\r\n| --- | --- | --- |\r\n| Ein Schlag | Torwache | Warteschlange bleibt bestehen. |\r\n| Drei Schläge | ' +
    link +
    ' | Nera bleibt am Westtor. |\r\n\r\n- [ ] Erkennungszeichen prüfen\r\n- [ ] Lieferliste vergleichen\r\n\r\n> Nicht vorlesen: Der Lieferbote kennt das Zeichen bereits.\r\n\r\n## Nach dem Besuch\r\n\r\nDie persönlichen Absprachen im Besuch bleiben bestehen.\r\n';
  const guide = make('Das Glockentor · Einsatznotizen', 'quest', raw),
    updated = raw.replace('Nera bleibt am Westtor.', 'Nera wartet jetzt im Wachraum.'),
    plan = {
      version: 1,
      id: randomUUID(),
      revision: 1,
      name: 'Abend 16 · Glockentor',
      scenes: ['Vorher am Kai', 'Dritter Glockenschlag am Tor'].map((title) => ({
        id: randomUUID(),
        title,
        notes: '  Eigener Besuchsrahmen\r\nbleibt bestehen.\r\n',
        locationId: null,
      })),
    },
    target = plan.scenes[1];
  const store = new CampaignStore(file),
    campaign = store.create('Spielabend lesen und das Original ergänzen'),
    w = store.activate(campaign.id),
    command = (action) => ({
      commandId: randomUUID(),
      campaignId: campaign.id,
      token: w.token,
      action,
    });
  for (const note of [nera, personal, guide])
    store.changePreparation({
      ...command(null),
      change: { kind: 'note', expectedRevision: null, note },
    });
  store.changePreparation({
    ...command(null),
    change: { kind: 'plan', expectedRevision: null, plan },
  });
  const visit = store.session(w.token, plan.id).visits[1];
  store.executeSession(
    command({
      kind: 'visit',
      planId: plan.id,
      expectedRevision: visit.revision,
      detail: { ...visit, readAloud: '  Eigene Begrüßung\r\n', noteIds: [personal.id, guide.id] },
    }),
  );
  const before = store.session(w.token, plan.id);
  store.close();
  await writeFile(
    out + '/fixture.json',
    JSON.stringify(
      { profile, campaign, notes: { nera, personal, guide }, plan, target, updated },
      null,
      2,
    ),
  );

  let app,
    closed = true;
  const launches = [],
    errors = [],
    result = {},
    hashes = {};
  for (const rel of ['main.cjs', 'preload.cjs', 'ui/renderer.js', 'ui/index.html', 'ui/app.css'])
    hashes[rel] = createHash('sha256')
      .update(await readFile(root + '/.build/desktop/' + rel))
      .digest('hex');
  async function launch() {
    app = await native.launchConfigured({
      executablePath: root + '/node_modules/electron/dist/electron',
      args: [root + '/.build/desktop/main.cjs', '--ozone-platform=x11', '--data-dir', profile],
    });
    closed = false;
    launches.push({ pid: app.process().pid });
    const page = await app.firstWindow();
    await app.evaluate(
      ({ BrowserWindow }, z) =>
        BrowserWindow.getAllWindows()
          .find((w) => w.webContents.getURL().endsWith('/index.html'))
          .webContents.setZoomFactor(z),
      zoom,
    );
    page.setDefaultTimeout(15000);
    page.on('pageerror', (e) => errors.push(e.stack));
    await page.waitForFunction(() => document.body.dataset.tutorialReady === 'true');
    if (await page.locator('#tutorial-dialog').isVisible())
      await page.locator('#tutorial-skip').click();
    await page
      .locator('#campaign-screen-list article')
      .filter({ hasText: campaign.name })
      .getByRole('button', { name: 'Fortsetzen', exact: true })
      .click();
    await revealWorkspaceNavigation(page);
    if (!(await page.locator('#preparation-tab').isVisible()))
      await page.locator('#workspace-nav-summary').click();
    await page.locator('#preparation-tab').click();
    await page.locator('#preparation-planning').click();
    await page.locator('#plans').selectOption({ label: plan.name });
    await page.locator('#scene-list button').filter({ hasText: target.title }).click();
    return page;
  }
  async function packet(page) {
    await page.locator('#session-packet-open').click();
    await page.waitForFunction(
      () =>
        document.querySelector('#session-packet-dialog').open &&
        document.querySelector('#session-packet-dialog').getAttribute('aria-busy') === 'false',
    );
    return page
      .locator('#session-packet-content .packet-block')
      .filter({ has: page.getByRole('heading', { name: guide.title + ' · quest', exact: true }) });
  }
  async function shot(page, name) {
    if (zoom === 1) await page.screenshot({ path: out + '/' + name + '.png' });
    else {
      const data = await app.evaluate(async ({ BrowserWindow }) =>
        (
          await BrowserWindow.getAllWindows()
            .find((w) => w.webContents.getURL().endsWith('/index.html'))
            .webContents.capturePage()
        )
          .toPNG()
          .toString('base64'),
      );
      await writeFile(out + '/' + name + '.png', Buffer.from(data, 'base64'));
    }
  }
  async function visible(page, phrase) {
    return page.locator('#session-packet-content').evaluate((el, phrase) => {
      const b = el.getBoundingClientRect(),
        dialog = el.closest('dialog').getBoundingClientRect();
      let top = Math.max(b.top, dialog.top, 0),
        bottom = Math.min(b.bottom, dialog.bottom, window.innerHeight);
      const runway = el.querySelector('.packet-runway')?.getBoundingClientRect();
      if (runway && runway.top < bottom && runway.bottom > top) top = Math.max(top, runway.bottom);
      const walk = document.createTreeWalker(el, NodeFilter.SHOW_TEXT);
      let n;
      while ((n = walk.nextNode())) {
        const at = n.textContent.indexOf(phrase);
        if (at < 0) continue;
        const footer = n.parentElement
          .closest('.packet-block')
          ?.querySelector('.packet-source-actions')
          ?.getBoundingClientRect();
        if (footer && footer.top < bottom && footer.bottom > top)
          bottom = Math.min(bottom, footer.top);
        const r = document.createRange();
        r.setStart(n, at);
        r.setEnd(n, at + phrase.length);
        const a = r.getBoundingClientRect();
        return a.top > top && a.bottom < bottom;
      }
      return false;
    }, phrase);
  }
  async function readCondition(page, block, phrase, name) {
    const host = page.locator('#session-packet-content');
    let steps = 0;
    for (; steps < 20; steps++) {
      if (await visible(page, phrase)) break;
      const box = await host.boundingBox();
      await page.mouse.move(
        box.x + box.width / 2,
        Math.min(box.y + box.height - 90, (await page.evaluate(() => window.innerHeight)) - 90),
      );
      await page.mouse.wheel(0, 220);
      await page.waitForTimeout(120);
    }
    assert(steps < 20, 'Condition reached by actual scrolling');
    result[name + 'ScrollSteps'] = steps;
    await shot(page, name);
  }
  async function finish() {
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
    let page = await launch(),
      block = await packet(page);
    await page.locator('#session-packet-search').fill('Glockenschlag');
    await block.scrollIntoViewIfNeeded();
    await readCondition(page, block, 'Nera bleibt am Westtor.', 'initial-reading');
    assert.equal(
      await block.getByRole('columnheader', { name: 'Reaktion', exact: true }).count(),
      1,
    );
    assert.equal(await block.locator('table').count(), 1);
    result.semanticTable = true;
    const editor = await page.locator('#note-editor').elementHandle(),
      action = block.getByRole('button', { name: 'Original bearbeiten…', exact: true });
    result.sourceActionVisibleAtReadingPlace = await action.evaluate((el) => {
      const r = el.getBoundingClientRect(),
        d = el.closest('dialog').getBoundingClientRect();
      return r.top >= Math.max(d.top, 0) && r.bottom <= Math.min(d.bottom, window.innerHeight);
    });
    assert(
      result.sourceActionVisibleAtReadingPlace,
      'Direct source action visible without leaving the condition',
    );
    const previousPosition = await page.evaluate(() => ({
      inner: document.querySelector('#session-packet-content').scrollTop,
      outer: document.querySelector('#session-packet-dialog').scrollTop,
    }));
    result.readingPositionBeforeEdit = previousPosition;
    await action.click();
    await page.waitForFunction(
      () =>
        !document.querySelector('#packet-note-editor').hidden &&
        !document.querySelector('#packet-note-content').hidden &&
        !document.querySelector('#packet-note-return').disabled,
    );
    assert.equal(await page.locator('#note-title').inputValue(), guide.title);
    assert(await editor.evaluate((n) => n === document.getElementById('note-editor')));
    result.editorSearchSelection = await page.locator('#note-gm').evaluate((el) => ({
      text: el.value.slice(el.selectionStart, el.selectionEnd),
      scrollTop: el.scrollTop,
      focused: document.activeElement === el,
    }));
    assert.equal(result.editorSearchSelection.text, 'Glockenschlag');
    assert(result.editorSearchSelection.focused);
    assert(
      result.editorSearchSelection.scrollTop > 0,
      'Search match scrolled into the original textarea',
    );
    await shot(page, 'original-editor');
    await page.locator('#note-gm').evaluate((el) => {
      const phrase = 'Nera bleibt am Westtor.',
        at = el.value.indexOf(phrase);
      if (at < 0) throw Error('Textstelle fehlt');
      el.focus();
      el.setSelectionRange(at, at + phrase.length);
    });
    await page.keyboard.insertText('Nera wartet jetzt im Wachraum.');
    await page.locator('#packet-note-return').click();
    await page.waitForFunction(
      () =>
        document.querySelector('#packet-note-editor').hidden &&
        document.querySelector('#session-packet-dialog').getAttribute('aria-busy') === 'false',
    );
    assert.equal(await page.locator('#session-packet-search').inputValue(), 'Glockenschlag');
    assert((await page.locator('#session-packet-content h3').innerText()).includes(target.title));
    assert(await editor.evaluate((n) => n === document.getElementById('note-editor')));
    const returned = await page.evaluate(() => ({
      inner: document.querySelector('#session-packet-content').scrollTop,
      outer: document.querySelector('#session-packet-dialog').scrollTop,
    }));
    result.readingPositionAfterEdit = returned;
    assert(Math.abs(returned.inner - previousPosition.inner) <= 1);
    assert(Math.abs(returned.outer - previousPosition.outer) <= 1);
    assert(
      await visible(page, 'Nera wartet jetzt im Wachraum.'),
      'Updated condition visible on return without additional scrolling',
    );
    result.queryVisitEditorAndReadingPlaceRetained = true;
    await shot(page, 'returned-reading');
    await page.locator('#session-packet-close').click();
    await page.locator('#preparation-knowledge').click();
    await page.locator('#world-search').fill(guide.title);
    await page
      .locator('#world-list')
      .getByRole('button', { name: guide.title, exact: true })
      .click();
    await page.waitForFunction(
      (t) => document.querySelector('#note-title').value === t,
      guide.title,
    );
    result.exactPastedTitleFindsSameOriginal = true;
    await finish();
    page = await launch();
    block = await packet(page);
    await block.scrollIntoViewIfNeeded();
    await readCondition(page, block, 'Nera wartet jetzt im Wachraum.', 'fresh-reading');
    await page.locator('#session-packet-close').click();
    await finish();
    const verify = new CampaignStore(file);
    try {
      const a = verify.activate(campaign.id),
        p = verify.preparation(a.token);
      assert.deepEqual(verify.session(a.token, plan.id), before);
      for (const n of [nera, personal, guide])
        assert.deepEqual(
          p.notes.find((r) => r.note.id === n.id).note,
          n === guide ? { ...guide, revision: 2, gmNotes: updated } : n,
        );
      result.onlyIntendedOriginalChangedWithRawCRLFPreserved = true;
    } finally {
      verify.close();
    }
    for (const l of launches) {
      let alive = false;
      try {
        process.kill(l.pid, 0);
        alive = true;
      } catch {}
      assert(!alive);
      l.mainPidAbsent = true;
    }
    assert.deepEqual(errors, []);
    await native.recordResult({
      source: sourceAtStart,
      dirty: dirtyAtStart,
      zoom,
      profile,
      result,
      launches,
      errors,
      hashes,
    });
    console.log(
      'COMPLETE after: source edited inside structured packet, query/visit/reading place retained, raw bytes preserved and fresh read',
    );
  } catch (error) {
    await writeFile(
      out + '/failure.json',
      JSON.stringify({ error: error.stack, result, launches, errors }, null, 2),
    );
    if (app && !closed)
      try {
        await shot(await app.firstWindow(), 'failure');
      } catch {}
    throw error;
  } finally {
    if (app && !closed) await native.close();
  }
});
