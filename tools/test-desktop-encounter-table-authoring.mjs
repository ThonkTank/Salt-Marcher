// Author a weighted table, use it as the proposal source, and edit it after native restart.
import { createNativeSession } from './native-session.mjs';
import { createRequire } from 'node:module';
import { randomUUID } from 'node:crypto';
import assert from 'node:assert/strict';
const root = process.cwd(),
  require = createRequire(import.meta.url),
  Database = require('better-sqlite3'),
  output = process.env.QA_EVIDENCE_DIR ?? root + '/.build/table-authoring-evidence';
const native = await createNativeSession({ root, output, name: 'table-authoring' });
require('esbuild').buildSync({
  entryPoints: ['src/app/storage/store.ts'],
  outfile: '.build/table-authoring-store.cjs',
  bundle: true,
  platform: 'node',
  format: 'cjs',
  external: ['better-sqlite3'],
});
const { CampaignStore } = require(root + '/.build/table-authoring-store.cjs'),
  file = native.profile + '/workbench.sqlite',
  store = new CampaignStore(file),
  campaign = store.create('Waldbegegnungen gewichten'),
  w = store.activate(campaign.id),
  cmd = (action) => ({ commandId: randomUUID(), campaignId: campaign.id, token: w.token, action });
store.executeLive(cmd({ kind: 'initialize', expectedRosterRevision: 0 }));
for (const name of ['Ada', 'Borin', 'Cora']) {
  const hero = store.executeLive(cmd({ kind: 'create-character', profile: { name } })).character,
    live = store.live(w.token);
  store.executeLive(
    cmd({
      kind: 'membership',
      characterId: hero.id,
      expectedRevision: hero.membershipRevision,
      expectedRosterRevision: live.rosterRevision,
      active: true,
      targetSceneId: live.scene.id,
      expectedFocusRevision: live.focusRevision,
    }),
  );
  const progress = store.progress(w.token).characters.find((p) => p.characterId === hero.id);
  store.executeProgress(
    cmd({
      kind: 'xp',
      characterId: hero.id,
      expectedRevision: progress.revision,
      mode: 'set',
      amount: 0,
      reason: 'Start auf Level 1',
    }),
  );
}
store.tutorial('skipped');
store.close();
function read(sql) {
  const db = new Database(file, { readonly: true });
  try {
    return db
      .prepare(sql)
      .all()
      .map((r) => JSON.parse(r.payload));
  } finally {
    db.close();
  }
}
const tables = () => read('SELECT payload FROM encounter_table'),
  runs = () => read('SELECT payload FROM generation_run');
