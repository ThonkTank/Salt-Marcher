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
import {
  newLocation,
  parseLocationDocument,
  serializeLocationDocument,
} from "../../src/features/location/location-schema";
import { FileConflict, type FileStore } from "../../src/persistence";

const path = "Atlanten/Welt.overworld",
  initial = serializeOverworld(newOverworld("world", "Welt", "pointy"));
const doc = (id = "town") => ({
  ...newLocation(id, id, "city", ["description", "notes"]),
  sections: [
    { id: "notes", title: "Notizen", markdown: "  **Text**\r\n\n[[Datei]]  " },
    { id: "description", title: "Beschreibung", markdown: "# Ort\n" },
  ],
});
const place = (id = "town") => ({
  kind: "location" as const,
  id: "p_" + id,
  locationId: id,
  position: { x: -5000, y: 7000 },
});
class Store implements FileStore {
  files = new Map([[path, initial]]);
  reads: string[] = [];
  failPath?: string;
  block?: { path: string; entered: () => void; resume: Promise<void> };
  async read(path: string) {
    this.reads.push(path);
    return this.files.get(path) ?? null;
  }
  async compareAndWrite(
    path: string,
    before: string | null,
    after: string | null,
  ) {
    if ((await this.read(path)) !== before) throw new FileConflict(path);
    if (this.failPath === path) {
      this.failPath = undefined;
      throw new Error("interruption");
    }
    if (this.block?.path === path) {
      const block = this.block;
      this.block = undefined;
      block.entered();
      await block.resume;
    }
    if (after === null) this.files.delete(path);
    else this.files.set(path, after);
  }
}
const repository = (store: Store, options = {}) =>
  new AtlasRepository(store, path, store, { locations: true, ...options });
async function paint(source: TerrainSource, q = -1) {
  await source.ensure([{ q, r: 0 }]);
  const stroke = new TerrainStroke(source, "forest");
  stroke.add({ q, r: 0 });
  stroke.finish();
}
async function saved(store: Store) {
  const repo = repository(store),
    source = await repo.open();
  repo.createLocation(doc(), place());
  repo.createLocation(doc("poi"), place("poi"));
  await paint(source);
  await repo.save();
  return { repo, source };
}
function journal(
  journalPath: string,
  writes: { path: string; before: string | null; after: string | null }[],
  state = "prepared",
) {
  return JSON.stringify({
    kind: "atlas-file-transaction",
    version: 1,
    transactionId: crypto.randomUUID(),
    journalPath,
    state,
    writes,
  });
}

test("Location repository shares one terrain/placement/Key history and persists exact documents through draft, Save and fresh open", async () => {
  const store = new Store(),
    repo = repository(store),
    source = await repo.open();
  repo.createLocation(doc(), place());
  repo.createLocation(doc("poi"), place("poi"));
  await paint(source);
  const edited = { ...doc(), name: "Neue Stadt" };
  repo.editLocation(edited);
  repo.moveLocation("town", { x: 15000, y: -3000 });
  assert.equal(source.history.undoDepth, 5);
  source.history.undo();
  assert.equal(source.placements()[0]!.position.x, -5000);
  source.history.undo();
  assert.equal(repo.location("town").read()!.name, "town");
  source.history.undo();
  assert.equal(source.cells().length, 0);
  source.history.redo();
  source.history.redo();
  source.history.redo();
  assert.equal(repo.location("town").history, source.history);
  await repo.persistDraft();
  const draft = parseAtlasDraft(store.files.get(repo.draftPath)!);
  assert.equal(draft.version, 2);
  if (draft.version !== 2) throw new Error();
  assert.equal(draft.locations.length, 2);
  assert.equal(draft.chunks.length, 1);
  assert.equal(store.files.get(path), initial);
  assert(!store.files.has("Orte/town.location"));
  const fresh = repository(store),
    restored = await fresh.open();
  assert.deepEqual(fresh.location("town").read(), edited);
  assert.equal(restored.placements()[0]!.position.x, 15000);
  await restored.ensure([{ q: -1, r: 0 }]);
  assert.equal(restored.cells().length, 1);
  await fresh.save();
  assert(!fresh.dirty);
  assert(!fresh.hasDraft);
  assert.equal(
    store.files.get("Orte/town.location"),
    serializeLocationDocument(edited),
  );
  const third = repository(store),
    opened = await third.open();
  assert.equal(opened.placements().length, 2);
  assert.throws(() => third.location("town"), /geladen/);
  assert.deepEqual((await third.ensureLocation("town")).read(), edited);
  assert(!third.dirty);
  await assert.rejects(new AtlasRepository(store, path).open(), /neueren/);
});

