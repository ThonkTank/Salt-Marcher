import test from "node:test";
import assert from "node:assert/strict";
import { AtlasHistory } from "../../src/features/atlas/atlas-history";
import { FileTransaction } from "../../src/features/atlas/file-transaction";
import { FileConflict, type FileStore } from "../../src/persistence";

class Store implements FileStore {
  files = new Map<string, string>([["map", "before"]]);
  writes: string[] = [];
  readHook?: (path: string) => void;
  writeHook?: (path: string) => void;
  async read(path: string) {
    this.readHook?.(path);
    return this.files.get(path) ?? null;
  }
  async compareAndWrite(
    path: string,
    before: string | null,
    after: string | null,
  ) {
    if ((this.files.get(path) ?? null) !== before) throw new FileConflict(path);
    this.writes.push(path);
    if (after === null) this.files.delete(path);
    else this.files.set(path, after);
    this.writeHook?.(path);
  }
}
function fixture() {
  let current = true;
  const guard = () => {
    if (!current) throw new Error("revoked mount");
  };
  const store = new Store();
  const transaction = new FileTransaction(
    store,
    "map.journal",
    (path) => path === "map",
    store,
    undefined,
    guard,
  );
  return {
    guard,
    store,
    transaction,
    revoke: () => {
      current = false;
    },
  };
}

test("mount lease covers register, hydrate, check, execute, undo and redo; read-only retained values survive revocation", () => {
  const f = fixture(),
    history = new AtlasHistory(f.guard);
  history.register("owner", () => {});
  history.hydrate("owner", [["value", "before"]]);
  const command = {
    label: "edit",
    changes: [
      { ownerId: "owner", target: "value", before: "before", after: "after" },
    ],
  };
  history.execute(command);
  history.undo();
  f.revoke();
  assert.throws(() => history.register("extra", () => {}), /revoked/);
  assert.throws(() => history.hydrate("owner", [["extra", "bad"]]), /revoked/);
  assert.throws(() => history.check(command), /revoked/);
  assert.throws(() => history.execute(command), /revoked/);
  assert.throws(() => history.undo(), /revoked/);
  assert.throws(() => history.redo(), /revoked/);
  assert.equal(history.read("owner", "value"), "before");
  assert.equal(history.read("owner", "extra"), null);
});

test("revocation while waiting for native baseline rejects before the first journal write", async () => {
  const f = fixture();
  f.store.readHook = (path) => {
    if (path === "map") f.revoke();
  };
  await assert.rejects(
    f.transaction.commit([{ path: "map", before: "before", after: "after" }]),
    /revoked/,
  );
  assert.deepEqual(f.store.writes, []);
  assert.equal(f.store.files.get("map"), "before");
});

test("an already started native journal finishes under its old file identities after context revocation", async () => {
  const f = fixture();
  f.store.writeHook = (path) => {
    if (path === "map.journal") f.revoke();
  };
  assert.equal(
    await f.transaction.commit([
      { path: "map", before: "before", after: "after" },
    ]),
    true,
  );
  assert.equal(f.store.files.get("map"), "after");
  assert.equal(f.store.files.has("map.journal"), false);
  await assert.rejects(
    f.transaction.commit([{ path: "map", before: "after", after: "new" }]),
    /revoked/,
  );
  assert.equal(f.store.files.get("map"), "after");
});

test("lost committed journal reply remains forward recoverable; stale mount cannot rollback or repair it", async () => {
  const f = fixture();
  f.store.writeHook = (path) => {
    if (
      path === "map.journal" &&
      f.store.files.get(path)?.includes('"state":"committed"')
    ) {
      f.revoke();
      throw new Error("lost reply");
    }
  };
  await assert.rejects(
    f.transaction.commit([{ path: "map", before: "before", after: "after" }]),
    AggregateError,
  );
  assert.equal(f.store.files.get("map"), "after");
  assert.match(f.store.files.get("map.journal")!, /"committed"/);
  await assert.rejects(f.transaction.recover(), /revoked/);
  f.store.writeHook = undefined;
  assert.equal(
    await new FileTransaction(
      f.store,
      "map.journal",
      (p) => p === "map",
    ).recover(),
    "committed",
  );
  assert.equal(f.store.files.get("map"), "after");
  assert.equal(f.store.files.has("map.journal"), false);
});
