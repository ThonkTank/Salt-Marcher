import { openNativeCampaign, revealWorkspaceNavigation } from './native-navigation.mjs';
// Real dossier → original profile draft → normal restart → explicit history append.
import { createRequire } from 'node:module';
import { mkdir, writeFile, rm } from 'node:fs/promises';
import { execFileSync } from 'node:child_process';
import { randomUUID } from 'node:crypto';
import assert from 'node:assert/strict';
import { createNativeSession } from './native-session.mjs';
const root = process.cwd(),
  require = createRequire(root + '/package.json');
const out = process.env.QA_EVIDENCE_DIR ?? root + '/.build/npc-conversation';
await mkdir(out, { recursive: true });
await rm(out + '/result.json', { force: true });
await rm(out + '/failure.json', { force: true });
require('esbuild').buildSync({
  entryPoints: ['src/app/storage/store.ts'],
  outfile: '.build/npc-conversation-store.cjs',
  bundle: true,
  platform: 'node',
  format: 'cjs',
  external: ['better-sqlite3'],
});
const { CampaignStore } = require(root + '/.build/npc-conversation-store.cjs');
const source = execFileSync('git', ['rev-parse', 'HEAD'], { encoding: 'utf8' }).trim(),
  dirty = !!execFileSync('git', ['status', '--porcelain'], { encoding: 'utf8' }).trim(),
  launches = [],
  results = [];
let native,
  page,
  captureSequence = 0;
