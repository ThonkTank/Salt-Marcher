import assert from "node:assert/strict";
import test from "node:test";
import {
  SCHEMA_VERSION,
  canonical,
  commandDigest,
  receiptDigest,
  validateReceipt,
  validateRequest,
  validateResult,
} from "../../tools/adr-prototypes/contracts/p02-v1/contract.mjs";
import { request } from "../../tools/adr-prototypes/p02/fixture.mjs";

test("P02 request binds exact canonical command bytes and returns an immutable copy", () => {
  const value = request(1), validated = validateRequest(value);
  assert.ok(Object.isFrozen(validated));
  assert.ok(Object.isFrozen(validated.command));
  value.command.newName = "mutated caller input";
  assert.equal(validated.command.newName, "Renamed Object 1");
  const reordered = {
    historyFact: validated.command.historyFact,
    newName: validated.command.newName,
    objectId: validated.command.objectId,
    campaignId: validated.command.campaignId,
    kind: validated.command.kind,
  };
  assert.equal(commandDigest(reordered), validated.commandDigest);
  assert.equal(canonical({ b: 1, a: 2 }), '{"a":2,"b":1}');
});

test("P02 contract rejects unknown keys, malformed identity, stale digest and unsupported command", () => {
  const original = request(1);
  for (const invalid of [
    { ...original, extra: true },
    { ...original, commandId: "short" },
    { ...original, commandDigest: "0".repeat(64) },
    { ...original, command: { ...original.command, kind: "delete_everything" } },
    { ...original, command: { ...original.command, extra: true } },
  ]) assert.throws(() => validateRequest(invalid));
});

test("P02 receipt and result validators bind consecutive revision and exact receipt digest", () => {
  const value = request(1), base = {
    schemaVersion: SCHEMA_VERSION,
    commandId: value.commandId,
    commandDigest: value.commandDigest,
    expectedRevision: 0,
    committedRevision: 1,
    campaignId: value.command.campaignId,
    objectId: value.command.objectId,
    beforeName: "Same Name",
    afterName: value.command.newName,
    historyFact: value.command.historyFact,
  };
  const receipt = validateReceipt({ ...base, receiptDigest: receiptDigest(base) });
  assert.ok(Object.isFrozen(receipt));
  assert.ok(Object.isFrozen(validateResult({
    schemaVersion: SCHEMA_VERSION,
    outcome: "applied",
    commandId: value.commandId,
    commandDigest: value.commandDigest,
    expectedRevision: 0,
    currentRevision: 1,
    receipt,
    reason: null,
  })));
  assert.throws(() => validateReceipt({ ...receipt, committedRevision: 2 }));
  assert.throws(() => validateResult({
    schemaVersion: SCHEMA_VERSION,
    outcome: "outcome_unknown",
    commandId: value.commandId,
    commandDigest: value.commandDigest,
    expectedRevision: 0,
    currentRevision: 0,
    receipt: null,
    reason: "unreadable",
  }));
});

test("P02 applied results reject a valid receipt belonging to another triplet", () => {
  const requestA = request(1), requestB = request(2, 1);
  const base = {
    schemaVersion: SCHEMA_VERSION,
    commandId: requestB.commandId,
    commandDigest: requestB.commandDigest,
    expectedRevision: requestB.expectedRevision,
    committedRevision: 2,
    campaignId: requestB.command.campaignId,
    objectId: requestB.command.objectId,
    beforeName: "Same Name",
    afterName: requestB.command.newName,
    historyFact: requestB.command.historyFact,
  };
  const foreignReceipt = { ...base, receiptDigest: receiptDigest(base) };
  assert.throws(() => validateResult({
    schemaVersion: SCHEMA_VERSION,
    outcome: "applied",
    commandId: requestA.commandId,
    commandDigest: requestA.commandDigest,
    expectedRevision: requestA.expectedRevision,
    currentRevision: 2,
    receipt: foreignReceipt,
    reason: null,
  }), /does not bind/);
});
