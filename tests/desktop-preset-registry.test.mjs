import test from 'node:test';
import assert from 'node:assert/strict';
import { mkdtempSync, rmSync } from 'node:fs';
import { tmpdir } from 'node:os';
import path from 'node:path';
import { randomUUID } from 'node:crypto';
import { createRequire } from 'node:module';
import { buildSync } from './helpers/build.mjs';
buildSync({
  entryPoints: ['src/app/storage/store.ts'],
  outfile: '.build/preset-registry-store.cjs',
  bundle: true,
  platform: 'node',
  format: 'cjs',
  external: ['better-sqlite3'],
});
const { CampaignStore } = createRequire(import.meta.url)('../.build/preset-registry-store.cjs');
function fixture(t) {
  const root = mkdtempSync(path.join(tmpdir(), 'preset-registry-')),
    file = path.join(root, 'work.sqlite'),
    x = { root, file, store: new CampaignStore(file) };
  t.after(() => {
    x.store.close();
    rmSync(root, { recursive: true, force: true });
  });
  x.command = (action, campaignId = null) => ({ commandId: randomUUID(), campaignId, action });
  x.save = () => {
    const p = structuredClone(x.store.presetRegistry(null).presets[0]);
    Object.assign(p, { id: randomUUID(), name: 'Meine Regeln', revision: 0, system: false });
    return x.command({
      kind: 'preset-save',
      preset: p,
      expectedRegistryRevision: x.store.presetRegistry(null).revision,
    });
  };
  return x;
}
test('installation rules are editable with no campaign and exact receipts survive restart without speculative writes', (t) => {
  const x = fixture(t),
    cmd = x.save(),
    r = x.store.presetCommand(cmd);
  assert.equal(x.store.list().campaigns.length, 0);
  assert.equal(r.registry.revision, 1);
  assert.equal(r.preset.revision, 1);
  assert.equal(r.registry.assignedId, null);
  assert.equal(r.preset.hash.length, 64);
  const bytes = x.store.db.serialize();
  assert.deepEqual(x.store.presetCommand(cmd), r);
  assert.deepEqual(x.store.presetOutcome(cmd), r);
  assert.ok(x.store.db.serialize().equals(bytes));
  x.store.close();
  x.store = new CampaignStore(x.file);
  assert.deepEqual(x.store.presetOutcome(cmd), r);
  assert.throws(
    () =>
      x.store.presetCommand({
        ...cmd,
        action: { ...cmd.action, preset: { ...cmd.action.preset, name: 'anders' } },
      }),
    /anders/,
  );
  assert.equal(x.store.presetOutcome({ ...cmd, commandId: randomUUID() }), null);
});
test('sharing and deleting rules changes only explicit assignments and preserves active campaign and usage', (t) => {
  const x = fixture(t),
    a = x.store.create('Gleich'),
    b = x.store.create('Gleich');
  x.store.activate(a.id);
  const usage = x.store.db.prepare('SELECT * FROM campaign_usage ORDER BY campaign_id').all(),
    p = x.store.presetCommand(x.save()).preset;
  const assign = (id) =>
    x.store.presetCommand(
      x.command(
        {
          kind: 'preset-assign',
          id: p.id,
          expectedRegistryRevision: x.store.presetRegistry(id).revision,
        },
        id,
      ),
    );
  assign(a.id);
  assign(b.id);
  assert.equal(x.store.presetRegistry(a.id).effectiveId, p.id);
  assert.equal(x.store.presetRegistry(b.id).effectiveId, p.id);
  const receipt = x.store.presetCommand(
    x.command({
      kind: 'preset-delete',
      id: p.id,
      expectedRegistryRevision: x.store.presetRegistry(null).revision,
    }),
  );
  assert.deepEqual(receipt.affectedCampaignIds, [a.id, b.id].sort());
  assert.equal(x.store.presetRegistry(a.id).assignedId, null);
  assert.equal(x.store.presetRegistry(b.id).assignedId, null);
  assert.equal(x.store.list().activeId, a.id);
  assert.deepEqual(
    x.store.db.prepare('SELECT * FROM campaign_usage ORDER BY campaign_id').all(),
    usage,
  );
  assert.deepEqual(x.store.db.pragma('foreign_key_check'), []);
});
test('stale saves and assignments, system writes, and assignment without a context do not mutate', (t) => {
  const x = fixture(t),
    a = x.store.create('A'),
    cmd = x.save();
  x.store.presetCommand(cmd);
  const stale = x.save();
  stale.action.expectedRegistryRevision = 0;
  for (const c of [
    stale,
    x.command(
      { kind: 'preset-assign', id: cmd.action.preset.id, expectedRegistryRevision: 0 },
      a.id,
    ),
    x.command({ kind: 'preset-assign', id: cmd.action.preset.id, expectedRegistryRevision: 1 }),
    x.command({ kind: 'preset-delete', id: 'generator-system-v5', expectedRegistryRevision: 1 }),
    x.command({
      kind: 'preset-save',
      preset: x.store.presetRegistry(null).presets[0],
      expectedRegistryRevision: 1,
    }),
  ]) {
    const bytes = x.store.db.serialize();
    assert.throws(() => x.store.presetCommand(c));
    assert.ok(x.store.db.serialize().equals(bytes));
  }
  assert.throws(() => x.store.presetCommand({ ...cmd, commandId: 'not-a-uuid' }), /Ungültiger/);
});
test('campaign packages strip installation receipts containing other campaign identities', async (t) => {
  const x = fixture(t),
    a = x.store.create('A'),
    b = x.store.create('Private B'),
    p = x.store.presetCommand(x.save()).preset;
  for (const id of [a.id, b.id])
    x.store.presetCommand(
      x.command(
        {
          kind: 'preset-assign',
          id: p.id,
          expectedRegistryRevision: x.store.presetRegistry(id).revision,
        },
        id,
      ),
    );
  x.store.presetCommand(
    x.command({
      kind: 'preset-delete',
      id: p.id,
      expectedRegistryRevision: x.store.presetRegistry(null).revision,
    }),
  );
  const w = x.store.activate(a.id),
    file = path.join(x.root, 'packet.sqlite');
  await x.store.campaignSnapshot(w.token, file);
  const Database = createRequire(import.meta.url)('better-sqlite3'),
    db = new Database(file, { readonly: true });
  try {
    assert.equal(db.prepare('SELECT count(*) n FROM generator_registry_receipt').get().n, 0);
  } finally {
    db.close();
  }
});
