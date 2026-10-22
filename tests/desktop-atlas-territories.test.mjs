import { test } from "node:test";
import assert from "node:assert/strict";
import { buildSync } from "esbuild";
import { createRequire } from "node:module";
import { mkdtempSync, rmSync } from "node:fs";
import { randomUUID } from "node:crypto";
import { tmpdir } from "node:os";
const require = createRequire(import.meta.url);
buildSync({
  stdin: {
    contents:
      "export * from './src/app/storage/store';export * from './src/app/atlas-territories';export * from './src/app/atlas-cartography';export * from './src/app/landscape-brush';export * from './src/app/storage/atlas-region';export * from './src/app/atlas-paint';",
    resolveDir: process.cwd(),
  },
  outfile: ".build/atlas-territories-tests.cjs",
  bundle: true,
  platform: "node",
  format: "cjs",
  external: ["better-sqlite3"],
});
const {
  CampaignStore,
  polygonArea,
  subtractPolygons,
  intersectPolygons,
  MapLabelLayout,
  territoryAnchor,
  lineLabels,
  AtlasRegionReader,
} = require("../.build/atlas-territories-tests.cjs");
const square = (x, y, w, h = w) => [
  {
    outer: [
      { x, y },
      { x: x + w, y },
      { x: x + w, y: y + h },
      { x, y: y + h },
    ],
    holes: [],
  },
];
const territory = (id, polygons = [], parentId = null, rank = 5) => ({
  id,
  revision: 0,
  name: id,
  polygons,
  parentId,
  layerId: "politics",
  typeId: "kingdom",
  rank,
  color: "#996633",
  opacity: 0.15,
  border: "solid",
});
function fixture(t) {
  const dir = mkdtempSync(tmpdir()+"/atlas-territories-");
  let store = new CampaignStore(dir + "/world.sqlite");
  const cam = store.create("Atlas");
  let w = store.activate(cam.id);
  t.after(() => {
    store.close();
    rmSync(dir, { recursive: true, force: true });
  });
  return {
    dir,
    cam,
    get store() {
      return store;
    },
    get token() {
      return w.token;
    },
    write: (action) =>
      store.executeAtlasCommit({
        commandId: randomUUID(),
        token: w.token,
        campaignId: cam.id,
        action,
      }),
    get state() {
      return store.atlasTerritories(w.token);
    },
    put(t) {
      this.write({
        kind: "territory-put",
        territory: t,
        expectedRevision: null,
      });
    },
    fresh() {
      store.close();
      store = new CampaignStore(dir + "/world.sqlite");
      w = store.activate(cam.id);
    },
  };
}
test('Main camera receives bounded name candidates before their flat scale threshold; public reads stay empty',async t=>{
  const f=fixture(t);
  f.write({kind:'landscape-put',expectedRevision:null,record:{id:'thin-road',revision:0,kind:'road',name:'Waldweg',points:[{x:-5000,y:0},{x:5000,y:0}],polygons:[],width:1,resolution:1,values:{}}});
  const db=new (require('better-sqlite3'))(f.dir+'/world.sqlite',{readonly:true});t.after(()=>db.close());
  const reader=new AtlasRegionReader(db),source=f.store.atlasRegionSource(f.token);await reader.sync(source);
  const q={box:{x:-6000,y:-4000,width:12000,height:8000},width:800,height:600,scopeId:null,floorId:'ground',slice:null,roofs:true,terrainRaster:false};
  assert(reader.read(source,q).landscape.labels.some(c=>c.text==='Waldweg'));
  assert.equal(reader.read(source,{...q,perception:true}).landscape.labels.length,0);
  assert.equal(f.store.landscapeFind(f.token,'Waldweg')[0].width,1);
});
test("brush transfers neighbouring land atomically and undo/redo survive reopening", (t) => {
  const f = fixture(t);
  f.put(territory("west", square(0, 0, 100)));
  f.put(territory("east", square(100, 0, 100)));
  const before = f.state;
  f.write({
    kind: "territory-stroke",
    id: "west",
    expectedRevision: 1,
    points: [{ x: 100, y: 50 }],
    radius: 20,
    operation: "add",
  });
  const after = f.state,
    a = after.territories.find((t) => t.id === "west"),
    b = after.territories.find((t) => t.id === "east");
  assert(polygonArea(a.polygons) > 10000);
  assert(polygonArea(b.polygons) < 10000);
  assert(polygonArea(intersectPolygons(a.polygons, b.polygons)) < 1e-6);
  assert(
    Math.abs(polygonArea(a.polygons) + polygonArea(b.polygons) - 20000) < 1e-5,
  );
  f.write({ kind: "undo" });
  assert.deepEqual(
    f.state.territories.map((t) => t.polygons),
    before.territories.map((t) => t.polygons),
  );
  f.write({ kind: "redo" });
  f.fresh();
  assert.deepEqual(
    f.state.territories.map((t) => t.polygons),
    after.territories.map((t) => t.polygons),
  );
});
test("subregions stay within parent and erasure leaves unassigned parent land", (t) => {
  const f = fixture(t);
  f.put(territory("kingdom", square(0, 0, 100)));
  f.put(territory("city", [], "kingdom", 3));
  f.write({
    kind: "territory-stroke",
    id: "city",
    expectedRevision: 1,
    points: [{ x: 100, y: 50 }],
    radius: 30,
    operation: "add",
  });
  const city = f.state.territories.find((t) => t.id === "city");
  assert.equal(
    polygonArea(subtractPolygons(city.polygons, square(0, 0, 100))),
    0,
  );
  f.write({
    kind: "territory-stroke",
    id: "city",
    expectedRevision: city.revision,
    points: [{ x: 85, y: 50 }],
    radius: 10,
    operation: "erase",
  });
  assert(
    polygonArea(f.state.territories.find((t) => t.id === "city").polygons) <
      polygonArea(city.polygons),
  );
  assert.equal(
    polygonArea(f.state.territories.find((t) => t.id === "kingdom").polygons),
    10000,
  );
});
test("parent edits and transfers cannot silently strand children; conflicts preserve every row", (t) => {
  const f = fixture(t);
  f.put(territory("west", square(0, 0, 100)));
  f.put(territory("east", square(100, 0, 100)));
  f.put(territory("city", square(110, 30, 20), "east", 3));
  const before = f.state;
  assert.throws(
    () =>
      f.write({
        kind: "territory-stroke",
        id: "west",
        expectedRevision: 1,
        points: [{ x: 110, y: 40 }],
        radius: 30,
        operation: "add",
      }),
    /Oberregion|Unterregion/,
  );
  assert.deepEqual(f.state, before);
  assert.throws(
    () =>
      f.write({
        kind: "territory-stroke",
        id: "west",
        expectedRevision: 0,
        points: [{ x: 90, y: 50 }],
        radius: 20,
        operation: "add",
      }),
    /inzwischen/,
  );
  assert.deepEqual(f.state, before);
});
test("layers and hierarchy validate cycles, foreign owners and deletion", (t) => {
  const f = fixture(t);
  f.put(territory("a", square(0, 0, 100)));
  f.put(territory("b", square(10, 10, 10), "a"));
  const a = f.state.territories.find((t) => t.id === "a");
  assert.throws(
    () =>
      f.write({
        kind: "territory-put",
        territory: { ...a, parentId: "b" },
        expectedRevision: 1,
      }),
    /Kreis/,
  );
  assert.throws(
    () => f.write({ kind: "territory-remove", id: "a", expectedRevision: 1 }),
    /Unterregion/,
  );
  f.put({
    ...territory("forest", square(0, 0, 100)),
    layerId: "geography",
    typeId: "forest",
  });
  assert.equal(f.state.territories.length, 3);
  f.write({
    kind: "territory-layer",
    expectedRevision: null,
    layer: {
      id: "trade",
      revision: 0,
      name: "Handelsbünde",
      order: 2,
      visible: true,
      types: [{ id: "guild", name: "Gilde", rank: 3 }],
    },
  });
  f.fresh();
  assert(f.state.layers.some((l) => l.name === "Handelsbünde"));
});
test("labels choose clear interior anchors, priority and readable screen size", () => {
  const hollow = [
    { outer: square(0, 0, 200)[0].outer, holes: [square(70, 70, 60)[0].outer] },
  ];
  const p = territoryAnchor(hollow);
  assert(p);
  assert(!(p.x > 70 && p.x < 130 && p.y > 70 && p.y < 130));
  const l = new MapLabelLayout(),
    box = { x: 0, y: 0, width: 1000, height: 1000 },
    measure = (s, n) => s.length * n * 0.6,
    labels = [
      {
        id: "a",
        text: "Königreich Ähren",
        kind: "place",
        rank: 5,
        point: { x: 500, y: 500 },
      },
      {
        id: "b",
        text: "Dorf",
        kind: "place",
        rank: 2,
        point: { x: 500, y: 500 },
      },
    ];
  const placed = l.layout(labels, box, 1, measure);
  assert(placed.some((p) => p.candidate.id === "a"));
  for (const a of placed)
    for (const b of placed)
      if (a !== b)
        assert(
          !(
            a.box.x < b.box.x + b.box.w &&
            a.box.x + a.box.w > b.box.x &&
            a.box.y < b.box.y + b.box.h &&
            a.box.y + a.box.h > b.box.y
          ),
        );
  assert(l.layout(labels, box, 20, measure).every((p) => p.font >= 12));
});
test("line names remain upright and insufficient lengths are suppressed", () => {
  const labels = lineLabels(
    "road",
    "Königsstraße",
    "road",
    [
      { x: 900, y: 500 },
      { x: 100, y: 500 },
    ],
    2,
  );
  assert.equal(labels.length, 1);
  assert(Math.abs(labels[0].angle) <= Math.PI / 2);
  const l = new MapLabelLayout(),
    box = { x: 0, y: 0, width: 1000, height: 1000 };
  assert.equal(
    l.layout(labels, box, 1, (s, n) => s.length * n * 0.6).length,
    1,
  );
  assert.equal(
    l.layout(labels, box, 20, (s, n) => s.length * n * 0.6).length,
    0,
  );
});
test("dense landscape raster retains bounded geographically distributed name candidates", async (t) => {
  const f = fixture(t);
  const put = f.store.db.prepare(
    "INSERT INTO atlas_landscape VALUES(?,?,?,?,?,?,?,?)",
  );
  f.store.db.transaction(() => {
    for (let i = 0; i < 520; i++) {
      const x = (i % 26) * 100,
        y = Math.floor(i / 26) * 100,
        r = {
          id: "p" + i,
          revision: 1,
          kind: "place",
          name: "Ort " + i,
          points: [{ x, y }],
          polygons: [],
          width: 0,
          resolution: 1,
          values: {},
        };
      put.run(f.cam.id, r.id, 1, x, x, y, y, JSON.stringify(r));
    }
  })();
  const source = f.store.atlasRegionSource(f.token),
    readDb = new (require("better-sqlite3"))(f.dir + "/world.sqlite", {
      readonly: true,
    }),
    reader = new AtlasRegionReader(readDb);
  t.after(() => readDb.close());
  await reader.sync(source);
  const result = reader.read(source, {
    box: { x: -100, y: -100, width: 3000, height: 3000 },
    width: 1000,
    height: 1000,
    scopeId: null,
    floorId: "ground",
    slice: null,
    roofs: true,
  });
  assert.equal(result.landscape.coverage.mode, "raster");
  assert(result.landscape.labels.length > 100);
  assert(result.landscape.labels.length <= 1200);
});
test("shared vertices and triple junctions move without gaps, including neighbour edge interiors", (t) => {
  const f = fixture(t);
  f.put(territory("west", square(0, 0, 100, 200)));
  f.put(territory("north", square(100, 0, 100)));
  f.put(territory("south", square(100, 100, 100)));
  f.write({
    kind: "territory-vertex",
    id: "north",
    expectedRevision: 1,
    polygon: 0,
    ring: 0,
    vertex: 3,
    point: { x: 80, y: 120 },
  });
  const all = f.state.territories;
  assert(all.every((t) => t.revision === 2));
  assert(
    Math.abs(all.reduce((sum, t) => sum + polygonArea(t.polygons), 0) - 40000) <
      1e-5,
  );
  for (const a of all)
    for (const b of all)
      if (a !== b)
        assert(polygonArea(intersectPolygons(a.polygons, b.polygons)) < 1e-5);
  assert(
    all.every((t) =>
      t.polygons.some((p) => p.outer.some((v) => v.x === 80 && v.y === 120)),
    ),
  );
  f.write({ kind: "undo" });
  assert.equal(
    f.state.territories.find((t) => t.id === "west").polygons[0].outer.length,
    4,
  );
});
test("insert/delete on a shared edge and invalid point edits are atomic", (t) => {
  const f = fixture(t);
  f.put(territory("a", square(0, 0, 100)));
  f.put(territory("b", square(100, 0, 100)));
  f.write({
    kind: "territory-vertex",
    id: "a",
    expectedRevision: 1,
    polygon: 0,
    ring: 0,
    vertex: 1,
    point: { x: 100, y: 50 },
    insert: true,
  });
  assert(f.state.territories.every((t) => t.polygons[0].outer.length === 5));
  const before = f.state;
  assert.throws(() =>
    f.write({
      kind: "territory-vertex",
      id: "a",
      expectedRevision: 2,
      polygon: 0,
      ring: 0,
      vertex: 2,
      point: { x: 250, y: 50 },
    }),
  );
  assert.deepEqual(f.state, before);
  f.write({
    kind: "territory-vertex",
    id: "a",
    expectedRevision: 2,
    polygon: 0,
    ring: 0,
    vertex: 2,
    point: null,
  });
  assert(f.state.territories.every((t) => t.polygons[0].outer.length === 4));
});
test("archives preserve default/custom layers, their types and parent references under new campaign IDs", async (t) => {
  const f = fixture(t);
  f.write({
    kind: "territory-layer",
    expectedRevision: null,
    layer: {
      ...f.state.layers.find((l) => l.id === "politics"),
      name: "Politische Gebiete",
    },
  });
  f.put(territory("realm", square(0, 0, 100)));
  f.put(territory("town", square(10, 10, 10), "realm", 3));
  f.write({
    kind: "territory-layer",
    expectedRevision: null,
    layer: {
      id: "trade",
      revision: 0,
      name: "Handelsbünde",
      visible: true,
      order: 2,
      types: [{ id: "guild", name: "Gilde", rank: 3 }],
    },
  });
  f.put({
    ...territory("guild-zone", square(0, 0, 100)),
    layerId: "trade",
    typeId: "guild",
  });
  const snapshot = f.dir + "/copy.sqlite";
  await f.store.campaignSnapshot(f.token, snapshot);
  const imported = f.store.acceptCampaignSnapshot(snapshot, "Kopie", {});
  const token = f.store.activate(imported.id).token,
    state = f.store.atlasTerritories(token);
  assert.equal(state.layers.length, 3);
  assert.equal(
    state.layers.find((l) => l.id === "politics").name,
    "Politische Gebiete",
  );
  const realm = state.territories.find((t) => t.name === "realm"),
    town = state.territories.find((t) => t.name === "town"),
    guild = state.territories.find((t) => t.name === "guild-zone");
  assert.notEqual(realm.id, "realm");
  assert.equal(town.parentId, realm.id);
  assert.equal(
    guild.layerId,
    state.layers.find((l) => l.name === "Handelsbünde").id,
  );
  assert.equal(guild.typeId, "guild");
});
test("schema 48 opens without changing existing geometry and schema 50 refuses missing storage", (t) => {
  const f = fixture(t);
  f.store.db.exec(
    "DROP TABLE atlas_territory;DROP TABLE atlas_territory_layer;PRAGMA user_version=48;",
  );
  f.fresh();
  assert.equal(f.state.territories.length, 0);
  assert.ok(f.store.db.pragma("user_version", { simple: true }) >= 50);
  f.store.db.exec("DROP TABLE atlas_territory");
  assert.throws(
    () => new CampaignStore(f.dir + "/world.sqlite"),
    /Regionsspeicher fehlt/,
  );
});
test("large-coordinate area keeps metre-scale regions measurable", () => {
  assert.equal(polygonArea(square(1e10, 1e10, 100)), 10000);
});
test("one line chooses its longest fitting segment and manual style survives reload", (t) => {
  const labels = lineLabels(
      "road",
      "Königsstraße",
      "road",
      [
        { x: 0, y: 100 },
        { x: 200, y: 100 },
        { x: 200, y: 200 },
        { x: 900, y: 200 },
      ],
      3,
    ),
    placed = new MapLabelLayout().layout(
      labels,
      { x: -100, y: 0, width: 1200, height: 500 },
      1,
      (s, n) => s.length * n * 0.6,
    );
  assert.equal(placed.length, 1);
  assert(placed[0].candidate.available > 500);
  const f = fixture(t),
    record = {
      id: "named",
      revision: 0,
      kind: "road",
      name: "Handelsstraße",
      points: [
        { x: 0, y: 0 },
        { x: 1000, y: 0 },
      ],
      polygons: [],
      width: 4,
      resolution: 1,
      values: {},
      label: { rank: 5, point: { x: 300, y: 50 }, angle: 0.2 },
    };
  f.write({ kind: "landscape-put", record, expectedRevision: null });
  f.fresh();
  assert.deepEqual(
    f.store.landscapeFind(f.token, "Handelsstraße")[0].label,
    record.label,
  );
  assert.throws(
    () =>
      f.write({
        kind: "landscape-put",
        record: { ...record, label: { rank: 99 } },
        expectedRevision: 1,
      }),
    /Beschriftung/,
  );
});
test("global export layout stays fixed across tile offsets and preserves Unicode", () => {
  const labels = [
      {
        id: "town",
        kind: "place",
        text: "Ährenfurt · 水",
        rank: 5,
        point: { x: 510, y: 500 },
      },
    ],
    box = { x: 0, y: 0, width: 1024, height: 1024 },
    layout = new MapLabelLayout().layout(
      labels,
      box,
      1,
      (s, n) => s.length * n * 0.6,
    );
  assert.equal(layout.length, 1);
  const {
    atlasPaint,
    paintMapLabels,
  } = require("../.build/atlas-territories-tests.cjs");
  const left = atlasPaint("group"),
    right = atlasPaint("group");
  paintMapLabels(left, layout, box, 1);
  paintMapLabels(right, layout, { x: 512, y: 0, width: 512, height: 1024 }, 1);
  assert.equal(
    left.children[0].geometry.matrix[4] - right.children[0].geometry.matrix[4],
    512,
  );
  // Geometry of placement is global; each tile receives the same world anchor.
  assert.equal(layout[0].candidate.text, "Ährenfurt · 水");
  assert.equal(layout[0].point.x, 510);
  const l2 = new MapLabelLayout().layout(
    labels,
    box,
    2,
    (s, n) => s.length * n * 0.6,
  );
  assert.equal(l2[0].font, layout[0].font);
});

