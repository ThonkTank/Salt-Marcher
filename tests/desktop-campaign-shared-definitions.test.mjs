import { test } from 'node:test';
import assert from 'node:assert/strict';
import { mkdtempSync, rmSync, readFileSync } from 'node:fs';
import { tmpdir } from 'node:os';
import path from 'node:path';
import { randomUUID, createHash } from 'node:crypto';
import { createRequire } from 'node:module';
import { buildSync } from './helpers/build.mjs';
buildSync({
  entryPoints: ['src/app/storage/store.ts'],
  outfile: '.build/campaign-shared-store.cjs',
  bundle: true,
  platform: 'node',
  format: 'cjs',
  external: ['better-sqlite3'],
});
const { CampaignStore } = createRequire(import.meta.url)('../.build/campaign-shared-store.cjs');
function fixture(t) {
  const root = mkdtempSync(path.join(tmpdir(), 'campaign-shared-')),
    source = new CampaignStore(path.join(root, 'source.sqlite')),
    targetFile = path.join(root, 'target.sqlite'),
    target = new CampaignStore(targetFile),
    cam = source.create('Quelle'),
    w = source.activate(cam.id),
    command = (action) => ({ commandId: randomUUID(), campaignId: cam.id, token: w.token, action });
  const definition = source.executeItemShop(
    command({
      kind: 'definition',
      expectedRevision: null,
      definition: {
        id: randomUUID(),
        revision: 0,
        name: 'Feldseil',
        category: 'equipment',
        magic: false,
        rarity: '',
        attunement: 'no',
        unitCopper: '200',
        weightText: '',
        properties: [],
        description: '  Unveränderte Prosa\r\n',
        source: { kind: 'authored', label: 'GM', license: null, url: null },
        trashed: false,
      },
    }),
  ).definition;
  const ids = [definition.id];
  source.db.transaction(() => {
    for (let i = 1; i < 120; i++) {
      const id = randomUUID();
      ids.push(id);
      for (const table of ['authored_item', 'item_definition', 'item_definition_version']) {
        const row = source.db.prepare('SELECT * FROM ' + table + ' WHERE id=?').get(definition.id);
        row.id = id;
        if (row.payload) {
          row.payload = JSON.stringify({ ...JSON.parse(row.payload), id });
          row.checksum = createHash('sha256').update(row.payload).digest('hex');
        }
        const keys = Object.keys(row);
        source.db
          .prepare(
            'INSERT INTO ' +
              table +
              '(' +
              keys.join(',') +
              ') VALUES(' +
              keys.map(() => '?').join(',') +
              ')',
          )
          .run(...keys.map((k) => row[k]));
      }
    }
  })();
  const note = {
    version: 1,
    id: randomUUID(),
    revision: 1,
    kind: 'quest',
    title: 'Seil am Tor',
    readAloud: '',
    gmNotes: 'Nutze [Seil](dungeon-ref:item/' + definition.id + ').',
    relations: [],
    creatureId: null,
    deleted: false,
  };
  source.changePreparation({
    ...command(null),
    change: { kind: 'note', expectedRevision: null, note },
  });
  t.after(() => {
    source.close();
    target.close();
    rmSync(root, { recursive: true, force: true });
  });
  return {
    root,
    source,
    target,
    targetFile,
    cam,
    w,
    command,
    definition,
    ids,
    note,
    snapshot: path.join(root, 'campaign.sqlite'),
  };
}
test('repeated independent imports reuse every unchanged shared definition and keep local notes independent', async (t) => {
  const x = fixture(t);
  await x.source.campaignSnapshot(x.w.token, x.snapshot);
  const bytes = readFileSync(x.snapshot),
    first = x.target.acceptCampaignSnapshot(x.snapshot, 'Erste Kopie', {}),
    rows = x.target.db.prepare('SELECT * FROM item_definition ORDER BY id').all(),
    second = x.target.acceptCampaignSnapshot(x.snapshot, 'Zweite Kopie', {});
  assert.notEqual(first.id, second.id);
  assert.deepEqual(x.target.db.prepare('SELECT * FROM item_definition ORDER BY id').all(), rows);
  assert.ok(readFileSync(x.snapshot).equals(bytes));
  for (const c of [first, second]) {
    const w = x.target.activate(c.id),
      n = x.target.preparation(w.token).notes.find((r) => r.note.title === x.note.title).note;
    assert.notEqual(n.id, x.note.id);
    assert.equal(n.gmNotes, x.note.gmNotes);
  }
  for (const id of x.ids) assert.equal(x.target.itemDefinition(id).unitCopper, '200');
});
for (const choice of ['keep-current', 'keep-imported', 'keep-both'])
  test(`shared definition reuse preserves explicit ${choice} and copied authored references after Fresh`, async (t) => {
    const x = fixture(t);
    await x.source.campaignSnapshot(x.w.token, x.snapshot);
    const first = x.target.acceptCampaignSnapshot(x.snapshot, 'Erste Kopie', {});
    x.source.executeItemShop(
      x.command({
        kind: 'definition',
        expectedRevision: x.definition.revision,
        definition: { ...x.definition, unitCopper: '900' },
      }),
    );
    await x.source.campaignSnapshot(x.w.token, x.snapshot);
    const bytes = readFileSync(x.snapshot),
      preview = x.target.campaignPreview(x.snapshot);
    assert.deepEqual(
      preview.conflicts.map((c) => c.key),
      ['item:' + x.definition.id],
    );
    const second = x.target.acceptCampaignSnapshot(x.snapshot, 'Zweite Kopie', {
      ['item:' + x.definition.id]: choice,
    });
    assert.ok(readFileSync(x.snapshot).equals(bytes));
    const fresh = new CampaignStore(x.targetFile);
    try {
      const w = fresh.activate(second.id),
        note = fresh.preparation(w.token).notes.find((r) => r.note.title === x.note.title).note,
        mapped = note.gmNotes.match(/dungeon-ref:item\/([^)]*)/)[1];
      assert.equal(mapped !== x.definition.id, choice === 'keep-both');
      assert.equal(
        fresh.itemDefinition(mapped).unitCopper,
        choice === 'keep-current' ? '200' : '900',
      );
      assert.equal(
        fresh.itemDefinition(x.definition.id).unitCopper,
        choice === 'keep-imported' ? '900' : '200',
      );
      for (const id of x.ids.slice(1)) assert.equal(fresh.itemDefinition(id).unitCopper, '200');
      const original = fresh.activate(first.id);
      assert.equal(
        fresh.preparation(original.token).notes.find((r) => r.note.title === x.note.title).note
          .gmNotes,
        x.note.gmNotes,
      );
    } finally {
      fresh.close();
    }
  });