test("Unloaded Location owners remain lazy through move, draft and Save; loaded formatting does not trigger a rewrite", async () => {
  const store = new Store();
  await saved(store);
  const pretty = JSON.stringify(doc(), null, 4) + "\r\n";
  store.files.set("Orte/town.location", pretty);
  store.reads = [];
  const repo = repository(store),
    source = await repo.open();
  assert(!store.reads.some((p) => p.endsWith(".location")));
  repo.moveLocation("town", { x: 20, y: 30 });
  await repo.persistDraft();
  const draft = parseAtlasDraft(store.files.get(repo.draftPath)!);
  assert.equal(draft.version, 2);
  if (draft.version === 2) assert.equal(draft.locations.length, 0);
  await repo.save();
  assert.equal(store.files.get("Orte/town.location"), pretty);
  const a = await repo.ensureLocation("town"),
    b = await repo.ensureLocation("town");
  assert.equal(a, b);
  assert(!repo.dirty);
  await repo.save();
  assert.equal(store.files.get("Orte/town.location"), pretty);
  assert.equal(source.cells().length, 0);
});

test("Location Save rolls every changed owner back on interruption and a fresh repository saves the complete restored draft", async () => {
  for (const fail of ["Orte/town.location", path, path + ".draft"]) {
    const store = new Store(),
      repo = repository(store),
      source = await repo.open();
    repo.createLocation(doc(), place());
    repo.createLocation(doc("poi"), place("poi"));
    await paint(source);
    await repo.persistDraft();
    const before = new Map(store.files);
    store.failPath = fail;
    await assert.rejects(repo.save(), /interruption/);
    assert.deepEqual(store.files, before);
    const recovered = repository(store),
      next = await recovered.open();
    assert.equal(next.placements().length, 2);
    assert.deepEqual(recovered.location("town").read(), doc());
    await recovered.save();
    assert(!recovered.dirty);
    assert(!recovered.hasDraft);
    assert(store.files.has("Orte/poi.location"));
  }
});

test("Location conflict, missing, corrupt and wrong-ID files are never adopted or replaced", async () => {
  for (const external of [
    null,
    "broken",
    serializeLocationDocument(doc("other")),
  ]) {
    const store = new Store(),
      { repo } = await saved(store);
    repo.editLocation({ ...doc(), name: "Entwurf" });
    await repo.persistDraft();
    if (external === null) store.files.delete("Orte/town.location");
    else store.files.set("Orte/town.location", external);
    const before = new Map(store.files);
    await assert.rejects(repo.save(), FileConflict);
    assert.deepEqual(store.files, before);
    await assert.rejects(repository(store).open());
    assert.deepEqual(store.files, before);
    store.files.delete(path + ".draft");
    const fresh = repository(store);
    await fresh.open();
    const remaining = new Map(store.files);
    await assert.rejects(fresh.ensureLocation("town"));
    assert.deepEqual(store.files, remaining);
    assert(!fresh.dirty);
  }
});

test("Whole Atlas Discard resets terrain, placement and Location history while protecting every loaded canonical owner", async () => {
  const store = new Store(),
    { repo, source } = await saved(store);
  const canonical = new Map(store.files);
  repo.removeLocation("town");
  repo.moveLocation("poi", { x: 0, y: 0 });
  await paint(source, 10);
  await repo.persistDraft();
  const fresh = repository(store),
    restored = await fresh.open();
  assert.equal(fresh.location("town").read(), null);
  assert.equal(restored.placements().length, 1);
  const discarded = await fresh.discard();
  assert.deepEqual(store.files, canonical);
  assert.equal(discarded.placements().length, 2);
  assert(!discarded.history.canUndo);
  assert(!fresh.dirty);
  assert(!fresh.hasDraft);
  assert.deepEqual((await fresh.ensureLocation("town")).read(), doc());
  const again = repository(store);
  await again.open();
  await again.ensureLocation("town");
  again.editLocation({ ...doc(), name: "Entwurf" });
  await again.persistDraft();
  store.files.set("Orte/town.location", "external");
  const before = new Map(store.files);
  await assert.rejects(again.discard(), FileConflict);
  assert.deepEqual(store.files, before);
});

