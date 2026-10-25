import { createNativeSession } from './native-session.mjs';
import { createRequire } from 'node:module';
import { randomUUID, createHash } from 'node:crypto';
import assert from 'node:assert/strict';
import path from 'node:path';
const source = process.cwd(),
  output = process.env.QA_EVIDENCE_DIR ?? path.join(source, '.build/narrative-recovery-evidence');
const native = await createNativeSession({
    root: source,
    output,
    name: 'gm-narrative-recovery',
    resultName: 'narrative-after.json',
  }),
  { profile, launches, errors } = native;
const require = createRequire(source + '/package.json'),
  Database = require('better-sqlite3');
require('esbuild').buildSync({
  entryPoints: ['src/app/storage/store.ts'],
  outfile: '.build/narrative-native-store.cjs',
  bundle: true,
  platform: 'node',
  format: 'cjs',
  external: ['better-sqlite3'],
});
const { CampaignStore } = require(source + '/.build/narrative-native-store.cjs');
const file = profile + '/workbench.sqlite',
  store = new CampaignStore(file),
  campaign = store.create('Narrative Eingaben'),
  w = store.activate(campaign.id);
const command = (action) => ({
  commandId: randomUUID(),
  token: w.token,
  campaignId: campaign.id,
  action,
});
const heroes = [];
for (const name of ['Nera', 'Kai']) {
  const c = store.executeLive(command({ kind: 'create-character', profile: { name } })).character;
  heroes.push(c);
  store.executeLive(
    command({
      kind: 'membership',
      characterId: c.id,
      expectedRevision: c.membershipRevision,
      expectedRosterRevision: store.live(w.token).rosterRevision,
      active: true,
      targetSceneId: null,
      expectedFocusRevision: null,
    }),
  );
}
store.executeLive(
  command({ kind: 'initialize', expectedRosterRevision: store.live(w.token).rosterRevision }),
);
const notes = ['Leuchtturm', 'Karawane'].map((title) => ({
  version: 1,
  id: randomUUID(),
  revision: 1,
  kind: 'quest',
  title,
  readAloud: '  Original ' + title + '\r\n',
  gmNotes: '  Private GM-Prosa\r\n',
  relations: [],
  creatureId: null,
  deleted: false,
}));
for (const note of notes) {
  store.changePreparation({
    ...command(null),
    change: { kind: 'note', expectedRevision: null, note },
  });
  const n = store.narrative(w.token, note.id);
  store.executeProgress(
    command({
      kind: 'narrative-state',
      expectedRevision: 0,
      expectedNoteRevision: n.noteRevision,
      state: {
        ...n.state,
        poolXp: note.title === 'Leuchtturm' ? 77 : 101,
        contributors: [heroes[0].id],
      },
    }),
  );
}
let n = store.narrative(w.token, notes[1].id);
store.executeProgress(
  command({
    kind: 'narrative-award',
    noteId: notes[1].id,
    expectedRevision: n.state.revision,
    expectedNoteRevision: n.noteRevision,
    sceneId: store.live(w.token).focusId,
    poolXp: 101,
    noXp: false,
    recipients: store
      .progress(w.token)
      .characters.filter((c) => c.characterId === heroes[0].id)
      .map((c) => ({ characterId: c.characterId, revision: c.revision })),
    items: [],
    outcome: 'Karawane gerettet',
  }),
);
// Controlled fault in our closed-app fixture: a paid quest must never look unpaid.
const row = store.db.prepare('SELECT * FROM narrative_state WHERE note_id=?').get(notes[1].id),
  payload = JSON.stringify({ ...JSON.parse(row.payload), awardId: null });
store.db
  .prepare('UPDATE narrative_state SET payload=?,checksum=? WHERE note_id=?')
  .run(payload, createHash('sha256').update(payload).digest('hex'), notes[1].id);
