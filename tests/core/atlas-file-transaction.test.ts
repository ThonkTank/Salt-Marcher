import test from "node:test";
import assert from "node:assert/strict";
import {
  FileTransaction,
  type AtlasFileRollbackReceipt,
  type AtlasFileWrite,
} from "../../src/features/atlas/file-transaction";
import { FileConflict, type FileStore } from "../../src/persistence";

const journalPath = "QA/Insel.overworld.journal";
const writes: readonly AtlasFileWrite[] = [
  { path: "QA/terrain.json", before: null, after: "terrain-after" },
  { path: "QA/Insel.overworld", before: "world-before", after: "world-after" },
  { path: "QA/Insel.overworld.draft", before: "draft-before", after: null },
];
class Store implements FileStore {
  files = new Map(
    writes.filter((w) => w.before !== null).map((w) => [w.path, w.before!]),
  );
  calls = 0;
  failAt = Infinity;
  afterFault = false;
  async read(path: string): Promise<string | null> {
    return this.files.get(path) ?? null;
  }
  async compareAndWrite(
    path: string,
    before: string | null,
    after: string | null,
  ): Promise<void> {
    if ((await this.read(path)) !== before) throw new FileConflict(path);
    const fault = ++this.calls === this.failAt;
    if (fault && !this.afterFault) throw new Error("interrupted CAS");
    if (after === null) this.files.delete(path);
    else this.files.set(path, after);
    if (fault) throw new Error("lost CAS acknowledgement");
  }
}
const transaction = (store: FileStore, scope?: object) =>
  new FileTransaction(
    store,
    journalPath,
    (p) => writes.some((w) => w.path === p),
    scope,
  );
function journal(
  state: "prepared" | "committed",
  data: readonly AtlasFileWrite[] = writes,
) {
  return JSON.stringify({
    kind: "atlas-file-transaction",
    version: 1,
    journalPath,
    transactionId: "12345678-1234-1234-1234-123456789abc",
    state,
    writes: data,
  });
}
async function expectState(store: Store, after: boolean) {
  for (const write of writes)
    assert.equal(
      await store.read(write.path),
      after ? write.after : write.before,
    );
  assert.equal(await store.read(journalPath), null);
}
test("Three-file atlas save creates terrain, updates world, removes draft and cleans committed journal", async () => {
  const store = new Store();
  assert.equal(await transaction(store).commit(writes), true);
  await expectState(store, true);
  assert.equal(
    await transaction(store).commit(
      writes.map((w) => ({ ...w, before: w.after })),
    ),
    false,
  );
  assert.equal(store.calls, 6);
});
test("Before/after faults at every write boundary recover to a complete before or committed after snapshot", async () => {
  for (const afterFault of [false, true])
    for (let failAt = 1; failAt <= 6; failAt++) {
      const store = new Store();
      store.failAt = failAt;
      store.afterFault = afterFault;
      const complete = failAt > 5 || (failAt === 5 && afterFault);
      if (complete) assert.equal(await transaction(store).commit(writes), true);
      else await assert.rejects(transaction(store).commit(writes), /CAS/);
      await expectState(store, complete);
    }
});
test("A fresh transaction reverses prepared partial saves or retains committed saves idempotently", async () => {
  for (const state of ["prepared", "committed"] as const) {
    const store = new Store();
    store.files.set(journalPath, journal(state));
    for (const w of state === "committed" ? writes : writes.slice(0, 2))
      if (w.after === null) store.files.delete(w.path);
      else store.files.set(w.path, w.after);
    assert.equal(
      await transaction(store).recover(),
      state === "prepared" ? "rolled_back" : "committed",
    );
    await expectState(store, state === "committed");
    assert.equal(await transaction(store).recover(), "none");
  }
});
test("External changes are detected before any recovery mutation and journals remain for both states", async () => {
  for (const state of ["prepared", "committed"] as const) {
    const store = new Store(),
      raw = journal(state);
    store.files.set(journalPath, raw);
    for (const w of writes)
      if (w.after === null) store.files.delete(w.path);
      else store.files.set(w.path, w.after);
    store.files.set(writes[1]!.path, "external-world");
    const before = new Map(store.files);
    await assert.rejects(transaction(store).recover(), FileConflict);
    assert.deepEqual(store.files, before);
    assert.equal(store.calls, 0);
  }
  const store = new Store();
  store.files.set(writes[1]!.path, "external-world");
  const before = new Map(store.files);
  await assert.rejects(transaction(store).commit(writes), FileConflict);
  assert.deepEqual(store.files, before);
  assert.equal(store.calls, 0);
});
test("Unsafe, foreign, duplicate and corrupt journal inputs fail before writes or destructive recovery", async () => {
  const badWrites = [
    [{ ...writes[0]!, path: "../outside" }],
    [{ ...writes[0]!, path: journalPath }],
    [writes[0]!, writes[0]!],
    [{ ...writes[0]!, extra: true }],
    [{ ...writes[0]!, after: 42 }],
  ];
  for (const bad of badWrites) {
    const store = new Store();
    assert.throws(() =>
      transaction(store).commit(bad as readonly AtlasFileWrite[]),
    );
    assert.equal(store.calls, 0);
  }
  for (const raw of [
    "unreadable",
    JSON.stringify({ ...JSON.parse(journal("prepared")), version: 2 }),
    journal("prepared", [{ ...writes[0]!, path: "../outside" }]),
    JSON.stringify({ ...JSON.parse(journal("prepared")), extra: true }),
  ]) {
    const store = new Store();
    store.files.set(journalPath, raw);
    const before = new Map(store.files);
    await assert.rejects(transaction(store).recover());
    assert.deepEqual(store.files, before);
    assert.equal(store.calls, 0);
  }
});
test("Transactions sharing a backend scope serialize across wrappers and validate queued snapshots against their original basis", async () => {
  const store = new Store(),
    scope = {};
  let release!: () => void;
  const paused = new Promise<void>((r) => (release = r)),
    original = store.compareAndWrite.bind(store);
  store.compareAndWrite = async (path, before, after) => {
    if (path === writes[0]!.path) await paused;
    await original(path, before, after);
  };
  const wrapper: FileStore = {
    read: store.read.bind(store),
    compareAndWrite: store.compareAndWrite.bind(store),
  };
  const first = transaction(store, scope).commit(writes),
    second = transaction(wrapper, scope).commit(writes);
  const rejected = assert.rejects(second, FileConflict);
  release();
  assert.equal(await first, true);
  await rejected;
  await expectState(store, true);
});

