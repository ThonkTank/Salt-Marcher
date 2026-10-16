import test from "node:test";
import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import { AtlasRepository } from "../../src/features/atlas/atlas-repository";
import {
  parseAtlasDraft,
  serializeAtlasDraft,
} from "../../src/features/atlas/atlas-draft";
import {
  parseSpatialWorld,
  serializeSpatialWorld,
  spatialChange,
  type DetailPlacement,
} from "../../src/features/atlas/spatial-schema";
import {
  CitySource,
  cityDocumentChange,
} from "../../src/features/city/commands";
import {
  DungeonAtlasSource,
  dungeonDocumentChange,
} from "../../src/features/dungeon/atlas-source";
import {
  paintWalkableColumn,
  projectVolumeSlice,
  setHorizontalFace,
  setVolumeHeight,
} from "../../src/features/dungeon/volume";
import { locationDocumentChange } from "../../src/features/location/location-source";
import { parseCityDocument } from "../../src/features/city/codec";
import { parseDocument, serializeDocument } from "../../src/model";
import { FileConflict, type FileStore } from "../../src/persistence";
import type { AtlasSpatialOptions } from "../../src/features/atlas/detail-owners";
import { TerrainStroke } from "../../src/features/atlas/terrain-source";

const id = (n: number) =>
  `00000000-0000-4000-8000-${String(n).padStart(12, "0")}`;
const path = "Atlanten/Gemeinsamer-Testatlas.overworld",
  cityPath = `Städte/${id(100)}.city`,
  dungeonPath = "Dungeons/E2E-01-Testdungeon/Karte.dungeon";
const fixture = (p: string) =>
  readFileSync("tests/fixtures/atlas-e2e-v1/input/" + p, "utf8");
const bindings: readonly DetailPlacement[] = [
  {
    kind: "city",
    id: id(201),
    documentId: id(100),
    parent: { kind: "location", locationId: id(11) },
    offsetMeters: { x: 0, y: 0 },
    rotationRadians: 0,
  },
  {
    kind: "dungeon",
    id: id(202),
    documentId: id(30),
    parent: { kind: "city-building", cityId: id(100), buildingId: id(105) },
    anchor: {
      parentPointMeters: { x: 0, y: 0 },
      mapPointFields: { x: 4, y: 4 },
    },
    rotationRadians: 0,
    surfaceFloorId: id(32),
    entrances: [
      {
        routeId: id(33),
        floorId: id(32),
        roomId: id(31),
        pointFields: { x: 4, y: 4 },
      },
    ],
  },
];
const world = parseSpatialWorld(fixture(path)),
  linkedWorld = { ...world, version: 2 as const, detailPlacements: bindings };

test("existing Dungeon-at-Location binding is atomic, idempotent and rejects foreign or missing identities", async () => {
  const f = await opened();
  await f.repo.ensureLocation(id(12));
  const before = f.source.spatialState(), location = f.repo.location(id(12)).read(), depth = f.source.history.undoDepth,
    dungeon = f.dungeon.read().documentBytes;
  for (const placement of [id(201), id(9001)])
    assert.throws(() => f.repo.bindDungeonAtLocation(id(12), placement), /Dungeonplatzierung/);
  assert.throws(() => f.repo.bindDungeonAtLocation(id(999), id(202)), /geladen/);
  assert.equal(f.source.history.undoDepth, depth);
  assert.equal(f.repo.bindDungeonAtLocation(id(12), id(202)), true);
  assert.equal(f.source.history.undoDepth, depth + 1);
  assert.equal(f.repo.bindDungeonAtLocation(id(12), id(202)), false);
  assert.equal(f.source.history.undoDepth, depth + 1);
  const after = f.source.spatialState();
  assert.equal(f.source.history.undo(), true);
  assert.deepEqual(f.source.spatialState(), before); assert.deepEqual(f.repo.location(id(12)).read(), location);
  assert.equal(f.source.history.redo(), true); assert.deepEqual(f.source.spatialState(), after);
  assert.equal(f.dungeon.read().documentBytes, dungeon);
});

