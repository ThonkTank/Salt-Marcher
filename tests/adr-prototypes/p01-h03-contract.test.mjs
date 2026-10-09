import assert from "node:assert/strict";
import { createHash } from "node:crypto";
import test from "node:test";
import {
  SCHEMA_VERSION,
  aggregateAfterDigest,
  aggregateBeforeDigest,
  validateChildReceipt,
  validateParentReceipt,
  validateRequest,
} from "../../tools/adr-prototypes/contracts/p01-v3/contract.mjs";

const hash = (value) => createHash("sha256").update(value).digest("hex");
const token = (value) => value.repeat(24);
const id = (inode = 1) => ({ device: 1, inode, linkCount: 1 });
const name = (kind, value) => `.p01h03-${kind}-${token(value)}`;
const data = (operation, side) =>
  operation === "create" && side === "before"
    ? null
    : operation === "delete" && side === "after"
      ? null
      : `${operation}-${side}`;
const ev = (status, content, inode = 1) =>
  status === "not-applicable"
    ? { status, identity: null, length: null, hash: null }
    : status === "pending"
      ? { status, identity: null, length: null, hash: null }
      : status === "absent"
        ? { status, identity: null, length: 0, hash: null }
        : {
            status,
            identity: id(inode),
            length: Buffer.byteLength(content),
            hash: hash(content),
          };
function child(operation, targetId = "map", letter = "b") {
  const before = data(operation, "before"),
    after = data(operation, "after");
  return {
    childId: token(letter),
    targetId,
    operation,
    beforeHash: before && hash(before),
    beforeLength: before && Buffer.byteLength(before),
    afterHash: after && hash(after),
    afterLength: after && Buffer.byteLength(after),
  };
}
function childNames(operation, letter = "c") {
  return {
    childReceiptStaging: name("child-staging", letter),
    temp: operation === "delete" ? null : name("temp", `${letter}t`),
    beforeSnapshot:
      operation === "create" ? null : name("before", `${letter}b`),
    capture: operation === "create" ? null : name("capture", `${letter}c`),
    rollbackCapture:
      operation === "delete" ? null : name("rollback-capture", `${letter}r`),
    rollbackTemp:
      operation === "create" ? null : name("rollback-temp", `${letter}x`),
  };
}
function receipt(operation, state) {
  const c = child(operation);
  const conflict = state.includes("conflict");
  const afterTemp = [
    "temp-synced",
    "ready-to-capture",
    "old-captured",
    "conflict-before-capture",
    "conflict",
  ].includes(state);
  const afterBefore = [
    "before-snapshotted",
    "ready-to-capture",
    "old-captured",
    "new-published",
    "deleted",
    "committed",
    "rolling-back",
    "rollback-captured",
    "rollback-published",
    "rolled-back",
    "conflict-before-capture",
    "conflict",
  ].includes(state);
  const afterCapture = [
    "old-captured",
    "new-published",
    "deleted",
    "committed",
    "rolling-back",
    "rollback-captured",
    "rollback-published",
    "rolled-back",
    "conflict-before-capture",
    "conflict",
  ].includes(state);
  const choice = (applicable, retained, content, inode) =>
    !applicable
      ? ev("not-applicable")
      : retained
        ? ev("present", content, inode)
        : ev("pending");
  const artifacts = {
    beforeSnapshot: choice(
      operation !== "create",
      operation !== "create" && afterBefore,
      data(operation, "before"),
      2,
    ),
    temp: choice(
      operation !== "delete",
      operation !== "delete" && afterTemp,
      data(operation, "after"),
      3,
    ),
    capture: choice(
      operation !== "create",
      operation !== "create" && afterCapture,
      data(operation, "before"),
      4,
    ),
    rollbackCapture: choice(
      operation !== "delete",
      operation !== "delete" &&
        [
          "rollback-captured",
          "rollback-published",
          "rolled-back",
          "conflict",
        ].includes(state),
      data(operation, "after"),
      5,
    ),
    rollbackTemp: choice(
      operation !== "create",
      operation !== "create" &&
        ["rollback-published", "rolled-back", "conflict"].includes(state),
      data(operation, "before"),
      6,
    ),
    target: ev("absent"),
  };
  if (
    operation !== "delete" &&
    [
      "new-published",
      "committed",
      "rollback-captured",
      "rollback-published",
      "rolled-back",
    ].includes(state)
  )
    artifacts.temp = ev("absent");
  if (
    operation !== "create" &&
    ["rollback-published", "rolled-back"].includes(state)
  )
    artifacts.rollbackTemp = ev("absent");
  const beforeTarget =
    operation !== "create" &&
    [
      "prepared",
      "before-snapshotted",
      "ready-to-capture",
      "rollback-published",
      "rolled-back",
    ].includes(state);
  if (beforeTarget)
    artifacts.target = ev("present", data(operation, "before"), 7);
  if (["new-published", "committed"].includes(state) && operation !== "delete")
    artifacts.target = ev("present", data(operation, "after"), 7);
  if (conflict) artifacts.target = ev("present", "competitor", 8);
  return {
    schemaVersion: SCHEMA_VERSION,
    transactionId: token("a"),
    parentId: token("p"),
    generation: 1,
    state,
    child: c,
    names: childNames(operation),
    artifacts,
    orphanInventory: [],
  };
}
function parent(state, childState) {
  const children = [
    child("update", "draft", "b"),
    child("delete", "journal", "c"),
    child("create", "map", "d"),
    child("update", "note", "e"),
  ].map((item, index) => ({
    ...item,
    state: childState,
    receiptName: name("child-receipt", String.fromCharCode(102 + index)),
    receiptDigest: hash(`r${index}`),
    names: childNames(item.operation, String.fromCharCode(110 + index)),
  }));
  return {
    schemaVersion: SCHEMA_VERSION,
    transactionId: token("a"),
    parentId: token("p"),
    generation: 1,
    state,
    names: {
      parentReceiptStaging: name("parent-staging", "k"),
      parentReceipt: name("parent-receipt", "l"),
    },
    children,
    beforeDigest: aggregateBeforeDigest(children),
    afterDigest: aggregateAfterDigest(children),
    orphanInventory: [],
  };
}

