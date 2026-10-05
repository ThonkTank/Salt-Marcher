import { test } from "node:test";
import assert from "node:assert/strict";
import { newDocument, parseDocument, serializeDocument } from "../src/model";
import { Session } from "../src/session";
import { createLight, createRoom } from "../src/commands";
import { FileConflict, MapRepository, type FileStore } from "../src/persistence";

const mapPath = "QA/Pending/Karte.dungeon";
class Store implements FileStore {
  files = new Map<string, string>();
  hook?: (path: string) => void;
  async read(path: string): Promise<string | null> {
    return this.files.get(path) ?? null;
  }
  async compareAndWrite(path: string, before: string | null,
    after: string | null): Promise<void> {
    this.hook?.(path);
    if ((await this.read(path)) !== before) throw new FileConflict(path);
    if (after === null) this.files.delete(path);
    else this.files.set(path, after);
  }
}
function pending() {
  const initial = newDocument("Pending", 8, 8);
  const session = new Session(initial);
  const floor = session.floors.keys().next().value!;
  const store = new Store();
  const repo = new MapRepository(store, mapPath);
  const light = () => createLight(session, floor, { x: 4, y: 4 }, {
    radius: 2, intensity: 1, color: 0xffd080, shadows: true,
  });
  return { initial, session, floor, store, repo, light };
}

test("DD-001.04 pending card keeps pre-save history through first save", async () => {
  const { initial, session, store, repo, light } = pending();
  await repo.beginPending(initial, session);
  assert.equal(await store.read(mapPath), null);
  assert.equal(JSON.parse((await store.read(repo.draftPath))!).version, 2);
  assert.equal(session.dirty, false);
  assert.equal(session.canUndo, false);
  const placed = light();
  await repo.persistDraft(session);
  session.undo();
  assert.equal(session.entities.has(placed.id), false);
  assert.equal(session.canRedo, true);
  session.redo();
  assert.equal(session.entities.has(placed.id), true);
  assert.equal(await store.read(mapPath), null);
  await repo.save(session);
  const saved = await store.read(mapPath);
  assert(saved);
  assert.equal(session.canUndo, true);
  assert.equal(session.dirty, false);
  assert.equal(await store.read(repo.draftPath), null);
  session.undo();
  assert.equal(session.entities.has(placed.id), false);
  assert.equal(await store.read(mapPath), saved);
  session.redo();
  assert.deepEqual(session.entities.get(placed.id), placed);
  assert.equal(await store.read(mapPath), saved);
  const reopened = await new MapRepository(store, mapPath).open();
  assert.deepEqual(reopened.document(), parseDocument(saved));
  assert.equal(reopened.entities.has(placed.id), true);
});

test("DD-001.04 a new empty map is recoverable before its first edit", async () => {
  const { initial, session, store, repo } = pending();
  await repo.beginPending(initial, session);
  const draft = await store.read(repo.draftPath);
  assert(draft);
  assert.equal(await store.read(mapPath), null);
  const restored = await new MapRepository(store, mapPath).openPending();
  assert.deepEqual(restored.document(), session.document());
  assert.equal(restored.dirty, false);
  assert.equal(restored.canUndo, false);
  await assert.rejects(new MapRepository(store, mapPath)
    .beginPending(initial, new Session(initial)), FileConflict);
  assert.equal(await store.read(repo.draftPath), draft);
});

test("DD-001.04 pending draft reopens without map and rejects a foreign target", async () => {
  const { initial, session, store, repo, light } = pending();
  await repo.beginPending(initial, session);
  const placed = light();
  await repo.persistDraft(session);
  const rawDraft = await store.read(repo.draftPath);
  const fresh = new MapRepository(store, mapPath);
  const restored = await fresh.openPending();
  assert.equal(await store.read(mapPath), null);
  assert.equal(restored.entities.has(placed.id), true);
  assert.equal(restored.dirty, true);
  store.files.set(mapPath, "foreign map");
  await assert.rejects(fresh.save(restored), FileConflict);
  assert.equal(await store.read(mapPath), "foreign map");
  assert.equal(await store.read(repo.draftPath), rawDraft);
});

test("DD-001.04 prepared first-save failure preserves pending draft", async () => {
  const { initial, session, store, repo, light } = pending();
  await repo.beginPending(initial, session);
  const placed = light();
  let once = false;
  store.hook = (path) => {
    if (path === mapPath && !once) {
      once = true;
      throw new Error("interrupted map write");
    }
  };
  await assert.rejects(repo.save(session));
  assert.equal(await store.read(mapPath), null);
  assert.equal(await store.read(repo.journalPath), null);
  store.hook = undefined;
  const restored = await new MapRepository(store, mapPath).openPending();
  assert.equal(restored.entities.has(placed.id), true);
});