test("Dungeon-at-Location Copy remaps the entire binding and Discard restores the untouched source", async () => {
  const f = await opened();
  await f.repo.ensureLocation(id(12));
  const canonical = new Map(f.store.files);
  f.repo.bindDungeonAtLocation(id(12), id(202));
  f.repo.bindDungeonAtLocation(id(11), id(202));
  const dest = 'Atlanten/Ortsdungeon-Kopie.overworld';
  await f.repo.copy(dest, id(910), 'Ortsdungeon-Kopie');
  const copy = new AtlasRepository(f.store, dest, f.store, options(f.store));
  await copy.open();
  const d = copy.terrainSource.spatialState().detailPlacements.find((p) => p.kind === 'dungeon')!;
  assert.ok(d.kind === 'dungeon' && d.parent.kind === 'location');
  assert.notEqual(d.id, id(202)); assert.notEqual(d.documentId, id(30));
  assert.notEqual(d.parent.locationId, id(11));
  assert.ok(copy.location(d.parent.locationId).read()!.detailMaps.some((r) => r.kind === 'dungeon' && r.documentId === d.documentId));
  for (const p of copy.terrainSource.placements()) await copy.ensureLocation(p.locationId);
  const copiedOldLocation = copy.terrainSource.placements()
    .map((p) => copy.location(p.locationId).read()!)
    .find((l) => l.name === f.repo.location(id(12)).read()!.name)!;
  assert.deepEqual(copiedOldLocation.detailMaps, []);
  const copiedDungeon = copy.detail('dungeon', d.documentId);
  assert.ok(copiedDungeon instanceof DungeonAtlasSource);
  assert.ok(copiedDungeon.read().document.entities.some((r) => r.id === d.entrances[0]!.roomId));
  assert.ok(copiedDungeon.read().document.content.routes.some((r) => r.id === d.entrances[0]!.routeId));
  for (const [p, bytes] of canonical) assert.equal(f.store.files.get(p), bytes, p);
  await f.repo.discard();
  assert.deepEqual(f.repo.terrainSource.spatialState().detailPlacements, bindings);
  await f.repo.ensureLocation(id(12));
  assert.deepEqual(f.repo.location(id(12)).read()!.detailMaps, []);
  assert.equal(f.repo.dirty, false); assert.equal(f.repo.hasDraft, false);
  for (const [p, bytes] of canonical) assert.equal(f.store.files.get(p), bytes, p);
  assert.ok(f.store.files.has(dest));
});