test("Golden Create Update Delete requests bind UTF-8 hashes and lengths immutably", () => {
  for (const operation of ["create", "update", "delete"]) {
    const c = child(operation);
    const result = validateRequest({
      schemaVersion: SCHEMA_VERSION,
      operation,
      transactionId: token("a"),
      fixtureId: "small-v4",
      payload: {
        child: c,
        beforeBytes: data(operation, "before"),
        afterBytes: data(operation, "after"),
      },
    });
    assert.ok(Object.isFrozen(result));
  }
});
test("all child and parent state families accept Golden DTOs", () => {
  const states = {
    create: [
      "prepared",
      "temp-synced",
      "new-published",
      "committed",
      "rolling-back",
      "rollback-captured",
      "rolled-back",
      "conflict",
    ],
    update: [
      "prepared",
      "before-snapshotted",
      "ready-to-capture",
      "old-captured",
      "new-published",
      "committed",
      "rolling-back",
      "rollback-captured",
      "rollback-published",
      "rolled-back",
      "conflict-before-capture",
      "conflict",
    ],
    delete: [
      "prepared",
      "before-snapshotted",
      "ready-to-capture",
      "old-captured",
      "deleted",
      "committed",
      "rolling-back",
      "rollback-published",
      "rolled-back",
      "conflict-before-capture",
      "conflict",
    ],
  };
  for (const [operation, values] of Object.entries(states))
    for (const state of values)
      assert.equal(
        validateChildReceipt(receipt(operation, state)).state,
        state,
      );
  for (const [state, childState] of [
    ["prepared", "ready-to-capture"],
    ["children-committed", "committed"],
    ["committed", "committed"],
    ["rolling-back", "committed"],
    ["rolled-back", "rolled-back"],
    ["conflict", "conflict"],
  ])
    assert.equal(validateParentReceipt(parent(state, childState)).state, state);
});
test("applicability, lengths, retention and target absence fail closed", () => {
  const cases = [
    () => {
      const v = receipt("create", "prepared");
      v.artifacts.beforeSnapshot = ev("pending");
      return validateChildReceipt(v);
    },
    () => {
      const v = receipt("update", "ready-to-capture");
      v.artifacts.temp.length += 1;
      return validateChildReceipt(v);
    },
    () => {
      const v = receipt("update", "rollback-published");
      v.artifacts.rollbackCapture = ev("pending");
      return validateChildReceipt(v);
    },
    () => {
      const v = receipt("delete", "deleted");
      v.artifacts.target = ev("present", "old");
      return validateChildReceipt(v);
    },
    () => {
      const v = child("create");
      v.beforeLength = 0;
      return validateRequest({
        schemaVersion: SCHEMA_VERSION,
        operation: "create",
        transactionId: token("a"),
        fixtureId: "small-v4",
        payload: {
          child: v,
          beforeBytes: null,
          afterBytes: data("create", "after"),
        },
      });
    },
  ];
  for (const invalid of cases) assert.throws(invalid);
});
test("conflicts retain a syntactically valid competing truth or orphan", () => {
  assert.equal(
    validateChildReceipt(receipt("update", "conflict-before-capture")).state,
    "conflict-before-capture",
  );
  const noProof = receipt("update", "conflict");
  noProof.artifacts.target = ev("present", data("update", "after"));
  assert.throws(() => validateChildReceipt(noProof));
  const withOrphan = receipt("create", "conflict");
  withOrphan.artifacts.target = ev("absent");
  withOrphan.orphanInventory = [
    {
      name: name("parent-staging", "z"),
      exists: true,
      bytes: "partial",
      length: 7,
      hash: hash("partial"),
      identity: id(9),
    },
  ];
  assert.equal(validateChildReceipt(withOrphan).state, "conflict");
});
test("parent sorting, duplicate identities, aggregates, foreign fields and mutation fail", () => {
  const cases = [
    () => {
      const v = parent("committed", "committed");
      v.children.reverse();
      return validateParentReceipt(v);
    },
    () => {
      const v = parent("committed", "committed");
      v.children[1].childId = v.children[0].childId;
      return validateParentReceipt(v);
    },
    () => {
      const v = parent("committed", "committed");
      v.children[0].beforeLength += 1;
      return validateParentReceipt(v);
    },
    () => {
      const v = receipt("update", "prepared");
      v.extra = true;
      return validateChildReceipt(v);
    },
  ];
  for (const invalid of cases) assert.throws(invalid);
  const value = validateParentReceipt(parent("committed", "committed"));
  assert.throws(() => {
    value.children[0].state = "conflict";
  }, TypeError);
});

