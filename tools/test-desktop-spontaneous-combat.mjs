// Full GM visit; only the existing party is a fixture. All combat authoring uses the native UI.
import { createRequire } from 'node:module';
import { mkdir, readFile, writeFile, rm } from 'node:fs/promises';
import { randomUUID } from 'node:crypto';
import path from 'node:path';
import assert from 'node:assert/strict';
import { createNativeSession } from './native-session.mjs';
const root = process.cwd(),
  require = createRequire(root + '/package.json');
const output = path.resolve(process.env.QA_EVIDENCE_DIR ?? '.build/spontaneous-combat');
await mkdir(output, { recursive: true });
await rm(output + '/result.json', { force: true });
require('esbuild').buildSync({
  entryPoints: ['src/app/storage/store.ts'],
  outfile: '.build/spontaneous-combat-store.cjs',
  bundle: true,
  platform: 'node',
  format: 'cjs',
  external: ['better-sqlite3'],
});
const { CampaignStore } = require(root + '/.build/spontaneous-combat-store.cjs'),
  results = [];
for (const scale of process.env.GM_QA_ZOOM ? [Number(process.env.GM_QA_ZOOM)] : [1, 2]) {
  const native = await createNativeSession({
      root,
      output: output + '/' + scale,
      name: 'gm-spontaneous-combat',
    }),
    file = native.profile + '/workbench.sqlite';
  const store = new CampaignStore(file),
    campaign = store.create('Hafentor – ungeplanter Kampf'),
    w = store.activate(campaign.id),
    command = (action) => ({
      commandId: randomUUID(),
      campaignId: campaign.id,
      token: w.token,
      action,
    });
  store.executeLive(command({ kind: 'initialize', expectedRosterRevision: 0 }));
  for (const [name, hp, armorClass] of [
    ['Mira', 20, 16],
    ['Rolan', 18, 14],
  ]) {
    const c = store.executeLive(
        command({ kind: 'create-character', profile: { name, armorClass } }),
      ).character,
      l = store.live(w.token);
    store.executeLive(
      command({
        kind: 'membership',
        characterId: c.id,
        expectedRevision: c.membershipRevision,
        expectedRosterRevision: l.rosterRevision,
        active: true,
        targetSceneId: l.scene.id,
        expectedFocusRevision: l.focusRevision,
      }),
    );
    const p = store.progress(w.token).characters.find((p) => p.characterId === c.id);
    store.executeProgress(
      command({
        kind: 'health',
        characterId: c.id,
        expectedRevision: p.revision,
        operation: 'set',
        reason: 'Isolierte Ausgangsgruppe',
        health: { hp, maxHp: hp, tempHp: 0, conditions: '', concentrating: false },
      }),
    );
  }
  const sceneId = store.live(w.token).scene.id;
  store.tutorial('skipped');
  store.close();
  async function open() {
    const page = await native.launch(scale);
    await page
      .locator('.campaign-card')
      .filter({ hasText: campaign.name })
      .getByRole('button', { name: /^(Fortsetzen|Öffnen)$/ })
      .click();
    await page.waitForFunction(
      () =>
        document.body.classList.contains('has-workspace') && !document.querySelector('main').inert,
    );
    if (
      !(await page.locator('#live-tab').isVisible()) &&
      (await page.locator('#atlas-navigation').isVisible())
    )
      await page.locator('#atlas-navigation').click();
    if (!(await page.locator('#live-tab').isVisible()))
      await page.locator('#workspace-nav-summary').click();
    await page.locator('#live-tab').click();
    await page.waitForFunction(
      () => document.getElementById('combat-panel').getAttribute('aria-busy') === 'false',
    );
    return page;
  }
  async function choose(page, name, count) {
    await page.locator('#combat-creature-search').fill(name);
    await page.locator('#combat-creature-search-form button').click();
    await page.waitForFunction(
      (id) => document.getElementById('combat-creature-select').value === 'creature:' + id,
      name.toLowerCase(),
    );
    await page.locator('#combat-creature-count').fill(String(count));
    if (count > 1) await page.locator('#combat-creature-grouped').check();
  }
  try {
    let page = await open();
    await page.locator('#combat-catalog-open').click();
    await choose(page, 'Goblin', 3);
    await native.capture(page, 'first-choice');
    await page.locator('#combat-creature-add').click();
    await page.waitForFunction(() =>
      document.getElementById('combat-add-status').textContent.includes('3 × Goblin übernommen'),
    );
    assert(await page.locator('#combat-add-dialog').isVisible());
    assert.equal(await page.locator('#combat-creature-count').inputValue(), '1');
    assert.equal(await page.locator('#combat-creature-grouped').isChecked(), false);
    assert(await page.locator('#combat-creature-add').isDisabled());
    await choose(page, 'Orc', 1);
    await page.locator('#combat-creature-initiative').fill('8');
    await page.locator('#combat-creature-add').click();
    await page.waitForFunction(() =>
      document.getElementById('combat-add-status').textContent.includes('1 × Orc übernommen'),
    );
    assert(await page.locator('#combat-add-dialog').isVisible());
    assert.match(await page.locator('#combat-add-context').innerText(), /3 × Goblin.*1 × Orc/);
    assert(await page.locator('#combat-creature-add').isDisabled());
    await native.capture(page, 'assembled');
    await page.locator('#combat-preparation-initiative').click();
    await page.locator('#combat-initiative-dialog').waitFor({ state: 'visible' });
    assert(await page.locator('#combat-add-dialog').isHidden());
    assert.equal(await page.locator('#initiative-rows input').count(), 4);
    assert.equal(
      await page.getByRole('textbox', { name: 'Initiative Orc A', exact: true }).inputValue(),
      '8',
    );
    for (const [name, n] of [
      ['Mira', 16],
      ['Rolan', 11],
      ['Goblin A', 14],
    ])
      await page.getByRole('textbox', { name: 'Initiative ' + name, exact: true }).fill(String(n));
    await page.locator('#initiative-start').click();
    await page.waitForFunction(() =>
      document.getElementById('combat-status').textContent.includes('Am Zug: Mira'),
    );
    await page.getByRole('button', { name: 'Goblin A', exact: true }).click();
    await page.locator('#fighter-amount').fill('3');
    await page.locator('#fighter-damage').click();
    await page.waitForFunction(() =>
      document.getElementById('fighter-quick-health').textContent.includes('4 / 7 HP'),
    );
    await page.locator('#combat-next').click();
    await page.waitForFunction(() =>
      document.getElementById('combat-status').textContent.includes('Am Zug: Goblin A'),
    );
    await page.locator('#combat-undo').click();
    await page.waitForFunction(() =>
      document.getElementById('combat-status').textContent.includes('Am Zug: Mira'),
    );
    assert.match(await page.locator('#fighter-quick-health').innerText(), /4 \/ 7 HP/);
    await page.locator('#combat-next').click();
    await page.waitForFunction(() =>
      document.getElementById('combat-status').textContent.includes('Am Zug: Goblin A'),
    );
    await native.capture(page, 'running');
    await page.locator('#combat-add-open').click();
    assert(await page.locator('#combat-preparation-initiative').isHidden());
    await page.locator('#combat-add-close').click();
    await page.locator('#combat-finish').click();
    await page.locator('#combat-outcome').fill('Goblins ergeben sich');
    await page.locator('#finish-no-xp').check();
    await page
      .getByRole('button', { name: 'Ergebnis speichern und abschließen', exact: true })
      .click();
    await page.waitForFunction(() =>
      document
        .getElementById('combat-status')
        .textContent.includes('Abgeschlossen · Goblins ergeben sich'),
    );
    await native.close();
    page = await open();
    assert.match(
      await page.locator('#combat-status').innerText(),
      /Abgeschlossen · Goblins ergeben sich/,
    );
    assert.match(await page.locator('#combat-rows').innerText(), /4 \/ 7 HP/);
    await native.capture(page, 'reopened');
    if (!(await page.locator('#groups-tab').isVisible()))
      await page.locator('#workspace-nav-summary').click();
    await page.locator('#groups-tab').click();
    await page.locator('#groups-list button').filter({ hasText: '3 × Goblin' }).click();
    const first = page
      .locator('#groups-actors .session-group-card')
      .filter({ hasText: '1. Goblin A' });
    await first.waitFor();
    await first.scrollIntoViewIfNeeded();
    assert.equal(
      await first.getByRole('textbox', { name: 'Aktuelle HP', exact: true }).inputValue(),
      '4',
    );
    assert.equal(await page.locator('#groups-actors .session-group-card').count(), 3);
    await native.capture(page, 'survivors');
    await native.close();
    const fresh = new CampaignStore(file);
    try {
      const active = fresh.activate(campaign.id),
        c = fresh.combat(active.token, sceneId).combat,
        groups = fresh.scenePreparation(active.token, sceneId).groups;
      assert.equal(c.participants.length, 6);
      assert.equal(groups.length, 2);
      assert.equal(groups.flatMap((g) => g.actors).length, 4);
      assert.equal(
        new Set(c.participants.filter((p) => p.worldActorId).map((p) => p.worldActorId)).size,
        4,
      );
      assert.equal(groups.flatMap((g) => g.actors).find((p) => p.name === 'Goblin A').hp, 4);
      assert.equal(c.participants.find((p) => p.name === 'Orc A').initiative, 8);
      const goblins = c.participants.filter((p) => p.sourceId === 'goblin');
      assert.equal(new Set(goblins.map((p) => p.groupId)).size, 1);
      assert(goblins.every((p) => p.initiative === 14 && p.partitionKind === 'mob'));
    } finally {
      fresh.close();
    }
    await native.finish({ complete: true, participants: 6, sceneOpponents: 4, survivorHp: 4 });
    results.push(JSON.parse(await readFile(output + '/' + scale + '/result.json', 'utf8')));
  } catch (error) {
    await native.fail(error);
    throw error;
  } finally {
    await native.dispose();
  }
}
assert(
  results.every(
    (r) =>
      r.source === results[0].source &&
      JSON.stringify(r.artifacts) === JSON.stringify(results[0].artifacts),
  ),
  'Both scales must use the same application build',
);
await writeFile(output + '/result.json', JSON.stringify({ complete: true, results }, null, 2));
console.log(
  JSON.stringify({ complete: true, output, scales: results.map((r) => r.launches[0].zoom) }),
);