test("Dungeon moving between Locations removes only its old detail link in one undoable command", async () => {
  const f = await opened();
  await f.repo.ensureLocation(id(12));
  const cityLocation = f.repo.location(id(11)).read()!;
  f.repo.editLocation({ ...cityLocation, detailMaps: [{ kind: 'city', documentId: id(100) }] });
  f.repo.bindDungeonAtLocation(id(11), id(202));
  const old = f.repo.location(id(11)).read()!, next = f.repo.location(id(12)).read()!,
    worldBefore = f.source.spatialState(), dungeonBefore = f.dungeon.read().documentBytes,
    depth = f.source.history.undoDepth;
  assert.equal(f.repo.bindDungeonAtLocation(id(12), id(202)), true);
  const expectedOld = { ...old, detailMaps: old.detailMaps.filter((r) => r.kind !== 'dungeon' || r.documentId !== id(30)) },
    expectedNext = { ...next, detailMaps: [...next.detailMaps, { kind: 'dungeon', documentId: id(30) }] },
    worldAfter = f.source.spatialState();
  assert.deepEqual(f.repo.location(id(11)).read(), expectedOld);
  assert.deepEqual(f.repo.location(id(12)).read(), expectedNext);
  assert.deepEqual(worldAfter.detailPlacements.find((p) => p.id === id(202))!.parent,
    { kind: 'location', locationId: id(12) });
  assert.equal(f.source.history.undoDepth, depth + 1);
  assert.equal(f.source.history.undo(), true);
  assert.deepEqual(f.source.spatialState(), worldBefore);
  assert.deepEqual(f.repo.location(id(11)).read(), old);
  assert.deepEqual(f.repo.location(id(12)).read(), next);
  assert.equal(f.source.history.redo(), true);
  assert.deepEqual(f.source.spatialState(), worldAfter);
  assert.deepEqual(f.repo.location(id(11)).read(), expectedOld);
  assert.deepEqual(f.repo.location(id(12)).read(), expectedNext);
  assert.equal(f.dungeon.read().documentBytes, dungeonBefore);
});
class Store implements FileStore {
  files = new Map<string, string>();
  fail?: (path: string, after: string | null) => boolean;
  crash = false;
  offline = false;
  block?: { path: string; entered: () => void; resume: Promise<void> };
  constructor() {
    for (const p of [
      path,
      cityPath,
      dungeonPath,
      ...[11, 12].map((n) => `Orte/${id(n)}.location`),
      ...world.chunks.map((r) => `Atlasdaten/${world.id}/${r.file}`),
    ])
      this.files.set(p, fixture(p));
    this.files.set(path, serializeSpatialWorld(linkedWorld));
  }
  async read(p: string) {
    return this.files.get(p) ?? null;
  }
  async compareAndWrite(
    p: string,
    before: string | null,
    after: string | null,
  ) {
    if ((await this.read(p)) !== before) throw new FileConflict(p);
    if (this.offline) throw new Error("process stopped");
    if (this.fail?.(p, after)) {
      this.fail = undefined;
      this.offline = this.crash;
      throw new Error("interruption");
    }
    if (this.block?.path === p) {
      const b = this.block;
      this.block = undefined;
      b.entered();
      await b.resume;
    }
    if (after === null) this.files.delete(p);
    else this.files.set(p, after);
  }
}
function options(store: Store): AtlasSpatialOptions {
  let counter = 1000;
  return {
    locations: true,
    details: true,
    makeId: () => id(counter++),
    resolveDetail: async (_world, kind, doc) =>
      [...store.files]
        .filter(
          ([p, raw]) =>
            p.endsWith("." + kind) &&
            (JSON.parse(raw) as { id: string }).id === doc,
        )
        .map(([p]) => p),
  };
}
async function opened(
  store = new Store(),
  overrides: Partial<AtlasSpatialOptions> = {},
) {
  const repo = new AtlasRepository(store, path, store, {
      ...options(store),
      ...overrides,
    }),
    source = await repo.open();
  const city = repo.detail("city", id(100)),
    dungeon = repo.detail("dungeon", id(30));
  assert.ok(city instanceof CitySource);
  assert.ok(dungeon instanceof DungeonAtlasSource);
  return { store, repo, source, city, dungeon };
}
function keyChange(dungeon: DungeonAtlasSource, text: string) {
  const before = dungeon.read().document,
    after = JSON.parse(serializeDocument(before));
  after.entities[0].key.sections[0].markdown = text;
  return dungeonDocumentChange(before, parseDocument(JSON.stringify(after)));
}
function command(
  f: Awaited<ReturnType<typeof opened>>,
  text = "Änderung\r\n  **Tür**  \r\n",
) {
  const city = f.city.read(),
    loc = f.repo.location(id(11)).read()!;
  return {
    label: "Gemeinsame räumliche Bearbeitung",
    changes: [
      cityDocumentChange(city, {
        ...city,
        buildings: city.buildings.map((b) =>
          b.id === id(105) ? { ...b, position: { x: -18, y: 8 } } : b,
        ),
      }),
      keyChange(f.dungeon, text),
      locationDocumentChange(loc.id, loc, { ...loc, name: "Neue Stadt" }),
      spatialChange(world.id, f.source.spatialState(), {
        version: 2,
        detailPlacements: bindings.map((p) =>
          p.kind === "city" ? { ...p, offsetMeters: { x: 10, y: 0 } } : p,
        ),
      }),
    ],
  };
}
const journal = (p: string, writes: unknown[], state = "prepared") =>
  JSON.stringify({
    kind: "atlas-file-transaction",
    version: 1,
    journalPath: p,
    transactionId: id(8000),
    state,
    writes,
  });