async function open(zoom) {
  const page = await native.launch(zoom);
  await page
    .locator('.campaign-card[data-campaign-id="' + campaign.id + '"]')
    .getByRole('button', { name: /Öffnen|Fortsetzen/ })
    .click();
  await page.waitForFunction(
    () =>
      document.body.classList.contains('has-workspace') && !document.querySelector('main').inert,
    null,
    { timeout: 60000 },
  );
  if (!(await page.locator('#catalog-tab').isVisible())) {
    if (await page.locator('#atlas-navigation').isVisible())
      await page.locator('#atlas-navigation').click();
    else await page.locator('#workspace-nav-summary').click();
  }
  await page.locator('#catalog-tab').click();
  await page.locator('#catalog-tables').click();
  return page;
}
async function generate(page, table, seed) {
  await page.locator('#encounter-table-list').selectOption(table.id);
  await page.locator('#encounter-table-use').click();
  await page.locator('#generation-seed').fill(seed);
  await page.locator('#generation-difficulty').selectOption('medium');
  await page
    .locator('#generation-form')
    .getByRole('button', { name: 'Vorschläge erzeugen', exact: true })
    .click();
  await page.locator('#generation-preview article button:enabled').first().waitFor();
  const run = runs().find((r) => r.seed === seed);
  assert(run);
  assert.deepEqual(run.request.tableIds, [table.id]);
  assert.deepEqual(run.tables, [{ id: table.id, revision: table.revision }]);
  assert.deepEqual(
    [...run.candidates].sort((a, b) => a.creatureId.localeCompare(b.creatureId)),
    [...table.entries].sort((a, b) => a.creatureId.localeCompare(b.creatureId)),
  );
  assert(run.plans.length);
  assert(
    run.plans.every(
      (p) =>
        p.entries.length &&
        p.entries.every((e) => table.entries.some((source) => source.creatureId === e.creatureId)),
    ),
  );
  assert.deepEqual(tables(), [table], 'Selecting and generating must not rewrite the table');
  await native.capture(page, seed + '-proposal', '#generation-preview article:first-of-type');
  return run;
}
try {
  const page = await open(1);
  await page.locator('#encounter-table-new').click();
  await page.locator('#table-name').fill('Waldwache');
  for (const [id, name] of [
    ['goblin', 'Goblin'],
    ['guard', 'Guard'],
  ]) {
    await page.locator('#catalog-search').fill(name);
    await page
      .locator('#catalog-form')
      .getByRole('button', { name: 'Suchen', exact: true })
      .click();
    await page.locator('#catalog-rows button[data-creature-id="' + id + '"]').click();
    await page.locator('#table-add-creature').click();
  }
  const weights = page.locator('#table-entries input');
  await weights.first().fill('3');
  assert.match(await page.locator('#table-entries').innerText(), /75,00 %/);
  await native.capture(page, '01-weights');
  for (const invalid of ['0.5', '0', '11']) {
    await weights.first().fill(invalid);
    assert.equal(await page.locator('#table-save').isEnabled(), false);
    assert.match(await page.locator('#table-save-status').innerText(), /1 bis 10/);
    assert.equal(tables().length, 0);
  }
  await native.capture(page, '02-invalid-range');
  await weights.first().fill('3');
  await page.locator('#table-save').click();
  await page.locator('#table-manager').waitFor({ state: 'hidden' });
  const saved = tables()[0];
  assert.deepEqual(
    saved.entries.map((e) => e.weight),
    ['3', '1'],
  );
  const first = await generate(page, saved, 'table-3-to-1');
  await native.close();
  const fresh = await open(1);
  await fresh.locator('#encounter-table-list').selectOption(saved.id);
  await fresh.locator('#encounter-table-open').click();
  const reopened = fresh.locator('#table-entries input');
  assert.deepEqual(await reopened.evaluateAll((ns) => ns.map((n) => n.value)), ['3', '1']);
  await reopened.first().fill('9');
  assert.match(await fresh.locator('#table-entries').innerText(), /90,00 %/);
  await native.capture(fresh, '03-fresh-200', '#table-entries');
  await fresh.locator('#table-save').click();
  await fresh.locator('#table-manager').waitFor({ state: 'hidden' });
  const edited = tables()[0];
  assert.equal(edited.revision, 2);
  assert.deepEqual(
    edited.entries.map((e) => e.weight),
    ['9', '1'],
  );
  const second = await generate(fresh, edited, 'table-9-to-1');
  assert.deepEqual(
    runs().find((r) => r.id === first.id),
    first,
    'Historical proposals keep their original basis',
  );
  await native.close();
  const final = await open(1);
  await final.locator('#encounter-table-list').selectOption(saved.id);
  await final.locator('#encounter-table-open').click();
  assert.deepEqual(
    await final.locator('#table-entries input').evaluateAll((ns) => ns.map((n) => n.value)),
    ['9', '1'],
  );
  assert.deepEqual(tables(), [edited]);
  await native.capture(final, '04-saved-fresh-200', '#table-entries');
  await final.locator('#table-close').click();
  await native.close();
  await native.finish({ complete: true, table: edited, proposals: [first, second] });
} catch (error) {
  await native.fail(error);
  throw error;
} finally {
  await native.dispose();
}