test("city label corrections follow the city frame and private labels stay out of public reads", async (t) => {
  const f = fixture(t),
    made = f.write({
      kind: "city-create",
      name: "Eichenfurt",
      x: 1000,
      y: 2000,
      width: 200,
      height: 200,
    }),
    cityId = made.result.id,
    city = f.store.city(f.token, cityId);
  f.store.executeCity({
    commandId: randomUUID(),
    token: f.token,
    campaignId: f.cam.id,
    cityId,
    expectedRevision: city.header.revision,
    action: {
      kind: "change",
      label: "Taverne",
      remove: [],
      upsert: [
        {
          id: "tavern",
          kind: "building",
          name: "Goldene Taverne",
          protected: true,
          position: { x: 50, y: 50 },
          outline: [
            { x: -20, y: -10 },
            { x: 20, y: -10 },
            { x: 20, y: 10 },
            { x: -20, y: 10 },
          ],
          angle: 0,
          notes: "privat",
          label: { rank: 4, point: { x: 50, y: 50 }, angle: 0.2 },
          residentIds: [],
          workerIds: [],
          households: [],
          jobs: [],
        },
      ],
    },
  });
  f.store.db
    .prepare(
      "UPDATE atlas_binding SET angle=? WHERE campaign_id=? AND owner_id=?",
    )
    .run(Math.PI / 2, f.cam.id, cityId);
  const readDb = new (require("better-sqlite3"))(f.dir + "/world.sqlite", {
      readonly: true,
    }),
    reader = new AtlasRegionReader(readDb);
  t.after(() => readDb.close());
  const source = f.store.atlasRegionSource(f.token);
  await reader.sync(source);
  const q = {
      box: { x: 780, y: 1980, width: 250, height: 250 },
      width: 1000,
      height: 1000,
      scopeId: null,
      floorId: "ground",
      slice: null,
      roofs: true,
    },
    r = reader.read(source, q),
    label = r.labels.find((c) => c.id === "unit:tavern");
  assert(label);
  assert.deepEqual(label.point, { x: 950, y: 2050 });
  assert.equal(label.rank, 4);
  assert(Math.abs(label.angle - (Math.PI / 2 + 0.2)) < 1e-9);
  assert(!JSON.stringify(r).includes("privat"));
  const publicView = reader.read(source, { ...q, perception: true });
  assert.equal(publicView.labels, undefined);
  assert.equal(publicView.territories, undefined);
  assert.equal(publicView.territoryRaster, undefined);
  assert.equal(publicView.landscape.labels.length, 0);
});

