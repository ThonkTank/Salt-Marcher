import crypto from "node:crypto";

export const SCHEMA_VERSION = "p01-v2";
export const MAX_COMMAND_BYTES = 16 * 1024;
export const MAX_ASSET_BYTES = 8 * 1024 * 1024;
export const OPERATIONS = Object.freeze([
  "openMap", "executeMapCommand", "saveMap", "readAsset", "subscribeMapInvalidation",
]);

export function canonical(value) {
  if (value === null || typeof value !== "object") return JSON.stringify(value);
  if (Array.isArray(value)) return `[${value.map(canonical).join(",")}]`;
  return `{${Object.keys(value).sort().map((key) => `${JSON.stringify(key)}:${canonical(value[key])}`).join(",")}}`;
}

export function digest(value) {
  return crypto.createHash("sha256").update(canonical(value)).digest("hex");
}

export function assertObject(value, name) {
  if (!value || typeof value !== "object" || Array.isArray(value)) throw new Error(`${name} must be an object`);
  return value;
}

function positiveInteger(value, name) {
  if (!Number.isSafeInteger(value) || value < 0) throw new Error(`${name} must be a non-negative safe integer`);
  return value;
}

function opaqueToken(value, name) {
  if (typeof value !== "string" || !/^[A-Za-z0-9_-]{24,256}$/.test(value))
    throw new Error(`${name} must be an opaque token`);
  return value;
}

function exactKeys(value, allowed, name) {
  for (const key of Object.keys(value)) if (!allowed.includes(key)) throw new Error(`${name} has unexpected key ${key}`);
}

export function validateRequest(value) {
  assertObject(value, "request");
  exactKeys(value, ["schemaVersion", "operation", "requestId", "payload"], "request");
  if (value.schemaVersion !== SCHEMA_VERSION || !OPERATIONS.includes(value.operation))
    throw new Error("unsupported request");
  opaqueToken(value.requestId, "requestId");
  assertObject(value.payload, "request payload");
  const serialized = canonical(value.payload);
  if (Buffer.byteLength(serialized) > MAX_COMMAND_BYTES) throw new Error("request payload exceeds limit");
  return Object.freeze({ schemaVersion: SCHEMA_VERSION, operation: value.operation, requestId: value.requestId,
    payload: Object.freeze({ ...value.payload }) });
}

export function validateHandle(value) {
  assertObject(value, "map handle");
  exactKeys(value, ["schemaVersion", "token", "mapId", "revision"], "map handle");
  if (value.schemaVersion !== SCHEMA_VERSION || typeof value.mapId !== "string") throw new Error("invalid map handle");
  opaqueToken(value.token, "map handle token");
  positiveInteger(value.revision, "map handle revision");
  return Object.freeze({ ...value });
}

export function validateResponse(value) {
  assertObject(value, "response");
  exactKeys(value, ["schemaVersion", "requestId", "ok", "result", "error"], "response");
  if (value.schemaVersion !== SCHEMA_VERSION || typeof value.ok !== "boolean") throw new Error("invalid response");
  opaqueToken(value.requestId, "response requestId");
  if (value.ok && value.error !== undefined) throw new Error("successful response has error");
  if (!value.ok && (typeof value.error !== "string" || !value.error)) throw new Error("failed response has no bounded error");
  const serialized = canonical(value.result ?? null);
  if (Buffer.byteLength(serialized) > MAX_ASSET_BYTES) throw new Error("response exceeds limit");
  return Object.freeze({ ...value, result: value.result === undefined ? undefined : Object.freeze({ ...value.result }) });
}

export function validateInvalidation(value) {
  assertObject(value, "invalidation");
  exactKeys(value, ["schemaVersion", "subscriptionId", "mapId", "revision", "digest"], "invalidation");
  if (value.schemaVersion !== SCHEMA_VERSION || typeof value.mapId !== "string" ||
    typeof value.digest !== "string") throw new Error("invalid invalidation");
  opaqueToken(value.subscriptionId, "subscriptionId");
  positiveInteger(value.revision, "invalidation revision");
  return Object.freeze({ ...value });
}

export function receiptRecord(fields) {
  return Object.freeze({ schemaVersion: SCHEMA_VERSION, ...fields });
}
