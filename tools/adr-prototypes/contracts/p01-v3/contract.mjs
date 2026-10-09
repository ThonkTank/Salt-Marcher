import { createHash } from "node:crypto";

export const SCHEMA_VERSION = "p01-v3";
export const MAX_BYTES = 8 * 1024 * 1024;
export const MAX_ORPHANS = 16;
export const TARGET_IDS = Object.freeze(["draft", "journal", "map", "note"]);
export const CHILD_STATES = Object.freeze([
  "prepared", "temp-synced", "before-snapshotted", "ready-to-capture",
  "old-captured", "new-published", "deleted", "committed", "rolling-back",
  "rollback-captured", "rollback-published", "rolled-back",
  "conflict-before-capture", "conflict",
]);
export const PARENT_STATES = Object.freeze([
  "prepared", "children-committed", "committed", "rolling-back", "rolled-back", "conflict",
]);

const encoder = new TextEncoder();
const sha256 = (value) => createHash("sha256").update(value).digest("hex");
const freeze = (value) => {
  if (value && typeof value === "object" && !Object.isFrozen(value)) {
    for (const child of Object.values(value)) freeze(child);
    Object.freeze(value);
  }
  return value;
};

export function canonical(value) {
  if (value === null || typeof value !== "object") return JSON.stringify(value);
  if (Array.isArray(value)) return `[${value.map(canonical).join(",")}]`;
  return `{${Object.keys(value).sort().map((key) =>
    `${JSON.stringify(key)}:${canonical(value[key])}`).join(",")}}`;
}

function exact(value, keys, name) {
  if (!value || typeof value !== "object" || Array.isArray(value) ||
      Object.keys(value).length !== keys.length || keys.some((key) => !(key in value)))
    throw new Error(`${name} has an invalid shape`);
}

function token(value, name) {
  if (typeof value !== "string" || !/^[A-Za-z0-9_-]{24,256}$/.test(value))
    throw new Error(`${name} must be an opaque token`);
}

function digest(value, name, nullable = false) {
  if (value === null && nullable) return;
  if (typeof value !== "string" || !/^[a-f0-9]{64}$/.test(value))
    throw new Error(`${name} must be a SHA-256 digest`);
}

function bytes(value, name, nullable = false) {
  if (value === null && nullable) return;
  if (typeof value !== "string" || encoder.encode(value).byteLength > MAX_BYTES)
    throw new Error(`${name} must be bounded bytes`);
}

function name(value, kind, nullable = false) {
  if (value === null && nullable) return;
  if (typeof value !== "string" ||
      !new RegExp(`^\\.p01h03-${kind}-[A-Za-z0-9_-]{24,256}$`).test(value))
    throw new Error(`${kind} name is invalid`);
}

function unique(values, label) {
  const present = values.filter((value) => value !== null);
  if (new Set(present).size !== present.length) throw new Error(`${label} must be pairwise unique`);
}

function identity(value, label, pending = false, nullable = false) {
  if (value === null && nullable) return;
  if (value === "pending" && pending) return;
  exact(value, ["device", "inode", "linkCount"], label);
  for (const key of ["device", "inode", "linkCount"])
    if (!Number.isSafeInteger(value[key]) || value[key] < 0)
      throw new Error(`${label}.${key} must be a non-negative safe integer`);
  if (value.linkCount !== 1) throw new Error(`${label} must reject hardlinks`);
}

function child(value) {
  exact(value, ["childId", "targetId", "operation", "beforeHash", "afterHash"], "child");
  token(value.childId, "childId");
  if (!TARGET_IDS.includes(value.targetId)) throw new Error("unknown targetId");
  if (!['create', 'update', 'delete'].includes(value.operation)) throw new Error("invalid operation");
  digest(value.beforeHash, "beforeHash", true);
  digest(value.afterHash, "afterHash", true);
  if ((value.operation === "create") !== (value.beforeHash === null) ||
      (value.operation === "delete") !== (value.afterHash === null) ||
      (value.operation === "update" && (value.beforeHash === null || value.afterHash === null)))
    throw new Error("operation has an invalid null/hash combination");
}

function boundPayload(value, expectedHash, nullable, label) {
  bytes(value, label, nullable);
  if (value === null ? expectedHash !== null : sha256(value) !== expectedHash)
    throw new Error(`${label} does not match its bound hash`);
}

export function validateRequest(value) {
  exact(value, ["schemaVersion", "operation", "transactionId", "fixtureId", "payload"], "request");
  if (value.schemaVersion !== SCHEMA_VERSION || !["create", "update", "delete"].includes(value.operation))
    throw new Error("unsupported request");
  token(value.transactionId, "transactionId");
  if (typeof value.fixtureId !== "string" || !/^[a-z0-9][a-z0-9-]{0,63}$/.test(value.fixtureId))
    throw new Error("invalid fixtureId");
  exact(value.payload, ["child", "beforeBytes", "afterBytes"], "request payload");
  child(value.payload.child);
  if (value.payload.child.operation !== value.operation) throw new Error("request operation mismatch");
  boundPayload(value.payload.beforeBytes, value.payload.child.beforeHash, value.operation === "create", "beforeBytes");
  boundPayload(value.payload.afterBytes, value.payload.child.afterHash, value.operation === "delete", "afterBytes");
  return freeze(structuredClone(value));
}