test("a long road can be named in a viewport far from its original midpoint", () => {
  const box = { x: 9000, y: 0, width: 1000, height: 1000 },
    labels = lineLabels(
      "road",
      "Küstenstraße",
      "road",
      [
        { x: 0, y: 500 },
        { x: 20000, y: 500 },
      ],
      3,
      box,
    ),
    placed = new MapLabelLayout().layout(
      labels,
      box,
      1,
      (s, n) => s.length * n * 0.6,
    );
  assert.equal(placed.length, 1);
  assert(placed[0].point.x > 9000 && placed[0].point.x < 10000);
});

test("canonical creation rejects a self-crossing region before writing", (t) => {
  const f = fixture(t);
  assert.throws(
    () =>
      f.put(
        territory("cross", [
          {
            outer: [
              { x: 0, y: 0 },
              { x: 100, y: 100 },
              { x: 0, y: 100 },
              { x: 100, y: 0 },
            ],
            holes: [],
          },
        ]),
      ),
    /kreuzt|Fläche/,
  );
  assert.equal(f.state.territories.length, 0);
});

test("moving an end of a partly shared edge retains the intermediate neighbour junction", (t) => {
  const f = fixture(t);
  f.put(territory("west", square(0, 0, 100, 200)));
  f.put(territory("north", square(100, 0, 100)));
  f.put(territory("south", square(100, 100, 100)));
  f.write({
    kind: "territory-vertex",
    id: "west",
    expectedRevision: 1,
    polygon: 0,
    ring: 0,
    vertex: 1,
    point: { x: 80, y: 0 },
  });
  const rows = f.state.territories;
  assert.equal(rows.find((t) => t.id === "south").revision, 1);
  assert(
    Math.abs(rows.reduce((s, t) => s + polygonArea(t.polygons), 0) - 40000) <
      1e-5,
  );
  for (const a of rows)
    for (const b of rows)
      if (a !== b)
        assert(polygonArea(intersectPolygons(a.polygons, b.polygons)) < 1e-5);
});

