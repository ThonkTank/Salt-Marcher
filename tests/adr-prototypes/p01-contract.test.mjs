import assert from "node:assert/strict";
import test from "node:test";
import {
  SCHEMA_VERSION, validateHandle, validateInvalidation, validateRequest, validateResponse,
} from "../../tools/adr-prototypes/contracts/p01-v2/contract.mjs";

const token = "a".repeat(24);
test("p01-v2 permits only fixed bounded operations", () => {
  const request = validateRequest({ schemaVersion: SCHEMA_VERSION, operation: "openMap", requestId: token,
    payload: { mapId: "fixture", expectedRevision: 0 } });
  assert.equal(request.operation, "openMap");
  assert.throws(() => validateRequest({ ...request, operation: "send" }));
  assert.throws(() => validateRequest({ ...request, channel: "anything" }));
});
test("p01-v2 rejects handle and response privilege smuggling", () => {
  assert.throws(() => validateHandle({ schemaVersion: SCHEMA_VERSION, token, mapId: "m", revision: 0, path: "/tmp" }));
  assert.throws(() => validateResponse({ schemaVersion: SCHEMA_VERSION, requestId: token, ok: true,
    result: {}, error: "surprise" }));
  assert.throws(() => validateInvalidation({ schemaVersion: SCHEMA_VERSION, subscriptionId: token,
    mapId: "m", revision: 1, digest: "x", pathname: "/tmp" }));
});
