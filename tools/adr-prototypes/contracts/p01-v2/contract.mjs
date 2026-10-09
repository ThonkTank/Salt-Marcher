export const SCHEMA_VERSION = "p01-v2";
export const MAX_COMMAND_BYTES = 16 * 1024;
export const MAX_RESPONSE_BYTES = 8 * 1024 * 1024;
export const OPERATIONS = Object.freeze([
  "openMap",
  "executeMapCommand",
  "saveMap",
  "readAsset",
  "subscribeMapInvalidation",
]);

const encoder = new TextEncoder();

export function canonical(value) {
  if (value === null || typeof value !== "object") return JSON.stringify(value);
  if (Array.isArray(value)) return `[${value.map(canonical).join(",")}]`;
  return `{${Object.keys(value).sort().map((key) =>
    `${JSON.stringify(key)}:${canonical(value[key])}`).join(",")}}`;
}

export function deepFreeze(value) {
  if (!value || typeof value !== "object" || Object.isFrozen(value)) return value;
  for (const child of Object.values(value)) deepFreeze(child);
  return Object.freeze(value);
}

export function assertObject(value, name) {
  if (!value || typeof value !== "object" || Array.isArray(value))
    throw new Error(`${name} must be an object`);
  return value;
}

function exactKeys(value, allowed, name) {
  for (const key of Object.keys(value))
    if (!allowed.includes(key)) throw new Error(`${name} has unexpected key ${key}`);
  for (const key of allowed)
    if (!(key in value)) throw new Error(`${name} is missing ${key}`);
}

function exactOptionalKeys(value, required, optional, name) {
  for (const key of Object.keys(value))
    if (![...required, ...optional].includes(key))
      throw new Error(`${name} has unexpected key ${key}`);
  for (const key of required)
    if (!(key in value)) throw new Error(`${name} is missing ${key}`);
}

function nonNegativeInteger(value, name) {
  if (!Number.isSafeInteger(value) || value < 0)
    throw new Error(`${name} must be a non-negative safe integer`);
}

function boundedString(value, name, maximum = 256) {
  if (typeof value !== "string" || !value || value.length > maximum || /[\x00-\x1f]/.test(value))
    throw new Error(`${name} must be a bounded string`);
}

function opaqueToken(value, name) {
  if (typeof value !== "string" || !/^[A-Za-z0-9_-]{24,256}$/.test(value))
    throw new Error(`${name} must be an opaque token`);
}

function digestString(value, name) {
  if (typeof value !== "string" || !/^[a-f0-9]{64}$/.test(value))
    throw new Error(`${name} must be a SHA-256 digest`);
}

function finiteDelta(value, name) {
  if (typeof value !== "number" || !Number.isFinite(value) || Math.abs(value) > 10_000)
    throw new Error(`${name} must be a bounded finite number`);
}

export function validateHandle(value) {
  assertObject(value, "map handle");
  exactKeys(value, ["schemaVersion", "token", "mapId", "revision"], "map handle");
  if (value.schemaVersion !== SCHEMA_VERSION) throw new Error("invalid map handle version");
  opaqueToken(value.token, "map handle token");
  boundedString(value.mapId, "mapId", 128);
  nonNegativeInteger(value.revision, "map handle revision");
  return deepFreeze(structuredClone(value));
}

function validateCommand(value) {
  assertObject(value, "map command");
  if (value.kind === "moveEntity") {
    exactKeys(value, ["kind", "entityId", "dx", "dy"], "map command");
    boundedString(value.entityId, "entityId", 128);
    finiteDelta(value.dx, "dx");
    finiteDelta(value.dy, "dy");
  } else if (value.kind === "undo" || value.kind === "redo") {
    exactKeys(value, ["kind"], "map command");
  } else throw new Error("unsupported map command");
}

function validatePayload(operation, value) {
  assertObject(value, `${operation} payload`);
  if (operation === "openMap") {
    exactKeys(value, ["mapId", "expectedRevision"], "openMap payload");
    boundedString(value.mapId, "mapId", 128);
    nonNegativeInteger(value.expectedRevision, "expectedRevision");
  } else if (operation === "executeMapCommand") {
    exactKeys(value, ["mapHandle", "expectedRevision", "command"], "executeMapCommand payload");
    validateHandle(value.mapHandle);
    nonNegativeInteger(value.expectedRevision, "expectedRevision");
    validateCommand(value.command);
  } else if (operation === "saveMap") {
    exactKeys(value, ["mapHandle", "expectedRevision"], "saveMap payload");
    validateHandle(value.mapHandle);
    nonNegativeInteger(value.expectedRevision, "expectedRevision");
  } else if (operation === "readAsset") {
    exactKeys(value, ["mapHandle", "assetId", "expectedHash"], "readAsset payload");
    validateHandle(value.mapHandle);
    boundedString(value.assetId, "assetId", 128);
    digestString(value.expectedHash, "expectedHash");
  } else if (operation === "subscribeMapInvalidation") {
    exactKeys(value, ["mapHandle", "revision"], "subscribeMapInvalidation payload");
    validateHandle(value.mapHandle);
    nonNegativeInteger(value.revision, "revision");
  } else throw new Error("unsupported request operation");
}