test("DD-001.04 recovery rolls a partly written first map back to pending", async () => {
  const { initial, session, store, repo, light } = pending();
  await repo.beginPending(initial, session);
  const placed = light();
  await repo.persistDraft(session);
  const draft = await store.read(repo.draftPath);
  const mapText = serializeDocument(session.document());
  store.files.set(mapPath, mapText);
  store.files.set(repo.journalPath, JSON.stringify({
    version: 1, mapPath, state: "prepared",
    writes: [{ path: mapPath, before: null, after: mapText }],
  }));
  const restored = await new MapRepository(store, mapPath).openPending();
  assert.equal(restored.entities.has(placed.id), true);
  assert.equal(await store.read(mapPath), null);
  assert.equal(await store.read(repo.journalPath), null);
  assert.equal(await store.read(repo.draftPath), draft);
});

test("DD-001.04 committed save retires an exact pending draft after crash", async () => {
  const { initial, session, store, repo, light } = pending();
  await repo.beginPending(initial, session);
  const placed = light();
  store.hook = (path) => {
    if (path === repo.draftPath && store.files.has(mapPath))
      throw new Error("interrupted draft cleanup");
  };
  await assert.rejects(repo.save(session));
  assert(await store.read(mapPath));
  assert.equal(JSON.parse((await store.read(repo.draftPath))!).version, 2);
  store.hook = undefined;
  const reopened = await new MapRepository(store, mapPath).open();
  assert.equal(reopened.entities.has(placed.id), true);
  assert.equal(reopened.dirty, false);
  assert.equal(await store.read(repo.draftPath), null);
});

test("DD-001.04 committed first save recovers map and room text together", async () => {
  const { initial, session, floor, store, repo } = pending();
  await repo.beginPending(initial, session);
  const room = createRoom(session, floor, [
    { x: 1, y: 1 }, { x: 4, y: 1 }, { x: 4, y: 4 }, { x: 1, y: 4 },
  ], "QA/Pending/Räume");
  const note = session.note(room.note.path);
  assert(note);
  store.hook = (path) => {
    if (path === repo.draftPath && store.files.has(mapPath))
      throw new Error("interrupted draft cleanup");
  };
  await assert.rejects(repo.save(session));
  assert.equal(await store.read(room.note.path), note);
  store.hook = undefined;
  const reopened = await new MapRepository(store, mapPath).open();
  assert.equal(reopened.entities.has(room.id), true);
  assert.equal(await store.read(room.note.path), note);
  assert.equal(await store.read(repo.draftPath), null);
});

test("DD-001.04 edit during first save becomes a saved-map V1 draft", async () => {
  const { initial, session, store, repo, light } = pending();
  await repo.beginPending(initial, session);
  const first = light();
  let second: ReturnType<typeof light> | undefined;
  store.hook = (path) => {
    if (path === mapPath && !second) second = light();
  };
  await repo.save(session);
  assert(second);
  assert.equal(session.entities.has(first.id), true);
  assert.equal(session.entities.has(second.id), true);
  assert.equal(session.dirty, true);
  assert.equal(parseDocument((await store.read(mapPath))!).entities.length, 1);
  assert.equal(JSON.parse((await store.read(repo.draftPath))!).version, 1);
  const reopened = await new MapRepository(store, mapPath).open();
  assert.equal(reopened.entities.has(second.id), true);
  assert.equal(reopened.dirty, true);
});

test("DD-001.04 first-save handoff can hold edits and history against a write race", async () => {
  const { initial, session, store, repo, light } = pending();
  await repo.beginPending(initial, session);
  const placed = light();
  const before = session.document();
  const release = session.holdMutations();
  store.hook = (path) => {
    if (path !== mapPath) return;
    assert.throws(() => light(), /Karte wird gespeichert/);
    assert.throws(() => session.undo(), /Karte wird gespeichert/);
    assert.throws(() => session.redo(), /Karte wird gespeichert/);
  };
  try {
    await repo.save(session);
  } finally {
    release();
  }
  assert.deepEqual(session.document(), before);
  assert.equal(session.entities.has(placed.id), true);
  assert.equal(session.dirty, false);
  session.undo();
  assert.equal(session.entities.has(placed.id), false);
  session.redo();
  assert.equal(session.entities.has(placed.id), true);
  assert.equal(await store.read(repo.draftPath), null);
});