function validateNames(value, operation) {
  exact(value, ["childReceiptStaging", "temp", "beforeSnapshot", "capture", "rollbackCapture", "rollbackTemp"], "child names");
  name(value.childReceiptStaging, "child-staging");
  name(value.temp, "temp", operation === "delete");
  name(value.beforeSnapshot, "before", operation === "create");
  name(value.capture, "capture", operation === "create");
  name(value.rollbackCapture, "rollback-capture", operation === "delete");
  name(value.rollbackTemp, "rollback-temp", operation === "create");
  unique(Object.values(value), "child internal names");
}

function artifact(value, label, requiredHash, allowed, allowPending = false) {
  if (!allowed) {
    if (value === "pending" && allowPending) return;
    if (value !== null) throw new Error(`${label} is not valid for this operation/state`);
    return;
  }
  if (value === "pending" && allowPending) return;
  if (value === "pending") throw new Error(`${label} may no longer be pending`);
  exact(value, ["identity", "length", "hash"], label);
  identity(value.identity, `${label}.identity`);
  if (!Number.isSafeInteger(value.length) || value.length < 0 || value.length > MAX_BYTES)
    throw new Error(`${label}.length is invalid`);
  digest(value.hash, `${label}.hash`);
  if (requiredHash !== undefined && value.hash !== requiredHash)
    throw new Error(`${label} has the wrong hash`);
}

function requiredArtifacts(operation, state) {
  const needBefore = ["before-snapshotted", "ready-to-capture", "old-captured", "deleted",
    "committed", "rolling-back", "rollback-published", "rolled-back", "conflict-before-capture"].includes(state);
  const needTemp = ["temp-synced", "ready-to-capture", "old-captured", "new-published",
    "committed", "rolling-back", "rollback-captured", "conflict-before-capture"].includes(state);
  const needCapture = ["old-captured", "deleted", "committed", "rolling-back", "rollback-published",
    "rolled-back", "conflict-before-capture"].includes(state);
  return {
    beforeSnapshot: operation !== "create" && needBefore,
    temp: operation !== "delete" && needTemp,
    capture: operation !== "create" && needCapture,
    rollbackCapture: operation !== "delete" && state === "rollback-captured",
    rollbackTemp: operation !== "create" && ["rollback-published", "rolled-back"].includes(state),
    target: ["new-published", "committed"].includes(state) && operation !== "delete",
  };
}

function allowedStates(operation) {
  const shared = ["prepared", "committed", "rolling-back", "rolled-back", "conflict"];
  if (operation === "create") return [...shared, "temp-synced", "new-published", "rollback-captured"];
  if (operation === "update") return [...shared, "before-snapshotted", "ready-to-capture", "old-captured",
    "new-published", "rollback-captured", "rollback-published", "conflict-before-capture"];
  return [...shared, "before-snapshotted", "ready-to-capture", "old-captured", "deleted",
    "rollback-published", "conflict-before-capture"];
}

function validateOrphans(value) {
  if (!Array.isArray(value) || value.length > MAX_ORPHANS) throw new Error("orphan inventory is unbounded");
  const names = [];
  for (const orphan of value) {
    exact(orphan, ["name", "exists", "length", "hash", "bytes", "identity"], "orphan");
    name(orphan.name, "(?:parent-staging|child-staging|parent-receipt|child-receipt)");
    if (typeof orphan.exists !== "boolean") throw new Error("orphan.exists must be boolean");
    names.push(orphan.name);
    if (!orphan.exists) {
      if (orphan.length !== 0 || orphan.hash !== null || orphan.bytes !== null || orphan.identity !== null)
        throw new Error("absent orphan must have null evidence");
      continue;
    }
    bytes(orphan.bytes, "orphan.bytes");
    if (orphan.length !== encoder.encode(orphan.bytes).byteLength || orphan.length > MAX_BYTES ||
        orphan.hash !== sha256(orphan.bytes)) throw new Error("orphan evidence does not match content");
    identity(orphan.identity, "orphan.identity");
  }
  unique(names, "orphan names");
}