test("Existing WorldV1 upgrades through the same owner command and DraftV3 without rewriting the original until Save", async () => {
  const store = new Store();
  store.files.set(path, fixture(path));
  const repo = new AtlasRepository(store, path, store, options(store)),
    source = await repo.open();
  await repo.ensureLocation(id(11));
  await repo.ensureDetail("city", id(100));
  await repo.ensureDetail("dungeon", id(30));
  source.history.execute({
    label: "Detailkarten verorten",
    changes: [
      spatialChange(world.id, source.spatialState(), {
        version: 2,
        detailPlacements: bindings,
      }),
    ],
  });
  source.history.undo();
  assert.equal(serializeSpatialWorld(repo.spatialGraph.world()), fixture(path));
  source.history.redo();
  await repo.persistDraft();
  assert.equal(await store.read(path), fixture(path));
  const fresh = await opened(store);
  assert.equal(fresh.repo.spatialGraph.world().version, 2);
  await fresh.repo.save();
  assert.equal(parseSpatialWorld((await store.read(path))!).version, 2);
});

test("Spatial repository is opt-in and registers actual typed native owners once in the existing World history", async () => {
  const store = new Store();
  await assert.rejects(
    new AtlasRepository(store, path, store, { locations: true }).open(),
  );
  const f = await opened(store);
  assert.equal(await f.repo.ensureDetail("city", id(100)), f.city);
  assert.equal(await f.repo.ensureDetail("dungeon", id(30)), f.dungeon);
  assert.equal(f.city.history, f.source.history);
  assert.equal(f.dungeon.history, f.source.history);
  assert.equal(f.repo.location(id(11)).history, f.source.history);
  assert.equal(f.repo.spatialGraph.world().version, 2);
  assert.equal(f.repo.dirty, false);
  assert.equal(f.repo.spatialGraph.frame(id(30)).metersPerUnit, 1.524);
  assert.equal(await store.read(cityPath), fixture(cityPath));
});

test("World, terrain, Location, house and room Key persist together through shared undo/redo, DraftV3, fresh open, Save and Discard", async () => {
  const f = await opened();
  await f.source.ensure([{ q: 0, r: 0 }]);
  const stroke = new TerrainStroke(f.source, "forest");
  stroke.add({ q: 0, r: 0 });
  stroke.finish();
  f.source.history.execute(command(f));
  assert.equal(f.source.history.undoDepth, 2);
  f.source.history.undo();
  assert.equal(f.city.read().buildings[0]!.position.x, -6);
  f.source.history.redo();
  await f.repo.persistDraft();
  const d = parseAtlasDraft((await f.store.read(path + ".draft"))!);
  assert.equal(d.version, 3);
  assert.ok(d.version === 3);
  assert.equal(d.details.length, 2);
  assert.equal(d.locations.length, 1);
  assert.equal(d.chunks.length, 1);
  const fresh = await opened(f.store);
  assert.equal(fresh.source.history.undoDepth, 0);
  assert.equal(fresh.dungeon.read().keyClosure[0]!.kind, "markdown");
  assert.equal(fresh.city.read().buildings[0]!.position.x, -18);
  assert.equal(fresh.repo.location(id(11)).read()!.name, "Neue Stadt");
  await fresh.repo.save();
  assert.equal(fresh.repo.dirty, false);
  assert.equal(await f.store.read(path + ".draft"), null);
  const saved = await opened(f.store);
  saved.source.history.execute({
    label: "Key",
    changes: [keyChange(saved.dungeon, "verwerfen")],
  });
  await saved.repo.persistDraft();
  const old = saved.dungeon,
    reset = await saved.repo.discard();
  assert.notEqual(reset, saved.source);
  assert.notEqual(saved.repo.detail("dungeon", id(30)), old);
  assert.equal(reset.history.undoDepth, 0);
  assert.equal(saved.repo.dirty, false);
  assert.equal(await f.store.read(path + ".draft"), null);
});

