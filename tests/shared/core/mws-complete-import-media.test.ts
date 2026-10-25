import test from "node:test";
import assert from "node:assert/strict";
import {
  campaignCommandId,
  campaignContext,
  campaignId,
  campaignLocalId,
  campaignNamespace,
  campaignReceiptId,
  campaignRevision,
  campaignSnapshot,
  type CampaignContextProjection,
  type CampaignIdRemapV1,
} from "../../../src/features/campaign/campaign-contracts";
import {
  campaignDomainOwnerPolicyDigest,
  campaignDomainOwnershipProjectionDigest,
  type CampaignDomainOwnershipProjectionV1,
  type CampaignMultiOwnerStageInputV1,
  type CampaignOwnerRegistryPort,
  type CampaignOwnershipDigest,
  type CampaignOwnershipReadOutcome,
  type CampaignOwnershipVerifyOutcome,
} from "../../../src/features/campaign/campaign-ownership";
import {
  MwsCompleteImportMediaAdapter,
  type MwsImportMediaInventoryPort,
  type MwsImportMediaInventoryReadOutcome,
  type MwsImportMediaInventoryV1,
  type MwsImportMediaInventoryVerifyOutcome,
} from "../../../src/features/campaign/mws-complete-import-media";

const digest = (letter: string) => `sha256:${letter.repeat(64)}`;
const digestPort: CampaignOwnershipDigest = (value) => {
  let total = 0;
  for (const char of value) total = (total + char.charCodeAt(0)) % 16;
  return digest(total.toString(16));
};
const ids = {
  campaign: campaignId("00000000-0000-4000-8000-000000000001"),
  namespace: campaignNamespace("00000000-0000-4000-8000-000000000002"),
  audio: campaignLocalId("00000000-0000-4000-8000-000000000050"),
  cue: campaignLocalId("00000000-0000-4000-8000-000000000051"),
  scene: campaignLocalId("00000000-0000-4000-8000-000000000052"),
  runtime: campaignLocalId("00000000-0000-4000-8000-000000000053"),
  decision: campaignLocalId("00000000-0000-4000-8000-000000000054"),
  override: campaignLocalId("00000000-0000-4000-8000-000000000055"),
};
const target = (id: string) => id.replace(/0000([0-9a-f]{4})$/, "1000$1");
const snapshot = campaignSnapshot({ schemaVersion: 1, campaignId: ids.campaign,
  revision: campaignRevision(7), name: "Salzmarsch", namespace: ids.namespace, lifecycle: "active" });
const context = (): CampaignContextProjection => campaignContext(snapshot, "context.mws.v1" as CampaignContextProjection["contextToken"]);
const records = [
  { id: ids.audio, recordType: "audio-source", references: [], payloadDigest: digest("a"),
    media: { metadataDigest: digest("b"), byteDigest: digest("c") } },
  { id: ids.cue, recordType: "music-cue", references: [{ id: ids.audio, scope: "campaign-local" as const, schema: "refs.v1" }], payloadDigest: digest("d"), media: null },
  { id: ids.scene, recordType: "scene-audio", references: [{ id: ids.cue, scope: "campaign-local" as const, schema: "refs.v1" }], payloadDigest: digest("e"), media: null },
  { id: ids.runtime, recordType: "runtime-audio", references: [{ id: ids.scene, scope: "campaign-local" as const, schema: "refs.v1" }], payloadDigest: digest("f"), media: null },
  { id: ids.decision, recordType: "manual-decision", references: [], payloadDigest: digest("1"), media: null },
  { id: ids.override, recordType: "ambience-override", references: [{ id: ids.scene, scope: "campaign-local" as const, schema: "refs.v1" }], payloadDigest: digest("2"), media: null },
];
const projection = (): CampaignDomainOwnershipProjectionV1 => {
  let value: CampaignDomainOwnershipProjectionV1 = {
    version: 1, registryId: "e2e01.registry", registryRevision: "registry.v1",
    projectionDigest: digest("0"), context: context(), owners: [{
      ownerId: "media", ownerRevision: "media.owner.v1", schemaRevision: "media.schema.v1",
      snapshotRevision: "media.snapshot.v1", policyRevision: "media.policy.v1", policyDigest: digest("0"),
      availability: "confirmed", emptyConfirmed: false, referenceSchemas: ["refs.v1"],
      source: { adapterType: "media-library", generation: "media.g1" }, records,
      transferPolicies: [
        { recordId: ids.decision, transfer: "remap-required", sourceDisposition: "retain" },
        { recordId: ids.override, transfer: "fresh-target-required", sourceDisposition: "owner-suspend-after-publish" },
      ],
    }],
  };
  value = { ...value, owners: value.owners.map((owner) => ({ ...owner,
    policyDigest: campaignDomainOwnerPolicyDigest(owner, digestPort) })) };
  return { ...value, projectionDigest: campaignDomainOwnershipProjectionDigest(value, digestPort) };
};
const closure = (survivors = records.filter((record) => record.id !== ids.override).map((record) => record.id)):
readonly CampaignIdRemapV1[] => [
  { entityType: "campaign", sourceId: ids.campaign, targetId: "00000000-0000-4000-8000-000000001001" },
  { entityType: "namespace", sourceId: ids.namespace, targetId: "00000000-0000-4000-8000-000000001002" },
  ...survivors.map((id) => ({ entityType: records.find((record) => record.id === id)!.recordType,
    sourceId: id, targetId: target(id) })),
];
const baseInput = (): CampaignMultiOwnerStageInputV1 => {
  const owner = projection().owners[0]!;
  return {
    commandId: campaignCommandId("00000000-0000-4000-8000-000000000201"),
    receiptId: campaignReceiptId("00000000-0000-4000-8000-000000000202"),
    kind: "complete-import", participants: [{ ownerId: owner.ownerId, ownerRevision: owner.ownerRevision,
      schemaRevision: owner.schemaRevision, snapshotRevision: owner.snapshotRevision,
      policyRevision: owner.policyRevision, policyDigest: owner.policyDigest,
      beforeDigest: digest("3"), afterDigest: digest("4") }], closure: closure(),
    freshTargets: [{ ownerId: owner.ownerId, sourceRecordId: ids.override,
      recordType: "ambience-override", targetId: campaignLocalId(target(ids.override)), targetDigest: digest("5"),
      policyRevision: owner.policyRevision, policyDigest: owner.policyDigest }], salvage: null,
  };
};