test("A Location edit during captured Save survives automatically as a new durable draft", async () => {
  const store = new Store(),
    { repo } = await saved(store);
  repo.editLocation({ ...doc(), name: "Captured" });
  let entered!: () => void, resume!: () => void;
  const waiting = new Promise<void>((r) => (entered = r)),
    resumed = new Promise<void>((r) => (resume = r));
  store.block = { path: "Orte/town.location", entered, resume: resumed };
  const saving = repo.save();
  await waiting;
  repo.editLocation({ ...doc(), name: "Late" });
  resume();
  await saving;
  assert.equal(
    parseLocationDocument(store.files.get("Orte/town.location")!).name,
    "Captured",
  );
  assert(repo.hasDraft);
  assert(repo.dirty);
  const fresh = repository(store);
  await fresh.open();
  assert.equal(fresh.location("town").read()!.name, "Late");
});

test("Atlas Copy clones loaded and unloaded Locations with new identities and internal links while preserving source bytes", async () => {
  const store = new Store(),
    { repo } = await saved(store);
  repo.editLocation({
    ...doc(),
    keyLinks: [
      {
        kind: "location",
        atlasId: "world",
        documentId: "poi",
        sectionId: "notes",
      },
      {
        kind: "location",
        atlasId: "external",
        documentId: "externalPlace",
        sectionId: null,
      },
      {
        kind: "room",
        atlasId: "world",
        documentId: "dungeon",
        roomId: "room",
        sectionId: null,
        anchor: null,
      },
    ],
    detailMaps: [{ kind: "dungeon", documentId: "dungeon" }],
  });
  await repo.save();
  const source = new Map(store.files),
    ids = ["newTown", "newPoi", "placementTown", "placementPoi"];
  const copier = repository(store, { makeId: () => ids.shift()! });
  await copier.open();
  await copier.ensureLocation("town");
  copier.editLocation({
    ...copier.location("town").read()!,
    name: "Copy draft",
  });
  await copier.persistDraft();
  const draft = store.files.get(copier.draftPath)!;
  await copier.copy("Atlanten/Kopie.overworld", "copy", "Kopie");
  for (const [path, raw] of source) assert.equal(store.files.get(path), raw);
  assert.equal(store.files.get(copier.draftPath), draft);
  const world = parseOverworld(
    store.files.get("Atlanten/Kopie.overworld")!,
    true,
  );
  assert.deepEqual(
    world.placements.map((p) => p.locationId),
    ["newTown", "newPoi"],
  );
  const town = parseLocationDocument(store.files.get("Orte/newTown.location")!);
  assert.equal(town.name, "Copy draft");
  assert.equal(town.keyLinks[0]!.atlasId, "copy");
  assert.equal(town.keyLinks[0]!.documentId, "newPoi");
  assert.equal(town.keyLinks[1]!.atlasId, "external");
  assert.equal(town.keyLinks[2]!.documentId, "dungeon");
  assert.equal(town.keyLinks[2]!.atlasId, "copy");
  assert.deepEqual(town.detailMaps, [
    { kind: "dungeon", documentId: "dungeon" },
  ]);
  assert.deepEqual(town.sections, doc().sections);
  assert.notEqual(world.placements[0]!.id, "p_town");
});

test("Copy collisions, missing unloaded Locations and partial destination writes preserve source and retire only their own target", async () => {
  for (const failure of ["collision", "missing", "write"]) {
    const store = new Store();
    await saved(store);
    let count = 0;
    const repo = repository(store, { makeId: () => "new" + ++count });
    await repo.open();
    if (failure === "collision")
      store.files.set("Orte/new1.location", "foreign");
    if (failure === "missing") store.files.delete("Orte/poi.location");
    if (failure === "write") store.failPath = "Atlanten/Copy.overworld";
    const before = new Map(store.files);
    await assert.rejects(repo.copy("Atlanten/Copy.overworld", "copy", "Copy"));
    assert.deepEqual(store.files, before);
  }
});