test("Dungeon Volume survives shared Atlas history, Draft, Save, Copy and Discard", async () => {
  const f = await opened(),
    before = f.dungeon.read().document,
    lower = setVolumeHeight(paintWalkableColumn(before, id(600), {
      x: -2, y: 4, bottomStep: -1,
    }), id(600), 3),
    stacked = paintWalkableColumn(lower, id(601), {
      x: -2, y: 4, bottomStep: 2, heightSteps: 1,
    }),
    after = setHorizontalFace(stacked, {
      volumeId: id(600), x: -2, y: 4, z: 1,
      face: "ceiling", present: false,
    }),
    change = dungeonDocumentChange(before, after);
  assert.equal(f.source.history.execute({
    label: "Dungeon-Volume bearbeiten",
    changes: [change],
  }), true);
  assert.equal(f.source.history.undoDepth, 1);
  assert.deepEqual(f.dungeon.read().document.volumes, after.volumes);
  assert.deepEqual(projectVolumeSlice(f.dungeon.read().document, 0).map((item) => [
    item.volumeId, item.cell.z, item.relation,
  ]), [
    [id(600), -1, "below"],
    [id(600), 0, "active"],
    [id(600), 1, "active"],
    [id(600), 2, "above"],
  ]);
  assert.equal(f.source.history.undo(), true);
  assert.equal(f.dungeon.read().document.volumes, undefined);
  assert.equal(f.source.history.redo(), true);
  assert.deepEqual(f.dungeon.read().document.volumes, after.volumes);

  await f.repo.persistDraft();
  const draftReopen = await opened(f.store);
  assert.deepEqual(draftReopen.dungeon.read().document.volumes, after.volumes);
  await draftReopen.repo.save();
  const saved = await opened(f.store);
  assert.deepEqual(saved.dungeon.read().document.volumes, after.volumes);

  const destination = "Atlanten/Volume-Kopie.overworld";
  await saved.repo.copy(destination, id(900), "Volume-Kopie");
  const copy = new AtlasRepository(
    f.store, destination, f.store, options(f.store),
  );
  await copy.open();
  const copiedWorld = copy.spatialGraph.world();
  assert.ok(copiedWorld.version === 2);
  const placement = copiedWorld.detailPlacements.find(
    (candidate) => candidate.kind === "dungeon",
  );
  assert.ok(placement?.kind === "dungeon");
  const copied = copy.detail("dungeon", placement.documentId);
  assert.ok(copied instanceof DungeonAtlasSource);
  assert.deepEqual(copied.read().document.volumes?.map((volume) =>
    volume.cells.map(({ x, y, z, floor, ceiling, walls }) =>
      ({ x, y, z, floor, ceiling, walls }))),
  after.volumes?.map((volume) => volume.cells.map(
    ({ x, y, z, floor, ceiling, walls }) =>
      ({ x, y, z, floor, ceiling, walls }),
  )));
  assert.notEqual(copied.read().document.volumes?.[0]?.id, id(600));

  const savedBytes = saved.dungeon.read().documentBytes,
    edited = setVolumeHeight(saved.dungeon.read().document, id(600), 1);
  saved.source.history.execute({
    label: "Verwerfbare Volume-Höhe",
    changes: [dungeonDocumentChange(saved.dungeon.read().document, edited)],
  });
  await saved.repo.persistDraft();
  const reset = await saved.repo.discard(),
    restored = saved.repo.detail("dungeon", id(30));
  assert.equal(reset.history.undoDepth, 0);
  assert.ok(restored instanceof DungeonAtlasSource);
  assert.equal(restored.read().documentBytes, savedBytes);
  assert.deepEqual(restored.read().document.volumes, after.volumes);
});

test("Spatial Save captures one combined state and retains a newer room Key as a new recoverable draft", async () => {
  const f = await opened();
  f.source.history.execute(command(f, "captured"));
  let entered!: () => void, resume!: () => void;
  const entry = new Promise<void>((r) => (entered = r)),
    pause = new Promise<void>((r) => (resume = r));
  f.store.block = { path, entered, resume: pause };
  const save = f.repo.save();
  await entry;
  f.source.history.execute({
    label: "newer",
    changes: [keyChange(f.dungeon, "newer")],
  });
  resume();
  await save;
  assert.equal(
    parseDocument((await f.store.read(dungeonPath))!).entities[0]!.id,
    id(31),
  );
  const draft = parseAtlasDraft((await f.store.read(path + ".draft"))!);
  assert.ok(draft.version === 3);
  assert.equal(draft.details.length, 1);
  assert.equal(
    (await opened(f.store)).dungeon.read().keyClosure[0]!.kind,
    "markdown",
  );
  assert.match((await opened(f.store)).dungeon.read().documentBytes, /newer/);
});

