import { test } from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync, mkdtempSync, mkdirSync, copyFileSync, rmSync } from 'node:fs';
import { tmpdir } from 'node:os';
import path from 'node:path';
import { randomUUID, createHash } from 'node:crypto';
import { createRequire } from 'node:module';
import { buildSync } from '../helpers/build.mjs';
import { parseHTML } from '../helpers/dom.mjs';
const base = '.build/planner-session-packet',
  require = createRequire(import.meta.url);
mkdirSync(base + '/catalog', { recursive: true });
copyFileSync(
  'src/features/catalog/data/srd-5.1.generated.json',
  base + '/catalog/srd-5.1.generated.json',
);
buildSync({
  entryPoints: ['src/app/storage/store.ts'],
  outfile: base + '/store.cjs',
  bundle: true,
  platform: 'node',
  format: 'cjs',
  external: ['better-sqlite3'],
});
buildSync({
  stdin: {
    contents:
      "export * from './src/app/campaign/session-packet-ui';export * from './src/app/campaign/session-packet-contracts';",
    resolveDir: process.cwd(),
    loader: 'ts',
  },
  outfile: base + '/ui.cjs',
  bundle: true,
  platform: 'node',
  format: 'cjs',
});
const { CampaignStore } = require('../../' + base + '/store.cjs');
const wait = async () => {
    for (let i = 0; i < 5; i++) await new Promise((r) => setImmediate(r));
  },
  deferred = () => {
    let resolve;
    const promise = new Promise((r) => (resolve = r));
    return { promise, resolve };
  };
