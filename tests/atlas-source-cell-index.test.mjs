import { test } from "node:test";
import assert from "node:assert/strict";
import { buildSync } from "esbuild";
import { createRequire } from "node:module";
import { mkdirSync, mkdtempSync, rmSync } from "node:fs";
import { homedir } from "node:os";
import { randomUUID } from "node:crypto";
const require = createRequire(import.meta.url);
buildSync({
  stdin: {
    contents: "export {CampaignStore} from './src/app/storage/store';",
    resolveDir: process.cwd(),
  },
  outfile: ".build/atlas-source-cell-index.cjs",
  bundle: true,
  platform: "node",
  format: "cjs",
  external: ["better-sqlite3"],
});
const { CampaignStore } = require("../.build/atlas-source-cell-index.cjs");
// The exact lookup used by writeCellLandscape; every key must remain indexed.
const lookup =
  "SELECT id,revision FROM atlas_landscape WHERE campaign_id=? AND json_extract(payload,'$.sourceCell.mapId')=? AND json_extract(payload,'$.sourceCell.level')=? AND json_extract(payload,'$.sourceCell.q')=? AND json_extract(payload,'$.sourceCell.r')=?";
test("source-cell index backfills an existing database and follows canonical updates, deletes and reopen", (t) => {
  const root = homedir() + "/.cache/saltmarcher/tests";
  mkdirSync(root, { recursive: true });
  const dir = mkdtempSync(root + "/source-cell-");
  let store = new CampaignStore(dir + "/world.sqlite");
  const campaign = store.create("Cell index");
  let active = store.activate(campaign.id);
  t.after(() => {
    store.close();
    rmSync(dir, { recursive: true, force: true });
  });
  const write = (action) =>
    store.executeWorld({
      commandId: randomUUID(),
      campaignId: campaign.id,
      token: active.token,
      action,
    });
  const reopen = () => {
    store.close();
    store = new CampaignStore(dir + "/world.sqlite");
    active = store.activate(campaign.id);
  };
  let map = store.world(active.token).maps[0];
  store.db.exec("DROP INDEX landscape_source_cell");
  const cells = Array.from({ length: 24 }, (_, i) => ({
    q: (i % 8) - 4,
    r: Math.floor(i / 8) - 2,
    level: 0,
    terrain: "forest",
    elevationM: 12,
    climate: null,
    road: false,
    river: false,
    label: "",
    faction: "",
    interrupt: "",
  }));
  write({
    kind: "map",
    map: { ...map, cells },
    expectedRevision: map.revision,
  });
  const cell = cells[0],
    args = [campaign.id, map.id, cell.level, cell.q, cell.r],
    before = store.db.prepare(lookup).get(...args);
  assert(before);
  reopen();
  assert.deepEqual(store.db.prepare(lookup).get(...args), before);
  const plan = store.db
    .prepare("EXPLAIN QUERY PLAN " + lookup)
    .all(...args)
    .map((row) => row.detail)
    .join("\n");
  assert.match(plan, /USING INDEX landscape_source_cell/);
  assert.match(
    plan,
    /campaign_id=\? AND <expr>=\? AND <expr>=\? AND <expr>=\? AND <expr>=\?/,
  );
  map = store.world(active.token).maps[0];
  write({
    kind: "cell",
    mapId: map.id,
    cell: { ...cell, terrain: "plains" },
    expectedRevision: map.revision,
  });
  const updated = store.db.prepare(lookup).all(...args);
  assert.equal(updated.length, 1);
  assert.equal(updated[0].id, before.id);
  assert(updated[0].revision > before.revision);
  const payload = JSON.parse(
    store.db
      .prepare(
        "SELECT payload FROM atlas_landscape WHERE campaign_id=? AND id=?",
      )
      .get(campaign.id, before.id).payload,
  );
  assert.equal(payload.values.terrain, "plains");
  assert.equal(
    store.db.prepare(lookup).get("different-campaign", ...args.slice(1)),
    undefined,
  );
  reopen();
  assert.deepEqual(store.db.prepare(lookup).all(...args), updated);
  map = store.world(active.token).maps[0];
  write({
    kind: "map",
    map: { ...map, cells: [] },
    expectedRevision: map.revision,
  });
  assert.equal(store.db.prepare(lookup).get(...args), undefined);
  reopen();
  assert.equal(store.db.prepare(lookup).get(...args), undefined);
});