test("Spatial Copy remaps actual scoped house, floor, room, entrance, section and local navigation IDs while keeping text and source bytes", async () => {
  const f = await opened();
  await f.repo.ensureLocation(id(12));
  const loc = f.repo.location(id(11)).read()!;
  f.repo.editLocation({
    ...loc,
    detailMaps: [
      { kind: "city", documentId: id(100) },
      { kind: "dungeon", documentId: id(30) },
    ],
    keyLinks: [
      {
        kind: "room",
        atlasId: world.id,
        documentId: id(30),
        roomId: id(31),
        sectionId: id(34),
        anchor: null,
      },
      {
        kind: "location",
        atlasId: world.id,
        documentId: id(12),
        sectionId: id(17),
      },
      {
        kind: "room",
        atlasId: id(700),
        documentId: id(30),
        roomId: id(31),
        sectionId: id(34),
        anchor: null,
      },
    ],
  });
  f.source.history.execute(command(f, "Text\r\n[[" + id(31) + "]]  "));
  const canonical = new Map(f.store.files);
  const dest = "Atlanten/Kopie.overworld";
  await f.repo.copy(dest, id(900), "Kopie");
  const copy = new AtlasRepository(f.store, dest, f.store, options(f.store));
  await copy.open();
  const w = copy.spatialGraph.world();
  assert.ok(w.version === 2);
  const c = w.detailPlacements.find((p) => p.kind === "city")!,
    d = w.detailPlacements.find((p) => p.kind === "dungeon")!;
  assert.ok(d.kind === "dungeon" && d.parent.kind === "city-building");
  const cd = copy.detail("city", c.documentId),
    dd = copy.detail("dungeon", d.documentId);
  assert.ok(cd instanceof CitySource && dd instanceof DungeonAtlasSource);
  assert.notEqual(c.documentId, id(100));
  assert.notEqual(d.documentId, id(30));
  assert.equal(d.parent.buildingId, cd.read().buildings[0]!.id);
  assert.equal(d.surfaceFloorId, dd.read().document.floors[0]!.id);
  assert.equal(d.entrances[0]!.roomId, dd.read().document.entities[0]!.id);
  assert.notEqual(d.entrances[0]!.routeId, id(33));
  assert.match(dd.read().documentBytes, new RegExp(id(31))); // Markdown content is not an identity reference.
  const copiedLoc = copy.location(w.placements[0]!.locationId).read()!;
  assert.equal(copiedLoc.keyLinks[0]!.documentId, d.documentId);
  assert.equal(copiedLoc.keyLinks[2]!.atlasId, id(700));
  assert.equal(copiedLoc.keyLinks[2]!.documentId, id(30));
  for (const [p, raw] of canonical) assert.equal(await f.store.read(p), raw, p);
  assert.ok(await f.store.read(path + ".draft"));
});

for (const state of ["prepared", "committed"] as const)
  test(`Spatial Save journal ${state} recovers one exact native closure after interruption`, async () => {
    const f = await opened(),
      before = new Map(f.store.files);
    f.source.history.execute(command(f));
    await f.repo.persistDraft();
    f.store.crash = true;
    f.store.fail = (p, raw) =>
      state === "prepared"
        ? p === dungeonPath
        : p === path + ".journal" && raw === null;
    await assert.rejects(f.repo.save(), /interruption|unterbrochen/);
    assert.ok(await f.store.read(path + ".journal"));
    f.store.offline = false;
    const fresh = await opened(f.store);
    assert.equal(await f.store.read(path + ".journal"), null);
    assert.equal(fresh.city.read().buildings[0]!.position.x, -18);
    if (state === "prepared") {
      for (const [p, raw] of before)
        assert.equal(await f.store.read(p), raw, p);
      assert.ok(await f.store.read(path + ".draft"));
    } else {
      assert.equal(fresh.repo.dirty, false);
      assert.equal(await f.store.read(path + ".draft"), null);
    }
  });
for (const state of ["prepared", "committed"] as const)
  test(`Spatial Copy journal ${state} recovers native children with a missing or present new root`, async () => {
    const f = await opened();
    f.source.history.execute(command(f));
    const dest = "Atlanten/Kopie.overworld";
    await f.repo.persistDraft();
    f.store.crash = true;
    f.store.fail = (p, raw) =>
      state === "prepared"
        ? p === dest
        : p === dest + ".journal" && raw === null;
    await assert.rejects(
      f.repo.copy(dest, id(900), "Kopie"),
      /interruption|unterbrochen/,
    );
    f.store.offline = false;
    const repo = new AtlasRepository(f.store, dest, f.store, options(f.store));
    assert.equal(
      await repo.recoverCopy(),
      state === "prepared" ? "rolled_back" : "committed",
    );
    assert.equal(await f.store.read(dest + ".journal"), null);
    if (state === "prepared") assert.equal(await f.store.read(dest), null);
    else {
      await repo.open();
      assert.equal(repo.spatialGraph.world().version, 2);
    }
    assert.equal(await f.store.read(cityPath), fixture(cityPath));
    assert.equal(await f.store.read(dungeonPath), fixture(dungeonPath));
  });

