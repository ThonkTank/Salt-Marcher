import { test } from 'node:test';
import assert from 'node:assert/strict';
import { mkdtempSync, rmSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { randomUUID } from 'node:crypto';
import { createRequire } from 'node:module';
import { buildSync } from 'esbuild';
buildSync({
  stdin: {
    contents:
      "export {CampaignStore} from './src/app/storage/store';export {previewLoot} from './src/app/storage/generation';",
    resolveDir: process.cwd(),
    loader: 'ts',
  },
  outfile: '.build/generation-loot.cjs',
  bundle: true,
  platform: 'node',
  format: 'cjs',
  external: ['better-sqlite3'],
});
const { CampaignStore, previewLoot } = createRequire(import.meta.url)(
  '../../.build/generation-loot.cjs',
);
function fixture(t) {
  const root = mkdtempSync(tmpdir() + '/generation-loot-'),
    store = new CampaignStore(root + '/workbench.sqlite'),
    cam = store.create('Goblinbeute'),
    w = store.activate(cam.id),
    command = (action) => ({ commandId: randomUUID(), campaignId: cam.id, token: w.token, action });
  t.after(() => {
    store.close();
    rmSync(root, { recursive: true, force: true });
  });
  const item = (name, valueGold = '0') => ({ name, valueGold, category: 'other' }),
    table = {
      id: randomUUID(),
      revision: 0,
      name: 'Satteltaschen',
      description: ' Originalprosa\r\n',
      rolls: 12,
      trashed: false,
      entries: [
        { id: randomUUID(), weight: '0', minimum: 1, maximum: 1, item: item('Niemals') },
        { id: randomUUID(), weight: '0.5', minimum: 1, maximum: 4, item: item('Seil', '1') },
        { id: randomUUID(), weight: '1.25', minimum: 2, maximum: 5, item: item('Kreide') },
        { id: randomUUID(), weight: '0.25', minimum: 1, maximum: 2, item: item('Seil', '1') },
      ],
    };
  store.executeGeneration(command({ kind: 'loot-save', table, expectedRevision: null }));
  const roll = (seed) => ({
    commandId: randomUUID(),
    campaignId: cam.id,
    token: w.token,
    tableId: table.id,
    expectedRevision: 1,
    seed,
    title: 'Gefundene Beute',
  });
  return {
    store,
    cam,
    w,
    table,
    command,
    roll,
    preview: (seed) => previewLoot(store.db, cam.id, table.id, 1, seed),
  };
}
test('seeded previews and confirmed loot retain quantities, exact weights and item grouping', (t) => {
  const x = fixture(t);
  for (const [seed, quantities] of [
    ['patrol|loot|0', [31, 9]],
    ['patrol|loot|1', [20, 14]],
    ['anderer Seed', [18, 10]],
  ]) {
    const before = x.store.db.serialize(),
      items = x.preview(seed);
    assert(x.store.db.serialize().equals(before), 'preview is read-only');
    const command = x.roll(seed),
      result = x.store.rollLoot(command);
    assert.deepEqual(result.items, items);
    const committed = x.store.db.serialize();
    assert.deepEqual(x.store.rollLoot(command), result);
    assert(
      x.store.db.serialize().equals(committed),
      'receipt recovery must not create more treasure',
    );
    assert.equal(
      items.some((i) => i.name === 'Niemals'),
      false,
    );
    assert.equal(new Set(items.map((i) => i.name)).size, items.length);
    assert.deepEqual(
      items.map(({ name, quantity }) => [name, quantity]),
      [
        ['Kreide', quantities[0]],
        ['Seil', quantities[1]],
      ],
    );
  }
});
for (const trashed of [false, true])
  test(`changed linked loot rejects new rolls but preserves confirmed receipts (trashed=${trashed})`, (t) => {
    const x = fixture(t),
      old = x.roll('patrol|loot|0');
    for (const seed of ['', ' '.repeat(2), 'x'.repeat(1001)]) {
      const before = x.store.db.serialize();
      assert.throws(() => x.store.rollLoot({ ...old, seed }), /Seed/);
      assert(x.store.db.serialize().equals(before));
    }
    const confirmed = x.store.rollLoot(old);
    x.store.executeGeneration(
      x.command(
        trashed
          ? { kind: 'loot-trash', id: x.table.id, expectedRevision: 1, trashed: true }
          : {
              kind: 'loot-save',
              table: { ...x.table, revision: 1, name: 'Neuer Beutestand' },
              expectedRevision: 1,
            },
      ),
    );
    const before = x.store.db.serialize();
    assert.throws(() => x.preview(old.seed), /geändert/);
    assert.throws(
      () => x.store.rollLoot({ ...old, commandId: randomUUID() }),
      (error) => {
        assert.match(error.message, /geändert/);
        assert.doesNotMatch(error.message, /Begegnungsvorschlag/);
        return true;
      },
    );
    assert.deepEqual(x.store.rollLoot(old), confirmed);
    assert(x.store.db.serialize().equals(before));
  });
