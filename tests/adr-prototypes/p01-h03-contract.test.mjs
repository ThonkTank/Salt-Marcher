import assert from "node:assert/strict";
import { createHash } from "node:crypto";
import test from "node:test";
import {
  SCHEMA_VERSION, aggregateAfterDigest, aggregateBeforeDigest, receiptDigest,
  validateChildReceipt, validateParentReceipt, validateRequest,
} from "../../tools/adr-prototypes/contracts/p01-v3/contract.mjs";

const token = (letter) => letter.repeat(24);
const hash = (value) => createHash("sha256").update(value).digest("hex");
const identity = (inode = 1) => ({ device: 7, inode, linkCount: 1 });
const internal = (kind, letter) => `.p01h03-${kind}-${token(letter)}`;
const bytesFor = (operation, side) => operation === "create" && side === "before" ? null
  : operation === "delete" && side === "after" ? null : `${operation}-${side}`;

function child(operation, targetId = "map", letter = "b") {
  const before = bytesFor(operation, "before");
  const after = bytesFor(operation, "after");
  return { childId: token(letter), targetId, operation,
    beforeHash: before === null ? null : hash(before), afterHash: after === null ? null : hash(after) };
}

function request(operation) {
  const beforeBytes = bytesFor(operation, "before");
  const afterBytes = bytesFor(operation, "after");
  return { schemaVersion: SCHEMA_VERSION, operation, transactionId: token("a"), fixtureId: "small-v4",
    payload: { child: child(operation), beforeBytes, afterBytes } };
}

function names(operation, letter = "c") {
  return { childReceiptStaging: internal("child-staging", letter),
    temp: operation === "delete" ? null : internal("temp", `${letter}d`),
    beforeSnapshot: operation === "create" ? null : internal("before", `${letter}e`),
    capture: operation === "create" ? null : internal("capture", `${letter}f`),
    rollbackCapture: operation === "delete" ? null : internal("rollback-capture", `${letter}g`),
    rollbackTemp: operation === "create" ? null : internal("rollback-temp", `${letter}h`) };
}

function artifact(digest, inode) {
  return { identity: identity(inode), length: 3, hash: digest };
}

function childReceipt(operation, state) {
  const detail = child(operation);
  const needed = {
    beforeSnapshot: ["before-snapshotted", "ready-to-capture", "old-captured", "deleted", "committed", "rolling-back", "rollback-published", "rolled-back", "conflict-before-capture"].includes(state),
    temp: ["temp-synced", "ready-to-capture", "old-captured", "new-published", "committed", "rolling-back", "rollback-captured", "conflict-before-capture"].includes(state),
    capture: ["old-captured", "deleted", "committed", "rolling-back", "rollback-published", "rolled-back", "conflict-before-capture"].includes(state),
    rollbackCapture: state === "rollback-captured",
    rollbackTemp: ["rollback-published", "rolled-back"].includes(state),
    target: ["new-published", "committed"].includes(state),
  };
  const usable = (key, enabled, digest, inode) => enabled && digest !== null ? artifact(digest, inode) : null;
  return { schemaVersion: SCHEMA_VERSION, transactionId: token("a"), parentId: token("p"), generation: 1, state,
    child: detail, names: names(operation), artifacts: {
      beforeSnapshot: usable("beforeSnapshot", operation !== "create" && needed.beforeSnapshot, detail.beforeHash, 2),
      temp: usable("temp", operation !== "delete" && needed.temp, detail.afterHash, 3),
      capture: usable("capture", operation !== "create" && needed.capture, detail.beforeHash, 4),
      rollbackCapture: usable("rollbackCapture", operation !== "delete" && needed.rollbackCapture, detail.afterHash, 5),
      rollbackTemp: usable("rollbackTemp", operation !== "create" && needed.rollbackTemp, detail.beforeHash, 6),
      target: usable("target", operation !== "delete" && needed.target, detail.afterHash, 7),
    }, orphanInventory: [] };
}

function parent(state, childState) {
  const details = [child("update", "draft", "b"), child("delete", "journal", "c"),
    child("create", "map", "d"), child("update", "note", "e")];
  const children = details.map((detail, index) => ({ ...detail, state: childState,
    receiptName: internal("child-receipt", String.fromCharCode(102 + index)),
    receiptDigest: hash(`receipt-${index}`),
    names: names(detail.operation, String.fromCharCode(110 + index)) }));
  return { schemaVersion: SCHEMA_VERSION, transactionId: token("a"), parentId: token("p"), generation: 2, state,
    names: { parentReceiptStaging: internal("parent-staging", "k"), parentReceipt: internal("parent-receipt", "l") },
    children, beforeDigest: aggregateBeforeDigest(children), afterDigest: aggregateAfterDigest(children), orphanInventory: [] };
}

test("Golden Create, Update and Delete requests bind exact immutable bytes", () => {
  for (const operation of ["create", "update", "delete"]) {
    const result = validateRequest(request(operation));
    assert.ok(Object.isFrozen(result));
    assert.ok(Object.isFrozen(result.payload.child));
  }
});

