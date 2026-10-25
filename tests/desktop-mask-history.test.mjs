import { test } from 'node:test';
import assert from 'node:assert/strict';
import { mkdtempSync, rmSync } from 'node:fs';
import { tmpdir } from 'node:os';
import path from 'node:path';
import { randomUUID, createHash } from 'node:crypto';
import { createRequire } from 'node:module';
import { buildSync } from './helpers/build.mjs';
buildSync({
  entryPoints: ['src/app/storage/store.ts'],
  outfile: '.build/mask-history-store.cjs',
  bundle: true,
  platform: 'node',
  format: 'cjs',
  external: ['better-sqlite3'],
});
const { CampaignStore } = createRequire(import.meta.url)('../.build/mask-history-store.cjs');
function fixture(t) {
  const root = mkdtempSync(path.join(tmpdir(), 'mask-history-')),
    store = new CampaignStore(root + '/workbench.sqlite'),
    campaign = store.create('Lange Kampagne'),
    w = store.activate(campaign.id),
    base = (action) => ({
      commandId: randomUUID(),
      token: w.token,
      campaignId: campaign.id,
      action,
    }),
    scene = store.executeLive(base({ kind: 'initialize', expectedRosterRevision: 0 })).scene,
    chases = [],
    combats = [];
  for (let i = 0; i < 38; i++) {
    let c = store.executeChase({
      ...base({
        kind: 'create',
        title: i === 0 ? 'Kupfersiegel am Hafen' : 'Marktlauf ' + i,
        goal: i === 0 ? 'Mühle erneut besuchen' : 'Tor erreichen',
      }),
      sceneId: scene.id,
      chaseId: null,
      expectedRevision: null,
    }).chase;
    if (i > 0 && i < 37)
      c = store.executeChase({
        ...base({ kind: 'finish', outcome: 'Entkommen im Markt' }),
        sceneId: scene.id,
        chaseId: c.id,
        expectedRevision: c.revision,
      }).chase;
    chases.push(c);
  }
  for (let i = 0; i < 107; i++)
    combats.push(
      store.executeCombat({
        ...base({
          kind: 'create',
          sceneId: scene.id,
          title: i === 0 ? 'Bronzeschlüssel am Tor' : 'Wachen ' + i,
          includeParty: false,
          expectedMembershipRevision: 0,
        }),
        combatId: null,
        expectedRevision: null,
      }).combat,
    );
  const query = (kind, patch = {}) => ({ kind, state: 'all', search: '', after: null, ...patch }),
    read = (kind, patch = {}) => store.maskHistory(w.token, scene.id, query(kind, patch));
  t.after(() => {
    store.close();
    rmSync(root, { recursive: true, force: true });
  });
  return { root, store, w, scene, base, chases, combats, query, read };
}
for (const kind of ['chase', 'combat'])
  test(
    kind + ' history traverses every saved id exactly once beyond the quick-picker limit',
    (t) => {
      const x = fixture(t),
        ids = [],
        pages = [];
      let after = null;
      do {
        const p = x.read(kind, { after });
        assert.equal(p.items.length <= 20, true);
        assert.equal(p.total, kind === 'chase' ? 38 : 107);
        ids.push(...p.items.map((i) => i.id));
        pages.push(p);
        after = p.next;
      } while (after);
      assert.equal(new Set(ids).size, ids.length);
      assert.deepEqual(
        new Set(ids),
        new Set((kind === 'chase' ? x.chases : x.combats).map((i) => i.id)),
      );
      assert(pages.length >= 2);
      assert.deepEqual(x.read(kind), pages[0]);
      assert.deepEqual(x.read(kind, { after: pages[0].next }), pages[1]);
    },
  );