test("unselected detail names obey zoom and footprint limits in navigation and export", () => {
  const box = { x: 0, y: 0, width: 10000, height: 10000 },
    label = {
      id: "house",
      text: "Taverne",
      kind: "building",
      rank: 0,
      point: { x: 5000, y: 5000 },
      available: 10,
      height: 10,
    },
    measure = (s, n) => s.length * n * 0.6;
  assert.equal(
    new MapLabelLayout().layout([label], box, 10, measure).length,
    0,
  );
  assert.equal(
    new MapLabelLayout().layout([label], box, 10, measure, "house").length,
    1,
  );
  const a = { ...label, id: "a", kind: "area", rank: 5 },
    b = { ...label, id: "b", kind: "road", rank: 5, available: 10000 };
  assert.deepEqual(
    new MapLabelLayout().layout([a, b], box, 1, measure),
    new MapLabelLayout().layout([b, a], box, 1, measure),
  );
});

for (const junction of ['triple', 'outer']) test(`deleting a ${junction} boundary junction preserves canonical area and history`, t => {
 const f=fixture(t);f.put(territory('west',square(0,0,100,200)));
 if(junction==='triple'){f.put(territory('north',square(100,0,100)));f.put(territory('south',square(100,100,100)));}
 else f.put(territory('north',square(100,0,100,200)));
 const before=f.store.db.serialize();
 assert.throws(()=>f.write({kind:'territory-vertex',id:'north',expectedRevision:1,polygon:0,ring:0,vertex:junction==='triple'?3:0,point:null}),/Verzweigten Grenzpunkt/);
 assert.deepEqual(f.store.db.serialize(),before);f.fresh();assert.equal(f.state.territories.reduce((sum,r)=>sum+polygonArea(r.polygons),0),40000);
});