test("every operation-specific child-state family accepts its Golden DTO", () => {
  const states = {
    create: ["prepared", "temp-synced", "new-published", "committed", "rolling-back", "rollback-captured", "rolled-back", "conflict"],
    update: ["prepared", "before-snapshotted", "ready-to-capture", "old-captured", "new-published", "committed", "rolling-back", "rollback-captured", "rollback-published", "rolled-back", "conflict-before-capture", "conflict"],
    delete: ["prepared", "before-snapshotted", "ready-to-capture", "old-captured", "deleted", "committed", "rolling-back", "rollback-published", "rolled-back", "conflict-before-capture", "conflict"],
  };
  for (const [operation, values] of Object.entries(states))
    for (const state of values) assert.equal(validateChildReceipt(childReceipt(operation, state)).state, state);
});

test("every parent-state family accepts a coherent complete Golden DTO", () => {
  const cases = [["prepared", "ready-to-capture"], ["children-committed", "committed"],
    ["committed", "committed"], ["rolling-back", "rolling-back"], ["rolled-back", "rolled-back"], ["conflict", "conflict"]];
  for (const [state, childState] of cases)
    assert.equal(validateParentReceipt(parent(state, childState)).state, state);
});

test("payload nullability, bytes, hashes, identities and state/operation combinations fail closed", () => {
  const cases = [
    () => { const value = request("create"); value.payload.beforeBytes = "old"; return validateRequest(value); },
    () => { const value = request("update"); value.payload.afterBytes = "other"; return validateRequest(value); },
    () => { const value = childReceipt("delete", "temp-synced"); return validateChildReceipt(value); },
    () => { const value = childReceipt("update", "before-snapshotted"); value.artifacts.beforeSnapshot.identity.linkCount = 2; return validateChildReceipt(value); },
    () => { const value = childReceipt("create", "new-published"); value.artifacts.target = "pending"; return validateChildReceipt(value); },
  ];
  for (const invalid of cases) assert.throws(invalid);
});

test("internal names are syntactic, bound and pairwise unique", () => {
  const cases = [
    () => { const value = childReceipt("update", "ready-to-capture"); value.names.capture = "occupied"; return validateChildReceipt(value); },
    () => { const value = childReceipt("update", "ready-to-capture"); value.names.capture = value.names.temp; return validateChildReceipt(value); },
    () => { const value = parent("committed", "committed"); value.children[0].receiptName = value.names.parentReceipt; return validateParentReceipt(value); },
  ];
  for (const invalid of cases) assert.throws(invalid);
});

test("parent rejects unsorted, duplicate, incomplete or incoherent child sets and bad aggregates", () => {
  const cases = [
    () => { const value = parent("committed", "committed"); [value.children[0], value.children[1]] = [value.children[1], value.children[0]]; return validateParentReceipt(value); },
    () => { const value = parent("committed", "committed"); value.children[1].targetId = "draft"; return validateParentReceipt(value); },
    () => { const value = parent("committed", "committed"); value.children.pop(); return validateParentReceipt(value); },
    () => { const value = parent("committed", "committed"); value.children[0].state = "ready-to-capture"; return validateParentReceipt(value); },
    () => { const value = parent("committed", "committed"); value.beforeDigest = hash("third truth"); return validateParentReceipt(value); },
  ];
  for (const invalid of cases) assert.throws(invalid);
});

test("orphan inventory is structured, bounded, unique and content-evidenced", () => {
  const present = { name: internal("parent-staging", "z"), exists: true, bytes: "partial", length: 7,
    hash: hash("partial"), identity: identity(99) };
  const absent = { name: internal("child-staging", "y"), exists: false, bytes: null, length: 0, hash: null, identity: null };
  const accepted = childReceipt("update", "prepared");
  accepted.orphanInventory = [present, absent];
  assert.equal(validateChildReceipt(accepted).orphanInventory.length, 2);
  const cases = [
    () => { const value = childReceipt("update", "prepared"); value.orphanInventory = [{ ...absent, length: 1 }]; return validateChildReceipt(value); },
    () => { const value = childReceipt("update", "prepared"); value.orphanInventory = [{ ...present, hash: hash("other") }]; return validateChildReceipt(value); },
    () => { const value = childReceipt("update", "prepared"); value.orphanInventory = Array.from({ length: 17 }, (_, index) => ({ ...absent, name: internal("child-staging", `${index}`.padEnd(24, "x")) })); return validateChildReceipt(value); },
  ];
  for (const invalid of cases) assert.throws(invalid);
});

test("foreign fields and post-validation mutations cannot alter immutable receipts", () => {
  const cases = [
    () => { const value = request("update"); value.extra = true; return validateRequest(value); },
    () => { const value = childReceipt("update", "prepared"); value.names.extra = true; return validateChildReceipt(value); },
    () => { const value = parent("prepared", "ready-to-capture"); value.children[0].extra = true; return validateParentReceipt(value); },
  ];
  for (const invalid of cases) assert.throws(invalid);
  const result = validateParentReceipt(parent("committed", "committed"));
  assert.throws(() => { result.children[0].state = "conflict"; }, TypeError);
  assert.throws(() => { result.names.parentReceipt = "mutated"; }, TypeError);
  assert.equal(receiptDigest(result), receiptDigest(result));
});
