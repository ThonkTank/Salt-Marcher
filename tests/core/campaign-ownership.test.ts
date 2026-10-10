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
} from "../../src/features/campaign/campaign-contracts";
import {
  CampaignOwnershipCoordinator,
  campaignDomainOwnershipProjection,
  campaignDomainOwnershipProjectionDigest,
  campaignOwnershipDigestValue,
  type CampaignDomainOwnershipProjectionV1,
  type CampaignMultiOwnerPublishPort,
  type CampaignMultiOwnerPublishRequestV1,
  type CampaignOwnerRegistryPort,
  type CampaignOwnershipDigest,
  type CampaignOwnershipReadOutcome,
  type CampaignOwnershipVerifyOutcome,
  type CampaignSalvageProjectionV1,
} from "../../src/features/campaign/campaign-ownership";

const ids = {
  campaign: campaignId("00000000-0000-4000-8000-000000000001"),
  namespace: campaignNamespace("00000000-0000-4000-8000-000000000002"),
  world: campaignLocalId("00000000-0000-4000-8000-000000000010"),
  location: campaignLocalId("00000000-0000-4000-8000-000000000011"),
  city: campaignLocalId("00000000-0000-4000-8000-000000000100"),
  building: campaignLocalId("00000000-0000-4000-8000-000000000105"),
  dungeon: campaignLocalId("00000000-0000-4000-8000-000000000030"),
  floor: campaignLocalId("00000000-0000-4000-8000-000000000032"),
  room: campaignLocalId("00000000-0000-4000-8000-000000000031"),
  route: campaignLocalId("00000000-0000-4000-8000-000000000033"),
  section: campaignLocalId("00000000-0000-4000-8000-000000000034"),
  audio: campaignLocalId("00000000-0000-4000-8000-000000000050"),
  cue: campaignLocalId("00000000-0000-4000-8000-000000000051"),
  scene: campaignLocalId("00000000-0000-4000-8000-000000000052"),
  runtime: campaignLocalId("00000000-0000-4000-8000-000000000053"),
};
const target = (id: string) => id.replace(/0000([0-9a-f]{4})$/, "1000$1");
const digest = (letter: string) => `sha256:${letter.repeat(64)}`;
const digestPort: CampaignOwnershipDigest = (value) => {
  let total = 0;
  for (const char of value) total = (total + char.charCodeAt(0)) % 16;
  return digest(total.toString(16));
};
const snapshot = campaignSnapshot({ schemaVersion: 1, campaignId: ids.campaign,
  revision: campaignRevision(7), name: "Salzmarsch", namespace: ids.namespace, lifecycle: "active" });