const packet = (basis = 'one') => ({
  planId: 'plan',
  planName: 'Abend',
  planRevision: 1,
  campaignName: 'Welt',
  basis,
  party: [],
  warnings: [],
  visits: [
    {
      id: 'first',
      title: 'Ankunft',
      location: 'Tor',
      blocks: [{ heading: 'Vorlesen', text: '  Geheimwort\r\n**Wache**  ', kind: 'read-aloud' }],
    },
    {
      id: 'second',
      title: 'Schatz',
      location: null,
      blocks: [{ heading: 'Belohnung', text: 'Saphir', kind: 'reward' }],
    },
  ],
});
function uiSetup(t, offerVisit) {
  const { window, document } = parseHTML(readFileSync('src/app/workspace/index.html', 'utf8')),
    saved = { window: globalThis.window, document: globalThis.document };
  Object.assign(globalThis, { window, document });
  const messages = [],
    exports = [];
  let owner = { token: 'token', planId: 'plan' };
  window.campaign = {
    sessionPacket: async () => ({ ok: true, value: packet() }),
    exportSessionPacket: async (...args) => {
      exports.push(args);
      return { ok: true, value: { cancelled: false } };
    },
  };
  delete require.cache[require.resolve('../../' + base + '/ui.cjs')];
  const ui = require('../../' + base + '/ui.cjs'),
    x = {
      window,
      document,
      ui,
      messages,
      exports,
      flush: async () => true,
      setOwner: (o) => (owner = o),
      el: (id) => document.getElementById('session-packet-' + id),
    };
  ui.initSessionPacket(
    (text, error) => messages.push({ text, error }),
    () => owner,
    () => x.flush(),
    offerVisit,
  );
  const d = x.el('dialog');
  d.open = false;
  d.showModal = () => {
    d.open = true;
  };
  d.close = () => {
    d.open = false;
  };
  t.after(async () => {
    ui.closeSessionPacket();
    await wait();
    Object.assign(globalThis, saved);
  });
  return x;
}
test('search covers every visit and export retains the whole viewed snapshot', async (t) => {
  const x = uiSetup(t);
  x.el('open').click();
  await wait();
  x.el('search').value = 'saphir';
  x.el('search').oninput();
  assert.equal(x.el('count').textContent, '1 von 2 Besuchen');
  assert.match(x.el('content').textContent, /Saphir/);
  x.el('export').click();
  await wait();
  assert.deepEqual(x.exports, [['token', 'plan', 'one']]);
  const text = x.ui.sessionPacketMarkdown(packet());
  assert.ok(text.includes('  Geheimwort\r\n**Wache**  '));
  assert.match(text, /Schatz/);
});
test('one note card shares its original action while public cues and private source parts keep separate audiences', async (t) => {
  const x = uiSetup(t),
    p = packet(),
    actions = [],
    ref = (id) => ({ kind: 'reference', ref: { kind: 'note', id } });
  p.visits[0].blocks = [
    { heading: 'Siv · Zum Vorlesen', text: 'Öffentlich', kind: 'read-aloud', action: ref('siv') },
    {
      heading: 'Siv · NSC',
      text: '  Privater Originaltext\r\n',
      kind: 'reference',
      action: ref('siv'),
    },
    { heading: 'Siv · Status und Belohnung', text: 'Offen\n5 XP', kind: 'gm', action: ref('siv') },
    {
      heading: 'Siv · Beziehungen',
      text: 'Quelle → Protokoll',
      kind: 'reference',
      action: ref('siv'),
    },
    {
      heading: 'Andere Siv · NSC',
      text: 'Andere Identität',
      kind: 'reference',
      action: ref('other'),
    },
  ];
  const before = structuredClone(p);
  x.window.campaign.sessionPacket = async () => ({ ok: true, value: p });
  x.ui.setSessionPacketSurface('live');
  await x.ui.openLiveSessionPacket({
    sceneId: 'scene',
    token: 'token',
    planId: 'plan',
    visitId: 'first',
    key: 'one',
    current: () => true,
    flush: async () => true,
    openVisit: async () => {},
    readAloud: async () => {},
    openReference: async (r) => actions.push(r.id),
  });
  const sections = [...x.el('content').querySelectorAll('.packet-block')];
  assert.equal(sections.length, 2);
  assert.equal(x.el('content').querySelectorAll('.packet-runway-steps button').length, 2);
  const siv = sections[0],
    publicCue = siv.querySelector('.packet-read-aloud'),
    privateParts = [...siv.querySelectorAll('.packet-part')].filter((part) => part !== publicCue);
  assert.equal(siv.querySelector('h4').textContent, 'Siv');
  assert.match(publicCue.textContent, /Zum Vorlesen/);
  assert.doesNotMatch(publicCue.textContent, /Privater|5 XP|Protokoll/);
  assert.match(privateParts.map((p) => p.textContent).join(' '), /Privater Originaltext/);
  assert.match(siv.textContent, /Offen/);
  assert.match(siv.textContent, /Quelle → Protokoll/);
  assert.equal(siv.querySelectorAll('.packet-block-action').length, 1);
  siv.querySelector('.packet-block-action').click();
  await wait();
  assert.deepEqual(actions, ['siv']);
  x.el('search').value = 'Quelle →';
  x.el('search').oninput();
  assert.equal(x.el('count').textContent, '1 von 2 Besuchen');
  assert.deepEqual(p, before);
  assert.match(x.ui.sessionPacketMarkdown(p), /Status und Belohnung/);
});
test('a grouped note hands off only its original public bytes and keeps each moment bound to its own part', async (t) => {
  const x = uiSetup(t),
    p = packet(),
    actions = [],
    ref = { kind: 'reference', ref: { kind: 'note', id: 'siv' } };
  p.visits[0].blocks = [
    {
      heading: 'Siv · Zum Vorlesen',
      text: '  Sichtbarer Mantel\r\n',
      kind: 'read-aloud',
      action: ref,
    },
    { heading: 'Siv · NSC', text: 'Geheim: Fährschlüssel', kind: 'reference', action: ref },
  ];
  const before = structuredClone(p);
  x.window.campaign.sessionPacket = async () => ({ ok: true, value: p });
  x.ui.setSessionPacketSurface('live');
  await x.ui.openLiveSessionPacket({
    sceneId: 'scene',
    token: 'token',
    planId: 'plan',
    visitId: 'first',
    key: 'one',
    current: () => true,
    flush: async () => true,
    openVisit: async () => {},
    readAloud: async (text, title) => actions.push(['public', text, title]),
    captureMoment: async (...args) => actions.push(args.slice(0, 3)),
  });
  const card = x.el('content').querySelector('.packet-block'),
    publicButton = card.querySelector('.packet-use-read-aloud'),
    moments = [...card.querySelectorAll('button')].filter(
      (b) => b.textContent === 'Als Chronikmoment vormerken',
    );
  assert.equal(x.el('content').querySelectorAll('.packet-block').length, 1);
  assert.equal(moments.length, 2);
  publicButton.click();
  for (const button of moments) button.click();
  await wait();
  assert.deepEqual(actions, [
    ['public', '  Sichtbarer Mantel\r\n', 'Siv · Zum Vorlesen'],
    ['world', 'Siv · Zum Vorlesen', '  Sichtbarer Mantel\r\n'],
    ['narrative', 'Siv · NSC', 'Geheim: Fährschlüssel'],
  ]);
  x.el('next').click();
  publicButton.onclick();
  for (const button of moments) button.onclick();
  await wait();
  assert.equal(actions.length, 3);
  assert.deepEqual(p, before);
});
test('a source card never moves note material across an intervening encounter', async (t) => {
  const x = uiSetup(t),
    p = packet(),
    ref = { kind: 'reference', ref: { kind: 'note', id: 'siv' } };
  p.visits[0].blocks = [
    { heading: 'Siv · Zum Vorlesen', text: 'Erst vorlesen', kind: 'read-aloud', action: ref },
    {
      heading: 'Wache',
      text: 'Dann Gegner',
      kind: 'encounter',
      action: { kind: 'encounter', groupId: 'guard', groupRevision: 1 },
    },
    { heading: 'Siv · NSC', text: 'Danach geheim', kind: 'reference', action: ref },
  ];
  x.window.campaign.sessionPacket = async () => ({ ok: true, value: p });
  x.el('open').click();
  await wait();
  const cards = [...x.el('content').querySelectorAll('.packet-block')];
  assert.equal(cards.length, 3);
  assert.match(cards[0].textContent, /Erst vorlesen/);
  assert.doesNotMatch(cards[0].textContent, /Danach geheim/);
  assert.match(cards[1].textContent, /Dann Gegner/);
  assert.match(cards[2].textContent, /Danach geheim/);
});
test('a freshly prepared visit can open its exact packet page directly', async (t) => {
  const x = uiSetup(t);
  assert.equal(await x.ui.openPreparationSessionPacket('second'), true);
  assert.match(x.el('content').querySelector('.packet-runway summary').textContent, /1 Abschnitt$/);
  assert.equal(x.el('dialog').open, true);
  assert.match(x.el('content').textContent, /Schatz/);
  assert.equal(x.el('visits').querySelector('[aria-pressed="true"]')?.dataset.visitId, 'second');
});
test('a preparation packet hands its displayed visit to the existing live preview', async (t) => {
  const calls = [];
  let x;
  x = uiSetup(t, async (planId, visitId, current) => {
    assert.equal(current(), true);
    calls.push([planId, visitId]);
    x.ui.closeSessionPacket();
    assert.equal(current(), false);
  });
  await x.ui.openPreparationSessionPacket('second');
  const button = x.el('content').querySelector('.toolbar button');
  assert.equal(button.textContent, 'Am Spieltisch prüfen…');
  button.click();
  await wait();
  assert.deepEqual(calls, [['plan', 'second']]);
  assert.equal(x.el('dialog').open, false);
});
test('a failed direct packet read is reported to the handoff caller', async (t) => {
  const x = uiSetup(t);
  x.window.campaign.sessionPacket = async () => ({ ok: false, error: 'Damaged packet' });
  assert.equal(await x.ui.openPreparationSessionPacket('second'), false);
  assert.equal(x.messages.at(-1).text, 'Damaged packet');
  assert.equal(x.el('export').disabled, true);
});
test('refresh clears prior contents and keeps export disabled until its current answer', async (t) => {
  const x = uiSetup(t);
  x.el('open').click();
  await wait();
  const reply = deferred();
  x.window.campaign.sessionPacket = () => reply.promise;
  x.el('refresh').click();
  await wait();
  assert.equal(x.el('content').textContent, '');
  assert.equal(x.el('export').disabled, true);
  reply.resolve({ ok: true, value: packet('two') });
  await wait();
  assert.equal(x.el('export').disabled, false);
  assert.equal(x.el('dialog').getAttribute('aria-busy'), 'false');
});
test('an older export answer cannot re-enable export while refresh is waiting', async (t) => {
  const x = uiSetup(t);
  x.el('open').click();
  await wait();
  const exportReply = deferred(),
    query = deferred();
  x.window.campaign.exportSessionPacket = () => exportReply.promise;
  x.el('export').click();
  x.window.campaign.sessionPacket = () => query.promise;
  x.el('refresh').click();
  await wait();
  exportReply.resolve({ ok: true, value: { cancelled: false } });
  await wait();
  assert.equal(x.el('export').disabled, true);
  assert.equal(x.messages.length, 0);
  query.resolve({ ok: true, value: packet('two') });
  await wait();
});
test('late export failure after close does not report into the current workspace', async (t) => {
  const x = uiSetup(t);
  x.el('open').click();
  await wait();
  const reply = deferred();
  x.window.campaign.exportSessionPacket = () => reply.promise;
  x.el('export').click();
  x.el('close').click();
  reply.resolve({ ok: false, error: 'Old failure' });
  await wait();
  assert.deepEqual(x.messages, []);
  assert.equal(x.el('dialog').open, false);
});
test('late read after close cannot reopen or populate the packet', async (t) => {
  const x = uiSetup(t),
    reply = deferred();
  x.window.campaign.sessionPacket = () => reply.promise;
  x.el('open').click();
  await wait();
  x.el('close').click();
  reply.resolve({ ok: true, value: packet() });
  await wait();
  assert.equal(x.el('dialog').open, false);
  assert.equal(x.el('content').textContent, '');
});
test('failed draft flush does not query or export an older packet', async (t) => {
  const x = uiSetup(t);
  x.el('open').click();
  await wait();
  let reads = 0;
  x.window.campaign.sessionPacket = async () => {
    reads++;
    return { ok: true, value: packet() };
  };
  x.flush = async () => false;
  x.el('refresh').click();
  await wait();
  assert.equal(reads, 0);
  assert.equal(x.el('export').disabled, true);
  assert.equal(x.el('dialog').getAttribute('aria-busy'), 'false');
});
test('read failure removes stale source warnings and search count', async (t) => {
  const x = uiSetup(t);
  x.window.campaign.sessionPacket = async () => ({
    ok: true,
    value: { ...packet(), warnings: ['Old warning'] },
  });
  x.el('open').click();
  await wait();
  x.window.campaign.sessionPacket = async () => ({ ok: false, error: 'Damaged source' });
  x.el('refresh').click();
  await wait();
  assert.equal(x.el('warnings').textContent, '');
  assert.equal(x.el('count').textContent, '');
  assert.equal(x.el('export').disabled, true);
  assert.equal(x.messages.at(-1).text, 'Damaged source');
});
function storeSetup(t) {
  const root = mkdtempSync(path.join(tmpdir(), 'packet-')),
    file = path.join(root, 'store.sqlite'),
    store = new CampaignStore(file),
    campaign = store.create('Welt'),
    w = store.activate(campaign.id),
    id = randomUUID(),
    visitId = randomUUID();
  const command = (action) => ({
    commandId: randomUUID(),
    campaignId: campaign.id,
    token: w.token,
    action,
  });
  store.changePreparation({
    ...command(null),
    change: {
      kind: 'plan',
      expectedRevision: null,
      plan: {
        version: 1,
        id,
        revision: 1,
        name: 'Abend',
        scenes: [{ id: visitId, title: 'Ankunft', notes: '  GM\r\nNotiz  ', locationId: null }],
      },
    },
  });
  const x = { store, file, campaign, w, id, visitId, command };
  t.after(() => {
    x.store.close();
    rmSync(root, { recursive: true, force: true });
  });
  return x;
}
test('packet renders repeated statblock details once without rewriting frozen sources', (t) => {
  const x = storeSetup(t),
    ids = ['pony', 'manticore', 'adult-red-dragon', 'goblin'];
  const encounter = x.store.saveEncounterPlan({
    ...x.command(null),
    expectedRevision: null,
    plan: {
      id: randomUUID(),
      revision: 0,
      name: 'Frozen creatures',
      notes: '',
      party: [],
      entries: ids.map((creatureId) => ({
        id: randomUUID(),
        creatureId,
        count: 1,
        grouped: false,
      })),
      sources: [],
      catalogHash: '',
    },
  });
  x.store.executeSession(
    x.command({
      kind: 'attach',
      planId: x.id,
      visitId: x.visitId,
      expectedVisitRevision: x.store.session(x.w.token, x.id).visits[0].revision,
      encounterId: encounter.id,
      expectedEncounterRevision: encounter.revision,
    }),
  );
  const row = x.store.db
      .prepare('SELECT * FROM prepared_group WHERE campaign_id=?')
      .get(x.campaign.id),
    group = JSON.parse(row.payload);
  const pony = group.plan.sources.find((c) => c.id === 'pony'),
    manticore = group.plan.sources.find((c) => c.id === 'manticore'),
    dragon = group.plan.sources.find((c) => c.id === 'adult-red-dragon'),
    goblin = group.plan.sources.find((c) => c.id === 'goblin');
  assert.equal(pony.details, pony.actions[0].description, 'real catalog case: Pony repeats Hooves');
  assert.equal(
    manticore.details,
    manticore.traits[0].description,
    'real catalog case: Manticore repeats Tail Spike Regrowth',
  );
  // An imported frozen source can differ in whitespace or retain a distinct author note.
  dragon.details = '  ' + dragon.legendaryActions[0].description.replace(/ /g, ' \n') + '\r\n';
  const distinct = '  ' + goblin.actions[0].description + '\r\nGM: trägt ein rotes Band.  ';
  goblin.details = distinct;
  const payload = JSON.stringify(group);
  x.store.db
    .prepare('UPDATE prepared_group SET payload=?,checksum=? WHERE campaign_id=? AND id=?')
    .run(payload, createHash('sha256').update(payload).digest('hex'), x.campaign.id, group.id);
  const before = x.store.db.serialize(),
    p = x.store.sessionPacket(x.w.token, x.id);
  const stat = (c) => p.visits[0].blocks.find((b) => b.heading === 'Statblock: ' + c.name).text;
  for (const [c, action] of [
    [pony, pony.actions[0]],
    [manticore, manticore.traits[0]],
    [dragon, dragon.legendaryActions[0]],
  ]) {
    const text = stat(c).replace(/\s+/g, ' '),
      description = action.description.replace(/\s+/g, ' ');
    assert.equal(
      text.split(description).length - 1,
      1,
      c.name + ' rule must be present exactly once',
    );
  }
  assert.ok(stat(goblin).includes(distinct), 'distinct author prose must remain byte-for-byte');
  assert.equal(
    x.store.db.serialize().equals(before),
    true,
    'reading the packet must not mutate sources or other stored data',
  );
  const markdown = require('../../' + base + '/ui.cjs').sessionPacketMarkdown(p);
  assert.equal(
    markdown.split(pony.actions[0].description).length - 1,
    1,
    'export uses the same deduplicated projection',
  );
  assert.ok(markdown.includes(distinct));
  x.store.close();
  x.store = new CampaignStore(x.file);
  const w = x.store.activate(x.campaign.id);
  assert.deepEqual(x.store.sessionPacket(w.token, x.id), p, 'Fresh reads the same usable packet');
  assert.equal(
    x.store.db
      .prepare('SELECT payload FROM prepared_group WHERE campaign_id=? AND id=?')
      .get(x.campaign.id, group.id).payload,
    payload,
    'frozen source bytes remain intact after Fresh',
  );
});
test('SQLite packet preserves prose, reads without writes and changes basis only on changed content', (t) => {
  const x = storeSetup(t),
    before = readFileSync(x.file),
    p = x.store.sessionPacket(x.w.token, x.id);
  assert.equal(p.visits[0].blocks[0].text, '  GM\r\nNotiz  ');
  assert.equal(readFileSync(x.file).equals(before), true);
  assert.equal(x.store.sessionPacket(x.w.token, x.id).basis, p.basis);
  const d = x.store.session(x.w.token, x.id).visits[0];
  x.store.executeSession(
    x.command({
      kind: 'visit',
      planId: x.id,
      expectedRevision: d.revision,
      detail: { ...d, readAloud: '  Vorlesen\r\n\n' },
    }),
  );
  const next = x.store.sessionPacket(x.w.token, x.id);
  assert.notEqual(next.basis, p.basis);
  assert.equal(next.visits[0].blocks[0].text, '  Vorlesen\r\n\n');
  assert.ok(
    require('../../' + base + '/ui.cjs')
      .sessionPacketMarkdown(next)
      .includes('  Vorlesen\r\n\n'),
  );
  x.store.close();
  x.store = new CampaignStore(x.file);
  const w = x.store.activate(x.campaign.id);
  assert.equal(x.store.sessionPacket(w.token, x.id).basis, next.basis);
});
test('packet includes location sections, bound notes, relations and concrete encounter statblocks', (t) => {
  const x = storeSetup(t),
    target = {
      version: 1,
      id: randomUUID(),
      revision: 1,
      kind: 'quest',
      title: 'Auftrag',
      readAloud: '',
      gmNotes: 'Nur GM',
      relations: [],
      creatureId: null,
      deleted: false,
    },
    note = {
      ...target,
      id: randomUUID(),
      kind: 'npc',
      title: 'Wache',
      readAloud: '  Hallo\r\n',
      gmNotes: '  Geheimnis  ',
      relations: [{ targetId: target.id, label: 'weiß von' }],
    };
  for (const n of [target, note])
    x.store.changePreparation({
      ...x.command(null),
      change: { kind: 'note', expectedRevision: null, note: n },
    });
  const location = {
    kind: 'location',
    version: 1,
    id: randomUUID(),
    name: 'Tor',
    type: 'poi',
    sections: [{ id: randomUUID(), title: 'Inschrift', markdown: '  Runen\r\n**Alt**  ' }],
    detailMaps: [],
    keyLinks: [],
  };
  x.store.changePreparation({
    ...x.command(null),
    change: { kind: 'location', expectedRevision: null, document: location },
  });
  x.store.changePreparation({
    ...x.command(null),
    change: {
      kind: 'plan',
      expectedRevision: 1,
      plan: {
        version: 1,
        id: x.id,
        revision: 1,
        name: 'Abend',
        scenes: [
          { id: x.visitId, title: 'Ankunft', notes: '  GM\r\nNotiz  ', locationId: location.id },
        ],
      },
    },
  });
  const d = x.store.session(x.w.token, x.id).visits[0];
  x.store.executeSession(
    x.command({
      kind: 'visit',
      planId: x.id,
      expectedRevision: d.revision,
      detail: { ...d, noteIds: [note.id] },
    }),
  );
  const encounter = x.store.saveEncounterPlan({
    ...x.command(null),
    expectedRevision: null,
    plan: {
      id: randomUUID(),
      revision: 0,
      name: 'Goblinwache',
      notes: 'Gegenüber',
      party: [],
      entries: [{ id: randomUUID(), creatureId: 'goblin', count: 2, grouped: false }],
      sources: [],
      catalogHash: '',
    },
  });
  x.store.executeSession(
    x.command({
      kind: 'attach',
      planId: x.id,
      visitId: x.visitId,
      expectedVisitRevision: x.store.session(x.w.token, x.id).visits[0].revision,
      encounterId: encounter.id,
      expectedEncounterRevision: encounter.revision,
    }),
  );
  const p = x.store.sessionPacket(x.w.token, x.id),
    blocks = p.visits[0].blocks;
  assert.equal(p.visits[0].location, 'Tor');
  assert.ok(blocks.some((b) => b.text === '  Runen\r\n**Alt**  '));
  assert.ok(blocks.some((b) => b.text === '  Hallo\r\n'));
  assert.ok(blocks.some((b) => b.text === '  Geheimnis  '));
  assert.ok(blocks.some((b) => b.text === 'weiß von → Auftrag'));
  assert.ok(blocks.some((b) => b.heading === 'Begegnung: Goblinwache'));
  assert.ok(
    blocks.some(
      (b) =>
        b.heading.startsWith('Statblock:') &&
        b.text.includes('Aktion:') &&
        b.text.includes('Quelle:'),
    ),
  );
});
test('a damaged unrelated world note does not block the packet; a bound damaged note fails without writes', (t) => {
  const x = storeSetup(t),
    note = {
      version: 1,
      id: randomUUID(),
      revision: 1,
      kind: 'quest',
      title: 'Auftrag',
      readAloud: '',
      gmNotes: 'Text',
      relations: [],
      creatureId: null,
      deleted: false,
    };
  x.store.changePreparation({
    ...x.command(null),
    change: { kind: 'note', expectedRevision: null, note },
  });
  x.store.db
    .prepare('UPDATE world_note SET checksum=? WHERE campaign_id=? AND id=?')
    .run('damaged', x.campaign.id, note.id);
  assert.doesNotThrow(() => x.store.sessionPacket(x.w.token, x.id));
  const row = x.store.db
    .prepare('SELECT payload FROM world_note WHERE campaign_id=? AND id=?')
    .get(x.campaign.id, note.id);
  x.store.db
    .prepare('UPDATE world_note SET checksum=? WHERE campaign_id=? AND id=?')
    .run(createHash('sha256').update(row.payload).digest('hex'), x.campaign.id, note.id);
  const d = x.store.session(x.w.token, x.id).visits[0];
  x.store.executeSession(
    x.command({
      kind: 'visit',
      planId: x.id,
      expectedRevision: d.revision,
      detail: { ...d, noteIds: [note.id] },
    }),
  );
  x.store.db
    .prepare('UPDATE world_note SET checksum=? WHERE campaign_id=? AND id=?')
    .run('damaged', x.campaign.id, note.id);
  const before = readFileSync(x.file);
  assert.throws(() => x.store.sessionPacket(x.w.token, x.id), /beschädigt/);
  assert.equal(readFileSync(x.file).equals(before), true);
});
test('archived bound world content is explicitly warned and changes the exported basis', (t) => {
  const x = storeSetup(t),
    note = {
      version: 1,
      id: randomUUID(),
      revision: 1,
      kind: 'quest',
      title: 'Auftrag',
      readAloud: '',
      gmNotes: 'Text',
      relations: [],
      creatureId: null,
      deleted: false,
    };
  x.store.changePreparation({
    ...x.command(null),
    change: { kind: 'note', expectedRevision: null, note },
  });
  const d = x.store.session(x.w.token, x.id).visits[0];
  x.store.executeSession(
    x.command({
      kind: 'visit',
      planId: x.id,
      expectedRevision: d.revision,
      detail: { ...d, noteIds: [note.id] },
    }),
  );
  const before = x.store.sessionPacket(x.w.token, x.id);
  x.store.db
    .prepare('UPDATE world_note SET trashed=1 WHERE campaign_id=? AND id=?')
    .run(x.campaign.id, note.id);
  const p = x.store.sessionPacket(x.w.token, x.id);
  assert.notEqual(p.basis, before.basis);
  assert.ok(p.warnings.some((w) => w.includes(note.id)));
  assert.match(require('../../' + base + '/ui.cjs').sessionPacketMarkdown(p), /## Offene Quellen/);
});
test('removing an adopted planning visit does not break live preparation queries', (t) => {
  const x = storeSetup(t),
    scene = x.store.executeLive(x.command({ kind: 'initialize', expectedRosterRevision: 0 })).scene;
  x.store.executeLive(
    x.command({
      kind: 'apply-visit',
      planId: x.id,
      expectedPlanRevision: 1,
      visitId: x.visitId,
      expectedVisitRevision: 0,
      sceneId: scene.id,
      expectedRevision: scene.revision,
    }),
  );
  x.store.changePreparation({
    ...x.command(null),
    change: {
      kind: 'plan',
      expectedRevision: 1,
      plan: { version: 1, id: x.id, revision: 1, name: 'Abend', scenes: [] },
    },
  });
  const p = x.store.scenePreparation(x.w.token, scene.id);
  assert.deepEqual(p.noteIds, []);
  assert.equal(p.nextVisit, null);
  assert.equal(x.store.live(x.w.token).scene.adoption.visitId, x.visitId);
});

test('docked packet reuses the same reader and routes visit and authored text actions', async (t) => {
  const x = uiSetup(t),
    actions = [];
  x.ui.setSessionPacketSurface('live');
  const source = {
    sceneId: 'scene',
    token: 'token',
    planId: 'plan',
    visitId: 'first',
    key: 'one',
    current: () => true,
    flush: async () => true,
    openVisit: async (id) => actions.push(['visit', id]),
    readAloud: async (text, title) => actions.push(['text', text, title]),
  };
  const panel = x.document.getElementById('live-party-panel'),
    hidden = panel.hidden;
  await x.ui.openLiveSessionPacket(source);
  assert.equal(x.el('dialog').parentElement.id, 'live-packet-host');
  assert.equal(panel.hidden, true);
  x.el('content').querySelector('.toolbar button').click();
  x.el('content').querySelector('.packet-use-read-aloud').click();
  await wait();
  assert.deepEqual(actions, [
    ['visit', 'first'],
    ['text', '  Geheimwort\r\n**Wache**  ', 'Vorlesen'],
  ]);
  x.el('next').click();
  assert.match(x.el('content').textContent, /Schatz/);
  x.el('prev').click();
  assert.match(x.el('content').textContent, /Ankunft/);
  x.el('party-toggle').click();
  assert.equal(panel.hidden, false);
  assert.equal(x.document.getElementById('live-party-details').open, true);
  x.el('close').click();
  assert.equal(panel.hidden, hidden);
  assert.equal(x.el('dialog').parentElement, x.document.body);
});
test('docked context change revokes old actions and a late read cannot repopulate them', async (t) => {
  const x = uiSetup(t);
  x.ui.setSessionPacketSurface('live');
  const source = {
    sceneId: 'scene',
    token: 'token',
    planId: 'plan',
    visitId: 'first',
    key: 'one',
    current: () => true,
    flush: async () => true,
    openVisit: async () => {},
    readAloud: async () => {},
  };
  await x.ui.openLiveSessionPacket(source);
  const held = deferred();
  x.window.campaign.sessionPacket = () => held.promise;
  x.el('refresh').click();
  await wait();
  assert.equal(x.el('content').textContent, '');
  x.ui.syncLiveSessionPacket(null);
  held.resolve({ ok: true, value: packet() });
  await wait();
  assert.equal(x.el('dialog').open, false);
  assert.equal(x.el('content').textContent, '');
  assert.equal(x.el('export').disabled, true);
});
test('closing a docked packet invalidates detached read-aloud and visit controls', async (t) => {
  const x = uiSetup(t),
    actions = [],
    source = {
      sceneId: 'scene',
      token: 'token',
      planId: 'plan',
      visitId: 'first',
      key: 'one',
      current: () => true,
      flush: async () => true,
      openVisit: async (id) => actions.push(['visit', id]),
      readAloud: async (text) => actions.push(['text', text]),
    };
  x.ui.setSessionPacketSurface('live');
  await x.ui.openLiveSessionPacket(source);
  const text = x.el('content').querySelector('.packet-use-read-aloud'),
    visit = [...x.el('content').querySelectorAll('button')].find((b) =>
      b.textContent.includes('Besuch'),
    );
  assert.ok(text);
  assert.ok(visit);
  x.el('close').click();
  text.onclick();
  visit.onclick();
  await wait();
  assert.deepEqual(actions, []);
});
test('refreshing a docked packet invalidates detached controls for its previous source snapshot', async (t) => {
  const x = uiSetup(t),
    actions = [],
    source = {
      sceneId: 'scene',
      token: 'token',
      planId: 'plan',
      visitId: 'first',
      key: 'one',
      current: () => true,
      flush: async () => true,
      openVisit: async (id) => actions.push(['visit', id]),
      readAloud: async (text) => actions.push(['text', text]),
    };
  x.ui.setSessionPacketSurface('live');
  await x.ui.openLiveSessionPacket(source);
  const old = x.el('content').querySelector('.packet-use-read-aloud');
  x.window.campaign.sessionPacket = async () => ({ ok: true, value: packet('two') });
  x.el('refresh').click();
  await wait();
  old.onclick();
  await wait();
  assert.deepEqual(actions, []);
  const current = x.el('content').querySelector('.packet-use-read-aloud');
  current.onclick();
  await wait();
  assert.deepEqual(actions, [['text', '  Geheimwort\r\n**Wache**  ']]);
});

test('journal pagination reads all ordered quest owners without writing and survives Fresh', (t) => {
  const x = storeSetup(t);
  for (let i = 0; i < 42; i++)
    x.store.changePreparation({
      ...x.command(null),
      change: {
        kind: 'note',
        expectedRevision: null,
        note: {
          version: 1,
          id: randomUUID(),
          revision: 1,
          kind: 'quest',
          title: 'Auftrag ' + String(i).padStart(2, '0'),
          readAloud: '  Vorlesen\r\n',
          gmNotes: '  Auftragstext  ',
          relations: [],
          creatureId: null,
          deleted: false,
        },
      },
    });
  const q = { search: 'Auftragstext', kind: 'quest', status: 'open', after: null },
    before = x.store.db.serialize(),
    first = x.store.narrativeJournal(x.w.token, q);
  assert.equal(first.entries.length, 40);
  assert.deepEqual(first.counts, { open: 42, closed: 0 });
  assert.ok(first.next);
  const last = x.store.narrativeJournal(x.w.token, { ...q, after: first.next });
  assert.deepEqual(
    last.entries.map((e) => e.note.title),
    ['Auftrag 40', 'Auftrag 41'],
  );
  assert.equal(last.next, null);
  assert.equal(new Set([...first.entries, ...last.entries].map((e) => e.note.id)).size, 42);
  assert.equal(first.entries[0].note.readAloud, '  Vorlesen\r\n');
  assert.equal(x.store.db.serialize().equals(before), true);
  x.store.close();
  x.store = new CampaignStore(x.file);
  const w = x.store.activate(x.campaign.id);
  assert.deepEqual(x.store.narrativeJournal(w.token, q), first);
});
test('journal and bound session packet project the same confirmed narrative outcome', (t) => {
  const x = storeSetup(t),
    note = {
      version: 1,
      id: randomUUID(),
      revision: 1,
      kind: 'quest',
      title: 'Torauftrag',
      readAloud: '',
      gmNotes: '  Privat\r\n',
      relations: [],
      creatureId: null,
      deleted: false,
    };
  x.store.changePreparation({
    ...x.command(null),
    change: { kind: 'note', expectedRevision: null, note },
  });
  const d = x.store.session(x.w.token, x.id).visits[0];
  x.store.executeSession(
    x.command({
      kind: 'visit',
      planId: x.id,
      expectedRevision: d.revision,
      detail: { ...d, noteIds: [note.id] },
    }),
  );
  let n = x.store.narrative(x.w.token, note.id);
  x.store.executeProgress(
    x.command({
      kind: 'narrative-state',
      expectedRevision: n.state.revision,
      expectedNoteRevision: n.noteRevision,
      state: { ...n.state, poolXp: 25 },
    }),
  );
  const before = x.store.sessionPacket(x.w.token, x.id);
  assert.ok(before.visits[0].blocks.some((b) => b.text.includes('25 Gruppen-XP vorbereitet')));
  n = x.store.narrative(x.w.token, note.id);
  x.store.executeProgress(
    x.command({
      kind: 'narrative-award',
      noteId: note.id,
      expectedRevision: n.state.revision,
      expectedNoteRevision: n.noteRevision,
      sceneId: null,
      poolXp: 0,
      noXp: true,
      recipients: [],
      items: [],
      outcome: '  Tor gesichert.\r\n',
    }),
  );
  const journal = x.store.narrativeJournal(x.w.token, {
    search: 'Tor gesichert',
    kind: 'quest',
    status: 'closed',
    after: null,
  });
  assert.deepEqual(journal.counts, { open: 0, closed: 1 });
  assert.equal(journal.entries[0].view.award.outcome, '  Tor gesichert.\r\n');
  const after = x.store.sessionPacket(x.w.token, x.id);
  assert.notEqual(after.basis, before.basis);
  assert.ok(
    after.visits[0].blocks.some(
      (b) =>
        b.text.includes('Belohnung bereits vergeben') && b.text.endsWith('  Tor gesichert.\r\n'),
    ),
  );
});

test('packet source, encounter and reward actions use confirmed IDs and old visit controls stay revoked after returning', async (t) => {
  const x = uiSetup(t),
    actions = [],
    p = packet();
  p.visits[0].blocks.push(
    {
      kind: 'location-section',
      heading: 'Ort',
      text: 'Nordtor',
      action: { kind: 'reference', ref: { kind: 'location', id: 'place-id' } },
    },
    {
      kind: 'encounter',
      heading: 'Wache',
      text: 'Figuren',
      action: { kind: 'encounter', groupId: 'guard-id', groupRevision: 1 },
    },
    { kind: 'reward', heading: 'Beute', text: 'Münzen', action: { kind: 'reward' } },
  );
  x.window.campaign.sessionPacket = async () => ({ ok: true, value: p });
  x.ui.setSessionPacketSurface('live');
  const source = {
    sceneId: 'scene',
    token: 'token',
    planId: 'plan',
    visitId: 'first',
    key: 'one',
    current: () => true,
    flush: async () => true,
    openVisit: async () => {},
    readAloud: async () => {},
    openReference: async (ref) => actions.push(['source', ref]),
    prepareEncounter: async (groupId, visitId) => actions.push(['encounter', groupId, visitId]),
    openReward: async (visitId) => actions.push(['reward', visitId]),
  };
  await x.ui.openLiveSessionPacket(source);
  const old = [...x.el('content').querySelectorAll('.packet-block-action')];
  assert.equal(old.length, 3);
  for (const button of old) button.click();
  await wait();
  assert.deepEqual(actions, [
    ['source', { kind: 'location', id: 'place-id' }],
    ['encounter', 'guard-id', 'first'],
    ['reward', 'first'],
  ]);
  x.el('next').click();
  x.el('prev').click();
  for (const button of old) button.onclick();
  await wait();
  assert.equal(
    actions.length,
    3,
    'detached controls must not become current again when returning to the same visit',
  );
  x.el('content').querySelector('.packet-block-action').click();
  await wait();
  assert.equal(actions.length, 4);
});

test('packet reference actions stay bound to the displayed descriptor and become inert after changing visits', async (t) => {
  const x = uiSetup(t),
    actions = [],
    shown = packet(),
    source = {
      sceneId: 'scene',
      token: 'token',
      planId: 'plan',
      visitId: 'first',
      key: 'one',
      current: () => true,
      flush: async () => true,
      openVisit: async () => {},
      readAloud: async () => {},
      openReference: async (r) => actions.push(r.id),
    };
  shown.visits[0].blocks.push({
    heading: 'Ort',
    text: 'Tor',
    kind: 'reference',
    action: { kind: 'reference', ref: { kind: 'location', id: 'shown-location' } },
  });
  x.window.campaign.sessionPacket = async () => ({ ok: true, value: shown });
  x.ui.setSessionPacketSurface('live');
  await x.ui.openLiveSessionPacket(source);
  const b = x.el('content').querySelector('.packet-block-action');
  shown.visits[0].blocks.at(-1).action.ref.id = 'later-location';
  b.onclick();
  await wait();
  assert.deepEqual(actions, ['shown-location']);
  x.el('next').click();
  b.onclick();
  await wait();
  assert.deepEqual(actions, ['shown-location']);
});

test('refreshed and hidden packet action controls cannot open rewards or prepare an encounter', async (t) => {
  const x = uiSetup(t),
    actions = [],
    p = packet(),
    source = {
      sceneId: 'scene',
      token: 'token',
      planId: 'plan',
      visitId: 'first',
      key: 'one',
      current: () => true,
      flush: async () => true,
      openVisit: async () => {},
      readAloud: async () => {},
      prepareEncounter: async (...args) => actions.push(args.slice(0, 3)),
      openReward: async (id) => actions.push(id),
    };
  p.visits[0].blocks.push(
    {
      heading: 'Gegner',
      text: 'Wachen',
      kind: 'encounter',
      action: { kind: 'encounter', groupId: 'group', groupRevision: 4 },
    },
    { heading: 'Loot', text: 'Beute', kind: 'reward', action: { kind: 'reward' } },
  );
  x.window.campaign.sessionPacket = async () => ({ ok: true, value: p });
  x.ui.setSessionPacketSurface('live');
  await x.ui.openLiveSessionPacket(source);
  let controls = [...x.el('content').querySelectorAll('.packet-block-action')];
  x.el('refresh').click();
  await wait();
  for (const b of controls) b.onclick();
  await wait();
  assert.deepEqual(actions, []);
  controls = [...x.el('content').querySelectorAll('.packet-block-action')];
  x.ui.setSessionPacketSurface('preparation');
  for (const b of controls) b.onclick();
  await wait();
  assert.deepEqual(actions, []);
  x.ui.setSessionPacketSurface('live');
  await wait();
  x.el('content').querySelector('.packet-block-action').onclick();
  await wait();
  assert.deepEqual(actions, [['group', 'first', 4]]);
});

test('an encounter block without its displayed source revision cannot approve a newer group', async (t) => {
  const x = uiSetup(t),
    actions = [],
    p = packet(),
    source = {
      sceneId: 'scene',
      token: 'token',
      planId: 'plan',
      visitId: 'first',
      key: 'one',
      current: () => true,
      flush: async () => true,
      openVisit: async () => {},
      readAloud: async () => {},
      prepareEncounter: async () => actions.push('prepared'),
    };
  p.visits[0].blocks.push({
    heading: 'Gegner',
    text: 'Alt',
    kind: 'encounter',
    action: { kind: 'encounter', groupId: 'group' },
  });
  x.window.campaign.sessionPacket = async () => ({ ok: true, value: p });
  x.ui.setSessionPacketSurface('live');
  await x.ui.openLiveSessionPacket(source);
  const b = x.el('content').querySelector('.packet-block-action');
  assert.equal(b.disabled, true);
  b.onclick();
  await wait();
  assert.deepEqual(actions, []);
});

test('packet runway and moment handoffs retain their displayed visit and source text', async (t) => {
  const x = uiSetup(t),
    shown = packet(),
    actions = [],
    source = {
      sceneId: 'scene',
      token: 'token',
      planId: 'plan',
      visitId: 'first',
      key: 'one',
      current: () => true,
      flush: async () => true,
      openVisit: async () => {},
      readAloud: async () => {},
      captureMoment: async (...args) => actions.push(args.slice(0, 3)),
    };
  x.window.campaign.sessionPacket = async () => ({ ok: true, value: shown });
  x.ui.setSessionPacketSurface('live');
  await x.ui.openLiveSessionPacket(source);
  const runway = x.el('content').querySelector('.packet-runway button'),
    moment = [...x.el('content').querySelectorAll('button')].find(
      (b) => b.textContent === 'Als Chronikmoment vormerken',
    );
  assert(runway);
  assert(moment);
  shown.visits[0].blocks[0].text = 'Spätere fremde Quelle';
  moment.onclick();
  await wait();
  assert.deepEqual(actions, [['world', 'Vorlesen', '  Geheimwort\r\n**Wache**  ']]);
  x.el('next').click();
  let moved = 0;
  const target = x.el('content').querySelector('[data-packet-block-index="0"]');
  target.scrollIntoView = () => moved++;
  target.focus = () => moved++;
  runway.onclick();
  moment.onclick();
  await wait();
  assert.equal(moved, 0);
  assert.equal(actions.length, 1);
  x.el('close').click();
  [...x.el('content').querySelectorAll('button')]
    .find((b) => b.textContent === 'Als Chronikmoment vormerken')
    .onclick();
  await wait();
  assert.equal(actions.length, 1);
});

test('the packet button starts at the current preparation visit while explicit opens and in-packet navigation remain deliberate', async (t) => {
  const x = uiSetup(t);
  x.setOwner({ token: 'token', planId: 'plan', visitId: 'second' });
  x.el('open').click();
  await wait();
  assert.equal(x.el('visits').querySelector('[aria-pressed="true"]')?.dataset.visitId, 'second');
  assert.match(x.el('content').textContent, /Saphir/);
  assert.doesNotMatch(x.el('visits').textContent, /aktuelle Übernahme/);
  x.el('visits').querySelector('button[data-visit-id="first"]').click();
  x.el('refresh').click();
  await wait();
  assert.equal(x.el('visits').querySelector('[aria-pressed="true"]')?.dataset.visitId, 'first');
  x.el('close').click();
  x.el('open').click();
  await wait();
  assert.equal(x.el('visits').querySelector('[aria-pressed="true"]')?.dataset.visitId, 'second');
  assert.equal(await x.ui.openPreparationSessionPacket('first'), true);
  assert.equal(x.el('visits').querySelector('[aria-pressed="true"]')?.dataset.visitId, 'first');
});
for (const fail of [false, true])
  test(`an old preparation visit packet ${fail ? 'error' : 'answer'} cannot appear after selection moves inside the same plan`, async (t) => {
    const x = uiSetup(t),
      reply = deferred();
    x.setOwner({ token: 'token', planId: 'plan', visitId: 'first' });
    x.window.campaign.sessionPacket = () => reply.promise;
    x.el('open').click();
    await wait();
    x.setOwner({ token: 'token', planId: 'plan', visitId: 'second' });
    reply.resolve(fail ? { ok: false, error: 'Alter Lesefehler' } : { ok: true, value: packet() });
    await wait();
    assert.equal(x.el('content').textContent, '');
    assert.equal(x.el('visits').textContent, '');
    assert.equal(x.el('export').disabled, true);
    assert.deepEqual(x.messages, []);
  });

test('packet omits empty optional location sections, preserves the place and warns only when unavailable', (t) => {
  const x = storeSetup(t),
    location = {
      kind: 'location',
      version: 1,
      id: randomUUID(),
      name: 'Weidenhain',
      type: 'poi',
      sections: [
        { id: randomUUID(), title: 'Beschreibung', markdown: '' },
        { id: randomUUID(), title: 'Notizen', markdown: ' \r\n\t ' },
        { id: randomUUID(), title: 'Spuren', markdown: '  Messer\r\n**Blaues Band**  ' },
      ],
      detailMaps: [],
      keyLinks: [],
    };
  x.store.changePreparation({
    ...x.command(null),
    change: { kind: 'location', expectedRevision: null, document: location },
  });
  x.store.changePreparation({
    ...x.command(null),
    change: {
      kind: 'plan',
      expectedRevision: 1,
      plan: {
        version: 1,
        id: x.id,
        revision: 1,
        name: 'Abend',
        scenes: [
          {
            id: x.visitId,
            title: 'Rückzug',
            notes: 'Verhandeln oder rasten.',
            locationId: location.id,
          },
        ],
      },
    },
  });
  const before = x.store.db.serialize(),
    p = x.store.sessionPacket(x.w.token, x.id),
    v = p.visits[0];
  assert.equal(v.location, 'Weidenhain');
  assert.equal(v.locationId, location.id);
  assert.deepEqual(p.warnings, []);
  assert.deepEqual(
    v.blocks.map((b) => [b.heading, b.text]),
    [
      ['GM-Notizen', 'Verhandeln oder rasten.'],
      ['Weidenhain · Spuren', '  Messer\r\n**Blaues Band**  '],
    ],
  );
  const markdown = require('../../' + base + '/ui.cjs').sessionPacketMarkdown(p);
  assert.match(markdown, /\*\*Ort:\*\* Weidenhain/);
  assert.doesNotMatch(markdown, /### Weidenhain · (Beschreibung|Notizen)|Keine Notizen/);
  assert.ok(markdown.includes(location.sections[2].markdown));
  assert.equal(x.store.db.serialize().equals(before), true);
  x.store.close();
  x.store = new CampaignStore(x.file);
  const w = x.store.activate(x.campaign.id);
  assert.deepEqual(x.store.sessionPacket(w.token, x.id), p);
  x.store.db
    .prepare('UPDATE location SET trashed=1 WHERE campaign_id=? AND id=?')
    .run(x.campaign.id, location.id);
  const unavailable = x.store.sessionPacket(w.token, x.id);
  assert.match(unavailable.warnings.join(' '), /fehlt oder liegt im Papierkorb/);
  assert.equal(unavailable.visits[0].location, 'Nicht verfügbarer Ort');
  assert.notEqual(unavailable.basis, p.basis);
});
test('a place without authored sections remains accessible in the live packet and old controls are revoked', async (t) => {
  const x = uiSetup(t),
    actions = [],
    p = packet();
  p.visits[0].locationId = 'weidenhain';
  p.visits[0].blocks = [];
  x.window.campaign.sessionPacket = async () => ({ ok: true, value: p });
  x.ui.setSessionPacketSurface('live');
  const source = {
    sceneId: 'scene',
    token: 'token',
    planId: 'plan',
    visitId: 'first',
    key: 'one',
    current: () => true,
    flush: async () => true,
    openVisit: async () => {},
    openReference: async (ref) => actions.push(ref),
  };
  await x.ui.openLiveSessionPacket(source);
  assert.match(x.el('content').textContent, /Tor/);
  assert.equal(x.el('content').querySelectorAll('.packet-block').length, 0);
  const button = x.el('content').querySelector('.packet-location-action');
  assert.ok(button);
  button.click();
  await wait();
  assert.deepEqual(actions, [{ kind: 'location', id: 'weidenhain' }]);
  x.el('next').click();
  button.onclick();
  await wait();
  assert.equal(actions.length, 1);
});
