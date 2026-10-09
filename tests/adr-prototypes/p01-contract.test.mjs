import assert from "node:assert/strict";
import test from "node:test";
import {
  OPERATIONS,
  SCHEMA_VERSION,
  validateHandle,
  validateInvalidation,
  validateRequest,
  validateResponse,
} from "../../tools/adr-prototypes/contracts/p01-v2/contract.mjs";
import { digest } from "../../tools/adr-prototypes/contracts/p01-v2/node.mjs";

const token = "a".repeat(24);
const hash = "b".repeat(64);
const handle = Object.freeze({ schemaVersion: SCHEMA_VERSION, token, mapId: "fixture", revision: 0 });

test("p01-v2 browser contract has no Node import and permits only five fixed operations", async () => {
  assert.deepEqual(OPERATIONS, ["openMap", "executeMapCommand", "saveMap", "readAsset", "subscribeMapInvalidation"]);
  const source = await import("node:fs/promises").then((fs) =>
    fs.readFile(new URL("../../tools/adr-prototypes/contracts/p01-v2/contract.mjs", import.meta.url), "utf8"));
  assert.doesNotMatch(source, /node:|\bBuffer\b|\brequire\s*\(/);
  const request = validateRequest({ schemaVersion: SCHEMA_VERSION, operation: "openMap", requestId: token,
    payload: { mapId: "fixture", expectedRevision: 0 } });
  assert.equal(request.operation, "openMap");
  assert.ok(Object.isFrozen(request.payload));
  assert.throws(() => validateRequest({ ...request, operation: "send" }));
  assert.throws(() => validateRequest({ ...request, channel: "anything" }));
});

test("p01-v2 validates every operation payload and rejects privilege smuggling", () => {
  assert.doesNotThrow(() => validateRequest({ schemaVersion: SCHEMA_VERSION,
    operation: "executeMapCommand", requestId: token, payload: { mapHandle: handle,
      expectedRevision: 0, command: { kind: "moveEntity", entityId: "object", dx: 1, dy: 2 } } }));
  assert.doesNotThrow(() => validateRequest({ schemaVersion: SCHEMA_VERSION,
    operation: "executeMapCommand", requestId: token, payload: { mapHandle: handle,
      expectedRevision: 1, command: { kind: "undo" } } }));
  assert.doesNotThrow(() => validateRequest({ schemaVersion: SCHEMA_VERSION,
    operation: "executeMapCommand", requestId: token, payload: { mapHandle: handle,
      expectedRevision: 2, command: { kind: "redo" } } }));
  assert.doesNotThrow(() => validateRequest({ schemaVersion: SCHEMA_VERSION,
    operation: "saveMap", requestId: token, payload: { mapHandle: handle, expectedRevision: 0 } }));
  assert.doesNotThrow(() => validateRequest({ schemaVersion: SCHEMA_VERSION,
    operation: "readAsset", requestId: token, payload: { mapHandle: handle, assetId: "asset", expectedHash: hash } }));
  assert.doesNotThrow(() => validateRequest({ schemaVersion: SCHEMA_VERSION,
    operation: "subscribeMapInvalidation", requestId: token, payload: { mapHandle: handle, revision: 0 } }));
  assert.throws(() => validateRequest({ schemaVersion: SCHEMA_VERSION,
    operation: "openMap", requestId: token, payload: { mapId: "fixture", expectedRevision: 0, path: "/tmp" } }));
  assert.throws(() => validateHandle({ ...handle, path: "/tmp" }));
  assert.throws(() => validateRequest({ schemaVersion: SCHEMA_VERSION,
    operation: "executeMapCommand", requestId: token, payload: { mapHandle: handle,
      expectedRevision: 0, command: { kind: "undo", extra: true } } }));
});

test("p01-v2 responses and invalidations are exact, bounded and deeply immutable", () => {
  const response = validateResponse({ schemaVersion: SCHEMA_VERSION, operation: "openMap", requestId: token,
    ok: true, result: { handle, snapshot: { schemaVersion: SCHEMA_VERSION, mapId: "fixture",
      revision: 0, digest: hash, document: { format: "dungeon-map", nested: { value: 1 } } } } });
  assert.ok(Object.isFrozen(response.result.snapshot.document.nested));
  assert.throws(() => validateResponse({ ...response, error: "surprise" }));
  assert.throws(() => validateInvalidation({ schemaVersion: SCHEMA_VERSION, subscriptionId: token,
    mapId: "m", revision: 1, digest: hash, pathname: "/tmp" }));
  assert.equal(digest({ b: 2, a: 1 }), digest({ a: 1, b: 2 }));
});