const context = (token = "context.a1") => campaignContext(snapshot, token as ReturnType<typeof campaignContext>["contextToken"]);
const refs = (id: string) => [{ id, scope: "campaign-local" as const, schema: "refs.v1" }];
const worldRecords = [
  { id: ids.world, recordType: "world", references: refs(ids.location) },
  { id: ids.location, recordType: "location", references: refs(ids.city) },
  { id: ids.city, recordType: "city", references: refs(ids.building) },
  { id: ids.building, recordType: "building", references: refs(ids.dungeon) },
  { id: ids.dungeon, recordType: "dungeon", references: refs(ids.floor) },
  { id: ids.floor, recordType: "floor", references: refs(ids.room) },
  { id: ids.room, recordType: "room", references: refs(ids.route) },
  { id: ids.route, recordType: "route", references: refs(ids.section) },
  { id: ids.section, recordType: "section", references: [] },
];
const mediaRecords = [
  { id: ids.audio, recordType: "audio-source", references: [] },
  { id: ids.cue, recordType: "music-cue", references: refs(ids.audio) },
  { id: ids.scene, recordType: "scene-audio", references: refs(ids.cue) },
  { id: ids.runtime, recordType: "runtime-audio", references: refs(ids.scene) },
];
const recordTypes = new Map([...worldRecords, ...mediaRecords].map((record) => [record.id, record.recordType]));
const projection = (ctx = context()): CampaignDomainOwnershipProjectionV1 => {
  const result: CampaignDomainOwnershipProjectionV1 = {
    version: 1, registryId: "e2e01.registry", registryRevision: "registry.v1",
    projectionDigest: digest("f"), context: ctx,
    owners: [
    { ownerId: "media", ownerRevision: "media.owner.v1", schemaRevision: "media.schema.v1",
      snapshotRevision: "media.snapshot.v1", availability: "confirmed", emptyConfirmed: false,
      referenceSchemas: ["refs.v1"], source: { adapterType: "media-library", generation: "media.g1" },
      records: mediaRecords.map((record, index) => ({ ...record, payloadDigest: digest(String.fromCharCode(97 + index)),
        media: record.recordType === "audio-source" ? { metadataDigest: digest("d"), byteDigest: digest("e") } : null })) },
    { ownerId: "world", ownerRevision: "world.owner.v1", schemaRevision: "world.schema.v2",
      snapshotRevision: "world.snapshot.v1", availability: "confirmed", emptyConfirmed: false,
      referenceSchemas: ["refs.v1"], source: { adapterType: "atlas-spatial-graph", generation: "repository.g7" },
      records: worldRecords.map((record, index) => ({ ...record, payloadDigest: digest((index + 1).toString(16)), media: null })) },
    ],
  };
  return { ...result, projectionDigest: campaignDomainOwnershipProjectionDigest(result, digestPort) };
};
const closure = (recordIds = [...worldRecords, ...mediaRecords].map((record) => record.id)): readonly CampaignIdRemapV1[] => [
  { entityType: "campaign", sourceId: ids.campaign, targetId: "00000000-0000-4000-8000-000000001001" },
  { entityType: "namespace", sourceId: ids.namespace, targetId: "00000000-0000-4000-8000-000000001002" },
  ...recordIds.map((id) => ({ entityType: recordTypes.get(id)!, sourceId: id, targetId: target(id) })),
];
const participants = () => projection().owners.map((owner, index) => ({
  ownerId: owner.ownerId, ownerRevision: owner.ownerRevision, schemaRevision: owner.schemaRevision,
  snapshotRevision: owner.snapshotRevision, beforeDigest: digest(index ? "8" : "6"), afterDigest: digest(index ? "9" : "7"),
}));

