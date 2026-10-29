import { test } from 'node:test';
import assert from 'node:assert/strict';
import { mkdtempSync, rmSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { randomUUID } from 'node:crypto';
import { createRequire } from 'node:module';
import { buildSync } from '../helpers/build.mjs';
buildSync({
  stdin: {
    contents: `export {CampaignStore} from './src/app/storage/store';
      export {LiveDraftOwner} from './src/app/runtime/live-draft-owner';
      export {LiveWriteCoordinator} from './src/app/runtime/live-write-coordinator';
      export {EditorSession} from './src/app/shared/editor-session';`,
    resolveDir: process.cwd(),
  },
  outfile: '.build/live-write-owner.cjs',
  bundle: true,
  platform: 'node',
  format: 'cjs',
  external: ['better-sqlite3'],
});
const { CampaignStore, LiveDraftOwner, LiveWriteCoordinator, EditorSession } = createRequire(
  import.meta.url,
)('../../.build/live-write-owner.cjs');
const tick = async () => {
  for (let i = 0; i < 5; i++) await new Promise((r) => setImmediate(r));
};
function deferred() {
  let resolve;
  const promise = new Promise((r) => {
    resolve = r;
  });
  return { promise, resolve };
}
function fixture(t) {
  const dir = mkdtempSync(tmpdir() + '/live-write-owner-'),
    store = new CampaignStore(dir + '/db.sqlite');
  const campaign = store.create('Live raw state'),
    context = store.activate(campaign.id);
  const command = (action) => ({
    commandId: randomUUID(),
    campaignId: campaign.id,
    token: context.token,
    action,
  });
  const character = store.executeLive(
    command({ kind: 'create-character', profile: { name: 'Ada' } }),
  ).character;
  store.executeLive(
    command({
      kind: 'initialize',
      expectedRosterRevision: store.live(context.token).rosterRevision,
    }),
  );
  const drafts = new LiveDraftOwner(),
    session = new EditorSession(),
    writes = [],
    lookups = [],
    messages = [];
  drafts.accept(store.live(context.token));
  const api = {
    executeLive: async (c) => {
      writes.push(c);
      return { ok: true, value: store.executeLive(c) };
    },
    liveStatus: async (c, token) => {
      lookups.push(c);
      return { ok: true, value: store.liveStatus(c, token) };
    },
  };
  const writer = new LiveWriteCoordinator({
    session,
    api,
    context: () => context,
    drafts,
    flushDependents: async () => true,
    invalidateRead() {},
    accepted: (ack, action, profile) => drafts.acceptAck(ack, action, profile),
    busy() {},
    renderGroups() {},
    recovery() {},
    refreshSession: async () => {},
    tell: (text, error) => messages.push({ text, error }),
  });
  t.after(async () => {
    session.deactivate();
    await session.settle();
    store.close();
    rmSync(dir, { recursive: true, force: true });
  });
  return { store, context, character, drafts, session, api, writer, writes, lookups, messages };
}
test('Live close drain saves later character and scene input against their own confirmed bases', async (t) => {
  const x = fixture(t),
    gate = deferred(),
    save = x.api.executeLive;
  x.api.executeLive = async (c) => {
    const result = await save(c);
    if (x.writes.length === 1) await gate.promise;
    return result;
  };
  x.drafts.editProfile({ name: 'First profile' });
  const firstRevision = x.drafts.character.profileRevision;
  const flush = x.writer.flush();
  await tick();
  assert.equal(x.writes.length, 1);
  x.drafts.editProfile({ name: 'Later profile\r\n' });
  x.drafts.editScene({ title: 'Later scene', notes: '  literal\r\nnotes  ' });
  let drained = false;
  const drain = x.session.settle().then(() => {
    drained = true;
  });
  await tick();
  assert.equal(drained, false);
  gate.resolve();
  assert.equal(await flush, true);
  await drain;
  assert.deepEqual(
    x.writes.map((c) => c.action.kind),
    ['profile', 'scene-content', 'profile'],
  );
  assert.equal(x.writes.at(-1).action.expectedRevision, firstRevision + 1);
  assert.equal(x.store.live(x.context.token).roster[0].profile.name, 'Later profile\r\n');
  assert.equal(x.store.live(x.context.token).scene.notes, '  literal\r\nnotes  ');
  assert.equal(x.drafts.changed(), false);
});
for (const applied of [true, false])
  test(`Live ${applied ? 'applied' : 'unapplied'} lost reply resolves the original command without replay or confirming later input`, async (t) => {
    const x = fixture(t),
      save = x.api.executeLive;
    let lose = true;
    x.api.executeLive = async (c) => {
      if (!lose) return save(c);
      lose = false;
      if (applied) await save(c);
      else x.writes.push(c);
      throw Error('reply lost');
    };
    x.drafts.editProfile({ name: 'Submitted' });
    assert.equal(await x.writer.flush(), false);
    x.drafts.editProfile({ name: 'Later' });
    const original = x.writer.uncertainCommand;
    assert.equal(
      await x.writer.execute({ kind: 'create-character', profile: { name: 'Duplicate' } }),
      null,
    );
    const status = await x.writer.resolve();
    assert.equal(status.outcome, applied ? 'applied' : 'not-applied');
    assert.equal(x.lookups[0], original);
    assert.equal(x.writes.length, 1);
    assert.equal(x.drafts.character.profile.name, 'Later');
    assert.equal(x.drafts.changed(), true);
    assert.equal(await x.writer.flush(), true);
    assert.equal(x.writes.length, 2);
    assert.equal(x.store.live(x.context.token).roster.length, 1);
  });
test('Live detachment drains an accepted write, keeps its unknown command and rejects stale receipt adoption after reactivation', async (t) => {
  const x = fixture(t),
    gate = deferred(),
    save = x.api.executeLive;
  x.api.executeLive = async (c) => {
    await save(c);
    await gate.promise;
    throw Error('late reply lost');
  };
  x.drafts.editProfile({ name: 'First owner' });
  const write = x.writer.execute({
    kind: 'profile',
    characterId: x.character.id,
    expectedRevision: x.character.profileRevision,
    profile: { name: 'First owner' },
  });
  await tick();
  x.session.deactivate();
  let drained = false;
  const drain = x.session.settle().then(() => {
    drained = true;
  });
  await tick();
  assert.equal(drained, false);
  gate.resolve();
  await write;
  await drain;
  assert.equal(x.writer.blocked, true);
  x.session.generation++;
  x.drafts.accept(x.store.live(x.context.token));
  x.drafts.editProfile({ name: 'New owner' });
  const before = structuredClone(x.drafts.character);
  assert.equal((await x.writer.resolve()).outcome, 'applied');
  assert.deepEqual(x.drafts.character, before);
  assert.equal(x.writes.length, 1);
});
test('Live clock publication preserves raw scene input and rejects foreign or stale clocks', (t) => {
  const { drafts } = fixture(t);
  drafts.editScene({ notes: 'Unconfirmed\r\nscene text' });
  const raw = structuredClone(drafts.scene),
    scene = structuredClone(drafts.view.scene),
    clock = { ...scene.clock, revision: scene.clock.revision + 1 };
  assert.equal(drafts.acceptClock({ id: scene.id, clock }), true);
  assert.deepEqual(drafts.view.scene.clock, clock);
  assert.deepEqual(drafts.view.scenes.find((row) => row.id === scene.id).clock, clock);
  assert.deepEqual(drafts.scene, raw);
  assert.equal(drafts.acceptClock(scene), false);
  assert.equal(drafts.acceptClock({ id: 'other-scene', clock }), false);
  assert.equal(
    drafts.acceptClock({ id: scene.id, clock: { ...clock, epochId: 'other-epoch' } }),
    false,
  );
  assert.deepEqual(drafts.view.scene.clock, clock);
  assert.deepEqual(drafts.scene, raw);
});
test('Live owners isolate equal identities and preserve selected draft and revision through a confirmed refresh', (t) => {
  const x = fixture(t),
    other = new LiveDraftOwner();
  other.accept(structuredClone(x.drafts.view));
  x.drafts.editProfile({ name: 'Private A' });
  const basis = x.drafts.character.profileRevision;
  x.drafts.accept(structuredClone(x.drafts.view));
  assert.equal(x.drafts.character.profile.name, 'Private A');
  assert.equal(x.drafts.character.profileRevision, basis);
  assert.equal(other.character.profile.name, 'Ada');
  other.editScene({ notes: 'Private B' });
  assert.notEqual(x.drafts.scene.notes, other.scene.notes);
});