export function validateChildReceipt(value) {
  exact(value, ["schemaVersion", "transactionId", "parentId", "child", "generation", "state", "names", "artifacts", "orphanInventory"], "child receipt");
  if (value.schemaVersion !== SCHEMA_VERSION || !Number.isSafeInteger(value.generation) || value.generation < 0)
    throw new Error("invalid child receipt header");
  token(value.transactionId, "transactionId");
  token(value.parentId, "parentId");
  child(value.child);
  if (!allowedStates(value.child.operation).includes(value.state)) throw new Error("child state is invalid for operation");
  validateNames(value.names, value.child.operation);
  exact(value.artifacts, ["beforeSnapshot", "temp", "capture", "rollbackCapture", "rollbackTemp", "target"], "artifacts");
  const needed = requiredArtifacts(value.child.operation, value.state);
  const allowPending = value.state === "prepared";
  artifact(value.artifacts.beforeSnapshot, "beforeSnapshot", value.child.beforeHash, needed.beforeSnapshot, allowPending);
  artifact(value.artifacts.temp, "temp", value.child.afterHash, needed.temp, allowPending);
  artifact(value.artifacts.capture, "capture", value.child.beforeHash, needed.capture, allowPending);
  artifact(value.artifacts.rollbackCapture, "rollbackCapture", value.child.afterHash, needed.rollbackCapture, allowPending);
  artifact(value.artifacts.rollbackTemp, "rollbackTemp", value.child.beforeHash, needed.rollbackTemp, allowPending);
  artifact(value.artifacts.target, "target", value.child.afterHash, needed.target, allowPending);
  validateOrphans(value.orphanInventory);
  return freeze(structuredClone(value));
}

function aggregate(children, key) {
  return sha256(canonical(children.map(({ targetId, operation, beforeHash, afterHash }) => ({
    targetId, operation, hash: key === "before" ? beforeHash : afterHash,
  }))));
}

export const aggregateBeforeDigest = (children) => aggregate(children, "before");
export const aggregateAfterDigest = (children) => aggregate(children, "after");

function validateChildReferences(value) {
  if (!Array.isArray(value) || value.length !== TARGET_IDS.length) throw new Error("parent must bind the complete child set");
  const expected = [...TARGET_IDS];
  for (let index = 0; index < value.length; index += 1) {
    const reference = value[index];
    exact(reference, ["childId", "targetId", "operation", "beforeHash", "afterHash", "state", "receiptName", "receiptDigest", "names"], "child reference");
    child({ childId: reference.childId, targetId: reference.targetId, operation: reference.operation,
      beforeHash: reference.beforeHash, afterHash: reference.afterHash });
    if (reference.targetId !== expected[index]) throw new Error("children must be stably sorted by targetId");
    if (!CHILD_STATES.includes(reference.state)) throw new Error("invalid child reference state");
    name(reference.receiptName, "child-receipt");
    digest(reference.receiptDigest, "child receipt digest");
    validateNames(reference.names, reference.operation);
  }
  unique(value.map((reference) => reference.childId), "child IDs");
  unique(value.map((reference) => reference.receiptName), "child receipt names");
  return value;
}

function coherent(parentState, children) {
  const states = children.map((childReference) => childReference.state);
  if (["children-committed", "committed"].includes(parentState) && !states.every((state) => state === "committed"))
    throw new Error("committed parent requires committed children");
  if (parentState === "rolled-back" && !states.every((state) => state === "rolled-back"))
    throw new Error("rolled-back parent requires rolled-back children");
  if (parentState === "conflict" && !states.some((state) => state.includes("conflict")))
    throw new Error("conflict parent requires a conflict child");
  if (parentState === "prepared" && states.some((state) => ["committed", "rolled-back"].includes(state)))
    throw new Error("prepared parent cannot describe terminal children");
  if (parentState === "rolling-back" && states.some((state) => state === "committed"))
    throw new Error("rolling-back parent cannot retain committed children");
}

export function validateParentReceipt(value) {
  exact(value, ["schemaVersion", "transactionId", "parentId", "generation", "state", "names", "children", "beforeDigest", "afterDigest", "orphanInventory"], "parent receipt");
  if (value.schemaVersion !== SCHEMA_VERSION || !PARENT_STATES.includes(value.state) ||
      !Number.isSafeInteger(value.generation) || value.generation < 0) throw new Error("invalid parent receipt header");
  token(value.transactionId, "transactionId");
  token(value.parentId, "parentId");
  exact(value.names, ["parentReceiptStaging", "parentReceipt"], "parent names");
  name(value.names.parentReceiptStaging, "parent-staging");
  name(value.names.parentReceipt, "parent-receipt");
  const children = validateChildReferences(value.children);
  unique([value.names.parentReceiptStaging, value.names.parentReceipt,
    ...children.flatMap((reference) => [reference.receiptName, ...Object.values(reference.names)])],
  "all parent and child internal names");
  digest(value.beforeDigest, "beforeDigest");
  digest(value.afterDigest, "afterDigest");
  if (value.beforeDigest !== aggregateBeforeDigest(children) || value.afterDigest !== aggregateAfterDigest(children))
    throw new Error("parent aggregate digest does not bind its full child set");
  coherent(value.state, children);
  validateOrphans(value.orphanInventory);
  return freeze(structuredClone(value));
}

export function receiptDigest(receipt) {
  return sha256(canonical(receipt));
}