class Registry implements CampaignOwnerRegistryPort {
  current = projection();
  verifyOutcome: CampaignOwnershipVerifyOutcome = { kind: "current" };
  afterVerify?: () => void;
  async read(): Promise<CampaignOwnershipReadOutcome> { return { kind: "confirmed", projection: this.current }; }
  async verify() { const result = this.verifyOutcome; this.afterVerify?.(); return result; }
}
class Publisher implements CampaignMultiOwnerPublishPort {
  current = projection();
  published = new Map<string, { fingerprint: string; outcome: { readonly kind: "confirmed" } }>();
  calls = 0;
  beforeCompare?: () => void;
  returnUnknownAfterPublish = false;
  async publish(request: CampaignMultiOwnerPublishRequestV1) {
    this.calls += 1; this.beforeCompare?.();
    const key = `${request.envelope.commandId}:${request.envelope.receiptId}`, prior = this.published.get(key);
    if (prior) return prior.fingerprint === request.envelope.fingerprint ? prior.outcome : { kind: "conflict" as const };
    const p = request.preconditions, c = this.current.context;
    if (c.campaignId !== p.context.campaignId || c.revision !== p.context.revision ||
        c.namespace !== p.context.namespace || c.contextToken !== p.context.contextToken ||
        this.current.registryId !== p.registryId || this.current.registryRevision !== p.registryRevision ||
        this.current.projectionDigest !== p.projectionDigest) return { kind: "conflict" as const };
    for (const participant of p.participants) {
      const owner = this.current.owners.find((item) => item.ownerId === participant.ownerId);
      if (!owner || owner.ownerRevision !== participant.ownerRevision || owner.schemaRevision !== participant.schemaRevision ||
          owner.snapshotRevision !== participant.snapshotRevision) return { kind: "conflict" as const };
    }
    const outcome = { kind: "confirmed" as const };
    this.published.set(key, { fingerprint: request.envelope.fingerprint, outcome });
    if (this.returnUnknownAfterPublish) {
      this.returnUnknownAfterPublish = false;
      return { kind: "outcome_unknown" as const };
    }
    return outcome;
  }
  async status(commandId: ReturnType<typeof campaignCommandId>, receiptId: ReturnType<typeof campaignReceiptId>) {
    return this.published.get(`${commandId}:${receiptId}`)?.outcome ?? { kind: "outcome_unknown" as const };
  }
}
const setup = (ctx: CampaignContextProjection = context()) => {
  const registry = new Registry(), publisher = new Publisher();
  let active: CampaignContextProjection | null = ctx;
  registry.current = projection(ctx); publisher.current = projection(ctx);
  return { registry, publisher, setContext: (value: CampaignContextProjection | null) => { active = value; },
    coordinator: new CampaignOwnershipCoordinator(registry, publisher, () => active, digestPort) };
};
const completeInput = () => ({ commandId: campaignCommandId("00000000-0000-4000-8000-000000000201"),
  receiptId: campaignReceiptId("00000000-0000-4000-8000-000000000202"), kind: "complete-import" as const,
  participants: participants(), closure: closure(), salvage: null });

test("ownership projection is immutable, complete and keeps media byte evidence", () => {
  const checked = campaignDomainOwnershipProjection(projection());
  assert.equal(Object.isFrozen(checked), true);
  assert.equal(Object.isFrozen(checked.owners[0]!.records), true);
  assert.equal(checked.owners[0]!.records.find((record) => record.id === ids.audio)!.media!.byteDigest, digest("e"));
  const invalid = structuredClone(projection()) as unknown as { owners: { records: { recordType: string }[] }[] };
  invalid.owners[1]!.records[0]!.recordType = "audio-source";
  assert.throws(() => campaignDomainOwnershipProjection(
    invalid as unknown as CampaignDomainOwnershipProjectionV1,
  ), /AudioSource/);
});

test("complete command freezes original context, registry, participants, command and receipt", async () => {
  const { coordinator, publisher } = setup(), input = completeInput(), envelope = await coordinator.stage(input);
  assert.equal(envelope.commandId, input.commandId); assert.equal(envelope.receiptId, input.receiptId);
  assert.equal(envelope.registryRevision, "registry.v1"); assert.equal(Object.isFrozen(envelope), true);
  assert.deepEqual(await coordinator.publish(input.commandId), { kind: "confirmed" });
  assert.deepEqual(await coordinator.status(input.commandId), { kind: "confirmed" });
  assert.equal(publisher.calls, 1);
  assert.equal(await coordinator.stage(input), envelope);
  await assert.rejects(() => coordinator.stage({ ...input, receiptId: campaignReceiptId("00000000-0000-4000-8000-000000000203") }), /anderem Ownership-Auftrag/);
});

test("post-verify context, registry and owner races fail at the atomic publish boundary", async () => {
  for (const race of ["context", "registry", "owner"] as const) {
    const initial = context(), { coordinator, registry, publisher, setContext } = setup(initial), input = completeInput();
    await coordinator.stage(input);
    registry.afterVerify = () => {
      if (race === "context") {
        const changed = context("context.a2"); setContext(changed); publisher.current = projection(changed);
      } else if (race === "registry") publisher.current = { ...projection(initial), registryRevision: "registry.v2" };
      else publisher.current = { ...projection(initial), owners: projection(initial).owners.map((owner) =>
        owner.ownerId === "world" ? { ...owner, snapshotRevision: "world.snapshot.v2" } : owner) };
    };
    assert.deepEqual(await coordinator.publish(input.commandId), { kind: "conflict" }, race);
    assert.equal(publisher.published.size, 0, race);
    assert.deepEqual(await coordinator.status(input.commandId), { kind: "outcome_unknown" }, race);
  }
});