export function validateRequest(value) {
  assertObject(value, "request");
  exactKeys(value, ["schemaVersion", "operation", "requestId", "payload"], "request");
  if (value.schemaVersion !== SCHEMA_VERSION || !OPERATIONS.includes(value.operation))
    throw new Error("unsupported request");
  opaqueToken(value.requestId, "requestId");
  validatePayload(value.operation, value.payload);
  if (encoder.encode(canonical(value.payload)).byteLength > MAX_COMMAND_BYTES)
    throw new Error("request payload exceeds limit");
  return deepFreeze(structuredClone(value));
}

function validateSnapshot(value) {
  assertObject(value, "snapshot");
  exactKeys(value, ["schemaVersion", "mapId", "revision", "digest", "document"], "snapshot");
  if (value.schemaVersion !== SCHEMA_VERSION) throw new Error("invalid snapshot version");
  boundedString(value.mapId, "snapshot mapId", 128);
  nonNegativeInteger(value.revision, "snapshot revision");
  digestString(value.digest, "snapshot digest");
  assertObject(value.document, "snapshot document");
}

function validateCommandResult(value) {
  assertObject(value, "command result");
  exactKeys(value, ["schemaVersion", "revision", "digest"], "command result");
  if (value.schemaVersion !== SCHEMA_VERSION) throw new Error("invalid command result version");
  nonNegativeInteger(value.revision, "command result revision");
  digestString(value.digest, "command result digest");
}

function validateResult(operation, value) {
  assertObject(value, `${operation} result`);
  if (operation === "openMap") {
    exactKeys(value, ["handle", "snapshot"], "openMap result");
    validateHandle(value.handle);
    validateSnapshot(value.snapshot);
  } else if (operation === "executeMapCommand" || operation === "saveMap") {
    validateCommandResult(value);
  } else if (operation === "readAsset") {
    exactKeys(value, ["schemaVersion", "assetId", "hash", "data"], "readAsset result");
    if (value.schemaVersion !== SCHEMA_VERSION) throw new Error("invalid asset result version");
    boundedString(value.assetId, "assetId", 128);
    digestString(value.hash, "asset hash");
    if (typeof value.data !== "string") throw new Error("asset data must be a string");
  } else if (operation === "subscribeMapInvalidation") {
    exactKeys(value, ["subscriptionId"], "subscription result");
    opaqueToken(value.subscriptionId, "subscriptionId");
  } else throw new Error("unsupported response operation");
}

export function validateResponse(value) {
  assertObject(value, "response");
  exactOptionalKeys(value,
    ["schemaVersion", "operation", "requestId", "ok"], ["result", "error"], "response");
  if (value.schemaVersion !== SCHEMA_VERSION || !OPERATIONS.includes(value.operation) ||
      typeof value.ok !== "boolean") throw new Error("invalid response");
  opaqueToken(value.requestId, "response requestId");
  if (value.ok) {
    if (value.error !== undefined || value.result === undefined)
      throw new Error("successful response shape is invalid");
    validateResult(value.operation, value.result);
  } else if (value.result !== undefined || typeof value.error !== "string" ||
      !value.error || value.error.length > 512) {
    throw new Error("failed response shape is invalid");
  }
  if (encoder.encode(canonical(value.result ?? null)).byteLength > MAX_RESPONSE_BYTES)
    throw new Error("response exceeds limit");
  return deepFreeze(structuredClone(value));
}

export function validateInvalidation(value) {
  assertObject(value, "invalidation");
  exactKeys(value, ["schemaVersion", "subscriptionId", "mapId", "revision", "digest"], "invalidation");
  if (value.schemaVersion !== SCHEMA_VERSION) throw new Error("invalid invalidation version");
  opaqueToken(value.subscriptionId, "subscriptionId");
  boundedString(value.mapId, "invalidation mapId", 128);
  nonNegativeInteger(value.revision, "invalidation revision");
  digestString(value.digest, "invalidation digest");
  return deepFreeze(structuredClone(value));
}