test('ongoing history remains first and filters distinguish open from completed work', (t) => {
  const x = fixture(t),
    p = x.read('chase');
  assert.deepEqual(
    p.items.slice(0, 2).map((i) => i.id),
    [x.chases.at(-1).id, x.chases[0].id],
  );
  assert.equal(x.read('chase', { state: 'active' }).total, 2);
  assert.equal(x.read('chase', { state: 'finished' }).total, 36);
  assert.equal(x.read('chase', { state: 'retired' }).total, 0);
});
test('Unicode-insensitive AND search finds titles, goals, notes and completion outcomes', (t) => {
  const x = fixture(t);
  assert.equal(x.read('chase', { search: 'KUPFERSIEGEL MÜHLE' }).items[0].id, x.chases[0].id);
  assert.equal(x.read('combat', { search: 'BRONZESCHLÜSSEL' }).items[0].id, x.combats[0].id);
  assert.equal(x.read('chase', { search: 'entkommen markt' }).total, 36);
  assert.equal(x.read('chase', { search: 'Kupfersiegel Wache' }).total, 0);
  const c = x.combats[0];
  x.store.executeCombat({
    ...x.base({ kind: 'notes', title: c.title, notes: '  Straße am Hintertor\r\n' }),
    combatId: c.id,
    expectedRevision: c.revision,
  });
  assert.equal(x.read('combat', { search: 'STRASSE HINTERTOR' }).total, 1);
});
test('cursor stays bound to campaign, scene, kind, search and state', (t) => {
  const x = fixture(t),
    after = x.read('chase').next;
  for (const patch of [{ kind: 'combat' }, { search: 'Markt' }, { state: 'finished' }])
    assert.throws(
      () => x.store.maskHistory(x.w.token, x.scene.id, x.query('chase', { after, ...patch })),
      /andere/,
    );
  const other = x.store.create('Andere'),
    ow = x.store.activate(other.id);
  assert.throws(
    () => x.store.maskHistory(ow.token, x.scene.id, x.query('chase', { after })),
    /andere/,
  );
});
test('keyset pagination does not duplicate older results when a newer mask is inserted', (t) => {
  const x = fixture(t),
    first = x.read('chase');
  x.store.executeChase({
    ...x.base({ kind: 'create', title: 'Neu während Suche', goal: '' }),
    sceneId: x.scene.id,
    chaseId: null,
    expectedRevision: null,
  });
  const second = x.read('chase', { after: first.next });
  assert.equal(second.total, 39);
  assert.equal(
    second.items.some((i) => first.items.some((j) => i.id === j.id)),
    false,
  );
  assert.deepEqual(
    new Set([...first.items, ...second.items].map((i) => i.id)),
    new Set(x.chases.map((i) => i.id)),
  );
});
test('large notes remain exact while discovery returns small summaries instead of combat payloads', (t) => {
  const x = fixture(t),
    c = x.combats[0],
    notes = '  Lange Notiz\r\n' + 'Abschnitt '.repeat(100000);
  x.store.executeCombat({
    ...x.base({ kind: 'notes', title: c.title, notes }),
    combatId: c.id,
    expectedRevision: c.revision,
  });
  const before = x.store.db.prepare('SELECT payload,checksum FROM combat WHERE id=?').get(c.id),
    p = x.read('combat', { search: 'Lange Notiz' });
  assert.equal(p.items[0].summary, notes.slice(0, 240));
  assert.equal(p.items[0].participants, undefined);
  assert(JSON.stringify(p).length < 2000);
  assert.deepEqual(
    x.store.db.prepare('SELECT payload,checksum FROM combat WHERE id=?').get(c.id),
    before,
  );
});
test('query guards reject malformed cursors and oversized filters without modifying records', (t) => {
  const x = fixture(t),
    count = x.store.db.prepare('SELECT count(*) n FROM chase').get().n;
  for (const patch of [
    { after: 'bad' },
    { after: '{}' },
    { search: 'x'.repeat(1001) },
    { state: 'invented' },
    { kind: 'not-a-table' },
  ])
    assert.throws(() => x.store.maskHistory(x.w.token, x.scene.id, x.query('chase', patch)));
  assert.equal(x.store.db.prepare('SELECT count(*) n FROM chase').get().n, count);
});
test('matching corrupted bytes fail locally instead of becoming a selectable trusted mask', (t) => {
  const x = fixture(t),
    id = x.chases[0].id;
  x.store.db.prepare('UPDATE chase SET checksum=? WHERE id=?').run('bad', id);
  assert.throws(() => x.read('chase', { search: 'Kupfersiegel' }), /beschädigt/);
  assert.equal(x.read('combat', { search: 'Bronze' }).items.length, 1);
});