test('a bend between two regions can be deleted without losing area and undone together',t=>{
 const f=fixture(t),west=territory('west',[{outer:[{x:0,y:0},{x:100,y:0},{x:120,y:50},{x:100,y:100},{x:0,y:100}],holes:[]}]),east=territory('east',[{outer:[{x:100,y:0},{x:200,y:0},{x:200,y:100},{x:100,y:100},{x:120,y:50}],holes:[]}]);f.put(west);f.put(east);const before=f.state.territories.map(r=>r.polygons);
 f.write({kind:'territory-vertex',id:'west',expectedRevision:1,polygon:0,ring:0,vertex:2,point:null});assert.equal(f.state.territories.reduce((sum,r)=>sum+polygonArea(r.polygons),0),20000);assert(f.state.territories.every(r=>r.polygons[0].outer.length===4));
 f.write({kind:'undo'});assert.deepEqual(f.state.territories.map(r=>r.polygons),before);f.fresh();assert.deepEqual(f.state.territories.map(r=>r.polygons),before);
});

test('continental brush survives normalization roundoff while a crossing at the same scale is rejected',t=>{
 const f=fixture(t),{brushFootprint,unionPolygons}=require('../.build/atlas-territories-tests.cjs');
 const points=[{x:-8580000,y:-1449582.867321307},{x:-7860000,y:-1316457.867321307},{x:-8130000,y:-850520.3673213068}];
 const polygons=brushFootprint(points,800000),normalized=unionPolygons(polygons,polygons);
 assert(polygonArea(polygons)>3e12);
 assert(Math.abs(polygonArea(polygons)-polygonArea(normalized))<.01);
 f.put(territory('continental',polygons));assert(f.state.territories.find(r=>r.id==='continental').polygons.length);
 const x=2e7,y=-1e7;
 assert.throws(()=>f.put(territory('crossing-world',[{outer:[{x,y},{x:x+1e6,y:y+1e6},{x,y:y+1e6},{x:x+1e6,y}],holes:[]}])),/kreuzt|Fläche/);
});