test("internal names remain typed and globally pairwise unique", () => {
  const invalid = [
    () => {
      const value = receipt("update", "ready-to-capture");
      value.names.capture = "outside-the-transaction-root";
      return validateChildReceipt(value);
    },
    () => {
      const value = receipt("update", "ready-to-capture");
      value.names.capture = value.names.temp;
      return validateChildReceipt(value);
    },
    () => {
      const value = parent("committed", "committed");
      value.children[0].receiptName = value.names.parentReceipt;
      return validateParentReceipt(value);
    },
    () => {
      const value = parent("committed", "committed");
      value.children[1].names.capture = value.children[0].names.capture;
      return validateParentReceipt(value);
    },
  ];
  for (const reject of invalid) assert.throws(reject);
});

test("orphan inventories bind absence or exact bounded retained content", () => {
  const present = {
    name: name("parent-staging", "z"),
    exists: true,
    bytes: "partial",
    length: 7,
    hash: hash("partial"),
    identity: id(90),
  };
  const absent = {
    name: name("child-staging", "y"),
    exists: false,
    bytes: null,
    length: 0,
    hash: null,
    identity: null,
  };
  const accepted = receipt("update", "prepared");
  accepted.orphanInventory = [present, absent];
  assert.equal(validateChildReceipt(accepted).orphanInventory.length, 2);

  const invalid = [
    () => {
      const value = receipt("update", "prepared");
      value.orphanInventory = [{ ...absent, length: 1 }];
      return validateChildReceipt(value);
    },
    () => {
      const value = receipt("update", "prepared");
      value.orphanInventory = [{ ...present, hash: hash("different") }];
      return validateChildReceipt(value);
    },
    () => {
      const value = receipt("update", "prepared");
      value.orphanInventory = [present, { ...present }];
      return validateChildReceipt(value);
    },
    () => {
      const value = receipt("update", "prepared");
      value.orphanInventory = Array.from({ length: 17 }, (_, index) => ({
        ...absent,
        name: name("child-staging", String(index).padEnd(24, "x")),
      }));
      return validateChildReceipt(value);
    },
    () => {
      const value = receipt("update", "prepared");
      value.orphanInventory = [
        { ...absent, name: value.names.childReceiptStaging },
      ];
      return validateChildReceipt(value);
    },
    () => {
      const value = parent("committed", "committed");
      value.orphanInventory = [
        { ...absent, name: value.children[0].receiptName },
      ];
      return validateParentReceipt(value);
    },
  ];
  for (const reject of invalid) assert.throws(reject);
});