test('duplicate titles remain independently identifiable through summaries and stable ids', (t) => {
  const x = fixture(t);
  for (const [i, notes] of [
    [0, 'Nordtor'],
    [1, 'Südtor'],
  ]) {
    const c = x.combats[i];
    x.store.executeCombat({
      ...x.base({ kind: 'notes', title: 'Doppelte Wache', notes }),
      combatId: c.id,
      expectedRevision: c.revision,
    });
  }
  const p = x.read('combat', { search: 'Doppelte Wache' });
  assert.equal(p.items.length, 2);
  assert.equal(new Set(p.items.map((i) => i.id)).size, 2);
  assert.deepEqual(new Set(p.items.map((i) => i.summary)), new Set(['Nordtor', 'Südtor']));
});

test('finished combats show their result instead of identical preparation notes, without changing saved text', (t) => {
  const x = fixture(t);
  const finishes = [];
  for (const [i, outcome] of [
    [105, 'Nordtor befreit'],
    [106, 'Südtor evakuiert'],
  ]) {
    let c = x.combats[i];
    c = x.store.executeCombat({
      ...x.base({ kind: 'notes', title: 'Doppelte Wache', notes: 'Identische Vorbereitung' }),
      combatId: c.id,
      expectedRevision: c.revision,
    }).combat;
    c = x.store.executeCombat({
      ...x.base({ kind: 'finish', outcome }),
      combatId: c.id,
      expectedRevision: c.revision,
    }).combat;
    finishes.push(c);
  }
  const before = x.store.db.serialize(),
    page = x.read('combat', { search: 'Doppelte Wache' });
  assert.deepEqual(
    new Set(page.items.map((i) => i.summary)),
    new Set(['Nordtor befreit', 'Südtor evakuiert']),
  );
  assert.equal(x.read('combat', { search: 'Identische Vorbereitung' }).total, 2);
  assert.equal(x.read('combat', { search: 'Südtor' }).items[0].summary, 'Südtor evakuiert');
  assert(before.equals(x.store.db.serialize()));
  const ids = x.combats.slice(103, 105).map((c) => c.id),
    numbers = () =>
      x.store
        .combat(x.w.token, x.scene.id, ids[0])
        .recent.filter((c) => ids.includes(c.id))
        .map((c) => c.sequence);
  const initial = numbers();
  assert.equal(new Set(initial).size, 2);
  assert(initial.every(Number.isSafeInteger));
  x.store.executeCombat({
    ...x.base({
      kind: 'create',
      sceneId: x.scene.id,
      title: 'Neu',
      includeParty: false,
      expectedMembershipRevision: 0,
    }),
    combatId: null,
    expectedRevision: null,
  });
  assert.deepEqual(numbers(), initial);
});

test('opening an old combat outside the quick picker preserves bytes and still rejects a damaged recent mask', (t) => {
  const x = fixture(t),
    old = x.combats[0],
    before = x.store.db.serialize();
  const view = x.store.combat(x.w.token, x.scene.id, old.id);
  assert.equal(view.combat.id, old.id);
  assert.equal(view.combat.notes, old.notes);
  assert.equal(view.recent.length, 100);
  assert(!view.recent.some((c) => c.id === old.id));
  assert(before.equals(x.store.db.serialize()));
  x.store.db.prepare('UPDATE combat SET checksum=? WHERE id=?').run('damaged', view.recent[0].id);
  const damaged = x.store.db.serialize();
  assert.throws(() => x.store.combat(x.w.token, x.scene.id, old.id), /beschädigt/);
  assert(damaged.equals(x.store.db.serialize()));
});
