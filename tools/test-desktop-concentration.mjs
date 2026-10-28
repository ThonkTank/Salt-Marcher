import { createNativeSession } from './native-session.mjs';
import { createRequire } from 'node:module';
import { mkdir, writeFile, readFile, rm } from 'node:fs/promises';
import { randomUUID } from 'node:crypto';
import assert from 'node:assert/strict';
import path from 'node:path';
const root = process.cwd(),
  require = createRequire(root + '/package.json');
const output = path.resolve(process.env.QA_EVIDENCE_DIR ?? '.build/concentration');
await mkdir(output, { recursive: true });
await rm(path.join(output, 'result.json'), { force: true });
require('esbuild').buildSync({
  entryPoints: ['src/app/storage/store.ts'],
  outfile: '.build/concentration-store.cjs',
  bundle: true,
  platform: 'node',
  format: 'cjs',
  external: ['better-sqlite3'],
});
const { CampaignStore } = require(root + '/.build/concentration-store.cjs');
for (const zoom of [1]) {
  const native = await createNativeSession({
    root,
    output: path.join(output, String(zoom)),
    name: 'concentration',
  });
  try {
    const file = native.profile + '/workbench.sqlite',
      store = new CampaignStore(file, require(root + '/package.json').version),
      campaign = store.create('Konzentration – Brückenduell'),
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
    const scene = store.live(w.token).scene;
    let combat;
    const act = (action) =>
      (combat = store.executeCombat({
        ...command(action),
        combatId: combat?.id ?? null,
        expectedRevision: combat?.revision ?? null,
      }).combat);
    act({
      kind: 'create',
      sceneId: scene.id,
      title: 'Erzmagier am Tor',
      includeParty: true,
      expectedMembershipRevision: scene.membershipRevision,
      catalogCreature: { creatureId: 'archmage', count: 1, grouped: false },
    });
    for (const p of combat.participants)
      act({
        kind: 'edit',
        participantId: p.id,
        changes: { initiative: p.characterId ? (p.name === 'Mira' ? 18 : 8) : 12 },
      });
    act({ kind: 'start' });
    const actorId = combat.participants.find((p) => p.sourceId === 'archmage').id;
    store.tutorial('skipped');
    store.close();
    async function launch() {
      const page = await native.launch(zoom);
      await native.app.evaluate(({ BrowserWindow }) =>
        BrowserWindow.getAllWindows()
          .find((w) => w.webContents.getURL().endsWith('/index.html'))
          .setSize(1600, 1000),
      );
      assert.equal(
        await native.app.evaluate(({ BrowserWindow }) =>
          BrowserWindow.getAllWindows()
            .find((w) => w.webContents.getURL().endsWith('/index.html'))
            .webContents.getZoomFactor(),
        ),
        zoom,
      );
      await page
        .locator('.campaign-card[data-campaign-id="' + campaign.id + '"]')
        .getByRole('button', { name: 'Fortsetzen' })
        .click();
      await page.waitForFunction(
        (id) =>
          document.getElementById('campaigns').value === id &&
          !document.querySelector('main').inert,
        campaign.id,
      );
      if (
        !(await page.locator('#live-tab').isVisible()) &&
        (await page.locator('#atlas-navigation').isVisible())
      )
        await page.locator('#atlas-navigation').click();
      if (!(await page.locator('#live-tab').isVisible()))
        await page.locator('#workspace-nav-summary').click();
      await page.locator('#live-tab').click();
      await page.locator('#combat-panel').waitFor();
      await ready(page);
      return page;
    }
    async function ready(page) {
      await page.waitForFunction(
        () =>
          document.getElementById('combat-panel').getAttribute('aria-busy') === 'false' &&
          !document.getElementById('combat-refresh').disabled,
      );
    }
    const close = () => native.close(),
      shot = (page, name) => native.capture(page, name);
    const row = (page) => page.locator('[data-participant-id="' + actorId + '"]');
    let page = await launch();
    await row(page)
      .getByRole('button', { name: /Zustände bearbeiten/ })
      .click();
    assert.equal(await page.locator('#fighter-values').evaluate((e) => e.open), false);
    await page.getByRole('button', { name: 'Konzentration beginnen', exact: true }).click();
    await ready(page);
    await page.getByRole('button', { name: 'Konzentration beenden', exact: true }).waitFor();
    assert.match(await row(page).innerText(), /Konzentration/);
    assert.equal(await page.locator('#fighter-values').evaluate((e) => e.open), false);
    await page.locator('#fighter-condition-panel').scrollIntoViewIfNeeded();
    await shot(page, 'enabled');
    await page.locator('#fighter-amount').fill('32');
    await page.locator('#fighter-damage').click();
    await ready(page);
    await page.waitForFunction(() =>
      document.getElementById('combat-concentration-result').textContent.includes('SG 16'),
    );
    assert.equal(await page.locator('#combat-concentration-modifier').inputValue(), '1');
    assert.match(
      await page.locator('#combat-concentration-result').innerText(),
      /CON \+1 laut Statblock/,
    );
    assert.equal(await page.locator('#combat-next').isDisabled(), true);
    assert.equal(await page.locator('#combat-finish').isDisabled(), true);
    assert.equal(await page.locator('#fighter-concentration-toggle').isDisabled(), true);
    await page.locator('#combat-concentration-modifier').fill('4');
    await page.locator('#combat-history-details > summary').click();
    await page.locator('#combat-refresh').click();
    await ready(page);
    await page.locator('#combat-history-details > summary').click();
    assert.equal(await page.locator('#combat-concentration-modifier').inputValue(), '4');
    await page.locator('#fighter-amount').fill('32');
    await page.locator('#fighter-damage').click();
    await ready(page);
    assert.match(
      await page.locator('#combat-concentration-result').innerText(),
      /1 von 2 offenen Prüfungen/,
    );
    assert.equal(
      await page.locator('#combat-concentration-modifier').inputValue(),
      '4',
      'Adding a hit behind the current check must preserve its override',
    );
    await page.locator('#combat-concentration-effect').scrollIntoViewIfNeeded();
    await shot(page, 'pending');
    await close();
    page = await launch();
    assert.match(
      await page.locator('#combat-concentration-result').innerText(),
      /SG 16.*32 Schaden.*CON \+1/,
    );
    assert.equal(await page.locator('#combat-concentration-modifier').inputValue(), '1');
    assert.equal(await page.locator('#combat-next').isDisabled(), true);
    await page.locator('#combat-concentration-effect').scrollIntoViewIfNeeded();
    await shot(page, 'resumed');
    await page.locator('#combat-concentration-modifier').fill('4');
    await page.locator('#combat-concentration-pass').click();
    await ready(page);
    assert.match(
      await page.locator('#combat-concentration-result').innerText(),
      /SG 16.*32 Schaden/,
    );
    assert.equal(
      await page.locator('#combat-concentration-modifier').inputValue(),
      '1',
      'A completed check cannot lend its override to the next identical hit',
    );
    assert.doesNotMatch(await page.locator('#combat-concentration-result').innerText(), /1 von 2/);
    assert.match(await row(page).innerText(), /35 \/ 99.*Konzentration/s);
    await page.locator('#combat-concentration-modifier').fill('5');
    await page.locator('#combat-undo').click();
    await ready(page);
    assert.match(
      await page.locator('#combat-concentration-result').innerText(),
      /1 von 2 offenen Prüfungen/,
    );
    assert.equal(
      await page.locator('#combat-concentration-modifier').inputValue(),
      '1',
      'Undo restores a check without borrowing its successor correction',
    );
    await page.locator('#combat-concentration-pass').click();
    await ready(page);
    assert.equal(await page.locator('#combat-concentration-modifier').inputValue(), '1');
    await page.locator('#combat-concentration-effect').scrollIntoViewIfNeeded();
    await shot(page, 'next-check');
    await page.locator('#combat-concentration-fail').click();
    await ready(page);
    await page.locator('#combat-concentration-effect').waitFor({ state: 'hidden' });
    assert.match(await row(page).innerText(), /35 \/ 99/);
    assert.doesNotMatch(await row(page).innerText(), /Konzentration/);
    await row(page)
      .getByRole('button', { name: /HP · Schaden oder Heilung/ })
      .click();
    await page.locator('#fighter-amount').fill('7');
    await page.locator('#fighter-damage').click();
    await ready(page);
    assert.equal(await page.locator('#combat-concentration-effect').isHidden(), true);
    assert.match(await row(page).innerText(), /28 \/ 99/);
    await page.locator('#combat-next').click();
    await ready(page);
    assert.match(await page.locator('#combat-status').innerText(), /Runde 1.*Am Zug: Archmage A/);
    await page.locator('#combat-rows').scrollIntoViewIfNeeded();
    await shot(page, 'continued');
    await page.locator('#combat-finish').click();
    await page.locator('#combat-outcome').fill('Erzmagier gibt ohne Konzentration auf');
    await page.locator('#finish-no-xp').check();
    await page
      .getByRole('button', { name: 'Ergebnis speichern und abschließen', exact: true })
      .click();
    await page.waitForFunction(() =>
      document
        .getElementById('combat-status')
        .textContent.includes('Abgeschlossen · Erzmagier gibt ohne Konzentration auf'),
    );
    await close();
    page = await launch();
    assert.match(
      await page.locator('#combat-status').innerText(),
      /Abgeschlossen · Erzmagier gibt ohne Konzentration auf/,
    );
    assert.match(
      await page.locator('#combat-resolution').innerText(),
      /Archmage A · 28 HP bei Kampfabschluss/,
    );
    assert.doesNotMatch(await row(page).innerText(), /Konzentration/);
    await page.locator('#combat-resolution').scrollIntoViewIfNeeded();
    await shot(page, 'finished');
    await close();
    const fresh = new CampaignStore(file);
    try {
      const active = fresh.activate(campaign.id),
        c = fresh.combat(active.token, scene.id).combat,
        p = c.participants.find((p) => p.id === actorId);
      assert.equal(c.phase, 'finished');
      assert.equal(c.outcome, 'Erzmagier gibt ohne Konzentration auf');
      assert.equal(c.rewards.totalXp, 0);
      assert.equal(p.hp, 28);
      assert.equal(p.concentrating, false);
      assert.equal(p.concentrationChecks, undefined);
      assert.equal(p.concentrationLast.success, false);
      assert.deepEqual(
        c.participants.filter((p) => p.characterId).map((p) => p.hp),
        [20, 18],
      );
    } finally {
      fresh.close();
    }
    await native.finish({ hp: 28, concentrating: false, damagePerCheck: 32, dc: 16, modifier: 1 });
    console.log('Separate concentration checks, restart and finish verified', zoom);
  } catch (error) {
    await native.fail(error);
    throw error;
  } finally {
    await native.dispose();
  }
}
const runs = await Promise.all(
  [1].map(async (z) =>
    JSON.parse(await readFile(path.join(output, String(z), 'result.json'), 'utf8')),
  ),
);
await writeFile(path.join(output, 'result.json'), JSON.stringify({ runs }, null, 2));
