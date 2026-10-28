// Author a weekly visit and rest days, retain a raw draft, then read the same
// future visit in the native dossier and location map before and after restart.
import { createNativeSession } from './native-session.mjs';
import { createRequire } from 'node:module';
import { randomUUID } from 'node:crypto';
import assert from 'node:assert/strict';
const root = process.cwd(),
  require = createRequire(root + '/package.json');
const output = process.env.QA_EVIDENCE_DIR ?? root + '/.build/npc-weekly-visits';
const native = await createNativeSession({ root, output, name: 'npc-weekly-visits' });
require('esbuild').buildSync({
  entryPoints: ['src/app/storage/store.ts'],
  outfile: '.build/weekly-visits-store.cjs',
  bundle: true,
  platform: 'node',
  format: 'cjs',
  external: ['better-sqlite3'],
});
const { CampaignStore } = require(root + '/.build/weekly-visits-store.cjs'),
  results = [];
let page;
async function live() {
  if (await page.locator('#atlas-navigation').isVisible())
    await page.locator('#atlas-navigation').click();
  if (!(await page.locator('#live-tab').isVisible()))
    await page.locator('#workspace-nav-summary').click();
  await page.locator('#live-tab').click();
}
async function launch(zoom, campaign) {
  page = await native.launch(zoom);
  await page
    .locator('.campaign-card[data-campaign-id="' + campaign.id + '"]')
    .getByRole('button', { name: /Öffnen|Fortsetzen/ })
    .click();
  await page.waitForFunction(() => !document.getElementById('workspace-navigation').inert);
  await live();
}
async function dossier(id) {
  await page.getByRole('button', { name: 'NSCs am Spieltisch…', exact: true }).click();
  await page.locator('#npc-cast-list [data-npc-id="' + id + '"]').click();
  await page.getByRole('button', { name: 'Profil bearbeiten…', exact: true }).waitFor();
}
async function edit() {
  await page.getByRole('button', { name: 'Profil bearbeiten…', exact: true }).click();
  await page.waitForFunction(() => document.activeElement?.id === 'npc-name');
}
async function save() {
  await page
    .locator('#npc-editor')
    .getByRole('button', { name: 'NPC übernehmen', exact: true })
    .click();
  await page.waitForFunction(
    () => document.getElementById('npc-save-status').textContent === 'Gespeicherter Stand.',
  );
}
async function visits(zoom, day, stage, id) {
  const plan = page.locator('#npc-cast-daily-plan');
  assert.match(
    await plan.innerText(),
    new RegExp('Als Nächstes: Erster Tag, ' + day + '\\. Frühmond 1 · 00:00 · Marktaufsicht'),
  );
  assert.match(await plan.innerText(), /tatsächlicher Standort: Ohne Ortsbindung/);
  await native.capture(page, stage + '-dossier-' + zoom, '#npc-cast-daily-plan');
  await page.getByRole('button', { name: 'Geplantes Ziel: Hafenmarkt', exact: true }).click();
  const details = page.locator('#location-activity');
  if (!(await details.evaluate((el) => el.open))) await details.locator('summary').click();
  await page.locator('[data-location-activity-npc="' + id + '"]').waitFor();
  assert.match(
    await details.innerText(),
    new RegExp('Nächster Besuch: Erster Tag, ' + day + '\\. Frühmond 1 · 00:00 · Marktaufsicht'),
  );
  assert.match(await details.innerText(), /Tatsächlicher Standort: Ohne Ortsbindung/);
  await native.capture(page, stage + '-location-' + zoom, '#location-activity-rows');
}
try {
  for (const zoom of [1]) {
    const store = new CampaignStore(native.profile + '/workbench.sqlite'),
      campaign = store.create('Wochenbesuch ' + zoom),
      w = store.activate(campaign.id);
    const cmd = (action) => ({
      commandId: randomUUID(),
      campaignId: campaign.id,
      token: w.token,
      action,
    });
    const scene = store.executeLive(cmd({ kind: 'initialize', expectedRosterRevision: 0 })).scene;
    const place = {
      kind: 'location',
      version: 1,
      id: randomUUID(),
      name: 'Hafenmarkt',
      type: 'poi',
      sections: [{ id: randomUUID(), title: 'GM', markdown: 'Stände am Wasser' }],
      detailMaps: [],
      keyLinks: [],
    };
    store.changePreparation({
      ...cmd(null),
      change: { kind: 'location', expectedRevision: null, document: place },
    });
    const npcs = [];
    for (const name of ['Hafenmeisterin Mira', 'Späher Borin']) {
      const id = randomUUID();
      npcs.push(
        store.executeNpc({
          ...cmd(null),
          expectedNoteRevision: null,
          expectedRecordRevision: 0,
          expectedActorRevision: null,
          expectedPositionRevision: null,
          npc: {
            id,
            name,
            creatureId: null,
            readAloud: '  Reisemantel.\r\n',
            gmNotes: '  Privater Hinweis.\r\n',
            record: {
              id,
              revision: 0,
              factionId: null,
              modifier: 0,
              lifecycle: 'active',
              appearance: '',
              behavior: '',
              history: '',
            },
            locationId: null,
            health: null,
          },
        }),
      );
    }
    const [npc, other] = npcs;
    store.tutorial('skipped');
    store.close();
    await launch(zoom, campaign);
    await dossier(npc.id);
    await edit();
    await page.locator('#npc-daily-add').click();
    await page.locator('[data-daily-field="start"]').fill('00:00');
    await page.locator('[data-daily-field="end"]').fill('12:00');
    await page.locator('[data-daily-field="activity"]').fill('Marktaufsicht');
    await page.locator('[data-daily-field="place"]').selectOption('location');
    await page.locator('[data-daily-field="locationId"]').selectOption(place.id);
    await page.locator('[data-daily-every]').uncheck();
    await page.locator('[data-daily-weekday="0"]').check();
    await page.locator('#npc-daily-override-add').click();
    await page.waitForFunction(() =>
      document.getElementById('npc-save-status').textContent.includes('Entwurf gesichert'),
    );
    // The incomplete exception is raw author input, not a confirmed calendar fact.
    await native.close();
    const check = new CampaignStore(native.profile + '/workbench.sqlite');
    try {
      const a = check.activate(campaign.id);
      assert.deepEqual(check.npc(a.token, npc.id), npc);
      assert.equal(JSON.parse(check.npcDraft(a.token, npc.id).fields.dailyOverrides)[0].day, '');
    } finally {
      check.close();
    }
    await launch(zoom, campaign);
    await dossier(npc.id);
    await edit();
    assert.equal(await page.locator('[data-daily-field="activity"]').inputValue(), 'Marktaufsicht');
    assert.equal(await page.locator('[data-override-field="day"]').inputValue(), '');
    await page.locator('[data-override-field="day"]').fill('8');
    await save();
    await live();
    await dossier(npc.id);
    await visits(zoom, 15, 'first', npc.id);
    // Continue editing the original profile directly from its planned visit.
    await page.locator('[data-location-activity-profile="' + npc.id + '"]').click();
    await page.waitForFunction(() => document.activeElement?.id === 'npc-name');
    await page.locator('#npc-daily-override-add').click();
    await page.locator('[data-override-field="day"]').nth(1).fill('15');
    await save();
    await native.close();
    await launch(zoom, campaign);
    await dossier(npc.id);
    await visits(zoom, 22, 'fresh', npc.id);
    await native.close();
    const fresh = new CampaignStore(native.profile + '/workbench.sqlite');
    try {
      const a = fresh.activate(campaign.id),
        saved = fresh.npc(a.token, npc.id);
      assert.deepEqual(
        saved.record.dailyOverrides.map((o) => o.day),
        ['8', '15'],
      );
      assert.equal(saved.record.dailyPlan[0].locationId, place.id);
      assert.deepEqual(saved.record.dailyPlan[0].weekdays, [0]);
      assert.equal(saved.locationId, null);
      assert.equal(saved.readAloud, npc.readAloud);
      assert.equal(saved.gmNotes, npc.gmNotes);
      assert.equal(fresh.npcDraft(a.token, npc.id), null);
      assert.deepEqual(fresh.npc(a.token, other.id), other);
      assert.deepEqual(fresh.live(a.token).scene, scene);
    } finally {
      fresh.close();
    }
    results.push({
      zoom,
      rawDraftRestored: true,
      weeklyVisitAfterRestDay: 15,
      weeklyVisitAfterTwoRestDays: 22,
      dossierAndLocationAgree: true,
      originalIdentityAndProsePreserved: true,
      sceneAndOtherNpcUnchanged: true,
    });
  }
  await native.finish({ results });
  console.log(JSON.stringify({ results, launches: native.launches }));
} catch (error) {
  await native.fail(error);
  throw error;
} finally {
  await native.dispose();
}
