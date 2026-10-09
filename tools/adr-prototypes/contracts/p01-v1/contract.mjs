import crypto from "node:crypto";

export const SCHEMA_VERSION = "p01-v1";

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

export function validateHandle(value) {
  assertObject(value, "mapHandle");
  if (value.schemaVersion !== SCHEMA_VERSION || typeof value.token !== "string" || value.token.length < 16 ||
      typeof value.mapId !== "string" || typeof value.revision !== "number" || !Number.isInteger(value.revision))
    throw new Error("invalid map handle");
  return Object.freeze({ ...value });
}

export function validateSnapshot(value) {
  assertObject(value, "snapshot");
  if (value.schemaVersion !== SCHEMA_VERSION || typeof value.mapId !== "string" ||
      typeof value.revision !== "number" || typeof value.digest !== "string" ||
      typeof value.document !== "object") throw new Error("invalid map snapshot");
  return Object.freeze({ ...value });
}

export function validateCommandResult(value) {
  assertObject(value, "command result");
  if (value.schemaVersion !== SCHEMA_VERSION || typeof value.ok !== "boolean" ||
      typeof value.revision !== "number" || typeof value.digest !== "string") throw new Error("invalid command result");
  return Object.freeze({ ...value });
}

export function validateAssetResult(value) {
  assertObject(value, "asset result");
  if (value.schemaVersion !== SCHEMA_VERSION || typeof value.assetId !== "string" ||
      typeof value.hash !== "string" || typeof value.bytes !== "number" || !Number.isInteger(value.bytes) ||
      typeof value.data !== "string") throw new Error("invalid asset result");
  return Object.freeze({ ...value });
}

export function validateInvalidation(value) {
  assertObject(value, "invalidation");
  if (value.schemaVersion !== SCHEMA_VERSION || typeof value.mapId !== "string" ||
      typeof value.revision !== "number" || typeof value.digest !== "string") throw new Error("invalid invalidation");
  return Object.freeze({ ...value });
}

export function receiptRecord(fields) {
  return Object.freeze({ schemaVersion: SCHEMA_VERSION, ...fields });
}
