import { test } from "node:test";
import assert from "node:assert/strict";
import { buildSync } from "esbuild";
import { createRequire } from "node:module";
import { mkdtempSync, rmSync } from "node:fs";
import { tmpdir } from "node:os";
import { createHash, randomUUID } from "node:crypto";
buildSync({
  stdin: {
    contents:
      "export {CampaignStore} from './src/app/storage/store';export {AtlasRegionReader} from './src/app/storage/atlas-region';",
    resolveDir: process.cwd(),
  },
  outfile: ".build/atlas-cartography-region.cjs",
  bundle: true,
  platform: "node",
  format: "cjs",
  external: ["better-sqlite3"],
});
const require = createRequire(import.meta.url),
  Database = require("better-sqlite3"),
  {
    CampaignStore,
    AtlasRegionReader,
  } = require("../.build/atlas-cartography-region.cjs");
const hash = (s) => createHash("sha256").update(s).digest("hex");
function fixture(t) {
  const dir = mkdtempSync(tmpdir() + "/map-label-region-"),
    store = new CampaignStore(dir + "/workbench.sqlite"),
    cam = store.create("Kartografie"),
    shell = store.activateShell(cam.id),
    db = new Database(store.filename, { readonly: true }),
    reader = new AtlasRegionReader(db);
  t.after(() => {
    db.close();
    store.close();
    rmSync(dir, { recursive: true, force: true });
  });
  let source;
  return {
    store,
    cam,
    shell,
    reader,
    get source() {
      return source;
    },
    async read(width = 1000, selectedIds = []) {
      source = store.atlasRegionSource(shell.token);
      await reader.sync(source);
      const q = {
        box: { x: 0, y: 0, width, height: width },
        width: 1024,
        height: 1024,
        scopeId: "local",
        floorId: "ground",
        slice: null,
        roofs: true,
        selectedIds,
      };
      return { q, result: reader.read(source, q) };
    },
  };
}
function city(f, count = 1600) {
  const { store, cam, shell } = f,
    created = store.executeAtlasCommit({
      commandId: randomUUID(),
      token: shell.token,
      campaignId: cam.id,
      action: {
        kind: "city-create",
        name: "Nebelstadt",
        x: 0,
        y: 0,
        width: 1000,
        height: 1000,
      },
    }),
    id = created.result.id;
  store.db.transaction(() => {
    for (let i = 0; i < count; i++) {
      const value = {
          id: "house" + i,
          kind: "building",
          name: "Haus " + i,
          protected: true,
          position: { x: 20 + (i % 40) * 22, y: 20 + Math.floor(i / 40) * 22 },
          outline: [
            { x: -5, y: -5 },
            { x: 5, y: -5 },
            { x: 5, y: 5 },
            { x: -5, y: 5 },
          ],
          angle: 0,
          notes: "PRIVATE NOTES",
          residentIds: [],
          workerIds: [],
          households: [],
          jobs: [],
        },
        payload = JSON.stringify(value);
      store.db
        .prepare("INSERT INTO city_unit VALUES(?,?,?,?,?,?)")
        .run(cam.id, id, value.id, value.kind, payload, hash(payload));
    }
  })();
  return id;
}
test("dense raster city still returns bounded name candidates without notes or author mutations", async (t) => {
  const f = fixture(t);
  city(f);
  const before = f.store.db
    .prepare("SELECT payload FROM city_unit ORDER BY id")
    .all();
  const { result } = await f.read();
  assert.equal(result.coverage.mode, "raster");
  assert(result.labels.length > 100 && result.labels.length <= 512);
  assert(result.labels.some((l) => l.text === "Nebelstadt"));
  assert(!JSON.stringify(result).includes("PRIVATE NOTES"));
  assert(Buffer.byteLength(JSON.stringify(result)) < 2 * 1024 * 1024);
  assert.deepEqual(
    f.store.db.prepare("SELECT payload FROM city_unit ORDER BY id").all(),
    before,
  );
});
test("hidden small buildings are not hit, while an explicitly selected building survives city overview", async (t) => {
  const f = fixture(t);
  city(f, 10);
  let { q, result } = await f.read(10000);
  assert(!result.cities.flatMap((c) => c.units).some((u) => u.id === "house0"));
  assert(
    !f.reader
      .candidatesAt(f.source, q, { x: 20, y: 20 })
      .items.some((i) => i.id === "house0"),
  );
  ({ q, result } = await f.read(100000, ["house0"]));
  assert(result.cities.flatMap((c) => c.units).some((u) => u.id === "house0"));
  assert(result.labels.find((l) => l.id === "unit:house0").selected);
  assert(
    f.reader
      .candidatesAt(f.source, q, { x: 20, y: 20 })
      .items.some((i) => i.id === "house0"),
  );
});
test("raster landscape retains names independently of baked geometry and removal invalidates them", async (t) => {
  const f = fixture(t),
    put = f.store.db.prepare(
      "INSERT INTO atlas_landscape VALUES(?,?,?,?,?,?,?,?)",
    );
  f.store.db.transaction(() => {
    for (let i = 0; i < 520; i++) {
      const r = {
        id: "place" + i,
        revision: 1,
        kind: "place",
        name: "Ort " + i,
        points: [{ x: 20 + (i % 25) * 30, y: 20 + Math.floor(i / 25) * 30 }],
        polygons: [],
        width: 0,
        resolution: 1,
        values: { description: "PRIVATE LANDSCAPE" },
      };
      const p = r.points[0];
      put.run(f.cam.id, r.id, 1, p.x, p.x, p.y, p.y, JSON.stringify(r));
    }
  })();
  let { result } = await f.read();
  assert.equal(result.landscape.coverage.mode, "raster");
  assert(
    result.landscape.labels.length > 100 &&
      result.landscape.labels.length <= 512,
  );
  assert(!JSON.stringify(result).includes("PRIVATE LANDSCAPE"));
  const id = result.landscape.labels[0].id.slice("landscape:".length);
  f.store.db.prepare("DELETE FROM atlas_landscape WHERE id=?").run(id);
  ({ result } = await f.read());
  assert(!result.landscape.labels.some((l) => l.id === "landscape:" + id));
});