test("External native edits block Save, Copy and Discard without overwriting canonical files or losing the complete local DraftV3", async () => {
  const f = await opened();
  f.source.history.execute(command(f));
  const foreign = keyChange(f.dungeon, "Extern").after as string;
  f.store.files.set(dungeonPath, foreign);
  await assert.rejects(f.repo.save(), FileConflict);
  const draft = await f.store.read(path + ".draft");
  assert.ok(draft);
  assert.ok(parseAtlasDraft(draft).version === 3);
  await assert.rejects(
    f.repo.copy("Atlanten/Kopie.overworld", id(900), "Kopie"),
    FileConflict,
  );
  await assert.rejects(f.repo.discard(), FileConflict);
  assert.equal(await f.store.read(dungeonPath), foreign);
  assert.equal(await f.store.read(cityPath), fixture(cityPath));
  assert.equal(await f.store.read(path + ".draft"), draft);
});

test("Native identity resolution rejects missing, wrong type, duplicate and renamed owners before canonical writes", async () => {
  for (const matches of [[], [cityPath, dungeonPath], [cityPath]])
    await assert.rejects(
      opened(new Store(), { resolveDetail: async () => matches }),
    );
  const f = await opened();
  f.source.history.execute(command(f));
  f.store.files.set(
    "Dungeons/umbenannt.dungeon",
    f.store.files.get(dungeonPath)!,
  );
  f.store.files.delete(dungeonPath);
  await assert.rejects(f.repo.save(), FileConflict);
  assert.ok(await f.store.read(path + ".draft"));
  assert.equal(await f.store.read(cityPath), fixture(cityPath));
  const fresh = await opened(new Store(), {
    resolveDetail: async (_w, kind) =>
      kind === "city" ? [cityPath] : [dungeonPath],
  });
  fresh.store.files.set(
    cityPath,
    JSON.stringify({ ...JSON.parse(fixture(cityPath)), id: id(301) }),
  );
  await assert.rejects(fresh.repo.save(), FileConflict);
});

test("DraftV3 rejects foreign IDs, path/type mismatch, header changes and unknown fields before loading or writing native documents", async () => {
  const f = await opened();
  f.source.history.execute(command(f));
  await f.repo.persistDraft();
  const raw = parseAtlasDraft((await f.store.read(path + ".draft"))!);
  assert.ok(raw.version === 3);
  for (const change of [
    (v: any) => (v.extra = true),
    (v: any) => (v.details[0].id = id(999)),
    (v: any) =>
      (v.details[0].kind = v.details[0].kind === "city" ? "dungeon" : "city"),
    (v: any) => (v.details[1].path = v.details[0].path),
    (v: any) =>
      (v.currentWorld = JSON.stringify({
        ...JSON.parse(v.currentWorld),
        name: "fremd",
      })),
  ]) {
    const v = JSON.parse(serializeAtlasDraft(raw));
    change(v);
    assert.throws(() => parseAtlasDraft(JSON.stringify(v)));
  }
  const snapshot = new Map(f.store.files),
    foreign = JSON.parse(serializeAtlasDraft(raw));
  foreign.details[0].path = "Städte/fremd.city";
  f.store.files.set(path + ".draft", JSON.stringify(foreign));
  await assert.rejects(opened(f.store));
  for (const [p, bytes] of snapshot)
    if (p !== path + ".draft") assert.equal(await f.store.read(p), bytes);
});

