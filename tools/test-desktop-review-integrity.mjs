// Native regression for the second independent review: author links, trash, and Party health.
import assert from 'node:assert/strict';
import { createRequire } from 'node:module';
import { randomUUID } from 'node:crypto';
import { createNativeSession } from './native-session.mjs';

const root = process.cwd(),
  require = createRequire(root + '/package.json');
require('esbuild').buildSync({
  entryPoints: ['src/app/storage/store.ts'],
  outfile: '.build/review-integrity-store.cjs',
  bundle: true,
  platform: 'node',
  format: 'cjs',
  external: ['better-sqlite3'],
});
const { CampaignStore } = require(root + '/.build/review-integrity-store.cjs');
const output = process.env.QA_EVIDENCE_DIR ?? root + '/.build/review-integrity';
const native = await createNativeSession({ root, output, name: 'review-integrity' });
const file = native.profile + '/workbench.sqlite',
  store = new CampaignStore(file),
  campaign = store.create('Unabhängige Integritätsprüfung'),
  w = store.activate(campaign.id);
const command = (action) => ({
  commandId: randomUUID(),
  campaignId: campaign.id,
  token: w.token,
  action,
});
const notes = [];
for (const title of ['Familie Alma', 'Familie Cora', 'Paar Ada', 'Paar Bert']) {
  const note = {
    version: 1,
    id: randomUUID(),
    revision: 1,
    kind: 'npc',
    title,
    readAloud: '',
    gmNotes: 'Unveränderte Autorenquelle.\r\n',
    relations: [],
    creatureId: null,
    deleted: false,
  };
  store.changePreparation({
    ...command(null),
    change: { kind: 'note', expectedRevision: null, note },
  });
  notes.push(note);
}
for (const [a, b, family] of [
  [notes[0], notes[1], true],
  [notes[2], notes[3], false],
])
  store.executeWorldRelationPair(
    command({
      kind: 'add',
      sourceId: a.id,
      targetId: b.id,
      sourceRevision: 1,
      targetRevision: 1,
      forwardLabel: 'Elternteil',
      reverseLabel: 'Kind',
      ...(family ? { forwardFamilyKind: 'parent', reverseFamilyKind: 'child' } : {}),
    }),
  );
store.executeLive(command({ kind: 'initialize', expectedRosterRevision: 0 }));
const characters = [];
for (const [name, result] of [
  ['Tote Mira', 'dead'],
  ['Stabile Runa', 'stabilize'],
]) {
  const c = store.executeLive(
      command({ kind: 'create-character', profile: { name, armorClass: 12 } }),
    ).character,
    live = store.live(w.token);
  store.executeLive(
    command({
      kind: 'membership',
      characterId: c.id,
      expectedRevision: c.membershipRevision,
      expectedRosterRevision: live.rosterRevision,
      active: true,
      targetSceneId: live.scene.id,
      expectedFocusRevision: live.focusRevision,
    }),
  );
  let p = store.progress(w.token).characters.find((p) => p.characterId === c.id);
  store.executeProgress(
    command({
      kind: 'health',
      characterId: c.id,
      expectedRevision: p.revision,
      operation: 'set',
      reason: 'Isolierte Prüffigur',
      health: { hp: 0, maxHp: 12, tempHp: 0, conditions: '', concentrating: false },
    }),
  );
  p = store.progress(w.token).characters.find((p) => p.characterId === c.id);
  store.executeProgress(
    command({
      kind: 'health',
      characterId: c.id,
      expectedRevision: p.revision,
      operation: 'death',
      result,
      reason: 'Isolierter Ausgangsstand',
    }),
  );
  characters.push(c);
}
const scene = store.live(w.token).scene;
const combat = store.executeCombat({
  ...command({
    kind: 'create',
    sceneId: scene.id,
    title: 'Offene Goblinbegegnung',
    includeParty: false,
    expectedMembershipRevision: scene.membershipRevision,
    catalogCreature: { creatureId: 'goblin', count: 1, grouped: false },
  }),
  combatId: null,
  expectedRevision: null,
}).combat;
const goblin = combat.participants.find((p) => p.worldActorId),
  goblinNote = store
    .preparation(w.token, '')
    .notes.find((n) => n.note.id === goblin.worldActorId).note;