class Registry implements CampaignOwnerRegistryPort {
  current = projection();
  verifyOutcome: CampaignOwnershipVerifyOutcome = { kind: "current" };
  async read(): Promise<CampaignOwnershipReadOutcome> { return { kind: "confirmed", projection: this.current }; }
  async verify(): Promise<CampaignOwnershipVerifyOutcome> { return this.verifyOutcome; }
}
class Inventory implements MwsImportMediaInventoryPort {
  current: MwsImportMediaInventoryV1 = { version: 1, importId: "import.mws.v1", revision: "inventory.v1",
    assets: [{ sourceId: ids.audio, availability: "available", metadataDigest: digest("b"), byteDigest: digest("c") }] };
  readOutcome?: MwsImportMediaInventoryReadOutcome;
  verifyOutcome: MwsImportMediaInventoryVerifyOutcome = { kind: "current" };
  entered?: () => void;
  wait?: Promise<void>;
  async read(): Promise<MwsImportMediaInventoryReadOutcome> {
    this.entered?.();
    await this.wait;
    return this.readOutcome ?? { kind: "confirmed", inventory: this.current };
  }
  async verify(): Promise<MwsImportMediaInventoryVerifyOutcome> { return this.verifyOutcome; }
}
const setup = () => {
  const registry = new Registry(), inventory = new Inventory();
  return { registry, inventory, adapter: new MwsCompleteImportMediaAdapter(registry, inventory, digestPort) };
};
const salvageInput = (disposition: "omit" | "quarantine"): CampaignMultiOwnerStageInputV1 => {
  const base = baseInput(), survivors = records.filter((record) => ![ids.override, ids.audio, ids.cue, ids.scene, ids.runtime].includes(record.id));
  const omissions = disposition === "omit" ? [{ sourceId: ids.audio, reason: "Datei fehlt", impact: "Musik ist nach Import nicht verfügbar." },
    ...[ids.cue, ids.scene, ids.runtime].map((sourceId) => ({ sourceId, reason: "Audioabhängigkeit fehlt", impact: "Abhängige Audiokonfiguration wird ausgelassen." }))] : [];
  const quarantine = disposition === "quarantine" ? [{ sourceId: ids.audio, retention: "unknown-retained" as const,
    originalDigest: digest("a"), reason: "Bytehash weicht ab", referenceIds: [] },
    ...[ids.cue, ids.scene, ids.runtime].map((sourceId) => ({ sourceId, retention: "opaque" as const,
      originalDigest: records.find((record) => record.id === sourceId)!.payloadDigest,
      reason: "Abhängige Audiokonfiguration ist nicht sicher aktivierbar",
      referenceIds: records.find((record) => record.id === sourceId)!.references.map((reference) => reference.id) }))] : [];
  return { ...base, kind: "salvage-import", closure: closure(survivors.map((record) => record.id)), salvage: {
    decisionId: "salvage.mws.v1", survivors: closure(survivors.map((record) => record.id)).slice(2),
    omissions, quarantine, survivorDigest: digest("6"), omissionDigest: digest("7"), quarantineDigest: digest("8"),
  } };
};