test("Spatial recovery rejects foreign owner paths and broken house closure without repairing any file", async () => {
  for (const forged of [true, false]) {
    const store = new Store(),
      city = parseCityDocument(fixture(cityPath)),
      after = JSON.stringify({
        ...city,
        buildings: city.buildings.filter((b) => b.id !== id(105)),
      });
    const target = forged ? "Städte/fremd.city" : cityPath;
    store.files.set(target, fixture(cityPath));
    store.files.set(
      path + ".journal",
      journal(path + ".journal", [
        { path: target, before: fixture(cityPath), after },
      ]),
    );
    const before = new Map(store.files);
    await assert.rejects(opened(store));
    assert.deepEqual(store.files, before);
  }
});

test("Detached native edits retain their owner and DraftV3 and persist through reopening without inventing a placement", async () => {
  const f = await opened();
  const before = f.source.spatialState();
  f.source.history.execute({
    label: "Dungeon entkoppeln und Key",
    changes: [
      spatialChange(world.id, before, {
        version: 2,
        detailPlacements: bindings.filter((p) => p.kind === "city"),
      }),
      keyChange(f.dungeon, "detached"),
    ],
  });
  await f.repo.persistDraft();
  const fresh = await opened(f.store);
  assert.match(fresh.dungeon.read().documentBytes, /detached/);
  assert.equal(fresh.repo.spatialGraph.world().version, 2);
  await fresh.repo.save();
  assert.match((await f.store.read(dungeonPath))!, /detached/);
  assert.equal(fresh.repo.dirty, false);
  const reloaded = new AtlasRepository(
    f.store,
    path,
    f.store,
    options(f.store),
  );
  await reloaded.open();
  assert.ok(
    (await reloaded.ensureDetail("dungeon", id(30))) instanceof
      DungeonAtlasSource,
  );
});

test("Discard retires asynchronous loads from the old World generation", async () => {
  const f = await opened(),
    old = f.source;
  const discard = f.repo.discard();
  const late = old.ensure([{ q: 0, r: 0 }]);
  await discard;
  await assert.rejects(late, /Veralteter/);
  assert.equal(f.repo.dirty, false);
});

test("Spatial Copy captures the requested room Key and remaps occurrences while preserving shared definition identity and literal text", async () => {
  const f = await opened(),
    before = f.dungeon.read().document;
  const doc = JSON.parse(serializeDocument(before));
  doc.content.definitions.push({
    id: id(500),
    name: "Shared",
    kind: "feature",
    xp: 0,
    lootValue: 0,
    description: id(31),
  });
  doc.content.occurrences.push({
    id: id(501),
    definitionId: id(500),
    roomId: id(31),
    sectionId: id(34),
    marker: "X",
    quantity: 1,
  });
  doc.content.routes[0].prerequisites.push(id(501));
  doc.entities[0].key.sections[0].markdown = "captured";
  f.source.history.execute({
    label: "Referenzen",
    changes: [
      dungeonDocumentChange(before, parseDocument(JSON.stringify(doc))),
    ],
  });
  const dest = "Atlanten/Snapshot.overworld",
    copy = f.repo.copy(dest, id(900), "Snapshot");
  f.source.history.execute({
    label: "newer",
    changes: [keyChange(f.dungeon, "newer")],
  });
  await copy;
  const target = new AtlasRepository(f.store, dest, f.store, options(f.store));
  await target.open();
  const w = target.spatialGraph.world();
  assert.ok(w.version === 2);
  const binding = w.detailPlacements.find((p) => p.kind === "dungeon")!;
  const owner = target.detail("dungeon", binding.documentId);
  assert.ok(owner instanceof DungeonAtlasSource);
  const result = owner.read().document;
  assert.equal(result.content.definitions[0]!.id, id(500));
  assert.equal(result.content.definitions[0]!.description, id(31));
  assert.equal(result.content.occurrences[0]!.definitionId, id(500));
  assert.notEqual(result.content.occurrences[0]!.id, id(501));
  assert.equal(
    result.content.routes[0]!.prerequisites[0],
    result.content.occurrences[0]!.id,
  );
  assert.equal(result.content.occurrences[0]!.roomId, result.entities[0]!.id);
  assert.match(owner.read().documentBytes, /captured/);
  assert.doesNotMatch(owner.read().documentBytes, /newer/);
  assert.match((await opened(f.store)).dungeon.read().documentBytes, /newer/);
  assert.equal(await f.store.read(dungeonPath), fixture(dungeonPath));
});