test("Won journal boundaries notify once; response loss releases only a sealed, fully read-back rollback", async () => {
  for (const afterFault of [false, true])
    for (let failAt = 1; failAt <= 6; failAt++) {
      const store = new Store(), tx = transaction(store), events: string[] = [];
      store.failAt = failAt;
      store.afterFault = afterFault;
      let receipt: AtlasFileRollbackReceipt | undefined;
      const saving = tx.commit(writes, {
        prepared: async (j) => {
          assert.equal(await store.read(journalPath), JSON.stringify(j));
          events.push("prepared");
        },
        committed: async (j) => {
          assert.equal(j.state, "committed");
          await expectState(store, true);
          events.push("committed");
        },
        rolledBack: async (r) => {
          await expectState(store, false);
          tx.validateRollbackReceipt(r);
          assert.throws(() => tx.validateRollbackReceipt({ ...r }), /nicht aus/);
          assert.throws(() => transaction(store).validateRollbackReceipt(r), /nicht aus/);
          assert.ok(Object.isFrozen(r) && Object.isFrozen(r.writes));
          receipt = r;
          events.push("rolled_back");
        },
      });
      const complete = failAt > 5 || (failAt === 5 && afterFault);
      if (complete) assert.equal(await saving, true);
      else await assert.rejects(saving, /CAS/);
      assert.deepEqual(events, failAt === 1 && !afterFault ? [] :
        ["prepared", complete ? "committed" : "rolled_back"]);
      assert.equal(Boolean(receipt), !complete && (failAt > 1 || afterFault));
    }
});

test("A foreign unchanged guard blocks rollback release even after changed files are restored", async () => {
  const store = new Store(), guard = "QA/unchanged.location", events: string[] = [];
  store.files.set(guard, "guard-before");
  const tx = new FileTransaction(store, journalPath, (p) => p === guard || writes.some((w) => w.path === p));
  const original = store.compareAndWrite.bind(store);
  store.compareAndWrite = async (path, before, after) => {
    if (path === writes[0]!.path) {
      store.files.set(guard, "external-guard");
      throw new Error("native save failed");
    }
    await original(path, before, after);
  };
  await assert.rejects(tx.commit([...writes, { path: guard, before: "guard-before", after: "guard-before" }], {
    prepared: () => { events.push("prepared"); },
    committed: () => { events.push("committed"); },
    rolledBack: () => { events.push("rolled_back"); },
  }), AggregateError);
  assert.deepEqual(events, ["prepared"]);
  assert.equal(await store.read(guard), "external-guard");
  await expectState(store, false);
});

test("A failed committed consumer acknowledgment retains canonical bytes and cannot issue a rollback", async () => {
  const store = new Store(), events: string[] = [];
  await assert.rejects(transaction(store).commit(writes, {
    prepared: () => { events.push("prepared"); },
    committed: () => { events.push("committed"); throw new Error("consumer closed"); },
    rolledBack: () => { events.push("rolled_back"); },
  }), /consumer closed/);
  assert.deepEqual(events, ["prepared", "committed"]);
  await expectState(store, true);
});
