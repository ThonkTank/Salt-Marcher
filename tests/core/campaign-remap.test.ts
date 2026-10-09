import test from "node:test";
import assert from "node:assert/strict";
import {
  campaignId,
  campaignLocalId,
  campaignNamespace,
  campaignRevision,
  campaignSnapshot,
  type CampaignDeliveryV1,
  type CampaignOwnerInventoryV1,
} from "../../src/features/campaign/campaign-contracts";
import { stageCampaignRemap } from "../../src/features/campaign/campaign-remap";

const sourceId = campaignId("00000000-0000-4000-8000-000000000001"),
  sourceNamespace = campaignNamespace("00000000-0000-4000-8000-000000000002"),
  targetId = campaignId("00000000-0000-4000-8000-000000000101"),
  targetNamespace = campaignNamespace("00000000-0000-4000-8000-000000000102"),
  worldId = campaignLocalId("00000000-0000-4000-8000-000000000201"),
  locationId = campaignLocalId("00000000-0000-4000-8000-000000000202"),
  dungeonId = campaignLocalId("00000000-0000-4000-8000-000000000203"),
  encounterId = campaignLocalId("00000000-0000-4000-8000-000000000204"),
  audioId = campaignLocalId("00000000-0000-4000-8000-000000000205"),
  cueId = campaignLocalId("00000000-0000-4000-8000-000000000206"),
  digest = (letter: string) => `sha256:${letter.repeat(64)}`;
const source = campaignSnapshot({
  schemaVersion: 1, campaignId: sourceId, revision: campaignRevision(7),
  name: "Salzmarsch", namespace: sourceNamespace, lifecycle: "active",
});
const evidence = (recordId: typeof worldId, letter: string, audio = false) => ({
  recordId, digest: digest(letter), referenceSchema: "refs.v1",
  media: audio ? { metadataDigest: digest("d"), byteDigest: digest("e") } : null,
});
const owner = (
  ownerId: string,
  records: CampaignOwnerInventoryV1["records"],
): CampaignOwnerInventoryV1 => ({
  version: 1, sourceCampaignId: sourceId, ownerId,
  ownerRevision: `${ownerId}.owner.v1`, schemaRevision: `${ownerId}.schema.v1`,
  snapshotRevision: `${ownerId}.snapshot.v1`, availability: "confirmed",
  referenceSchemas: [...new Set(["refs.v1", ...records.flatMap((record) =>
    record.references.map((reference) => reference.schema))])].sort(),
  emptyConfirmed: records.length === 0, recordCount: records.length, records,
  payloadEvidence: records.map((record, index) =>
    evidence(record.id, String.fromCharCode(97 + index), record.recordType === "audio-source")),
});
const inventories: readonly CampaignOwnerInventoryV1[] = [
  owner("atlas", [
    { id: worldId, recordType: "world", references: [
      { id: locationId, scope: "campaign-local", schema: "location.v1" },
      { id: "catalog:srd51:goblin", scope: "shared", schema: "catalog-entry.v1" },
    ] },
    { id: locationId, recordType: "location", references: [] },
  ]),
  owner("dungeon", [
    { id: dungeonId, recordType: "dungeon", references: [
      { id: encounterId, scope: "campaign-local", schema: "encounter-plan.v1" },
    ] },
    { id: encounterId, recordType: "encounter-plan", references: [
      { id: "catalog:srd51:goblin", scope: "shared", schema: "catalog-entry.v1" },
    ] },
  ]),
  owner("media", [
    { id: audioId, recordType: "audio-source", references: [] },
    { id: cueId, recordType: "music-cue", references: [
      { id: audioId, scope: "campaign-local", schema: "audio-source.v1" },
    ] },
  ]),
];
const delivery = (changes: Partial<CampaignDeliveryV1> = {}): CampaignDeliveryV1 => ({
  version: 1, sourceCampaignId: sourceId, sourceNamespace,
  expectedOwners: inventories.map((inventory) => ({
    ownerId: inventory.ownerId, ownerRevision: inventory.ownerRevision,
    schemaRevision: inventory.schemaRevision, snapshotRevision: inventory.snapshotRevision,
    referenceSchemas: inventory.referenceSchemas,
  })),
  inventories,
  ...changes,
});
const factories = () => {
  const local = [
    "00000000-0000-4000-8000-000000000301",
    "00000000-0000-4000-8000-000000000302",
    "00000000-0000-4000-8000-000000000303",
    "00000000-0000-4000-8000-000000000304",
    "00000000-0000-4000-8000-000000000305",
    "00000000-0000-4000-8000-000000000306",
  ].map(campaignLocalId);
  return {
    campaignId: () => targetId,
    namespace: () => targetNamespace,
    localId: () => local.shift()!,
  };
};