test("rename lifecycle distinguishes moved names from retained evidence", () => {
  const invalid = [
    () => {
      const value = receipt("create", "committed");
      value.artifacts.temp = ev("present", data("create", "after"), 31);
      return validateChildReceipt(value);
    },
    () => {
      const value = receipt("update", "rolled-back");
      value.artifacts.rollbackTemp = ev(
        "present",
        data("update", "before"),
        32,
      );
      return validateChildReceipt(value);
    },
    () => {
      const value = receipt("update", "rolled-back");
      value.artifacts.rollbackCapture = ev("pending");
      return validateChildReceipt(value);
    },
    () => {
      const value = receipt("update", "ready-to-capture");
      value.artifacts.target = ev("absent");
      return validateChildReceipt(value);
    },
    () => {
      const value = receipt("delete", "rollback-published");
      value.artifacts.target = ev("absent");
      return validateChildReceipt(value);
    },
  ];
  for (const reject of invalid) assert.throws(reject);

  assert.equal(
    validateChildReceipt(receipt("create", "rolling-back")).artifacts.target
      .status,
    "absent",
  );
  assert.equal(
    validateChildReceipt(receipt("update", "rolling-back")).artifacts.temp
      .status,
    "pending",
  );
});

test("validated DTOs are deeply immutable and headers fail closed", () => {
  const childValue = validateChildReceipt(
    receipt("update", "ready-to-capture"),
  );
  assert.ok(Object.isFrozen(childValue.artifacts));
  assert.ok(Object.isFrozen(childValue.artifacts.temp.identity));
  assert.ok(Object.isFrozen(childValue.orphanInventory));
  assert.throws(() => {
    childValue.artifacts.temp.identity.inode = 999;
  }, TypeError);

  const invalid = [
    () => {
      const value = receipt("update", "ready-to-capture");
      value.generation = -1;
      return validateChildReceipt(value);
    },
    () => {
      const value = receipt("delete", "deleted");
      value.state = "new-published";
      return validateChildReceipt(value);
    },
    () => {
      const value = parent("prepared", "ready-to-capture");
      value.state = "unknown";
      return validateParentReceipt(value);
    },
  ];
  for (const reject of invalid) assert.throws(reject);
});