test("race at the linearization callback has no partial effect and retry keeps one receipt", async () => {
  const { coordinator, publisher } = setup(), input = completeInput();
  await coordinator.stage(input);
  publisher.beforeCompare = () => { publisher.current = { ...projection(), registryRevision: "registry.v2" }; };
  assert.deepEqual(await coordinator.publish(input.commandId), { kind: "conflict" });
  assert.equal(publisher.published.size, 0);
  publisher.beforeCompare = undefined; publisher.current = projection();
  assert.deepEqual(await coordinator.publish(input.commandId), { kind: "confirmed" });
  assert.deepEqual(await coordinator.publish(input.commandId), { kind: "confirmed" });
  assert.equal(publisher.published.size, 1);
});

test("lost publish outcome resolves through the original receipt without a second effect", async () => {
  const { coordinator, publisher } = setup(), input = completeInput();
  await coordinator.stage(input); publisher.returnUnknownAfterPublish = true;
  assert.deepEqual(await coordinator.publish(input.commandId), { kind: "outcome_unknown" });
  assert.equal(publisher.published.size, 1);
  assert.deepEqual(await coordinator.status(input.commandId), { kind: "confirmed" });
  assert.deepEqual(await coordinator.publish(input.commandId), { kind: "confirmed" });
  assert.equal(publisher.published.size, 1);
});

test("projection digest, participant revision and closure ID-type binding fail before publish", async () => {
  const staleDigest = setup();
  staleDigest.registry.current = { ...projection(), projectionDigest: digest("0") };
  await assert.rejects(() => staleDigest.coordinator.stage(completeInput()), /Projektionsdigest/);
  const staleParticipant = setup(), input = completeInput();
  await assert.rejects(() => staleParticipant.coordinator.stage({ ...input,
    participants: input.participants.map((item) => item.ownerId === "world"
      ? { ...item, snapshotRevision: "world.snapshot.v2" } : item),
  }), /Teilnehmer ist stale/);
  const wrongType = setup();
  await assert.rejects(() => wrongType.coordinator.stage({ ...input,
    closure: input.closure.map((item) => item.sourceId === ids.room ? { ...item, entityType: "floor" } : item),
  }), /ID-Typ-Bindung/);
});

test("complete cannot carry salvage and salvage cannot omit its explicit decision", async () => {
  const input = completeInput(), complete = setup();
  await assert.rejects(() => complete.coordinator.stage({ ...input, salvage: salvage() }), /kein Salvage/);
  const noDecision = setup(), plan = salvage({ decisionId: "" });
  await assert.rejects(() => noDecision.coordinator.stage({ ...input, kind: "salvage-import",
    closure: [...input.closure.slice(0, 2), ...plan.survivors], salvage: plan }), /Salvage-Entscheidung/);
});

test("spatial write keeps campaign, namespace and local identities while new imports remap them", async () => {
  const input = completeInput(), spatial = setup();
  const identityClosure = input.closure.map((item) => ({ ...item, targetId: item.sourceId }));
  const envelope = await spatial.coordinator.stage({ ...input, kind: "spatial-write", closure: identityClosure });
  assert.equal(envelope.closure.every((item) => item.sourceId === item.targetId), true);
  const reusedImport = setup();
  await assert.rejects(() => reusedImport.coordinator.stage({ ...input, closure: identityClosure }), /Campaign-\/Namespace|nicht unabhängig/);
});