store.tutorial('skipped');
store.close();
function facts() {
  const db = new Database(file, { readonly: true });
  try {
    return {
      notes: db.prepare('SELECT * FROM world_note ORDER BY id').all(),
      states: db.prepare('SELECT * FROM narrative_state ORDER BY note_id').all(),
      awards: db.prepare('SELECT * FROM narrative_award ORDER BY id').all(),
      xp: Object.fromEntries(
        db
          .prepare('SELECT id,payload FROM character_progress')
          .all()
          .map((r) => [r.id, JSON.parse(r.payload).xp]),
      ),
      treasures: db
        .prepare('SELECT payload FROM treasure')
        .all()
        .map((r) => JSON.parse(r.payload)),
      drafts: db
        .prepare('SELECT payload FROM narrative_draft')
        .all()
        .map((r) => JSON.parse(r.payload)),
      ledger: db
        .prepare('SELECT payload FROM character_ledger')
        .all()
        .map((r) => JSON.parse(r.payload)),
    };
  } finally {
    db.close();
  }
}
const original = facts();
let app;
let allocationCommands = [];
const outcome = 'Leuchtturm wieder entzündet.';
async function tab(page, id) {
  if (!(await page.locator('#' + id).isVisible())) {
    if (await page.locator('#atlas-navigation').isVisible())
      await page.locator('#atlas-navigation').click();
    else await page.locator('#workspace-nav-summary').click();
  }
  await page.locator('#' + id).click();
}
async function launch(scale) {
  const page = await native.launch(scale);
  app = native.app;
  await page
    .locator('.campaign-card[data-campaign-id="' + campaign.id + '"]')
    .getByRole('button', { name: /Öffnen|Fortsetzen/ })
    .click();
  await page.waitForFunction(
    (id) =>
      document.querySelector('#campaigns').value === id &&
      !document.querySelector('#workspace-navigation').inert,
    campaign.id,
  );
  await tab(page, 'preparation-tab');
  await page.locator('#preparation-knowledge').click();
  return page;
}
async function note(page, title) {
  await page
    .locator('#world-list')
    .getByRole('button', { name: new RegExp(title) })
    .click();
  await page.waitForFunction(
    (title) => document.querySelector('#note-title').value === title,
    title,
  );
}
const capture = (page, name) => native.capture(page, name);
async function receiptShot(page, panel, name) {
  const receipt = panel.locator('p').filter({ hasText: outcome + ' · 151 XP je Empfänger' });
  await receipt.evaluate((e) => e.scrollIntoView({ block: 'center' }));
  assert(
    await receipt.evaluate((e) => {
      const r = e.getBoundingClientRect();
      return (
        r.top >= 0 &&
        r.bottom <= innerHeight &&
        e.contains(document.elementFromPoint(r.left + r.width / 2, r.top + r.height / 2))
      );
    }),
  );
  await capture(page, name);
}
async function openAwardTreasure(page, panel) {
  await panel.getByRole('button', { name: 'Beute gemeinsam verteilen…', exact: true }).click();
  const dialog = page.locator('#treasure-distribution-dialog');
  await dialog.waitFor({ state: 'visible' });
  await page.locator('#distribution-grid input[data-item-id]').first().waitFor();
  const treasure = facts().treasures[0];
  assert.equal(await page.locator('#distribution-treasure').inputValue(), treasure.id);
  return dialog;
}
async function close() {
  await native.close();
  app = null;
}
try {
  let page = await launch(1);
  await note(page, 'Leuchtturm');
  let panel = page.locator('#narrative-editor');
  await panel.getByLabel('Quest-XP-Pool', { exact: true }).fill('101-');
  await panel.getByRole('button', { name: 'Weiteren Gegenstand hinzufügen', exact: true }).click();
  await panel.getByLabel('Gegenstand', { exact: true }).fill('Unfertiger Trank');
  await panel.getByLabel('Menge', { exact: true }).fill('1,5');
  await panel.getByLabel('Wert pro Stück in Gold', { exact: true }).fill('offen');
  await note(page, 'Karawane');
  await panel.getByRole('alert').waitFor();
  assert.match(await panel.innerText(), /Narrativer Belohnungsbeleg ist falsch zugeordnet/);
  assert.equal(await panel.getByLabel('Quest-XP-Pool', { exact: true }).count(), 0);
  assert.equal(
    await panel
      .getByRole('button', { name: 'Manuell abschließen und Belohnung verteilen…', exact: true })
      .count(),
    0,
  );
  assert.equal(await panel.getAttribute('aria-busy'), 'false');
  await capture(page, 'narrative-after.png');
  await note(page, 'Leuchtturm');
  await panel.getByLabel('Quest-XP-Pool', { exact: true }).waitFor();
  assert.equal(await panel.getByLabel('Quest-XP-Pool', { exact: true }).inputValue(), '101-');
  assert.equal(await panel.getByLabel('Menge', { exact: true }).inputValue(), '1,5');
  assert.equal(
    await panel.getByLabel('Wert pro Stück in Gold', { exact: true }).inputValue(),
    'offen',
  );
  await close();
  page = await launch(2);
  await note(page, 'Leuchtturm');
  panel = page.locator('#narrative-editor');
  await panel.getByLabel('Quest-XP-Pool', { exact: true }).waitFor();
  assert.equal(await panel.getByLabel('Quest-XP-Pool', { exact: true }).inputValue(), '101-');
  assert.equal(await panel.getByLabel('Menge', { exact: true }).inputValue(), '1,5');
  assert.equal(
    await panel.getByLabel('Wert pro Stück in Gold', { exact: true }).inputValue(),
    'offen',
  );
  assert.deepEqual(facts().xp, original.xp);
  assert.equal(facts().awards.length, 1);
  await panel.getByLabel('Quest-XP-Pool', { exact: true }).fill('301');
  await panel.getByLabel('Menge', { exact: true }).fill('2');
  await panel.getByLabel('Wert pro Stück in Gold', { exact: true }).fill('5');
  await panel.getByRole('button', { name: 'Narrative Angaben speichern', exact: true }).click();
  await page.waitForFunction(() =>
    document
      .querySelector('#narrative-editor')
      .textContent.includes('Änderungen werden als Eingabe automatisch gesichert.'),
  );
  await panel
    .getByRole('button', { name: 'Manuell abschließen und Belohnung verteilen…', exact: true })
    .click();
  await page.locator('#combat-finish-dialog').waitFor();
  assert.equal(
    await page.locator('#finish-recipients input[value="' + heroes[0].id + '"]').isChecked(),
    true,
  );
  assert.equal(
    await page.locator('#finish-recipients input[value="' + heroes[1].id + '"]').isChecked(),
    false,
  );
  await page.locator('#finish-recipients input[value="' + heroes[1].id + '"]').check();
  assert.match(await page.locator('#finish-xp-preview').innerText(), /151 XP pro Figur/);
  assert.deepEqual(facts().xp, original.xp);
  await page.locator('#combat-outcome').fill(outcome);
  await page
    .getByRole('button', { name: 'Ergebnis speichern und abschließen', exact: true })
    .click();
  await page.locator('#combat-finish-dialog').waitFor({ state: 'hidden' });
  await panel.getByRole('button', { name: 'Belohnung bereits vergeben', exact: true }).waitFor();
  assert.match(await panel.innerText(), /151 XP je Empfänger/);
  await receiptShot(page, panel, 'quest-reward-2.png');
  const distribution = await openAwardTreasure(page, panel);
  await distribution.getByRole('button', { name: 'Schließen', exact: true }).click();
  await close();
  page = await launch(2);
  await note(page, 'Leuchtturm');
  panel = page.locator('#narrative-editor');
  await panel.getByRole('button', { name: 'Belohnung bereits vergeben', exact: true }).waitFor();
  assert.equal(
    await panel
      .getByRole('button', { name: 'Belohnung bereits vergeben', exact: true })
      .isDisabled(),
    true,
  );
  assert.equal(
    await panel.getByRole('combobox', { name: 'Narrativer Status', exact: true }).inputValue(),
    'closed',
  );
  assert((await panel.innerText()).includes(outcome));
  await receiptShot(page, panel, 'quest-fresh-2.png');
  const finalDistribution = await openAwardTreasure(page, panel);
  assert.match(await finalDistribution.innerText(), /Unfertiger Trank/);
  await capture(page, 'treasure-fresh-2.png');
  await page
    .locator('#distribution-grid input[data-character-id="' + heroes[1].id + '"]')
    .first()
    .fill('1');
  await page.locator('#distribution-check').click();
  await app.evaluate(({ ipcMain }) => {
    const execute = ipcMain._invokeHandlers.get('campaign:execute-progress'),
      status = ipcMain._invokeHandlers.get('campaign:commit-status');
    let drop = true,
      pending = false;
    globalThis.qaAllocationCommands = [];
    ipcMain.removeHandler('campaign:execute-progress');
    ipcMain.handle('campaign:execute-progress', async (e, c) => {
      if (c.action.kind === 'allocate-batch') globalThis.qaAllocationCommands.push(c.commandId);
      const result = await execute(e, c);
      if (drop && c.action.kind === 'allocate-batch') {
        drop = false;
        pending = true;
        return { ok: false, error: 'QA: Verteilungsantwort verloren' };
      }
      return result;
    });
    ipcMain.removeHandler('campaign:commit-status');
    ipcMain.handle('campaign:commit-status', async (e, ...args) => {
      if (pending) {
        pending = false;
        return { ok: true, value: { outcome: 'pending' } };
      }
      return status(e, ...args);
    });
  });
  await page.locator('#distribution-confirm').click();
  await page.locator('#distribution-status').filter({ hasText: 'Buchungsantwort fehlt' }).waitFor();
  assert.equal(
    await page
      .locator('#distribution-grid input[data-character-id="' + heroes[1].id + '"]')
      .first()
      .inputValue(),
    '1',
  );
  await finalDistribution.getByRole('button', { name: 'Schließen', exact: true }).click();
  await page.locator('#commit-check').click();
  await page.locator('#commit-pending').waitFor({ state: 'hidden' });
  allocationCommands = await app.evaluate(() => globalThis.qaAllocationCommands);
  assert.equal(allocationCommands.length, 1);
  await openAwardTreasure(page, panel);
  assert.match(await page.locator('#distribution-summary').innerText(), /1/);
  await capture(page, 'remaining-after-recovery-2.png');
  await page
    .locator('#treasure-distribution-dialog')
    .getByRole('button', { name: 'Schließen', exact: true })
    .click();
  await close();
  page = await launch(2);
  await note(page, 'Leuchtturm');
  panel = page.locator('#narrative-editor');
  await panel.getByRole('button', { name: 'Belohnung bereits vergeben', exact: true }).waitFor();
  await openAwardTreasure(page, panel);
  assert.equal(facts().treasures[0].items[0].allocated, 1);
  await capture(page, 'partial-treasure-fresh-2.png');
  await page
    .locator('#treasure-distribution-dialog')
    .getByRole('button', { name: 'Schließen', exact: true })
    .click();
  await close();
  const final = facts();
  assert.deepEqual(final.notes, original.notes);
  assert.equal(final.awards.length, 2);
  assert.equal(final.drafts.length, 0);
  assert.deepEqual(final.xp, { [heroes[0].id]: 252, [heroes[1].id]: 151 });
  assert.equal(final.treasures.length, 1);
  assert.equal(final.treasures[0].items[0].quantity, 2);
  assert.equal(final.treasures[0].items[0].allocated, 1);
  const award = final.awards
    .map((r) => JSON.parse(r.payload))
    .find((a) => a.noteId === notes[0].id);
  assert.equal(award.outcome, outcome);
  assert.equal(award.shareXp, 151);
  assert.deepEqual(award.recipientIds.slice().sort(), heroes.map((h) => h.id).sort());
  assert.equal(final.treasures[0].awardId, award.id);
  assert.equal(final.treasures[0].sourceNoteId, notes[0].id);
  assert.equal(final.ledger.length, 1);
  assert.equal(final.ledger[0].characterId, heroes[1].id);
  assert.equal(final.ledger[0].quantity, 1);
  assert.equal(final.ledger[0].treasureId, final.treasures[0].id);
  assert.equal(final.ledger[0].sourceNoteId, notes[0].id);
  assert.equal(final.ledger[0].awardId, award.id);
  assert.deepEqual(
    final.states.find((r) => r.note_id === notes[1].id),
    original.states.find((r) => r.note_id === notes[1].id),
  );
  assert.deepEqual(
    final.awards.find((r) => r.note_id === notes[1].id),
    original.awards[0],
  );
  assert.deepEqual(errors, []);
  await native.finish({
    normalClose: true,
    rawDraftRestartAndPaidHistoryPreserved: true,
    questAwardRestartAndUnallocatedLoot: true,
    partialDistributionReplyRecovery: true,
    allocationCommands,
    final,
  });
  console.log(JSON.stringify({ output, launches, errors }));
} catch (error) {
  await native.fail(error);
  throw error;
} finally {
  await native.dispose();
}