test("complete owner delivery produces one immutable closure and only an invisible Campaign/Data stage", () => {
  const before = structuredClone(delivery()), stage = stageCampaignRemap(source, delivery(), "Salzmarsch Kopie", factories());
  assert.equal(stage.visible, false);
  assert.equal(stage.ownerId, "campaign-data");
  assert.equal(stage.snapshot.campaignId, targetId);
  assert.equal(stage.snapshot.namespace, targetNamespace);
  assert.equal(stage.snapshot.revision, 1);
  assert.deepEqual(stage.plan.ownerIds, ["atlas", "dungeon", "media"]);
  assert.deepEqual(stage.plan.sharedReferences, ["catalog:srd51:goblin"]);
  assert.deepEqual(stage.plan.closure.slice(0, 2), [
    { entityType: "campaign", sourceId, targetId },
    { entityType: "namespace", sourceId: sourceNamespace, targetId: targetNamespace },
  ]);
  assert.equal(stage.plan.closure.length, 8);
  assert.equal(new Set(stage.plan.closure.map((entry) => entry.targetId)).size, 8);
  assert.equal(Object.isFrozen(stage), true);
  assert.equal(Object.isFrozen(stage.plan.closure), true);
  assert.deepEqual(delivery(), before);
});

test("missing, unknown or stale owners fail before a participant stage exists", () => {
  const missing = delivery({ inventories: inventories.slice(0, 2) });
  assert.throws(() => stageCampaignRemap(source, missing, "Ziel", factories()), /Ownerabdeckung/);
  const unavailable = inventories.map((value) => value.ownerId === "media" ? { ...value, availability: "unavailable" as const } : value);
  assert.throws(() => stageCampaignRemap(source, delivery({ inventories: unavailable }), "Ziel", factories()), /nicht verfügbar/);
  const staleExpected = delivery({ expectedOwners: delivery().expectedOwners.map((value) =>
    value.ownerId === "atlas" ? { ...value, snapshotRevision: "atlas.snapshot.v2" } : value) });
  assert.throws(() => stageCampaignRemap(source, staleExpected, "Ziel", factories()), /stale/);
});

test("omitted unreferenced records and missing payload evidence are rejected", () => {
  const shortAtlas = { ...inventories[0]!, recordCount: 2, records: inventories[0]!.records.slice(0, 1),
    payloadEvidence: inventories[0]!.payloadEvidence.slice(0, 1) };
  assert.throws(() => stageCampaignRemap(source, delivery({ inventories: [shortAtlas, ...inventories.slice(1)] }), "Ziel", factories()), /nicht vollständig/);
  const noEvidence = { ...inventories[1]!, payloadEvidence: inventories[1]!.payloadEvidence.slice(0, 1) };
  assert.throws(() => stageCampaignRemap(source, delivery({ inventories: [inventories[0]!, noEvidence, inventories[2]!] }), "Ziel", factories()), /Payloadabdeckung/);
});

test("dangling, unclassified and shared-local collisions fail closed", () => {
  const danglingId = campaignLocalId("00000000-0000-4000-8000-000000000999");
  const danglingAtlas = { ...inventories[0]!, records: inventories[0]!.records.map((record, index) =>
    index === 0 ? { ...record, references: [{ id: danglingId, scope: "campaign-local" as const, schema: "location.v1" }] } : record) };
  assert.throws(() => stageCampaignRemap(source, delivery({ inventories: [danglingAtlas, ...inventories.slice(1)] }), "Ziel", factories()), /hängt frei/);
  const collisionDungeon = { ...inventories[1]!, records: inventories[1]!.records.map((record, index) =>
    index === 0 ? { ...record, references: [{ id: worldId, scope: "shared" as const, schema: "encounter-plan.v1" }] } : record) };
  assert.throws(() => stageCampaignRemap(source, delivery({ inventories: [inventories[0]!, collisionDungeon, inventories[2]!] }), "Ziel", factories()), /kollidiert/);
  const invalidScope = structuredClone(inventories[0]) as unknown as { records: { references: { scope: string }[] }[] };
  invalidScope.records[0]!.references[0]!.scope = "mystery";
  assert.throws(() => stageCampaignRemap(source, delivery({ inventories: [invalidScope as unknown as CampaignOwnerInventoryV1, ...inventories.slice(1)] }), "Ziel", factories()), /Unklassifizierte/);
});

test("media inventory requires supported reference schemas plus AudioSource metadata and byte evidence", () => {
  const unsupportedMedia = { ...inventories[2]!, records: inventories[2]!.records.map((record) =>
    record.recordType === "music-cue" ? { ...record, references: record.references.map((reference) =>
      ({ ...reference, schema: "audio-source.v2" })) } : record) };
  assert.throws(() => stageCampaignRemap(source, delivery({
    inventories: [inventories[0]!, inventories[1]!, unsupportedMedia],
  }), "Ziel", factories()), /Nicht unterstütztes Referenzschema/);
  const missingMediaEvidence = { ...inventories[2]!, payloadEvidence: inventories[2]!.payloadEvidence.map((value) =>
    value.recordId === audioId ? { ...value, media: null } : value) };
  assert.throws(() => stageCampaignRemap(source, delivery({
    inventories: [inventories[0]!, inventories[1]!, missingMediaEvidence],
  }), "Ziel", factories()), /AudioSource/);
});

test("source reuse, duplicate target IDs and foreign deliveries cannot form a remap", () => {
  assert.throws(() => stageCampaignRemap(source, delivery(), "Ziel", { ...factories(), campaignId: () => sourceId }), /nicht unabhängig/);
  const duplicate = campaignLocalId("00000000-0000-4000-8000-000000000301");
  assert.throws(() => stageCampaignRemap(source, delivery(), "Ziel", {
    ...factories(), localId: () => duplicate,
  }), /keine eindeutigen/);
  assert.throws(() => stageCampaignRemap(source, delivery({ sourceCampaignId: targetId }), "Ziel", factories()), /anderen Quelle/);
});