const salvage = (changes: Partial<CampaignSalvageProjectionV1> = {}): CampaignSalvageProjectionV1 => ({
  decisionId: "salvage.decision.v1", survivors: closure(worldRecords.map((record) => record.id)).slice(2),
  omissions: [{ sourceId: ids.audio, reason: "Bytehash beschädigt", impact: "Audio fehlt sichtbar" },
    { sourceId: ids.cue, reason: "Audioabhängigkeit", impact: "Cue fehlt sichtbar" },
    { sourceId: ids.scene, reason: "Cue-Abhängigkeit", impact: "Scene-Audio fehlt sichtbar" }],
  quarantine: [{ sourceId: ids.runtime, retention: "unknown-retained", originalDigest: digest("d"),
    reason: "Runtime bleibt opaque erhalten", referenceIds: [ids.scene] }],
  survivorDigest: campaignOwnershipDigestValue(closure(worldRecords.map((record) => record.id)).slice(2), digestPort),
  omissionDigest: campaignOwnershipDigestValue([
    { sourceId: ids.audio, reason: "Bytehash beschädigt", impact: "Audio fehlt sichtbar" },
    { sourceId: ids.cue, reason: "Audioabhängigkeit", impact: "Cue fehlt sichtbar" },
    { sourceId: ids.scene, reason: "Cue-Abhängigkeit", impact: "Scene-Audio fehlt sichtbar" },
  ], digestPort),
  quarantineDigest: campaignOwnershipDigestValue([{ sourceId: ids.runtime, retention: "unknown-retained",
    originalDigest: digest("d"), reason: "Runtime bleibt opaque erhalten", referenceIds: [ids.scene] }], digestPort),
  ...changes,
});

test("salvage keeps a disjoint closed survivor, omission and quarantine partition", async () => {
  const { coordinator } = setup(), input = completeInput(), plan = salvage();
  const envelope = await coordinator.stage({ ...input, kind: "salvage-import", closure: [
    ...input.closure.slice(0, 2), ...plan.survivors,
  ], salvage: plan });
  assert.equal(envelope.salvage!.quarantine[0]!.retention, "unknown-retained");
  assert.equal(Object.isFrozen(envelope.salvage!.quarantine), true);
});

test("dangling media survivors and lost quarantine or unknown-retained references fail closed", async () => {
  const input = completeInput();
  for (const bad of [
    salvage({ survivors: [...salvage().survivors, { entityType: "music-cue", sourceId: ids.cue, targetId: target(ids.cue) }],
      omissions: salvage().omissions.filter((item) => item.sourceId !== ids.cue) }),
    salvage({ quarantine: [] }),
    salvage({ quarantine: [{ ...salvage().quarantine[0]!, referenceIds: [] }] }),
    salvage({ quarantine: [{ ...salvage().quarantine[0]!, originalDigest: digest("0") }] }),
  ]) {
    const { coordinator } = setup();
    await assert.rejects(() => coordinator.stage({ ...input, kind: "salvage-import",
      closure: [...input.closure.slice(0, 2), ...bad.survivors], salvage: bad }), /Salvage|Quarantäne/);
  }
});

test("unknown or unavailable registry and stale A to B to A context never publish", async () => {
  const initial = context(), { coordinator, publisher, setContext } = setup(initial), input = completeInput();
  await coordinator.stage(input);
  setContext(context("context.a2"));
  assert.deepEqual(await coordinator.publish(input.commandId), { kind: "conflict" });
  assert.equal(publisher.calls, 0);
  const other = setup();
  other.registry.read = async () => ({ kind: "unavailable" });
  await assert.rejects(() => other.coordinator.stage(completeInput()), /unavailable/);
  const verifyUnknown = setup();
  await verifyUnknown.coordinator.stage(completeInput());
  verifyUnknown.registry.verifyOutcome = { kind: "unknown" };
  assert.deepEqual(await verifyUnknown.coordinator.publish(completeInput().commandId), { kind: "outcome_unknown" });
  assert.equal(verifyUnknown.publisher.calls, 0);
});
