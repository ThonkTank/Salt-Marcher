import test from "node:test";
import assert from "node:assert/strict";
import { AtlasRepository } from "../../src/features/atlas/atlas-repository";
import { FileTransaction } from "../../src/features/atlas/file-transaction";
import {
  newOverworld,
  parseOverworld,
  serializeOverworld,
} from "../../src/features/atlas/overworld";
import { TerrainStroke } from "../../src/features/atlas/terrain-source";
import { FileConflict, type FileStore } from "../../src/persistence";

const A = "Atlanten/Quelle.overworld",
  B = "Atlanten/Kopie.overworld";
class Store implements FileStore {
  constructor(readonly files = new Map<string, string>()) {}
  boundaries: { path: string; files: Map<string, string> }[] = [];
  async read(path: string) {
    return this.files.get(path) ?? null;
  }
  async compareAndWrite(
    path: string,
    before: string | null,
    after: string | null,
  ) {
    if ((await this.read(path)) !== before) throw new FileConflict(path);
    if (after === null) this.files.delete(path);
    else this.files.set(path, after);
    this.boundaries.push({ path, files: new Map(this.files) });
  }
}
async function fixture(empty = false) {
  const store = new Store(
    new Map([
      [A, serializeOverworld(newOverworld("source", "Quelle", "flat"))],
      ["Orte/Fremd.location", "protected foreign key"],
      ["Atlasdaten/other/terrain/0_0_0.json", "protected unrelated chunk"],
    ]),
  );
  const repository = new AtlasRepository(store, A),
    source = await repository.open();
  if (!empty) {
    for (const q of [-33, 0, 33]) {
      await source.ensure([{ q, r: -1 }]);
      const stroke = new TerrainStroke(source, "land");
      stroke.add({ q, r: -1 });
      stroke.finish();
    }
  }
  await repository.persistDraft();
  const before = new Map(store.files);
  await repository.copy(B, "copy", "Kopie");
  const journalStates = store.boundaries.filter(
    (b) => b.path === B + ".journal",
  );
  const prepared = journalStates.find(
    (b) =>
      JSON.parse(b.files.get(B + ".journal") ?? "null")?.state === "prepared",
  )!;
  const committed = journalStates.find(
    (b) =>
      JSON.parse(b.files.get(B + ".journal") ?? "null")?.state === "committed",
  )!;
  return { store, before, prepared, committed };
}
test("Fresh copy recovery covers every prepared child/root boundary and committed cleanup, then permits a new copy", async () => {
  const f = await fixture();
  const start = f.store.boundaries.indexOf(f.prepared);
  const states = f.store.boundaries.slice(start);
  assert.equal(states.length, 7); // prepared + 3 children + root + committed + journal removal
  for (const [index, boundary] of states.entries()) {
    // Fresh backend/adapter: no same-process catch or rollback is run.
    const fresh = new Store(new Map(boundary.files));
    if (index < 5) {
      const original = new AtlasRepository(fresh, A);
      await original.open();
      await assert.rejects(
        original.copy(B, "retry-before", "Kopie"),
        FileConflict,
      );
    }
    const result = await new AtlasRepository(fresh, B).recoverCopy();
    assert.equal(
      result,
      index < 5 ? "rolled_back" : index === 5 ? "committed" : "none",
    );
    for (const [path, bytes] of f.before)
      assert.equal(fresh.files.get(path), bytes, path);
    assert.equal(fresh.files.has(B + ".journal"), false);
    if (index < 5) {
      assert.equal(fresh.files.has(B), false);
      assert.equal(
        [...fresh.files.keys()].some((p) => p.startsWith("Atlasdaten/copy/")),
        false,
      );
      const original = new AtlasRepository(fresh, A);
      await original.open();
      await original.copy(B, "retry", "Kopie");
    }
    const reopened = await new AtlasRepository(fresh, B).open();
    assert.equal(reopened.world.chunks.length, 3);
    for (const q of [-33, 0, 33]) await reopened.ensure([{ q, r: -1 }]);
    assert.equal(reopened.cells().length, 3);
  }
});
test("Root-only empty copy can recover without a target root and no journal is a read-only no-op", async () => {
  const f = await fixture(true);
  const fresh = new Store(new Map(f.prepared.files));
  assert.equal(fresh.files.has(B), false);
  assert.equal(
    await new AtlasRepository(fresh, B).recoverCopy(),
    "rolled_back",
  );
  const snapshot = new Map(fresh.files);
  assert.equal(await new AtlasRepository(fresh, B).recoverCopy(), "none");
  assert.deepEqual(fresh.files, snapshot);
});
test("Copy recovery rejects corrupt, foreign, incomplete, changed or non-create journals before any mutation", async () => {
  const f = await fixture(),
    path = B + ".journal";
  const original = JSON.parse(f.prepared.files.get(path)!);
  const variants: ((s: Store, j: typeof original) => void)[] = [
    (s) => {
      s.files.set(path, "broken");
    },
    (_s, j) => {
      j.extra = true;
    },
    (_s, j) => {
      j.writes.at(-1).path = A;
    },
    (_s, j) => {
      j.writes.at(-1).before = j.writes.at(-1).after;
    },
    (_s, j) => {
      j.writes.pop();
    },
    (_s, j) => {
      j.writes.shift();
    },
    (_s, j) => {
      j.writes.push({
        path: "Atlasdaten/other/terrain/0_0_0.json",
        before: null,
        after: "foreign",
      });
    },
    (_s, j) => {
      j.writes[0].before = "old";
    },
    (_s, j) => {
      j.writes[0].after = "broken";
    },
    (_s, j) => {
      j.writes[0].after = JSON.stringify({
        ...JSON.parse(j.writes[0].after),
        worldId: "other",
      });
    },
    (s) => {
      s.files.set(B + ".draft", "other draft");
    },
    (s, j) => {
      s.files.set(j.writes[0].path, "external");
    },
    (_s, j) => {
      j.state = "committed";
    },
    (_s, j) => {
      j.writes.at(-1).after = serializeOverworld({
        ...parseOverworld(j.writes.at(-1).after),
        id: "other",
      });
    },
  ];
  for (const variant of variants) {
    const fresh = new Store(new Map(f.prepared.files));
    const journal = structuredClone(original);
    variant(fresh, journal);
    if (fresh.files.get(path) !== "broken")
      fresh.files.set(path, JSON.stringify(journal));
    const snapshot = new Map(fresh.files);
    await assert.rejects(new AtlasRepository(fresh, B).recoverCopy());
    assert.deepEqual(fresh.files, snapshot);
    assert.equal(fresh.boundaries.length, 0);
  }
});
test("Recovery validates its exact journal inside the serialized operation and rejects a replacement before mutation", async () => {
  const f = await fixture(),
    fresh = new Store(new Map(f.prepared.files)),
    path = B + ".journal";
  const transaction = new FileTransaction(fresh, path, () => true);
  await assert.rejects(
    transaction.recover((j) => {
      assert.ok(Object.isFrozen(j));
      assert.ok(Object.isFrozen(j.writes[0]));
      fresh.files.set(
        path,
        JSON.stringify({ ...j, transactionId: crypto.randomUUID() }),
      );
    }),
    FileConflict,
  );
  assert.equal(fresh.boundaries.length, 0);
  assert.equal(fresh.files.has(B), false);
});