test("Prepared and committed Location journals recover a closed combined Save; forged owners are rejected before any mutation", async () => {
  for (const state of ["prepared", "committed"]) {
    const store = new Store(),
      world = serializeOverworld(
        { ...newOverworld("world", "Welt", "pointy"), placements: [place()] },
        true,
      );
    const location = serializeLocationDocument(doc());
    store.files.set(path, world);
    store.files.set("Orte/town.location", location);
    store.files.set(
      path + ".journal",
      journal(
        path + ".journal",
        [
          { path: "Orte/town.location", before: null, after: location },
          { path, before: initial, after: world },
        ],
        state,
      ),
    );
    const repo = repository(store),
      source = await repo.open();
    assert(!store.files.has(path + ".journal"));
    assert.equal(source.placements().length, state === "prepared" ? 0 : 1);
    assert.equal(store.files.has("Orte/town.location"), state === "committed");
  }
  const store = new Store(),
    { repo } = await saved(store);
  repo.editLocation({ ...doc(), name: "Changed" });
  const original = store.files.get("Orte/town.location")!;
  store.files.set(
    path + ".journal",
    journal(path + ".journal", [
      {
        path: "Orte/town.location",
        before: original,
        after: serializeLocationDocument(doc("foreign")),
      },
    ]),
  );
  const before = new Map(store.files);
  await assert.rejects(repo.persistDraft(), /kennung|Kennung/);
  assert.deepEqual(store.files, before);
  await assert.rejects(repository(store).open(), /kennung|Kennung/);
  assert.deepEqual(store.files, before);
});

test("Explicit missing-root Copy recovery requires every new Location and rejects foreign or omitted copy owners", async () => {
  const target = "Atlanten/Copy.overworld",
    world = serializeOverworld(
      {
        ...newOverworld("copy", "Copy", "pointy"),
        placements: [place("cloned")],
      },
      true,
    ),
    location = serializeLocationDocument(doc("cloned"));
  for (const state of ["prepared", "committed"]) {
    const store = new Store();
    store.files.set("Orte/cloned.location", location);
    if (state === "committed") store.files.set(target, world);
    store.files.set(
      target + ".journal",
      journal(
        target + ".journal",
        [
          { path: "Orte/cloned.location", before: null, after: location },
          { path: target, before: null, after: world },
        ],
        state,
      ),
    );
    const repo = new AtlasRepository(store, target, store, { locations: true });
    assert.equal(
      await repo.recoverCopy(),
      state === "prepared" ? "rolled_back" : "committed",
    );
    assert.equal(
      store.files.has("Orte/cloned.location"),
      state === "committed",
    );
    assert.equal(store.files.get(path), initial);
  }
  for (const writes of [
    [{ path: target, before: null, after: world }],
    [
      { path: target, before: null, after: world },
      { path: "Orte/foreign.location", before: null, after: location },
    ],
    [
      { path: target, before: null, after: world },
      {
        path: "Orte/cloned.location",
        before: null,
        after: serializeLocationDocument(doc("foreign")),
      },
    ],
  ]) {
    const store = new Store();
    store.files.set(target + ".journal", journal(target + ".journal", writes));
    const before = new Map(store.files);
    await assert.rejects(
      new AtlasRepository(store, target, store, {
        locations: true,
      }).recoverCopy(),
    );
    assert.deepEqual(store.files, before);
  }
});

test("Resolved Location paths remain owned by document ID and draft paths cannot redirect writes", async () => {
  const store = new Store();
  await saved(store);
  store.files.set(
    "Umbenannt/Stadt.location",
    store.files.get("Orte/town.location")!,
  );
  store.files.delete("Orte/town.location");
  const options = {
    resolveLocation: async (id: string) =>
      id === "town" ? "Umbenannt/Stadt.location" : `Orte/${id}.location`,
  };
  const repo = repository(store, options);
  await repo.open();
  await repo.ensureLocation("town");
  repo.editLocation({ ...doc(), name: "Changed" });
  await repo.persistDraft();
  const draft = JSON.parse(store.files.get(repo.draftPath)!);
  draft.locations[0].path = "Foreign.location";
  store.files.set(repo.draftPath, JSON.stringify(draft));
  const before = new Map(store.files);
  await assert.rejects(repository(store, options).open(), /fremde/);
  assert.deepEqual(store.files, before);
});