test("complete media review exposes a ready immutable view and returns the exact guarded stage input", async () => {
  const { adapter } = setup(), input = baseInput(), review = await adapter.review(context(), input);
  assert.equal(review.outcome, "ready"); assert.equal(review.mode, "complete");
  assert.equal(review.rows[0]!.status, "verified"); assert.equal(Object.isFrozen(review.rows), true);
  assert.deepEqual(await adapter.accept(review), input);
});

test("complete media review blocks missing and hash-mismatched audio bytes", async () => {
  for (const value of [
    { sourceId: ids.audio, availability: "missing" as const, metadataDigest: null, byteDigest: null },
    { sourceId: ids.audio, availability: "available" as const, metadataDigest: digest("b"), byteDigest: digest("9") },
  ]) {
    const { adapter, inventory } = setup(); inventory.current = { ...inventory.current, assets: [value] };
    const review = await adapter.review(context(), baseInput());
    assert.equal(review.outcome, "blocked");
    await assert.rejects(() => adapter.accept(review), /Blockierter Medienimport/);
  }
});

test("salvage requires explicit matching confirmation and distinguishes omission from retained quarantine", async () => {
  const missing = setup(); missing.inventory.current = { ...missing.inventory.current,
    assets: [{ sourceId: ids.audio, availability: "missing", metadataDigest: null, byteDigest: null }] };
  const omission = await missing.adapter.review(context(), salvageInput("omit"));
  assert.equal(omission.outcome, "confirmation-required"); assert.equal(omission.rows[0]!.action, "omit");
  assert.deepEqual(omission.rows.map((row) => [row.recordType, row.action]), [
    ["audio-source", "omit"], ["music-cue", "omit"], ["scene-audio", "omit"],
    ["runtime-audio", "omit"], ["manual-decision", "transfer"],
    ["ambience-override", "fresh-target"],
  ]);
  const omittedAudio = omission.rows.find((row) => row.recordType === "audio-source")!,
    omittedCue = omission.rows.find((row) => row.recordType === "music-cue")!;
  assert.deepEqual([omittedAudio.reason, omittedAudio.impact],
    ["Datei fehlt", "Musik ist nach Import nicht verfügbar."]);
  assert.deepEqual([omittedCue.reason, omittedCue.impact],
    ["Audioabhängigkeit fehlt", "Abhängige Audiokonfiguration wird ausgelassen."]);
  assert.match(omittedAudio.message, /Datei fehlt.*Musik ist nach Import nicht verfügbar/);
  await assert.rejects(() => missing.adapter.accept(omission, "salvage.other"), /nicht ausdrücklich bestätigt/);
  assert.equal((await missing.adapter.accept(omission, "salvage.mws.v1")).kind, "salvage-import");

  const changed = setup(); changed.inventory.current = { ...changed.inventory.current,
    assets: [{ sourceId: ids.audio, availability: "available", metadataDigest: digest("b"), byteDigest: digest("9") }] };
  const quarantine = await changed.adapter.review(context(), salvageInput("quarantine"));
  assert.equal(quarantine.rows[0]!.action, "quarantine");
  assert.equal(quarantine.rows.filter((row) => row.action === "quarantine").length, 4);
  assert.deepEqual([quarantine.rows[0]!.reason, quarantine.rows[0]!.retention],
    ["Bytehash weicht ab", "unknown-retained"]);
  assert.equal((await changed.adapter.accept(quarantine, "salvage.mws.v1")).salvage!.quarantine[0]!.sourceId, ids.audio);
});

test("media inventory rejects duplicate, foreign and false missing evidence", async () => {
  const values: MwsImportMediaInventoryV1["assets"][] = [
    [
      { sourceId: ids.audio, availability: "available", metadataDigest: digest("b"), byteDigest: digest("c") },
      { sourceId: ids.audio, availability: "available", metadataDigest: digest("b"), byteDigest: digest("c") },
    ],
    [{ sourceId: ids.cue, availability: "available", metadataDigest: digest("b"), byteDigest: digest("c") }],
    [{ sourceId: ids.audio, availability: "missing", metadataDigest: digest("b"), byteDigest: null }],
  ];
  for (const assets of values) {
    const { adapter, inventory } = setup(); inventory.current = { ...inventory.current, assets };
    await assert.rejects(() => adapter.review(context(), baseInput()), /Medieninventar|Medium/);
  }
});