const capture = (name) => native.capture(page, `${++captureSequence}-${name}`);
async function live() {
  await revealWorkspaceNavigation(page);
  await page.locator('#live-tab').click();
  await page.getByRole('button', { name: 'NSCs am Spieltisch…', exact: true }).waitFor();
}
async function launch(scale, campaign) {
  page = await native.launch(scale);
  await openNativeCampaign(page, campaign.id);
  await live();
}
async function dossier(id) {
  await page.getByRole('button', { name: 'NSCs am Spieltisch…', exact: true }).click();
  await page.locator('#npc-cast-list [data-npc-id="' + id + '"]').click();
  await page
    .locator('#npc-cast')
    .getByRole('button', { name: 'Gespräch festhalten…', exact: true })
    .waitFor({ state: 'visible' });
}
async function conversation(npc) {
  await dossier(npc.id);
  await page.getByRole('button', { name: 'Gespräch festhalten…', exact: true }).click();
  await page.waitForFunction(
    (name) =>
      document.getElementById('npc-name').value === name &&
      !document.getElementById('npc-editor').inert,
    npc.name,
  );
  await page.waitForFunction(() => document.activeElement?.id === 'npc-contact');
  const visible = await page.locator('#npc-contact').evaluate((el) => {
    const r = el.getBoundingClientRect(),
      x = r.x + r.width / 2,
      y = r.y + r.height / 2;
    return {
      top: r.top,
      bottom: r.bottom,
      viewport: innerHeight,
      uncovered: y > 0 && y < innerHeight && document.elementFromPoint(x, y) === el,
    };
  });
  await capture('conversation-entry-' + launches.length);
  assert(
    visible.top >= 0 && visible.bottom <= visible.viewport && visible.uncovered,
    'Conversation action must leave its focused field visible',
  );
  return visible;
}
try {
  for (const scale of [1]) {
    native = await createNativeSession({
      root,
      output: out + '/' + scale,
      name: 'npc-conversation',
    });
    const profile = native.profile;
    assert.equal(native.source, source);
    assert.equal(native.dirty, dirty);
    const store = new CampaignStore(profile + '/workbench.sqlite'),
      campaign = store.create('Gespräch an der Hafenwache'),
      w = store.activate(campaign.id);
    const command = (action) => ({
      commandId: randomUUID(),
      campaignId: campaign.id,
      token: w.token,
      action,
    });
    let scene = store.executeLive(command({ kind: 'initialize', expectedRosterRevision: 0 })).scene;
    scene = store.executeLive(
      command({
        kind: 'scene-content',
        sceneId: scene.id,
        expectedRevision: scene.revision,
        title: 'Nachtwache am Zollhaus',
        notes: '  Szenennotiz bleibt.\r\n',
        locationId: null,
      }),
    ).scene;
    const npcs = [];
    for (const name of ['Hafenmeisterin Mira', 'Späher Borin']) {
      const id = randomUUID();
      npcs.push(
        store.executeNpc({
          ...command(null),
          expectedNoteRevision: null,
          expectedRecordRevision: 0,
          expectedActorRevision: null,
          expectedPositionRevision: null,
          npc: {
            id,
            name,
            creatureId: null,
            readAloud: '  Ein ruhiger Blick.\r\n',
            gmNotes: '  Geheimnis: ' + name + '\r\n',
            record: {
              id,
              revision: 0,
              factionId: null,
              modifier: 0,
              lifecycle: 'active',
              appearance: 'Reisemantel',
              behavior: 'Wachsam',
              history: '  Frühere Begegnung.\r\n',
            },
            locationId: null,
            health: null,
          },
        }),
      );
    }
    const [npc, other] = npcs,
      receiptsBefore = store.db.prepare('SELECT count(*) n FROM npc_receipt').get().n;
    store.tutorial('skipped');
    store.close();
    await launch(scale, campaign);
    const entry = await conversation(npc),
      header = await page.locator('#npc-contact').inputValue();
    assert.match(header, /Nachtwache am Zollhaus\n$/);
    const whitespace = '  \n\t  ';
    await page.locator('#npc-contact').fill(whitespace);
    await page.waitForFunction(() =>
      document.getElementById('npc-save-status').textContent.includes('Entwurf gesichert'),
    );
    await live();
    await conversation(npc);
    assert.equal(
      await page.locator('#npc-contact').inputValue(),
      whitespace,
      'Opening a conversation must preserve a whitespace-only draft',
    );
    const contact =
      header + 'Mira nennt den Geheimgang unter dem Zollhaus.\n  Noch nicht bestätigt.  ';
    await page.locator('#npc-contact').fill(contact);
    await page.waitForFunction(() =>
      document.getElementById('npc-save-status').textContent.includes('Entwurf gesichert'),
    );
    await native.close();
    const check = new CampaignStore(profile + '/workbench.sqlite');
    try {
      const active = check.activate(campaign.id);
      assert.equal(check.npcDraft(active.token, npc.id).fields.contact, contact);
      assert.deepEqual(check.npc(active.token, npc.id), npc);
      assert.deepEqual(check.npc(active.token, other.id), other);
      assert.equal(check.db.prepare('SELECT count(*) n FROM npc_receipt').get().n, receiptsBefore);
    } finally {
      check.close();
    }
    await launch(scale, campaign);
    const resumed = await conversation(npc);
    assert.equal(
      await page.locator('#npc-contact').inputValue(),
      contact,
      'Returning to a draft must not append another conversation header',
    );
    await page.locator('#npc-contact').fill(contact + '\nFür den nächsten Abend bestätigt.');
    const confirmed = await page.locator('#npc-contact').inputValue();
    await page
      .locator('#npc-editor')
      .getByRole('button', { name: 'NPC übernehmen', exact: true })
      .click();
    await page.waitForFunction(
      () => document.getElementById('npc-save-status').textContent === 'Gespeicherter Stand.',
    );
    assert.equal(await page.locator('#npc-contact').inputValue(), '');
    await native.close();
    const verify = new CampaignStore(profile + '/workbench.sqlite');
    try {
      const active = verify.activate(campaign.id),
        saved = verify.npc(active.token, npc.id);
      assert.equal(saved.record.history, npc.record.history + '\n\n' + confirmed);
      assert.equal(saved.readAloud, npc.readAloud);
      assert.equal(saved.gmNotes, npc.gmNotes);
      assert.equal(saved.record.appearance, npc.record.appearance);
      assert.equal(saved.record.behavior, npc.record.behavior);
      assert.equal(verify.npcDraft(active.token, npc.id), null);
      assert.deepEqual(verify.npc(active.token, other.id), other);
      assert.equal(
        verify.db.prepare('SELECT count(*) n FROM npc_receipt').get().n,
        receiptsBefore + 1,
      );
      assert.deepEqual(verify.live(active.token).scene, scene);
    } finally {
      verify.close();
    }
    await launch(scale, campaign);
    await dossier(npc.id);
    await page
      .locator('#npc-cast-document')
      .getByText('Für den nächsten Abend bestätigt.', { exact: false })
      .scrollIntoViewIfNeeded();
    assert.equal(
      (await page.locator('#npc-cast-document').innerText()).split('Mira nennt den Geheimgang')
        .length - 1,
      1,
    );
    await capture('confirmed-dossier-' + scale);
    // The ordinary profile action keeps its own name-field entry rather than the conversation entry.
    await page.getByRole('button', { name: 'Profil bearbeiten…', exact: true }).click();
    await page.waitForFunction(() => document.activeElement?.id === 'npc-name');
    assert(
      await page.locator('#npc-name').evaluate((el) => {
        const r = el.getBoundingClientRect();
        return r.top >= 0 && r.bottom <= innerHeight;
      }),
    );
    assert.equal(await page.locator('#npc-contact').inputValue(), '');
    await native.close();
    results.push({
      scale,
      profile,
      campaignId: campaign.id,
      entry,
      resumed,
      rawDraftRestored: true,
      oneConfirmedHistoryAppend: true,
      originalProseAndOtherNpcUnchanged: true,
      ordinaryProfileEntry: true,
      whitespaceDraftPreserved: true,
    });
    await native.finish({ complete: true, result: results.at(-1) });
    launches.push(...native.launches);
    await native.dispose();
    native = null;
  }
  await writeFile(
    out + '/result.json',
    JSON.stringify({ source, dirty, launches, results }, null, 2),
  );
  console.log(JSON.stringify({ source, results, launches }));
} catch (error) {
  await rm(out + '/result.json', { force: true });
  await native?.fail(error);
  throw error;
} finally {
  await native?.dispose();
}
