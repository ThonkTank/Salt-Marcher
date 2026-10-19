import { test } from "node:test";
import assert from "node:assert/strict";
import { buildSync } from "esbuild";
import { createRequire } from "node:module";
import { mkdtempSync, rmSync } from "node:fs";
import { randomUUID } from "node:crypto";
const require = createRequire(import.meta.url);
for (const [name, file] of [
  ["model", "src/app/atlas-territory.ts"],
  ["store", "src/app/storage/store.ts"],
  ["reader", "src/app/storage/atlas-region.ts"],
  ["view", "src/app/atlas-territory-view.ts"],
  ["paint", "src/app/atlas-paint.ts"],
  ["ui", "src/app/atlas-territory-ui.ts"],
])
  buildSync({
    entryPoints: [file],
    outfile: ".build/territory-" + name + ".cjs",
    bundle: true,
    platform: "node",
    format: "cjs",
    external: ["better-sqlite3"],
  });
const M = require("../.build/territory-model.cjs"),
  { CampaignStore } = require("../.build/territory-store.cjs"),
  { AtlasRegionReader } = require("../.build/territory-reader.cjs"),
  { drawTerritories } = require("../.build/territory-view.cjs"),
  { atlasPaint } = require("../.build/territory-paint.cjs"),
  { TerritoryWorkbench } = require("../.build/territory-ui.cjs"),
  Database = require("better-sqlite3");
