import { test } from "node:test";
import assert from "node:assert/strict";
import { buildSync } from "esbuild";
import { createRequire } from "node:module";
import { mkdtempSync, mkdirSync, rmSync } from "node:fs";
import { homedir } from "node:os";
buildSync({
  stdin: {
    contents:
      "export * from './tools/atlas-benchmark/scene';export * from './tools/atlas-benchmark/seed';export {CampaignStore} from './src/app/storage/store';export {TerrainSampler,decodeHeights} from './src/app/terrain-height';",
    resolveDir: process.cwd(),
  },
  outfile: ".build/atlas-benchmark-test.cjs",
  bundle: true,
  platform: "node",
  format: "cjs",
  external: ["better-sqlite3"],
});
const {
  landscape,
  elevation,
  anchors,
  buildings,
  seedBenchmark,
  CampaignStore,
  TerrainSampler,
  decodeHeights,
} = createRequire(import.meta.url)("../.build/atlas-benchmark-test.cjs");

test("benchmark terrain contains sea, island, mountains and consistent nested detail", () => {
  const records = landscape(),
    sampler = new TerrainSampler(records);
  assert.deepEqual(records, landscape());
  assert.equal(new Set(records.map((r) => r.id)).size, records.length);
  assert(sampler.sample({ x: 15000, y: -12000 }).heightM < 0);
  assert(sampler.sample({ x: 13000, y: 3500 }).heightM > 0);
  assert(sampler.sample(anchors.mountain).heightM > 1000);
  assert(sampler.sample(anchors.village).heightM > 0);
  for (const record of records.filter((r) => r.height)) {
    const tile = record.height,
      values = decodeHeights(tile);
    for (const [x, y] of [
      [0, 0],
      [63, 63],
      [17, 31],
    ])
      assert(
        Math.abs(
          values[y * 64 + x] -
            elevation(tile.x + x * tile.pixel, tile.y + y * tile.pixel),
        ) < 0.001,
      );
  }
  assert.equal(sampler.sample(anchors.village).resolutionM, 2);
  const river = records.find((r) => r.id === "bench:river").points;
  const heights = river.map((p) => sampler.sample(p).heightM);
  assert(heights[0] > 0 && heights.at(-1) < 0, "spring connects to the sea");
  assert(
    heights.every((h, i) => i === 0 || h < heights[i - 1]),
    "river must not flow uphill",
  );
  assert.equal(buildings(5000).length, 5000);
  assert.throws(() => buildings(5001));
});

test("benchmark road leaves room for tavern walls and connects to its north entrance", () => {
  const road = landscape().find((r) => r.id === "bench:road");
  const tavern = anchors.village;
  // For each line segment, compare at every crossing of the footprint's x bounds.
  // The authored road is monotonic in x; its full stroke must stay north of the house.
  for (let i = 1; i < road.points.length; i++) {
    const a = road.points[i - 1],
      b = road.points[i];
    for (const x of [
      tavern.x - 8 - road.width / 2,
      tavern.x + 8 + road.width / 2,
    ]) {
      if (x < a.x || x > b.x) continue;
      const y = a.y + ((b.y - a.y) * (x - a.x)) / (b.x - a.x);
      assert(
        y + road.width / 2 < tavern.y - 9,
        "road overlaps tavern footprint",
      );
    }
  }
  const path = landscape().find((r) => r.id === "bench:entrance-path");
  assert.deepEqual(path.points.at(-1), { x: tavern.x, y: tavern.y - 9 });
  assert(
    road.points.some(
      (p) => p.x === path.points[0].x && p.y === path.points[0].y,
    ),
  );
});

test("canonical benchmark survives reopen with hierarchy, furnished floors and editable geometry", (t) => {
  const parent = homedir() + "/.cache/saltmarcher/atlas-benchmark-tests";
  mkdirSync(parent, { recursive: true });
  const dir = mkdtempSync(parent + "/run-");
  let store = new CampaignStore(dir + "/workbench.sqlite");
  t.after(() => {
    store.close();
    rmSync(dir, { recursive: true, force: true });
  });
  const manifest = seedBenchmark(store);
  let workspace = store.activate(manifest.campaignId),
    atlas = store.campaignAtlas(workspace.token);
  const before = atlas.workspace.rooms.map((r) => ({
    id: r.id,
    polygons: r.polygons,
    scopeId: r.scopeId,
    floorId: r.floorId,
  }));
  assert.equal(
    atlas.cities[0].units.filter((u) => u.kind === "building").length,
    36,
  );
  assert(atlas.geometry.drawing.elements.some((e) => e.kind === "object"));
  const village = atlas.workspace.rooms.filter(
    (r) => r.scopeId === manifest.villageId,
  );
  assert(new Set(village.map((r) => r.floorId)).size >= 3);
  assert(atlas.workspace.rooms.some((r) => r.scopeId === manifest.dungeonId));
  const regions = store.atlasTerritories(workspace.token).territories;
  assert.equal(
    regions.find((r) => r.id === "bench:ward").parentId,
    "bench:region",
  );
  assert.equal(
    regions.find((r) => r.id === "bench:region").parentId,
    "bench:realm",
  );
  const road = store.atlasLandscapeObject(workspace.token, "bench:road");
  const room = village[0],
    commandId = "benchmark-edit-room";
  store.executeAtlasCommit({
    commandId,
    token: workspace.token,
    campaignId: manifest.campaignId,
    action: {
      kind: "room-edit",
      edit: {
        commandId,
        token: workspace.token,
        campaignId: manifest.campaignId,
        roomId: room.id,
        expectedRevision: room.revision,
        name: "Geprüfter Raum",
        sections: room.sections,
        polygons: room.polygons,
      },
    },
  });
  assert.equal(
    store
      .campaignAtlas(workspace.token)
      .workspace.rooms.find((r) => r.id === room.id).name,
    "Geprüfter Raum",
  );
  store.executeAtlasCommit({
    commandId: "benchmark-undo",
    token: workspace.token,
    campaignId: manifest.campaignId,
    action: { kind: "undo" },
  });
  assert.equal(
    store
      .campaignAtlas(workspace.token)
      .workspace.rooms.find((r) => r.id === room.id).name,
    room.name,
  );
  store.close();
  store = new CampaignStore(dir + "/workbench.sqlite");
  workspace = store.activate(manifest.campaignId);
  atlas = store.campaignAtlas(workspace.token);
  assert.deepEqual(
    atlas.workspace.rooms.map((r) => ({
      id: r.id,
      polygons: r.polygons,
      scopeId: r.scopeId,
      floorId: r.floorId,
    })),
    before,
  );
  assert.deepEqual(
    store.atlasLandscapeObject(workspace.token, "bench:road"),
    road,
  );
  assert.deepEqual(
    store.atlasTerritories(workspace.token).territories,
    regions,
  );
});