store.tutorial('skipped');
store.close();
let page,
  ipcChecked = false;
async function tab(id) {
  if (
    !(await page.locator('#' + id).isVisible()) &&
    (await page.locator('#atlas-navigation').isVisible())
  )
    await page.locator('#atlas-navigation').click();
  if (!(await page.locator('#' + id).isVisible()))
    await page.locator('#workspace-nav-summary').click();
  await page.locator('#' + id).click();
}
async function launch() {
  page = await native.launch();
  if (!ipcChecked) {
    const receipt = await page.evaluate(async (campaignId) => {
      const workspace = await window.campaign.activateShell(campaignId);
      if (!workspace.ok) throw Error(workspace.error);
      const c = {
        commandId: crypto.randomUUID(),
        campaignId,
        token: workspace.value.token,
        action: { kind: 'city-create', name: 'IPC-Prüfort', x: 0, y: 0, width: 200, height: 200 },
      };
      const before = await window.campaign.reconcileAtlasCommit(c),
        written = await window.campaign.executeAtlasCommit(c),
        after = await window.campaign.reconcileAtlasCommit(c),
        mismatch = await window.campaign.reconcileAtlasCommit({
          ...c,
          action: { ...c.action, name: 'Andere Nutzlast' },
        });
      return { before, written, after, mismatch };
    }, campaign.id);
    assert.equal(receipt.before.value.outcome, 'not-applied');
    assert.equal(receipt.written.ok, true);
    assert.equal(receipt.after.value.outcome, 'applied');
    assert.equal(receipt.after.value.ack.commandId, receipt.written.value.commandId);
    assert.equal(receipt.mismatch.ok, false);
    results.nativeAtlasReceiptProtocol = true;
    ipcChecked = true;
  }
  await page
    .locator('.campaign-card[data-campaign-id="' + campaign.id + '"]')
    .getByRole('button', { name: /Öffnen|Fortsetzen/ })
    .click();
  await page.waitForFunction(() => !document.getElementById('workspace-navigation').inert);
}
async function openNote(name) {
  await tab('preparation-tab');
  await page.locator('#world-search').fill(name);
  await page.locator('#world-list').getByRole('button', { name, exact: true }).click();
  await page.waitForFunction((name) => document.getElementById('note-title').value === name, name);
}
async function health(c) {
  await tab('live-tab');
  await page.locator('#live-party-reference [data-character-id="' + c.id + '"]').click();
  await page.locator('#live-health-dialog').waitFor();
  await page.waitForFunction(() => !document.getElementById('health-damage').disabled);
}
const results = {};
try {
  await launch();
  await tab('preparation-tab');
  // A real editor submission must reject a duplicate without corrupting its source.
  if (!(await page.locator('#world-links-open').isVisible()))
    await page
      .locator('#world-links-open')
      .locator('xpath=ancestor::details[1]')
      .locator('summary')
      .click();
  await page.locator('#world-links-open').click();
  await page.locator('#world-links-search').fill('Paar Ada');
  await page
    .locator('#world-links-list')
    .getByRole('button', { name: /Paar Ada/ })
    .click();
  await page.locator('#world-link-target-search').fill('Paar Bert');
  await page
    .locator('#world-link-targets')
    .getByRole('button', { name: /Paar Bert/ })
    .click();
  await page.locator('#world-link-family-kind').selectOption('parent');
  await page.locator('#world-link-label').fill('Elternteil');
  await page.locator('#world-link-reverse-label').fill('Kind');
  await page
    .locator('#world-links')
    .getByRole('button', { name: 'Beziehung übernehmen', exact: true })
    .click();
  await page.waitForFunction(() =>
    /doppelt|bereits/.test(document.getElementById('world-links-status').textContent),
  );
  assert.equal(await page.locator('#world-link-label').inputValue(), 'Elternteil');
  await native.capture(page, 'duplicate-rejected');
  results.duplicateRejectedWithDraft = true;
  await page
    .locator('#world-links')
    .getByRole('button', { name: 'Auftrag prüfen', exact: true })
    .click();
  await page.waitForFunction(() =>
    document.getElementById('world-links-status').textContent.includes('nicht gespeichert'),
  );
  await page
    .locator('#world-links')
    .getByRole('button', { name: 'Eingabe verwerfen', exact: true })
    .click();
  await page.waitForFunction(() => document.getElementById('world-link-label').value === '');
  await page
    .locator('#world-links')
    .getByRole('button', { name: 'Schließen', exact: true })
    .click();
  await page.locator('#world-links').waitFor({ state: 'hidden' });
  await openNote(notes[0].title);
  await page.locator('#note-remove').click();
  await page.locator('#world-trash').check();
  await page
    .locator('#world-list')
    .getByRole('button', { name: notes[0].title, exact: true })
    .click();
  await page.locator('#note-restore').waitFor();
  await native.capture(page, 'family-in-trash');
  await native.close();
  let check = new CampaignStore(file);
  try {
    const token = check.activate(campaign.id).token;
    assert.equal(
      check.preparation(token, '').notes.find((r) => r.note.id === notes[0].id).trashed,
      true,
    );
    await check.backup(native.profile + '/family-trash-backup.sqlite');
  } finally {
    check.close();
  }
  results.familyTrashBackup = true;
  await launch();
  await tab('preparation-tab');
  await page.locator('#world-trash').check();
  await page.locator('#world-search').fill(notes[0].title);
  await page
    .locator('#world-list')
    .getByRole('button', { name: notes[0].title, exact: true })
    .click();
  await page.locator('#note-restore').click();
  await page.locator('#world-trash').uncheck();
  await openNote(goblinNote.title);
  await page.locator('#note-remove').click();
  await page.waitForFunction(() =>
    document.getElementById('status').textContent.includes('offenen Begegnung'),
  );
  assert.equal(await page.locator('#note-title').inputValue(), goblinNote.title);
  results.openCombatTrashBlocked = true;
  await page.locator('#preparation-reconcile').click();
  await page.locator('#preparation-reconcile').waitFor({ state: 'hidden' });
  await health(characters[0]);
  await page.locator('#health-amount').fill('1');
  await page.locator('#health-heal').click();
  await page.waitForFunction(() =>
    /tot|wiederbeleben|Heilung/i.test(document.getElementById('status').textContent),
  );
  assert.match(await page.locator('#health-summary').innerText(), /0 \/ 12/);
  assert.match(await page.locator('#death-summary').innerText(), /tot|Tot/);
  await native.capture(page, 'dead-not-healed');
  await page.locator('#live-health-close').click();
  await health(characters[1]);
  await page.locator('#health-amount').fill('1');
  await page.locator('#health-damage').click();
  await page.waitForFunction(() =>
    document.getElementById('death-summary').textContent.includes('1 Fehlschlag'),
  );
  await native.capture(page, 'damage-breaks-stability');
  await page.locator('#live-health-close').click();
  await native.close();
  check = new CampaignStore(file);
  try {
    const token = check.activate(campaign.id).token,
      progress = check.progress(token),
      dead = progress.characters.find((c) => c.characterId === characters[0].id).health,
      damaged = progress.characters.find((c) => c.characterId === characters[1].id).health;
    assert.equal(dead.hp, 0);
    assert.equal(dead.death.dead, true);
    assert.equal(damaged.hp, 0);
    assert.equal(damaged.death.stable, false);
    assert.equal(damaged.death.failures, 1);
    const rows = check.preparation(token, '').notes;
    assert.equal(rows.find((r) => r.note.id === notes[0].id).trashed, false);
    assert.equal(rows.find((r) => r.note.id === goblinNote.id).trashed, false);
    for (const note of notes) {
      const saved = rows.find((r) => r.note.id === note.id).note;
      assert.equal(saved.relations.length, 1);
      assert.equal(saved.gmNotes, note.gmNotes);
    }
    await check.backup(native.profile + '/final-backup.sqlite');
    results.freshDataAndBackup = true;
  } finally {
    check.close();
  }
  await launch();
  await health(characters[1]);
  assert.match(await page.locator('#death-summary').innerText(), /1 Fehlschlag/);
  await page.locator('#live-health-close').click();
  await native.close();
  results.partyDeathAndStability = true;
  results.normalRestart = true;
  await native.finish({ results });
  console.log(JSON.stringify({ source: native.source, results, launches: native.launches }));
} catch (error) {
  await native.fail(error);
  throw error;
} finally {
  await native.dispose();
}