const rect = (x, y, w, h) => ({
  outer: [
    { x, y },
    { x: x + w, y },
    { x: x + w, y: y + h },
    { x, y: y + h },
  ],
  holes: [],
});
function territory(
  id,
  x = 0,
  y = 0,
  w = 100,
  h = 100,
  parentId = null,
  layer = "political",
) {
  const r = M.newTerritory(id, layer);
  r.name = id;
  r.polygons = [rect(x, y, w, h)];
  r.territory.parentId = parentId;
  r.territory.prominence = 100;
  return r;
}
const inside = (r, x, y) => M.territoryContains(r, { x, y });
test("overpainting transfers sibling land and recursively clips descendants, not geography or geometry", () => {
  const a = territory("A"),
    b = territory("B", 100, 0, 100, 100),
    child = territory("Child", 120, 10, 20, 20, "B"),
    deep = territory("Deep", 125, 15, 5, 5, "Child"),
    geo = territory("Mountains", 0, 0, 200, 200, null, "geographic");
  const result = M.applyTerritory([a, b, child, deep, geo], {
    ...a,
    polygons: [rect(0, 0, 150, 100)],
  });
  assert(
    inside(
      result.find((r) => r.id === "A"),
      130,
      20,
    ),
  );
  assert(
    !inside(
      result.find((r) => r.id === "B"),
      130,
      20,
    ),
  );
  assert.deepEqual(result.find((r) => r.id === "Child").polygons, []);
  assert.deepEqual(result.find((r) => r.id === "Deep").polygons, []);
  assert(!result.some((r) => r.id === "Mountains"));
  assert(inside(b, 130, 20));
});
test("parent shrink clips children; children stay in parent; holes and separated areas survive", () => {
  const p = territory("P"),
    c = territory("C", 10, 10, 80, 80, "P");
  const result = M.applyTerritory([p, c], {
    ...p,
    polygons: [rect(0, 0, 50, 100)],
  });
  assert(
    inside(
      result.find((r) => r.id === "C"),
      20,
      20,
    ),
  );
  assert(
    !inside(
      result.find((r) => r.id === "C"),
      60,
      20,
    ),
  );
  const next = M.applyTerritory([p], territory("C", 90, 90, 30, 30, "P")).find(
    (r) => r.id === "C",
  );
  assert(inside(next, 95, 95));
  assert(!inside(next, 110, 110));
  const hole = M.combineTerritory(
    [rect(0, 0, 100, 100)],
    [rect(30, 30, 40, 40)],
    "erase",
  );
  assert.equal(hole[0].holes.length, 1);
  const split = M.combineTerritory(hole, [rect(45, -10, 10, 120)], "erase");
  assert.equal(split.length, 2);
});
test("reject cycles, missing parents, cross-layer parents and malformed shapes before mutation", () => {
  const p = territory("P"),
    c = territory("C", 1, 1, 10, 10, "P");
  assert.throws(
    () =>
      M.applyTerritory([p, c], {
        ...p,
        territory: { ...p.territory, parentId: "C" },
      }),
    /Kreis/,
  );
  assert.throws(() => M.applyTerritory([], c), /fehlt/);
  assert.throws(
    () =>
      M.applyTerritory([p], territory("C", 1, 1, 10, 10, "P", "geographic")),
    /Ebene/,
  );
  assert.throws(
    () => M.applyTerritory([p], { ...p, polygons: [rect(NaN, 0, 10, 10)] }),
    /grenze/i,
  );
});
test("brush interpolates sparse samples and zoom presets control the complete overlay", () => {
  const r = territory("brush");
  r.polygons = M.territoryStroke(
    [
      { x: 0, y: 0 },
      { x: 100, y: 0 },
    ],
    5,
  );
  assert(inside(r, 50, 0));
  assert(!inside(r, 50, 10));
  assert.equal(M.territoryThreshold(20), 5);
  assert.equal(M.territoryThreshold(40), 50);
  assert.equal(M.territoryThreshold(80), 5000);
  r.territory.prominence = 20;
  let scene = atlasPaint("group");
  drawTerritories(
    scene,
    [r],
    { x: -10, y: -10, width: 150, height: 50 },
    6,
    M.defaultRegionLayers,
  );
  assert.equal(scene.children.length, 0);
  scene = atlasPaint("group");
  drawTerritories(
    scene,
    [r],
    { x: -10, y: -10, width: 150, height: 50 },
    1,
    M.defaultRegionLayers,
  );
  assert(scene.children.some((n) => n.data.territoryLabel === "brush"));
  assert(scene.children.some((n) => n.data.territoryId === "brush"));
});
test("label is inside a concave region with holes and prominence resolves collisions once", () => {
  const a = territory("A");
  a.polygons = M.combineTerritory(a.polygons, [rect(10, 10, 80, 80)], "erase");
  assert(M.territoryContains(a, M.territoryLabelPoint(a)));
  const b = territory("B");
  a.territory.label.position = { x: 50, y: 50 };
  a.territory.prominence = 80;
  b.territory.prominence = 60;
  b.territory.label.position = { x: 50, y: 50 };
  const scene = atlasPaint("group");
  drawTerritories(
    scene,
    [b, a],
    { x: 0, y: 0, width: 100, height: 100 },
    1,
    M.defaultRegionLayers,
  );
  assert.deepEqual(
    scene.children
      .filter((n) => n.data.territoryLabel)
      .map((n) => n.data.territoryLabel),
    ["A"],
  );
});
function fixture(t) {
  const dir = mkdtempSync("/tmp/atlas-territories-");
  let store = new CampaignStore(dir + "/campaign.sqlite");
  const campaign = store.create("Regionstest", []);
  let w = store.activateShell(campaign.id);
  t.after(() => {
    store.close();
    rmSync(dir, { recursive: true, force: true });
  });
  return {
    get store() {
      return store;
    },
    get w() {
      return w;
    },
    campaign,
    command(action) {
      return store.executeAtlasCommit({
        commandId: randomUUID(),
        token: w.token,
        campaignId: campaign.id,
        action,
      });
    },
    put(record) {
      const old = store.db
        .prepare(
          "SELECT revision FROM atlas_landscape WHERE campaign_id=? AND id=?",
        )
        .get(campaign.id, record.id);
      return this.command({
        kind: "landscape-territory",
        record,
        expectedRevision: old?.revision ?? null,
      });
    },
    get(id) {
      return store.atlasLandscapeObject(w.token, id);
    },
    reopen() {
      store.close();
      store = new CampaignStore(dir + "/campaign.sqlite");
      w = store.activateShell(campaign.id);
    },
  };
}
test("store atomically transfers land with one Undo/Redo, persists notes, empty regions and custom layers", (t) => {
  const f = fixture(t),
    a = territory("A"),
    b = territory("B", 100, 0),
    c = territory("C", 110, 10, 10, 10, "B");
  a.territory.notes = "Original\r\n[[Notiz]]";
  f.put(a);
  f.put(b);
  f.put(c);
  const before = [f.get("A"), f.get("B"), f.get("C")];
  f.put({ ...f.get("A"), polygons: [rect(0, 0, 150, 100)] });
  assert.equal(f.get("C").polygons.length, 0);
  f.command({ kind: "undo" });
  assert.deepEqual(
    [f.get("A"), f.get("B"), f.get("C")].map(({ revision, ...r }) => r),
    before.map(({ revision, ...r }) => r),
  );
  f.command({ kind: "redo" });
  assert.equal(f.get("C").polygons.length, 0);
  f.command({
    kind: "landscape-region-layer",
    record: M.layerRecord({
      id: "custom",
      name: "Handelsräume",
      visible: true,
      order: 2,
    }),
    expectedRevision: null,
  });
  f.put(territory("Trade", 0, 0, 200, 200, null, "custom"));
  f.reopen();
  assert.equal(f.get("A").territory.notes, a.territory.notes);
  assert.equal(f.get("C").polygons.length, 0);
  assert(
    f.store
      .atlasOverview(f.w.token)
      .regionLayers.some((l) => l.name === "Handelsräume"),
  );
  assert.equal(
    f.store.atlasObjects(f.w.token, { kind: "territory", text: "C", limit: 10 })
      .items[0].parentId,
    "B",
  );
});
test("stale revisions, generic bypass and invalid hierarchy leave all records unchanged", (t) => {
  const f = fixture(t);
  f.put(territory("A"));
  f.put(territory("B", 100));
  const before = f.store.db
    .prepare("SELECT * FROM atlas_landscape ORDER BY id")
    .all();
  assert.throws(
    () =>
      f.command({
        kind: "landscape-territory",
        record: territory("A", 0, 0, 200, 200),
        expectedRevision: 0,
      }),
    /inzwischen/,
  );
  assert.throws(
    () =>
      f.command({
        kind: "landscape-put",
        record: territory("A"),
        expectedRevision: 1,
      }),
    /Regionswerkzeug/,
  );
  assert.throws(() => f.put(territory("C", 0, 0, 10, 10, "Missing")), /fehlt/);
  assert.deepEqual(
    f.store.db.prepare("SELECT * FROM atlas_landscape ORDER BY id").all(),
    before,
  );
});
test("source-bound reader keeps regions above dense raster geometry, strips notes, filters layers and hits polygons", async (t) => {
  const f = fixture(t),
    a = territory("A");
  a.territory.notes = "PRIVATE REGION NOTES";
  f.put(a);
  for (let i = 0; i < 501; i++)
    f.store.db
      .prepare("INSERT INTO atlas_landscape VALUES(?,?,?,?,?,?,?,?)")
      .run(
        f.campaign.id,
        "road" + i,
        1,
        0,
        10,
        0,
        10,
        JSON.stringify({
          id: "road" + i,
          revision: 1,
          kind: "road",
          name: "road",
          points: [
            { x: 0, y: 0 },
            { x: 10, y: 10 },
          ],
          polygons: [],
          resolution: 1,
          width: 1,
          values: {},
        }),
      );
  const db = new Database(f.store.filename, { readonly: true }),
    reader = new AtlasRegionReader(db);
  t.after(() => db.close());
  const q = {
    box: { x: -10, y: -10, width: 130, height: 130 },
    width: 1000,
    height: 1000,
    scopeId: "local",
    floorId: "ground",
    slice: null,
    roofs: true,
  };
  let source = f.store.atlasRegionSource(f.w.token);
  await reader.sync(source);
  let view = reader.read(source, q);
  assert.equal(view.landscape.state, "ready");
  assert.equal(view.landscape.coverage.mode, "raster");
  assert.equal(view.landscape.territories[0].id, "A");
  assert(!JSON.stringify(view).includes("PRIVATE REGION"));
  assert(
    reader
      .candidatesAt(source, q, { x: 50, y: 50 }, 0, "landscape")
      .items.some((r) => r.id === "A"),
  );
  f.command({
    kind: "landscape-region-layer",
    record: M.layerRecord({ ...M.defaultRegionLayers[0], visible: false }),
    expectedRevision: null,
  });
  source = f.store.atlasRegionSource(f.w.token, {
    epoch: source.epoch,
    sequence: source.sequence,
  });
  await reader.sync(source);
  view = reader.read(source, q);
  assert.equal(view.landscape.territories.length, 0);
  assert(
    !reader
      .candidatesAt(source, q, { x: 50, y: 50 }, 0, "landscape")
      .items.some((r) => r.id === "A"),
  );
});
test("drawing contexts are internal, world-aligned, repeatable and never create a place marker", (t) => {
  const f = fixture(t);
  for (const geometry of ["city", "dungeon"]) {
    const first = f.command({ kind: "geometry-context", geometry });
    const second = f.command({ kind: "geometry-context", geometry });
    assert.equal(first.result.id, second.result.id);
    const binding = f.store.db
      .prepare("SELECT * FROM atlas_binding WHERE campaign_id=? AND owner_id=?")
      .get(f.campaign.id, first.result.id);
    assert.equal(binding.x, 0);
    assert.equal(binding.y, 0);
    assert.equal(binding.angle, 0);
  }
  assert.equal(
    f.store.db.prepare("SELECT count(*) n FROM atlas_place").get().n,
    0,
  );
});
test("campaign archive copy retains layer identity and rewrites only region/parent identities", async (t) => {
  const f = fixture(t);
  f.command({
    kind: "landscape-region-layer",
    record: M.layerRecord({
      id: "trade",
      name: "Handelsräume",
      visible: true,
      order: 2,
    }),
    expectedRevision: null,
  });
  f.put(territory("Parent", 0, 0, 100, 100, null, "trade"));
  f.put(territory("Child", 10, 10, 10, 10, "Parent", "trade"));
  f.command({ kind: "geometry-context", geometry: "city" });
  const dir = mkdtempSync("/tmp/territory-copy-");
  t.after(() => rmSync(dir, { recursive: true, force: true }));
  await f.store.campaignSnapshot(f.w.token, dir + "/archive.sqlite");
  const copy = new CampaignStore(dir + "/copy.sqlite");
  t.after(() => copy.close());
  const c = copy.acceptCampaignSnapshot(dir + "/archive.sqlite", "Kopie", {}),
    w = copy.activateShell(c.id),
    items = copy.atlasObjects(w.token, {
      kind: "territory",
      text: "",
      limit: 20,
    }).items;
  const parent = items.find((r) => r.name === "Parent"),
    child = items.find((r) => r.name === "Child");
  assert.notEqual(parent.id, "Parent");
  assert.equal(child.parentId, parent.id);
  assert.equal(child.layerId, "trade");
  assert(
    copy.atlasOverview(w.token).regionLayers.some((l) => l.id === "trade"),
  );
  const l = copy.atlasLandscapeObject(w.token, "region-layer:trade");
  copy.executeAtlasCommit({
    commandId: randomUUID(),
    token: w.token,
    campaignId: c.id,
    action: {
      kind: "landscape-region-layer",
      record: { ...l, regionLayer: { ...l.regionLayer, name: "Handel" } },
      expectedRevision: l.revision,
    },
  });
  copy.executeAtlasCommit({
    commandId: randomUUID(),
    token: w.token,
    campaignId: c.id,
    action: { kind: "geometry-context", geometry: "city" },
  });
  assert.equal(
    copy.db
      .prepare("SELECT count(*) n FROM city_document WHERE campaign_id=?")
      .get(c.id).n,
    1,
  );
});
test("a write fault on the second affected region rolls back every boundary and history row", (t) => {
  const f = fixture(t);
  f.put(territory("A"));
  f.put(territory("B", 100));
  const before = f.store.db
      .prepare("SELECT * FROM atlas_landscape ORDER BY id")
      .all(),
    history = f.store.db
      .prepare("SELECT count(*) n FROM atlas_command")
      .get().n;
  f.store.db.exec(
    "CREATE TEMP TRIGGER region_fault BEFORE UPDATE ON atlas_landscape WHEN NEW.id='B' BEGIN SELECT RAISE(ABORT,'injected region write failure'); END",
  );
  assert.throws(
    () => f.put({ ...f.get("A"), polygons: [rect(0, 0, 150, 100)] }),
    /injected/,
  );
  assert.deepEqual(
    f.store.db.prepare("SELECT * FROM atlas_landscape ORDER BY id").all(),
    before,
  );
  assert.equal(
    f.store.db.prepare("SELECT count(*) n FROM atlas_command").get().n,
    history,
  );
});
test("delayed region selections cannot overwrite a newer selection or an edited draft", async (t) => {
  const previous = globalThis.window;
  t.after(() => {
    globalThis.window = previous;
  });
  const pending = new Map();
  globalThis.window = {
    campaign: {
      atlasLandscapeObject: (_token, id) =>
        new Promise((resolve) => pending.set(id, resolve)),
    },
  };
  const ui = Object.assign(Object.create(TerritoryWorkbench.prototype), {
    host: { token: () => "campaign", redraw() {} },
    generation: 0,
    dirty: false,
    drag: null,
    form() {},
    input: () => ({ value: "" }),
  });
  const first = ui.select("A"),
    second = ui.select("B");
  pending.get("B")({ ok: true, value: territory("B") });
  await second;
  pending.get("A")({ ok: true, value: territory("A") });
  await first;
  assert.equal(ui.selected.id, "B");
  const third = ui.select("C");
  ui.selected.name = "Unfinished wording";
  ui.dirty = true;
  pending.get("C")({ ok: true, value: territory("C") });
  await third;
  assert.equal(ui.selected.name, "Unfinished wording");
  assert(ui.hasDraft());
});
test("a pending region save locks its form and a failed save restores the editable draft", async () => {
  let reject;
  const ui = Object.assign(Object.create(TerritoryWorkbench.prototype), {
    host: {
      token: () => "campaign",
      write: () =>
        new Promise((_resolve, fail) => {
          reject = fail;
        }),
    },
    panel: { inert: false },
    selected: territory("Draft"),
    busy: false,
    dirty: true,
    readForm() {},
    status() {},
  });
  const save = ui.commit();
  assert.equal(ui.panel.inert, true);
  reject(Error("injected failure"));
  await assert.rejects(save, /injected/);
  assert.equal(ui.panel.inert, false);
  assert.equal(ui.busy, false);
  assert.equal(ui.selected.id, "Draft");
  assert(ui.hasDraft());
});
