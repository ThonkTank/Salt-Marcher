import assert from "node:assert/strict";
import test from "node:test";
import { PassiveProjectionChannel } from "../../tools/adr-prototypes/p03/channel.mjs";

test("P03 focus publishes blank first and stale A/B/A replies never replace the newest generation", async (t) => {
  const channel = new PassiveProjectionChannel();
  t.after(() => channel.close());
  const observed = [];
  channel.subscribe("passive-display", (value) =>
    observed.push(`${value.generation}:${value.state}:${value.sceneId}`),
  );
  const first = channel.focus({
    sceneId: "scene_a",
    knowledgePercent: 0,
    delayMs: 10,
  });
  assert.equal(channel.readProjection("passive-display").state, "blank");
  assert.equal(await first, true);
  const stale = channel.focus({
    sceneId: "scene_b",
    knowledgePercent: 50,
    delayMs: 60,
  });
  const current = channel.focus({
    sceneId: "scene_a",
    knowledgePercent: 100,
    delayMs: 5,
  });
  assert.equal(await current, true);
  assert.equal(await stale, false);
  assert.deepEqual(observed, [
    "1:blank:scene_a",
    "1:ready:scene_a",
    "2:blank:scene_b",
    "3:blank:scene_a",
    "3:ready:scene_a",
  ]);
  assert.equal(
    channel.readProjection("passive-display").releasedMarkers.length,
    3,
  );
});

test("P03 errors expose only a neutral empty code and role denial precedes all reads", async (t) => {
  const channel = new PassiveProjectionChannel();
  t.after(() => channel.close());
  await channel.focus({
    sceneId: "scene_a",
    knowledgePercent: 100,
    failure: "private filesystem detail",
  });
  assert.deepEqual(channel.readProjection("passive-display"), {
    schemaVersion: "p03-v1",
    sceneId: "scene_a",
    generation: 1,
    state: "error",
    map: null,
    releasedMarkers: [],
    releasedImage: null,
    statusCode: "PROJECTION_UNAVAILABLE",
  });
  assert.throws(() => channel.readProjection("gm"), /ROLE_DENIED/);
  assert.throws(() => channel.readCoreStatus("unknown"), /ROLE_DENIED/);
  assert.throws(() => channel.subscribe("gm", null), /ROLE_DENIED/);
});