test('failed publication rolls back replacement definitions and the new campaign without touching the input', async (t) => {
  const x = fixture(t);
  await x.source.campaignSnapshot(x.w.token, x.snapshot);
  x.target.acceptCampaignSnapshot(x.snapshot, 'Erste Kopie', {});
  x.source.executeItemShop(
    x.command({
      kind: 'definition',
      expectedRevision: x.definition.revision,
      definition: { ...x.definition, unitCopper: '900' },
    }),
  );
  await x.source.campaignSnapshot(x.w.token, x.snapshot);
  const bytes = readFileSync(x.snapshot);
  x.target.db.exec(
    "CREATE TRIGGER reject_import BEFORE INSERT ON campaign WHEN NEW.name='Rejected' BEGIN SELECT RAISE(ABORT,'QA publication rejected'); END",
  );
  const before = x.target.db.serialize();
  assert.throws(
    () =>
      x.target.acceptCampaignSnapshot(x.snapshot, 'Rejected', {
        ['item:' + x.definition.id]: 'keep-imported',
      }),
    /QA publication rejected/,
  );
  assert.ok(x.target.db.serialize().equals(before));
  assert.ok(readFileSync(x.snapshot).equals(bytes));
  assert.equal(x.target.itemDefinition(x.definition.id).unitCopper, '200');
});

test('mood conflicts keep their independent decisions while unchanged axes are reused', async (t) => {
  const x = fixture(t),
    original = x.source.music(x.w.token).registry,
    axes = Array.from({ length: 3 }, (_, i) => ({
      id: randomUUID(),
      name: 'Achse ' + i,
      lowLabel: 'Ruhig',
      highLabel: 'Dramatisch',
    }));
  x.source.executeMusic(
    x.command({
      kind: 'registry',
      expectedRevision: original.revision,
      axes: [...original.axes, ...axes],
    }),
  );
  await x.source.campaignSnapshot(x.w.token, x.snapshot);
  x.target.acceptCampaignSnapshot(x.snapshot, 'Erste Kopie', {});
  const registry = x.source.music(x.w.token).registry;
  x.source.executeMusic(
    x.command({
      kind: 'registry',
      expectedRevision: registry.revision,
      axes: registry.axes.map((a) =>
        axes.some((b) => b.id === a.id) ? { ...a, name: a.name + ' neu' } : a,
      ),
    }),
  );
  await x.source.campaignSnapshot(x.w.token, x.snapshot);
  const choices = Object.fromEntries(
      axes.map((a, i) => ['mood:' + a.id, ['keep-current', 'keep-imported', 'keep-both'][i]]),
    ),
    bytes = readFileSync(x.snapshot),
    copied = x.target.acceptCampaignSnapshot(x.snapshot, 'Zweite Kopie', choices),
    w = x.target.activate(copied.id),
    actual = x.target.music(w.token).registry.axes;
  assert.equal(actual.find((a) => a.id === axes[0].id).name, axes[0].name);
  assert.equal(actual.find((a) => a.id === axes[1].id).name, axes[1].name + ' neu');
  assert.equal(actual.find((a) => a.id === axes[2].id).name, axes[2].name);
  const independent = actual.find((a) => a.name === axes[2].name + ' neu');
  assert(independent);
  assert.notEqual(independent.id, axes[2].id);
  assert.ok(readFileSync(x.snapshot).equals(bytes));
});