test("manual decisions survive, ambience overrides use fresh targets and dangling media survivors fail closed", async () => {
  const { adapter } = setup(), base = baseInput();
  await assert.rejects(() => adapter.review(context(), { ...base,
    closure: base.closure.filter((item) => item.sourceId !== ids.decision) }), /ManualDecision/);
  await assert.rejects(() => adapter.review(context(), { ...base,
    closure: [...base.closure, { entityType: "ambience-override", sourceId: ids.override, targetId: target(ids.override) }] }), /AmbienceOverride/);
  await assert.rejects(() => adapter.review(context(), { ...base, freshTargets: [] }), /frische Zielprojektion/);
  await assert.rejects(() => adapter.review(context(), { ...base,
    closure: base.closure.map((item) => item.sourceId === ids.audio ? { ...item, entityType: "music-cue" } : item) }), /Medien-ID-Remap/);
  await assert.rejects(() => adapter.review(context(), { ...base,
    closure: base.closure.map((item) => item.sourceId === ids.audio ? { ...item, targetId: ids.audio } : item) }), /Medien-ID-Remap/);

  const missing = setup(); missing.inventory.current = { ...missing.inventory.current,
    assets: [{ sourceId: ids.audio, availability: "missing", metadataDigest: null, byteDigest: null }] };
  const bad = salvageInput("omit"), cue = records.find((record) => record.id === ids.cue)!;
  await assert.rejects(() => missing.adapter.review(context(), { ...bad,
    closure: [...bad.closure, { entityType: cue.recordType, sourceId: cue.id, targetId: target(cue.id) }],
    salvage: { ...bad.salvage!, survivors: [...bad.salvage!.survivors,
      { entityType: cue.recordType, sourceId: cue.id, targetId: target(cue.id) }],
      omissions: bad.salvage!.omissions.filter((item) => item.sourceId !== cue.id) } }), /hängt|vollständig/);
});

test("registry, policy and inventory races fail closed at acceptance", async () => {
  for (const race of ["registry", "policy", "inventory"] as const) {
    const { adapter, registry, inventory } = setup(), review = await adapter.review(context(), baseInput());
    if (race === "registry") registry.verifyOutcome = { kind: "stale" };
    else if (race === "inventory") inventory.verifyOutcome = { kind: "stale" };
    else registry.current = { ...registry.current, owners: registry.current.owners.map((owner) => ({ ...owner,
      policyRevision: "media.policy.v2" })) };
    if (race === "policy") registry.verifyOutcome = { kind: "stale" };
    await assert.rejects(() => adapter.accept(review), /stale/);
  }
});

test("review snapshots closure and salvage decision before the first asynchronous port", async () => {
  const { adapter, inventory } = setup();
  inventory.current = { ...inventory.current,
    assets: [{ sourceId: ids.audio, availability: "missing", metadataDigest: null, byteDigest: null }] };
  let release!: () => void, entered!: () => void;
  const enteredPromise = new Promise<void>((resolve) => { entered = resolve; });
  inventory.entered = entered;
  inventory.wait = new Promise<void>((resolve) => { release = resolve; });
  const input = salvageInput("omit"), pending = adapter.review(context(), input);
  await enteredPromise;
  (input as { closure: CampaignMultiOwnerStageInputV1["closure"] }).closure = [];
  (input.salvage as { decisionId: string }).decisionId = "salvage.mutated";
  release();
  const review = await pending, accepted = await adapter.accept(review, "salvage.mws.v1");
  assert.equal(review.decisionId, "salvage.mws.v1");
  assert.equal(accepted.salvage!.decisionId, "salvage.mws.v1");
  assert.equal(accepted.closure.some((item) => item.sourceId === ids.decision), true);
});

test("foreign reviews and unavailable inventory cannot be accepted or silently degraded", async () => {
  const first = setup(), second = setup(), review = await first.adapter.review(context(), baseInput());
  await assert.rejects(() => second.adapter.accept(review), /stammt nicht/);
  const unavailable = setup(); unavailable.inventory.readOutcome = { kind: "unavailable" };
  await assert.rejects(() => unavailable.adapter.review(context(), baseInput()), /unavailable/);
});
