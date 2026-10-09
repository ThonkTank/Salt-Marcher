import test from "node:test";
import assert from "node:assert/strict";
import { AtlasRepository } from "../../src/features/atlas/atlas-repository";
import { parseAtlasDraft } from "../../src/features/atlas/atlas-draft";
import {
  newOverworld,
  parseOverworld,
  serializeOverworld,
} from "../../src/features/atlas/overworld";
import {
  TerrainStroke,
  type TerrainSource,
} from "../../src/features/atlas/terrain-source";
import { FileConflict, type FileStore } from "../../src/persistence";

const worldPath = "Atlanten/Insel.overworld",
  initial = serializeOverworld(newOverworld("island", "Insel", "pointy"));
class Store implements FileStore {
  files = new Map([[worldPath, initial]]);
  reads: string[] = [];
  failPath?: string;
  async read(path: string): Promise<string | null> {
    this.reads.push(path);
    return this.files.get(path) ?? null;
  }
  async compareAndWrite(
    path: string,
    before: string | null,
    after: string | null,
  ): Promise<void> {
    if ((await this.read(path)) !== before) throw new FileConflict(path);
    if (this.failPath === path) {
      this.failPath = undefined;
      throw new Error("one-time interruption");
    }
    if (after === null) this.files.delete(path);
    else this.files.set(path, after);
  }
}
async function paint(
  source: TerrainSource,
  q: number,
  r = 0,
  tool: "land" | "reset" = "land",
) {
  await source.ensure([{ q, r }]);
  const stroke = new TerrainStroke(source, tool);
  stroke.add({ q, r });
  stroke.finish();
}
test("Native island saves sparse negative chunks, reopens lazily and uses content rather than undo depth for dirty state", async () => {
  const store = new Store(),
    repo = new AtlasRepository(store, worldPath),
    source = await repo.open();
  await paint(source, -33);
  await paint(source, -32);
  await paint(source, 1);
  await repo.persistDraft();
  assert(repo.hasDraft);
  assert(repo.dirty);
  assert.equal(store.files.get(worldPath), initial);
  await repo.save();
  assert(!repo.dirty);
  assert(!repo.hasDraft);
  assert(source.history.canUndo);
  const refs = parseOverworld(store.files.get(worldPath)!).chunks;
  assert.equal(refs.length, 3);
  assert.equal(store.files.size, 4);
  const reopened = new AtlasRepository(store, worldPath),
    next = await reopened.open();
  assert.equal(next.cells().length, 0, "open does not eagerly load terrain");
  await next.ensure([{ q: -33, r: 0 }]);
  assert.equal(next.cells().length, 1);
  assert(!reopened.dirty);
  await paint(next, 2);
  await reopened.persistDraft();
  assert(reopened.dirty);
  next.history.undo();
  await reopened.persistDraft();
  assert(!reopened.dirty);
  assert(!reopened.hasDraft);
  assert.equal(
    parseOverworld(store.files.get(worldPath)!).chunks.length,
    3,
    "unloaded chunks are retained",
  );
  source.history.undo();
  assert(repo.dirty, "Undo after save is a new unsaved state");
});
test("Unsaved draft restores new and deleted chunks; saving removes only the draft and saved deletions", async () => {
  const store = new Store(),
    repo = new AtlasRepository(store, worldPath),
    source = await repo.open();
  await paint(source, 0);
  await paint(source, 35);
  await repo.save();
  await paint(source, 0, 0, "reset");
  await paint(source, -35);
  await repo.persistDraft();
  const before = store.files.get(worldPath),
    draftRaw = store.files.get(repo.draftPath)!;
  const draft = parseAtlasDraft(draftRaw);
  assert.equal(draft.chunks.length, 2);
  const reopened = new AtlasRepository(store, worldPath),
    restored = await reopened.open();
  assert(reopened.hasDraft);
  assert(reopened.dirty);
  await restored.ensure([
    { q: -35, r: 0 },
    { q: 0, r: 0 },
    { q: 35, r: 0 },
  ]);
  assert.deepEqual(
    restored
      .cells()
      .map((c) => c.q)
      .sort((a, b) => a - b),
    [-35, 35],
  );
  assert.equal(store.files.get(worldPath), before);
  await reopened.save();
  assert(!reopened.dirty);
  assert(!store.files.has(repo.draftPath));
  assert(!store.files.has("Atlasdaten/island/terrain/0_0_0.json"));
  const third = await new AtlasRepository(store, worldPath).open();
  await third.ensure([
    { q: -35, r: 0 },
    { q: 35, r: 0 },
  ]);
  assert.equal(third.cells().length, 2);
});
test("Save interruption rolls back terrain and world while preserving the complete native draft for fresh recovery", async () => {
  const store = new Store(),
    repo = new AtlasRepository(store, worldPath),
    source = await repo.open();
  await paint(source, -1);
  await paint(source, 1);
  await repo.persistDraft();
  const before = new Map(store.files);
  store.failPath = worldPath;
  await assert.rejects(repo.save(), /interruption/);
  assert.deepEqual(store.files, before);
  const recovered = new AtlasRepository(store, worldPath),
    next = await recovered.open();
  await next.ensure([
    { q: -1, r: 0 },
    { q: 1, r: 0 },
  ]);
  assert.equal(next.cells().length, 2);
  await recovered.save();
  assert(!recovered.dirty);
});
test("External world, terrain, draft, missing and corrupt files remain preserved on conflicts", async () => {
  for (const target of [
    worldPath,
    "Atlasdaten/island/terrain/0_0_0.json",
    worldPath + ".draft",
  ]) {
    const store = new Store(),
      repo = new AtlasRepository(store, worldPath),
      source = await repo.open();
    await paint(source, 0);
    await repo.save();
    await paint(source, 1);
    await repo.persistDraft();
    store.files.set(target, "external bytes");
    const before = new Map(store.files);
    await assert.rejects(repo.save(), FileConflict);
    assert.deepEqual(store.files, before);
    await assert.rejects(new AtlasRepository(store, worldPath).open());
    assert.deepEqual(store.files, before);
  }
  const store = new Store(),
    repo = new AtlasRepository(store, worldPath),
    source = await repo.open();
  await paint(source, 0);
  await repo.save();
  store.files.delete("Atlasdaten/island/terrain/0_0_0.json");
  const reopened = new AtlasRepository(store, worldPath),
    next = await reopened.open();
  await assert.rejects(paint(next, 0), /fehlt/);
  assert(!reopened.dirty);
  const before = new Map(store.files);
  await reopened.save();
  assert.deepEqual(store.files, before);
});
test("Draft rejects unknown or mismatched delta data without mutating any files", async () => {
  const store = new Store(),
    repo = new AtlasRepository(store, worldPath),
    source = await repo.open();
  await paint(source, -1);
  await repo.persistDraft();
  const good = JSON.parse(store.files.get(repo.draftPath)!);
  for (const invalid of [
    { ...good, extra: true },
    { ...good, worldId: "other" },
    { ...good, chunks: [] },
    { ...good, chunks: [...good.chunks, ...good.chunks] },
    { ...good, chunks: [{ ...good.chunks[0], file: "../outside" }] },
    {
      ...good,
      currentWorld: JSON.stringify({
        ...JSON.parse(good.currentWorld),
        orientation: "flat",
      }),
    },
  ]) {
    store.files.set(repo.draftPath, JSON.stringify(invalid));
    const before = new Map(store.files);
    await assert.rejects(new AtlasRepository(store, worldPath).open());
    assert.deepEqual(store.files, before);
  }
});
test("Two leaves using separate store wrappers share backend scope and refuse to erase or replace each other's draft", async () => {
  const store = new Store(),
    scope = {},
    wrapper = (): FileStore => ({
      read: store.read.bind(store),
      compareAndWrite: store.compareAndWrite.bind(store),
    });
  const a = new AtlasRepository(wrapper(), worldPath, scope),
    b = new AtlasRepository(wrapper(), worldPath, scope);
  const [sa, sb] = await Promise.all([a.open(), b.open()]);
  await paint(sa, -1);
  await paint(sb, 1);
  const pa = a.persistDraft(),
    pb = assert.rejects(b.persistDraft(), FileConflict);
  await pa;
  await pb;
  const own = store.files.get(a.draftPath);
  assert(own);
  await assert.rejects(b.save(), FileConflict);
  assert.equal(store.files.get(a.draftPath), own);
  await a.save();
  await assert.rejects(b.save(), FileConflict);
  assert.equal(parseOverworld(store.files.get(worldPath)!).chunks.length, 1);
});
test("Formatting and valid cell/reference order do not become phantom edits or rewrite clean saved bytes", async () => {
  const store = new Store(),
    repo = new AtlasRepository(store, worldPath),
    source = await repo.open();
  await paint(source, 0);
  await paint(source, 1);
  await paint(source, -1);
  await repo.save();
  const d = JSON.parse(store.files.get(worldPath)!);
  d.chunks.reverse();
  store.files.set(worldPath, JSON.stringify(d));
  const file = "Atlasdaten/island/terrain/0_0_0.json",
    c = JSON.parse(store.files.get(file)!);
  c.cells.reverse();
  store.files.set(file, JSON.stringify(c));
  const before = new Map(store.files),
    reopened = new AtlasRepository(store, worldPath),
    next = await reopened.open();
  await next.ensure([
    { q: 0, r: 0 },
    { q: -1, r: 0 },
  ]);
  assert(!reopened.dirty);
  await reopened.persistDraft();
  await reopened.save();
  assert.deepEqual(store.files, before);
});
test("An edit arriving during save keeps its newer snapshot as the next durable draft", async () => {
  const store = new Store(),
    repo = new AtlasRepository(store, worldPath),
    source = await repo.open();
  await paint(source, 0);
  let release!: () => void, reached!: () => void;
  const paused = new Promise<void>((r) => (release = r)),
    entered = new Promise<void>((r) => (reached = r)),
    original = store.compareAndWrite.bind(store);
  store.compareAndWrite = async (p, b, a) => {
    if (p === worldPath) {
      reached();
      await paused;
    }
    await original(p, b, a);
  };
  const saving = repo.save();
  await entered;
  await paint(source, 1);
  const newer = repo.persistDraft();
  release();
  await saving;
  await newer;
  assert(repo.dirty && repo.hasDraft);
  assert.equal(
    parseOverworld(store.files.get(worldPath)!).chunks[0]!.cellCount,
    1,
  );
  const fresh = await new AtlasRepository(store, worldPath).open();
  await fresh.ensure([{ q: 0, r: 0 }]);
  assert.deepEqual(
    fresh.cells().map((c) => c.q),
    [0, 1],
  );
});
