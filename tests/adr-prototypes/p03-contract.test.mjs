import assert from "node:assert/strict";
import test from "node:test";
import {
  SCHEMA_VERSION,
  statusFor,
  validateProjection,
} from "../../tools/adr-prototypes/contracts/p03-v1/contract.mjs";
import {
  PRIVATE_IDENTITIES,
  PRIVATE_STRING_CANARIES,
  releasedFixture,
} from "../../tools/adr-prototypes/p03/fixture.mjs";

const projection = (knowledgePercent = 50) => ({
  schemaVersion: SCHEMA_VERSION,
  sceneId: "scene_a",
  generation: 4,
  state: "ready",
  ...releasedFixture("scene_a", knowledgePercent),
  statusCode: "READY",
});

test("P03 projection is exact, immutable and contains only released fields", () => {
  const source = projection(),
    value = validateProjection(source);
  assert.ok(Object.isFrozen(value));
  assert.ok(Object.isFrozen(value.map));
  assert.ok(Object.isFrozen(value.releasedMarkers));
  source.map.label = "caller mutation";
  assert.equal(value.map.label, "Harbor approach");
  const bytes = JSON.stringify(value);
  for (const forbidden of [
    ...PRIVATE_STRING_CANARIES,
    ...PRIVATE_IDENTITIES,
    "knownAt",
  ]) {
    assert.equal(bytes.includes(forbidden), false, forbidden);
  }
});

test("P03 rejects extra private fields and nonempty fail-closed states", () => {
  const valid = projection();
  assert.throws(
    () => validateProjection({ ...valid, privateNote: "secret" }),
    /invalid shape/,
  );
  assert.throws(
    () =>
      validateProjection({
        ...valid,
        map: { ...valid.map, privatePath: "/secret" },
      }),
    /invalid shape/,
  );
  assert.throws(
    () =>
      validateProjection({ ...valid, state: "blank", statusCode: "LOADING" }),
    /must be empty/,
  );
  assert.throws(
    () =>
      validateProjection({
        ...valid,
        releasedMarkers: [...valid.releasedMarkers, valid.releasedMarkers[0]],
      }),
    /unique/,
  );
});

test("P03 status is a minimal immutable projection of current state", () => {
  assert.deepEqual(statusFor(projection()), {
    schemaVersion: SCHEMA_VERSION,
    sceneId: "scene_a",
    generation: 4,
    state: "ready",
  });
});
