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
  outfile: '.build/loot-balance-review.cjs',
  bundle: true,
  platform: 'node',
  format: 'cjs',
  external: ['better-sqlite3'],
});
const { CampaignStore } = createRequire(import.meta.url)('../.build/loot-balance-review.cjs');
function fixture(t) {
  const root = mkdtempSync(path.join(tmpdir(), 'loot-balance-')),
    filename = path.join(root, 'store.sqlite'),
    store = new CampaignStore(filename),
    cam = store.create('Beutebilanz'),
    w = store.activate(cam.id),
    command = (action) => ({ commandId: randomUUID(), campaignId: cam.id, token: w.token, action });
  t.after(() => {
    store.close();
    rmSync(root, { recursive: true, force: true });
  });
  const characters = ['Iri', 'Dorn'].map(
    (name) => store.executeLive(command({ kind: 'create-character', profile: { name } })).character,
  );
  const definition = store.executeItemShop(
    command({
      kind: 'definition',
      expectedRevision: null,
      definition: {
        id: randomUUID(),
        revision: 0,
        name: 'Seil',
        category: 'equipment',
        magic: false,
        rarity: '',
        attunement: 'no',
        unitCopper: '100',
        weightText: '',
        properties: [],
        description: '',
        source: { kind: 'authored', label: 'Eigene Vorlage', license: null, url: null },
        trashed: false,
      },
    }),
  ).definition;
  const add = (character = characters[0], quantity = 2, origin = 'manual') =>
    store.executeProgress(
      command({
        kind: 'manual-item',
        characterId: character.id,
        expectedMembershipRevision: character.membershipRevision,
        origin,
        item: {
          name: definition.name,
          category: definition.category,
          quantity,
          valueGold: '1',
          reference: {
            kind: 'authored',
            definitionId: definition.id,
            revision: definition.revision,
          },
        },
        note: 'Vergeben',
      }),
    ).ledgerIds[0];
  const ledger = (character) =>
    store.ledger(w.token, { characterId: character.id, after: null, search: '', status: '' });
  return { root, filename, store, cam, w, command, characters, definition, add, ledger };
}
function matchesLedger(x) {
  const balance = x.store.lootBalance(x.w.token);
  for (const c of x.characters) {
    const row = balance.characters.find((r) => r.characterId === c.id);
    assert.equal(row.copper, x.ledger(c).totalCopper);
  }
  return balance;
}
test('balance follows current definition values and authoritative proceeds after multi-hop transfer', (t) => {
  const x = fixture(t),
    id = x.add();
  x.store.executeItemShop(
    x.command({
      kind: 'definition',
      expectedRevision: x.definition.revision,
      definition: { ...x.definition, unitCopper: '300' },
    }),
  );
  assert.equal(matchesLedger(x).characters[0].copper, '600');
  const transfer = x.store.executeProgress(
    x.command({
      kind: 'ledger-transfer',
      entryId: id,
      expectedRevision: 1,
      quantity: 2,
      characterId: x.characters[1].id,
      expectedMembershipRevision: x.characters[1].membershipRevision,
      reason: 'Weitergabe',
    }),
  );
  const received = transfer.ledgerIds[2],
    second = x.store.executeProgress(
      x.command({
        kind: 'ledger-transfer',
        entryId: received,
        expectedRevision: 1,
        quantity: 1,
        characterId: x.characters[0].id,
        expectedMembershipRevision: x.characters[0].membershipRevision,
        reason: 'Teil zurück',
      }),
    );
  x.store.executeProgress(
    x.command({
      kind: 'ledger',
      entryId: second.ledgerIds[2],
      expectedRevision: 1,
      operation: 'sold',
      quantity: 1,
      actualGold: '7',
      counterparty: 'Markt',
      reason: 'Verkauft',
    }),
  );
  const view = matchesLedger(x);
  assert.equal(view.characters[0].copper, '1000');
  assert.equal(view.characters[1].copper, '0');
  const fresh = new CampaignStore(x.filename);
  try {
    assert.deepEqual(fresh.lootBalance(fresh.activate(x.cam.id).token), view);
  } finally {
    fresh.close();
  }
});
test('purchases stay excluded and zero stacks match ledger semantics', (t) => {
  const x = fixture(t);
  x.add(x.characters[0], 2, 'purchase');
  const id = x.add(x.characters[1], 2);
  x.store.executeProgress(
    x.command({
      kind: 'ledger',
      entryId: id,
      expectedRevision: 1,
      operation: 'correct',
      quantity: 0,
      correctedQuantity: 0,
      actualGold: '',
      counterparty: '',
      reason: 'Menge berichtigt',
    }),
  );
  assert.deepEqual(
    matchesLedger(x).characters.map((c) => c.copper),
    ['0', '0'],
  );
});
test('unreadable current definitions make a balance explicitly incomplete rather than using historical prices', (t) => {
  const x = fixture(t);
  x.add();
  x.store.db
    .prepare('UPDATE item_definition SET checksum=? WHERE id=?')
    .run('broken', x.definition.id);
  const view = x.store.lootBalance(x.w.token);
  assert.equal(view.characters[0].unknownEntries, 1);
  assert.equal(x.ledger(x.characters[0]).totalCopper, null);
  assert.deepEqual(view.suggestedCharacterIds, []);
});
test('profile checksum must be checked before labels enter the balance', (t) => {
  const x = fixture(t),
    row = x.store.db
      .prepare('SELECT payload FROM character_profile WHERE id=?')
      .get(x.characters[0].id),
    profile = JSON.parse(row.payload);
  profile.name = 'Ungeprüfter Name';
  x.store.db
    .prepare('UPDATE character_profile SET payload=? WHERE id=?')
    .run(JSON.stringify(profile), x.characters[0].id);
  assert.throws(() => x.store.lootBalance(x.w.token), /beschädigt|nicht verfügbar|prüf/i);
});
test('unknown item value prevents recommending that character', (t) => {
  const x = fixture(t);
  x.add();
  const payload = JSON.stringify({ ...x.definition, unitCopper: null });
  x.store.db
    .prepare('UPDATE item_definition SET payload=?,checksum=? WHERE id=?')
    .run(payload, createHash('sha256').update(payload).digest('hex'), x.definition.id);
  const view = x.store.lootBalance(x.w.token);
  assert.equal(view.characters[0].unknownEntries, 1);
  assert.deepEqual(view.suggestedCharacterIds, []);
});
