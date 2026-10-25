import { createRequire } from 'node:module';
import { randomUUID } from 'node:crypto';
import { createNativeSession } from './native-session.mjs';
import assert from 'node:assert/strict';

// Real Electron, a disposable profile, original note IDs and an existing session.
const root = process.cwd(),
  require = createRequire(root + '/package.json');
const out = process.env.QA_EVIDENCE_DIR ?? root + '/.build/note-reopen';
const native = await createNativeSession({ root, output: out, name: 'salt-note-reopen' });
let page,
  stage = 'fixture';
const results = [];
try {
  require('esbuild').buildSync({
    entryPoints: ['src/app/storage/store.ts'],
    outfile: '.build/note-reopen-store.cjs',
    bundle: true,
    platform: 'node',
    format: 'cjs',
    external: ['better-sqlite3'],
  });
  const { CampaignStore } = require(root + '/.build/note-reopen-store.cjs');
  const file = native.profile + '/workbench.sqlite';
  const store = new CampaignStore(file),
    campaign = store.create('Die zurückgekehrte Spur'),
    w = store.activate(campaign.id);
  const cmd = (action) => ({
    commandId: randomUUID(),
    campaignId: campaign.id,
    token: w.token,
    action,
  });
  const make = (title, kind, gmNotes) => ({
    version: 1,
    id: randomUUID(),
    revision: 1,
    title,
    kind,
    gmNotes,
    readAloud: '  Original zum Vorlesen\r\n',
    relations: [],
    creatureId: null,
    deleted: false,
  });
  const npc = make('Nera die Quartiermeisterin', 'npc', 'Nera verwahrt den Schlüssel.\r\n');
  const clue = make('Die wiedergefundenen Fässer', 'rumor', 'Die Lieferung galt als geklärt.\r\n');
  const other = make('Das blaue Siegel', 'rumor', 'Unabhängige offene Frage.\r\n');
  const background = Array.from({ length: 39 }, (_, i) =>
    make('Weitere Quelle ' + i, 'note', 'Unveränderte Hintergrundnotiz ' + i + '.\r\n'),
  );
  const inserted = Array.from({ length: 40 }, (_, i) =>
    make('Neu verknüpfte Quelle ' + i, 'note', 'Unveränderte zusätzliche Notiz ' + i + '.\r\n'),
  );
  const sourceText = (notes) =>
    notes.map((n) => '[' + n.title + '](dungeon-ref:note/' + n.id + ')').join(' ');
  const overview = make(
    'Die Aufzug-Verschwörung',
    'quest',
    'Die Übergabe beobachten.\r\n' + sourceText([npc, other, ...background, clue]),
  );
  const previousPlan = {
    version: 1,
    id: randomUUID(),
    revision: 1,
    name: 'Abend 8 · Nachtwache',
    scenes: [
      {
        id: randomUUID(),
        title: 'Die erste Lieferung',
        notes: 'Historischer Plan bleibt erhalten.\r\n',
        locationId: null,
      },
    ],
  };
  const plan = {
    version: 1,
    id: randomUUID(),
    revision: 1,
    name: 'Abend 9 · Die Rückkehr',
    scenes: [
      {
        id: randomUUID(),
        title: 'Die Wache erneut befragen',
        notes: '  Bisherige Planung\r\n',
        locationId: null,
      },
    ],
  };
  for (const note of [npc, clue, other, ...background, ...inserted, overview])
    store.changePreparation({
      ...cmd(null),
      change: { kind: 'note', expectedRevision: null, note },
    });
  store.changePreparation({
    ...cmd(null),
    change: { kind: 'plan', expectedRevision: null, plan: previousPlan },
  });
  store.changePreparation({ ...cmd(null), change: { kind: 'plan', expectedRevision: null, plan } });
  const visit = store.session(w.token, plan.id).visits[0];
  store.executeSession(
    cmd({
      kind: 'visit',
      planId: plan.id,
      expectedRevision: visit.revision,
      detail: { ...visit, noteIds: [other.id] },
    }),
  );
  const narrative = store.narrative(w.token, clue.id);
  store.executeProgress(
    cmd({
      kind: 'narrative-state',
      state: { ...narrative.state, status: 'closed' },
      expectedRevision: narrative.state.revision,
      expectedNoteRevision: clue.revision,
    }),
  );
  store.tutorial('skipped');
  store.close();
  let expectedOverview = overview;
  function resetOverview() {
    // Reset only between closed native sessions, so both zooms exercise a real insertion.
    const writer = new CampaignStore(file);
    try {
      const active = writer.activate(campaign.id);
      const current = writer
        .preparation(active.token)
        .notes.find((r) => r.note.id === overview.id).note;
      writer.changePreparation({
        commandId: randomUUID(),
        campaignId: campaign.id,
        token: active.token,
        change: {
          kind: 'note',
          expectedRevision: current.revision,
          note: { ...current, gmNotes: overview.gmNotes },
        },
      });
      expectedOverview = writer
        .preparation(active.token)
        .notes.find((r) => r.note.id === overview.id).note;
    } finally {
      writer.close();
    }
  }
  async function launch(scale) {
    page = await native.launch(scale);
    await page
      .locator('.campaign-card[data-campaign-id="' + campaign.id + '"]')
      .getByRole('button', { name: /Öffnen|Fortsetzen/ })
      .click();
    await page.waitForFunction(
      (id) =>
        document.getElementById('campaigns').value === id &&
        !document.getElementById('workspace-navigation').inert,
      campaign.id,
    );
    if (!(await page.locator('#preparation-tab').isVisible())) {
      if (await page.locator('#atlas-navigation').isVisible())
        await page.locator('#atlas-navigation').click();
      if (!(await page.locator('#preparation-tab').isVisible()))
        await page.locator('#workspace-nav-summary').click();
    }
    await page.locator('#preparation-tab').click();
    await page.locator('#preparation-knowledge').click();
    await page.locator('#world-search').fill(overview.title);
    await page
      .locator('#world-list')
      .getByRole('button', { name: overview.title, exact: true })
      .click();
    await page.waitForFunction(
      (title) => document.getElementById('note-title').value === title,
      overview.title,
    );
    await page.locator('#note-thread-open').click();
    await page.waitForFunction(
      () => document.querySelectorAll('#note-thread-sources article').length === 40,
    );
    await allSources();
  }
  async function allSources() {
    await page.waitForFunction(() => !document.getElementById('note-thread-active').disabled);
    while (await page.locator('#note-thread-more').isVisible()) {
      await page.locator('#note-thread-more').click();
      await page.waitForFunction(() => !document.getElementById('note-thread-active').disabled);
    }
  }
  const card = (id) => page.locator('#note-thread-sources article[data-note-id="' + id + '"]');
  async function edit(id) {
    await card(id).getByRole('button', { name: 'Notiz bearbeiten…', exact: true }).click();
    await page.waitForFunction(
      (title) =>
        document.querySelector('#note-thread-editor:not([hidden]) #note-title')?.value === title &&
        !document.getElementById('note-thread-return').disabled,
      [npc, clue].find((n) => n.id === id).title,
    );
  }
  async function back() {
    await page.locator('#note-thread-return').click();
    await page.waitForFunction(
      () =>
        document.getElementById('note-thread-editor').hidden &&
        !document.getElementById('note-thread-use').disabled,
    );
  }
  for (const scale of [1, 2]) {
    // Each scale must really reopen a closed source, including after the prior fresh edit.
    const reset = new CampaignStore(file);
    try {
      const current = reset.activate(campaign.id),
        narrative = reset.narrative(current.token, clue.id);
      if (narrative.state.status !== 'closed')
        reset.executeProgress({
          commandId: randomUUID(),
          campaignId: campaign.id,
          token: current.token,
          action: {
            kind: 'narrative-state',
            state: { ...narrative.state, status: 'closed' },
            expectedRevision: narrative.state.revision,
            expectedNoteRevision: narrative.noteRevision,
          },
        });
    } finally {
      reset.close();
    }
    if (scale === 2) resetOverview();
    stage = 'reopen and update originals at ' + scale;
    await launch(scale);
    await page.locator('#note-thread-active').uncheck();
    await page.waitForFunction(() => !document.getElementById('note-thread-active').disabled);
    await page.getByRole('button', { name: 'Quellenauswahl leeren', exact: true }).click();
    await allSources();
    await card(clue.id).waitFor();
    assert.match(await card(clue.id).innerText(), /Geschlossen/);
    // Explicitly exclude an unrelated source. Its existing visit link must survive.
    await card(npc.id).locator('input[type=checkbox]').check();
    assert.deepEqual(
      await page
        .locator('#note-thread-sources input[type=checkbox]')
        .evaluateAll((ns) => ns.filter((n) => n.checked).map((n) => n.value)),
      [npc.id],
    );
    assert(await page.locator('#note-thread-include-root').isChecked());
    await page.locator('#note-thread-clear-selection').scrollIntoViewIfNeeded();
    await native.capture(page, 'source-selection-' + scale + '.png');
    await edit(clue.id);
    const clueText =
      'Die Lieferung galt als geklärt.\nNeuer Hinweis ' +
      scale +
      ': Eine zweite Lieferung kommt um Mitternacht.';
    await page.locator('#note-gm').fill(clueText);
    await page.getByLabel('Narrativer Status', { exact: true }).selectOption('open');
    await page.getByRole('button', { name: 'Narrative Angaben speichern', exact: true }).click();
    await page.waitForFunction(
      () =>
        document.getElementById('status').textContent ===
        'Quest-/Gerüchtstatus und Belohnung gespeichert.',
    );
    await back();
    await card(clue.id).getByText('Gerücht · Offen', { exact: true }).waitFor();
    await card(clue.id).locator('input[type=checkbox]').check();
    await page.locator('#note-thread-plan').selectOption(plan.id);
    await page.locator('#note-thread-visit').selectOption(plan.scenes[0].id);
    await edit(npc.id);
    assert.equal(await page.locator('#note-thread-prepare').isVisible(), false);
    const npcText =
      'Nera verwahrt den Schlüssel.\nGespräch ' + scale + ': Sie erwartet die zweite Lieferung.';
    await page.locator('#note-gm').fill(npcText);
    if (scale === 1) {
      await page.locator('#note-gm').dispatchEvent('compositionstart');
      await page.locator('#note-thread-prepare-map').click();
      await page.waitForFunction(
        () =>
          !document.getElementById('note-thread-editor').hidden &&
          !document.getElementById('note-thread-return').disabled,
      );
      assert.equal(await page.locator('#note-title').inputValue(), npc.title);
      await page.locator('#note-gm').dispatchEvent('compositionend');
    }
    await native.capture(page, 'editor-' + scale + '.png');
    await page
      .getByRole('button', { name: 'Mit dieser Mappe zum Spielabend…', exact: true })
      .click();
    await page.waitForFunction(
      () =>
        document.getElementById('note-thread-editor').hidden &&
        !document.getElementById('note-thread-use').disabled,
    );
    assert.equal(
      await page.locator('#note-thread-heading').innerText(),
      'Notizmappe: ' + overview.title,
    );
    assert.equal(await page.locator('#note-thread-plan').inputValue(), plan.id);
    assert.equal(await page.locator('#note-thread-visit').inputValue(), plan.scenes[0].id);
    assert.equal(await page.locator('#note-thread-parent').isVisible(), false);
    await page.locator('#note-thread-clear-selection').scrollIntoViewIfNeeded();
    assert(
      await page.locator('#note-thread-clear-selection').evaluate((e) => {
        const r = e.getBoundingClientRect();
        return e.contains(document.elementFromPoint(r.x + r.width / 2, r.y + r.height / 2));
      }),
    );
    // Many loaded sources must not push the destination down by their full height.
    const sourceChoices = page.locator('#note-thread-source-choices');
    const sourceLayout = await sourceChoices.evaluate((el) => ({
      height: el.getBoundingClientRect().height,
      viewport: innerHeight,
      scrollHeight: el.scrollHeight,
      clientHeight: el.clientHeight,
    }));
    assert(
      sourceLayout.height <= sourceLayout.viewport * 0.25,
      'Source choices must leave room for the destination',
    );
    assert(
      sourceLayout.scrollHeight > sourceLayout.clientHeight,
      'Fixture must exercise an overflowing source list',
    );
    assert.equal(await sourceChoices.getAttribute('role'), 'group');
    assert.equal(await sourceChoices.getAttribute('aria-label'), 'Quellen für den Spielabend');
    const sourceBoxes = sourceChoices.locator('input[type=checkbox]');
    const sourceCount = await sourceBoxes.count();
    assert.equal(sourceCount, background.length + 3);
    await page.locator('#note-thread-include-root').focus();
    for (let i = 0; i < sourceCount; i++) {
      await page.keyboard.press('Tab');
      assert(
        await sourceBoxes.nth(i).evaluate((el) => document.activeElement === el),
        'Tab must reach every source in order',
      );
    }
    const keyboardScroll = await sourceChoices.evaluate((el) => {
      const box = el.getBoundingClientRect(),
        last = el.querySelector('label:last-child input').getBoundingClientRect();
      return { top: el.scrollTop, lastVisible: last.top >= box.top && last.bottom <= box.bottom };
    });
    assert(
      keyboardScroll.top > 0 && keyboardScroll.lastVisible,
      'Keyboard focus must reveal the last source',
    );
    await page.keyboard.press('Tab');
    assert(
      await page.locator('#note-thread-plan').evaluate((el) => document.activeElement === el),
      'The destination must follow the source choices',
    );
    await sourceChoices.evaluate((el) => (el.scrollTop = 0));
    await page.locator('#note-thread-dialog').evaluate((el) => (el.scrollTop = 0));
    await native.capture(page, 'handoff-' + scale + '.png');
    assert(await card(clue.id).locator('input[type=checkbox]').isChecked());
    assert(!(await card(other.id).locator('input[type=checkbox]').isChecked()));
    await page.locator('#note-thread-active').check();
    await allSources();
    await card(clue.id).waitFor();
    assert(await card(clue.id).locator('input[type=checkbox]').isChecked());
    await page.getByRole('button', { name: 'Übersichtsnotiz bearbeiten…', exact: true }).click();
    await page.waitForFunction(
      (title) =>
        document.querySelector('#note-thread-editor:not([hidden]) #note-title')?.value === title &&
        !document.getElementById('note-thread-return').disabled,
      overview.title,
    );
    const expandedText = sourceText(inserted) + '\n' + overview.gmNotes.replaceAll('\r\n', '\n');
    await page.locator('#note-gm').fill(expandedText);
    await back();
    expectedOverview = {
      ...expectedOverview,
      revision: expectedOverview.revision + 1,
      gmNotes: expandedText.replaceAll('\n', '\r\n'),
    };
    await page
      .locator('#note-thread-dialog')
      .getByRole('button', { name: 'Aktualisieren', exact: true })
      .click();
    await page.waitForFunction(() => !document.getElementById('note-thread-active').disabled);
    await native.capture(page, 'refreshed-selection-' + scale + '.png');
    assert.equal(
      await card(clue.id).count(),
      1,
      'refresh must retain the loaded later-page source',
    );
    assert(await card(clue.id).locator('input[type=checkbox]').isChecked());
    assert(!(await card(inserted[0].id).locator('input[type=checkbox]').isChecked()));
    await page.locator('#note-thread-plan').selectOption(plan.id);
    await page.locator('#note-thread-visit').selectOption(plan.scenes[0].id);
    await native.capture(page, 'reopened-' + scale + '.png');
    await page.locator('#note-thread-use').click();
    await page.locator('#note-thread-dialog').waitFor({ state: 'hidden' });
    assert.equal(await page.locator('#scene-title').inputValue(), plan.scenes[0].title);
    await page.locator('#session-packet-open').click();
    await page.waitForFunction(
      () =>
        document.getElementById('session-packet-dialog').open &&
        document.getElementById('session-packet-dialog').getAttribute('aria-busy') === 'false',
    );
    const packet = await page.locator('#session-packet-content').innerText();
    assert(packet.includes('Neuer Hinweis ' + scale));
    assert(packet.includes('Gespräch ' + scale));
    assert(packet.includes(other.gmNotes.trim()));
    assert(!packet.includes(background[0].gmNotes.trim()));
    await native.capture(page, 'packet-' + scale + '.png');
    await page.locator('#session-packet-close').click();
    await native.close();
    stage = 'fresh reopen and further edit at ' + scale;
    await launch(scale);
    await card(clue.id).waitFor();
    assert.match(await card(clue.id).innerText(), /Offen/);
    await edit(clue.id);
    assert.equal(await page.locator('#note-gm').inputValue(), clueText);
    await page.locator('#note-gm').fill(clueText + '\nFür den nächsten Abend bestätigt.');
    await back();
    await native.close();
    const check = new CampaignStore(file);
    try {
      const a = check.activate(campaign.id),
        prep = check.preparation(a.token),
        original = prep.notes.find((r) => r.note.id === clue.id).note;
      assert.equal(prep.notes.length, 4 + background.length + inserted.length);
      assert.equal(prep.plans.length, 2);
      assert.deepEqual(
        prep.plans.find((p) => p.id === plan.id),
        plan,
      );
      assert.deepEqual(
        prep.plans.find((p) => p.id === previousPlan.id),
        previousPlan,
      );
      assert.equal(
        original.gmNotes.replaceAll('\r\n', '\n'),
        clueText + '\nFür den nächsten Abend bestätigt.',
      );
      assert.equal(original.readAloud, clue.readAloud);
      const dossier = prep.notes.find((r) => r.note.id === npc.id).note;
      assert.equal(dossier.gmNotes.replaceAll('\r\n', '\n'), npcText);
      assert.equal(dossier.readAloud, npc.readAloud);
      for (const untouched of [expectedOverview, other, ...background, ...inserted])
        assert.deepEqual(prep.notes.find((r) => r.note.id === untouched.id).note, untouched);
      assert.equal(check.narrative(a.token, clue.id).state.status, 'open');
      assert.deepEqual(
        new Set(check.session(a.token, plan.id).visits[0].noteIds),
        new Set([other.id, overview.id, npc.id, clue.id]),
      );
    } finally {
      check.close();
    }
    results.push({
      scale,
      reopenedOriginal: true,
      laterPageRestored: true,
      explicitRefreshRetained: true,
      reorderedSourcesRetained: true,
      sourceSelectionActions: 2,
      existingPlanUpdated: true,
      historicalPlanUnchanged: true,
      dossierHandoff: true,
      boundedSourceChoices: sourceLayout,
      keyboardSourceSelection: true,
      freshEdit: true,
    });
  }
  await native.finish({ results });
  console.log(JSON.stringify({ results, launches: native.launches }));
} catch (error) {
  error.message = stage + ': ' + error.message;
  await native.fail(error);
  throw error;
} finally {
  await native.dispose();
}
