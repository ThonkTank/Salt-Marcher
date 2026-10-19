import { test } from "node:test";
import assert from "node:assert/strict";
import { buildSync } from "esbuild";
import { createRequire } from "node:module";
import { mkdtempSync, rmSync } from "node:fs";
import { tmpdir } from "node:os";
buildSync({
  stdin: {
    contents:
      "export {CampaignStore} from './src/app/storage/store';export {AtlasRegionReader} from './src/app/storage/atlas-region';export {newTerritory} from './src/app/atlas-territory';",
    resolveDir: process.cwd(),
  },
  outfile: ".build/landscape-paint-bounds.cjs",
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
    newTerritory,
  } = require("../.build/landscape-paint-bounds.cjs");
function fixture(t, scan = false) {
  const dir = mkdtempSync(tmpdir() + "/landscape-paint-"),
    store = new CampaignStore(dir + "/workbench.sqlite"),
    campaign = store.create("Benannte Region"),
    w = store.activateShell(campaign.id),
    sql = [],
    db = new Database(store.filename, {
      readonly: true,
      verbose: (s) => sql.push(s),
    });
  if (scan) {
    const exec = db.exec.bind(db);
    db.exec = (s) => {
      if (s.includes("CREATE VIRTUAL TABLE temp.landscape_region_index"))
        throw Error("rtree unavailable");
      return exec(s);
    };
  }
  const reader = new AtlasRegionReader(db);
  let cursor;
  t.after(() => {
    db.close();
    store.close();
    rmSync(dir, { recursive: true, force: true });
  });
  const put = (r) => {
    const ps = [...r.points, ...r.polygons.flatMap((p) => p.outer)],
      xs = ps.map((p) => p.x),
      ys = ps.map((p) => p.y),
      pad = r.kind === "place" ? 0 : r.width / 2;
    store.db
      .prepare("INSERT OR REPLACE INTO atlas_landscape VALUES(?,?,?,?,?,?,?,?)")
      .run(
        campaign.id,
        r.id,
        r.revision,
        Math.min(...xs) - pad,
        Math.max(...xs) + pad,
        Math.min(...ys) - pad,
        Math.max(...ys) + pad,
        JSON.stringify(r),
      );
  };
  const read = async (box) => {
    const source = store.atlasRegionSource(w.token, cursor);
    await reader.sync(source);
    cursor = { epoch: source.epoch, sequence: source.sequence };
    const q = {
      box,
      width: 512,
      height: 512,
      scopeId: "local",
      floorId: "ground",
      slice: null,
      roofs: true,
    };
    return { source, q, result: reader.read(source, q) };
  };
  return { store, campaign, w, db, sql, reader, put, read };
}
const place = (id, x, y, name = id) => ({
  id,
  revision: 1,
  kind: "place",
  name,
  points: [{ x, y }],
  polygons: [],
  resolution: 1,
  width: 0,
  values: { description: "PRIVATE AUTHOR TEXT" },
});
const territory = (id, x, y, name = id) => {
  const r = newTerritory(id);
  r.revision = 1;
  r.name = name;
  r.territory.notes = "PRIVATE AUTHOR TEXT";
  r.polygons = [
    {
      outer: [
        { x: x - 2, y: y - 2 },
        { x: x + 2, y: y - 2 },
        { x: x + 2, y: y + 2 },
        { x: x - 2, y: y + 2 },
      ],
      holes: [],
    },
  ];
  return r;
};
for (const scan of [false, true])
  test(
    "paint bounds keep region labels across tile edges without inventing exact hits" +
      (scan ? " (scan)" : ""),
    async (t) => {
      const f = fixture(t, scan);
      f.put(territory("left", 502, 250, "Falkenbrück"));
      f.put(territory("below", 800, 520, "Nebelkloster"));
      f.put(territory("far", 50000, 0));
      f.put(place("legacy", 700, 250));
      const first = await f.read({ x: 0, y: 0, width: 512, height: 512 }),
        right = await f.read({ x: 512, y: 0, width: 512, height: 512 });
      assert(first.result.landscape.territories.some((r) => r.id === "left"));
      assert(right.result.landscape.territories.some((r) => r.id === "left"));
      assert(right.result.landscape.territories.some((r) => r.id === "below"));
      assert(!right.result.landscape.territories.some((r) => r.id === "far"));
      assert(
        !JSON.stringify(right.result.landscape).includes("PRIVATE AUTHOR TEXT"),
      );
      assert(
        !right.result.landscape.records.some((r) => r.kind === "place"),
        "legacy markers do not reappear",
      );
      assert.equal(
        f.reader.candidatesAt(
          right.source,
          right.q,
          { x: 512, y: 235 },
          0,
          "landscape",
        ).total,
        0,
        "paint reach is not a new hit priority or geometry",
      );
      assert.equal(
        f.store.atlasLandscapeObject(f.w.token, "left").polygons[0].outer[0].x,
        500,
      );
      const scans = f.sql.filter((s) => s.includes("max(length(CAST")).length;
      await f.read({ x: 512, y: 512, width: 512, height: 512 });
      assert.equal(
        f.sql.filter((s) => s.includes("max(length(CAST")).length,
        scans,
        "camera reads reuse the name envelope",
      );
    },
  );
test("region renames and rotated labels grow paint reach; removal and source reset retire it", async (t) => {
  const f = fixture(t),
    p = territory("named", 700, 250, "A");
  f.put(p);
  const box = { x: 0, y: 0, width: 512, height: 512 };
  assert.equal((await f.read(box)).result.landscape.territories.length, 0);
  p.name = "Nebelkloster jenseits der Furt";
  f.put(p);
  let r = await f.read(box);
  assert.equal(r.result.landscape.territories[0].name, p.name);
  assert.equal(r.result.landscape.territories[0].polygons[0].outer[0].x, 698);
  const rotated = territory("rotated", 250, 700, p.name);
  rotated.territory.label.angle = 90;
  rotated.territory.label.size = 96;
  f.put(rotated);
  r = await f.read(box);
  assert(
    r.result.landscape.territories.some((r) => r.id === "rotated"),
    "long rotated names crossing the vertical boundary remain loaded",
  );
  f.store.db.prepare("DELETE FROM atlas_landscape").run();
  const removed = await f.read(box);
  assert.equal(removed.result.landscape.territories.length, 0);
  await f.reader.sync({ ...removed.source, reset: true });
  assert.equal(
    f.reader.read(removed.source, removed.q).landscape.territories.length,
    0,
  );
});
test("minimum display strokes cross canonical bounds and invalidate adjacent dense tiles", async (t) => {
  const f = fixture(t),
    road = (id, x, y) => ({
      ...place(id, x, y),
      kind: "road",
      points: [
        { x, y: y - 1 },
        { x, y: y + 1 },
      ],
      width: 0.1,
    }),
    line = {
      ...road("thin", 0, -0.75),
      points: [
        { x: 0, y: -0.75 },
        { x: 512, y: -0.75 },
      ],
    };
  f.put(line);
  assert(
    (
      await f.read({ x: 0, y: 0, width: 512, height: 512 })
    ).result.landscape.records.some((r) => r.id === "thin"),
  );
  f.store.db.prepare("DELETE FROM atlas_landscape").run();
  for (let i = 0; i < 501; i++) f.put(road("dense" + i, 100, 100));
  f.put(road("edge", -0.25, 200));
  let r = (await f.read({ x: 0, y: 0, width: 512, height: 512 })).result
    .landscape;
  assert.equal(r.coverage.mode, "raster");
  const image = () => {
    const tile = r.tiles.find((t) => t.box.x === 0 && t.box.y === 0);
    const p = require("pngjs").PNG.sync.read(
      Buffer.from(tile.data.split(",")[1], "base64"),
    );
    return [...p.data.slice(100 * p.width * 4, (100 * p.width + 3) * 4)];
  };
  const before = image();
  assert(before.some((v) => v !== 0));
  f.store.db.prepare("DELETE FROM atlas_landscape WHERE id=?").run("edge");
  r = (await f.read({ x: 0, y: 0, width: 512, height: 512 })).result.landscape;
  assert(
    image().every((v) => v === 0),
    "cached adjacent tile must lose the removed off-tile stroke",
  );
});
