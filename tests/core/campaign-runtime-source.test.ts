import assert from "node:assert/strict";
import { createHash } from "node:crypto";
import test from "node:test";
import {
  campaignCommandId,
  campaignContextToken,
  campaignId,
  campaignNamespace,
  campaignReceiptId,
  campaignSnapshot,
  type CampaignContextProjection,
  type CampaignId,
} from "../../src/features/campaign/campaign-contracts";
import { CampaignLifecycle } from "../../src/features/campaign/campaign-lifecycle";
import { campaignDomainOwnerPolicyDigest, campaignOwnershipDigestValue,
  type CampaignDomainOwnerProjectionV1, type CampaignDomainOwnershipProjectionV1 } from
  "../../src/features/campaign/campaign-ownership";
import {
  CampaignRuntimeSource,
  CampaignRuntimeNavigationProvider,
  parseCampaignRuntimeManifest,
  type CampaignRuntimeFile,
  type CampaignRuntimeSaveAcknowledgmentV1,
  type CampaignRuntimeSaveRollbackReceipt,
  type CampaignRuntimeStorage,
  type CampaignRuntimeStorageChange,
} from "../../src/features/campaign/campaign-runtime-source";
import { CampaignRuntimeManifestSaveParticipant } from
  "../../src/features/campaign/campaign-runtime-save-participant";
import type { CampaignRuntimeSaveRollbackAuthority } from
  "../../src/features/campaign/campaign-runtime-save-participant";

const uuid = (n: number) => `00000000-0000-4000-8000-${String(n).padStart(12, "0")}`;
const sha = (value: string) => `sha256:${createHash("sha256").update(value).digest("hex")}`;
const digest = (canonical: string) => sha(canonical);
const a = campaignId(uuid(1)), b = campaignId(uuid(2)), worldA = uuid(101), worldB = uuid(102);

function manifest(id: CampaignId, worldId: string, name = "Salzmarsch", revision = 1): string {
  const snapshot = campaignSnapshot({ schemaVersion: 1, campaignId: id, revision, name,
    namespace: campaignNamespace(id === a ? uuid(11) : uuid(12)), lifecycle: "active" });
  const owner = { ownerId: "atlas", ownerRevision: "owner:1", schemaRevision: "schema:1",
    snapshotRevision: "snapshot:1", policyRevision: "policy:1", policyDigest: sha("placeholder"),
    availability: "confirmed", emptyConfirmed: false, referenceSchemas: ["atlas:1"],
    source: { adapterType: "native-atlas", generation: "source:1" },
    records: [{ id: worldId, recordType: "world", references: [], payloadDigest: sha("world"), media: null }],
    transferPolicies: [] };
  owner.policyDigest = campaignDomainOwnerPolicyDigest(owner as unknown as CampaignDomainOwnerProjectionV1, digest);
  const owners = [owner];
  const registryContent = { version: 1, registryId: "registry:1", registryRevision: "registry-revision:1",
    campaignId: id, campaignRevision: revision, namespace: snapshot.namespace, owners };
  return JSON.stringify({ version: 1, snapshot,
    registry: { ...registryContent, registryContentDigest: campaignOwnershipDigestValue(registryContent, digest) },
    atlas: { worldId, files: [{ kind: "world", id: worldId, path: `Atlanten/${worldId}.overworld`, savedDigest: sha("bytes") }],
      records: [{ id: worldId, kind: "world", documentId: worldId, ownerId: "atlas", availability: "available" }] } });
}
function resign(raw: Record<string, any>): string {
  const { registryContentDigest: _old, ...content } = raw.registry;
  raw.registry.registryContentDigest = campaignOwnershipDigestValue(content, digest);
  return JSON.stringify(raw);
}
class Storage implements CampaignRuntimeStorage {
  files: CampaignRuntimeFile[] = [];
  listener?: (change: CampaignRuntimeStorageChange) => void;
  async list() { return this.files; }
  subscribe(changed: (change: CampaignRuntimeStorageChange) => void) {
    this.listener = changed; return () => { this.listener = undefined; };
  }
  set(files: CampaignRuntimeFile[]) {
    const old = this.files[0], current = files[0]; this.files = files;
    this.listener?.(current ? { kind: old ? "modify" : "create", path: current.path, bytes: current.bytes }
      : { kind: "delete", path: old?.path ?? "Kampagnen/SaltMarcher/unknown.campaign.json" });
  }
}
function lifecycle(source: CampaignRuntimeSource) {
  let token = 0, receipt = 0;
  return new CampaignLifecycle(source.lifecycle, { campaignId: () => a, namespace: () => campaignNamespace(uuid(20)),
    contextToken: () => campaignContextToken(`runtime:${++token}`), receiptId: () => campaignReceiptId(uuid(200 + ++receipt)) });
}

function rollbackAuthority() {
  const receipts = new WeakSet<object>();
  return {
    authority: { validateRollbackReceipt(receipt: CampaignRuntimeSaveRollbackReceipt) {
      if (!receipts.has(receipt)) throw new Error("Rollback-Receipt ist nicht autoritativ.");
    } } satisfies CampaignRuntimeSaveRollbackAuthority,
    issue(prepared: CampaignRuntimeSaveAcknowledgmentV1): CampaignRuntimeSaveRollbackReceipt {
      const receipt = Object.freeze({ transactionId: prepared.transactionId, outcome: "rolled_back" as const,
        journalState: "absent" as const, writes: Object.freeze(prepared.journal.writes.map((write) =>
          Object.freeze({ ...write, current: write.before }))) });
      receipts.add(receipt); return receipt;
    },
  };
}

function saveAcknowledgments(
  participant: CampaignRuntimeManifestSaveParticipant,
  beforeBytes: string,
  context: CampaignContextProjection,
  beforeRegistry: CampaignDomainOwnershipProjectionV1,
  transactionId: string,
  savedBytes: string,
  revision: string,
) {
  const before = parseCampaignRuntimeManifest(beforeBytes, digest), nativePath = `Atlanten/${worldA}.overworld`,
    nextOwner = { ...before.registry.owners[0]!, ownerRevision: `owner:${revision}`,
      snapshotRevision: `snapshot:${revision}`,
      source: { ...before.registry.owners[0]!.source, generation: `source:${revision}` },
      records: before.registry.owners[0]!.records.map((record) => ({
        ...record, payloadDigest: sha(savedBytes),
      })) },
    nativeWrite = { path: nativePath, before: "bytes", after: savedBytes },
    [manifestWrite] = participant.prepare({ beforeManifestBytes: beforeBytes, nativeWrites: [nativeWrite],
      beforeOwners: before.registry.owners, afterOwners: [nextOwner] }),
    prepared = participant.createAcknowledgment({ context, beforeRegistry,
      journal: { transactionId, state: "prepared", writes: [nativeWrite, manifestWrite!] } }),
    committed = participant.createAcknowledgment({ context, beforeRegistry,
      journal: { ...prepared.journal, state: "committed" } });
  return { prepared, committed };
}

async function acknowledgmentFixture(command: number, transactionId: string, savedBytes: string) {
  const storage = new Storage(), path = "Kampagnen/SaltMarcher/a.campaign.json",
    beforeBytes = manifest(a, worldA),
    rollback = rollbackAuthority(),
    participant = new CampaignRuntimeManifestSaveParticipant(path, digest,
      [{ ownerId: "atlas", verify: () => undefined }], rollback.authority);
  storage.set([{ path, bytes: beforeBytes }]);
  const source = new CampaignRuntimeSource(storage, digest, participant), service = lifecycle(source),
    provider = new CampaignRuntimeNavigationProvider(source, service),
    activation = await provider.activate(campaignCommandId(uuid(command)), a, "open"), context = activation.context!,
    beforeRead = await source.registry.read(context);
  assert.equal(beforeRead.kind, "confirmed");
  if (beforeRead.kind !== "confirmed") throw new Error("Fixture benötigt bestätigte Registry.");
  const { prepared, committed } = saveAcknowledgments(participant, beforeBytes, context, beforeRead.projection,
    transactionId, savedBytes, String(command));
  return { storage, path, source, provider, participant, issueRollback: rollback.issue,
    beforeBytes, context, prepared, committed };
}

test("runtime source opens persisted campaigns and derives a fresh context-bound registry and inventory", async () => {
  const storage = new Storage(); storage.set([{ path: "Kampagnen/SaltMarcher/a.campaign.json", bytes: manifest(a, worldA) }]);
  const source = new CampaignRuntimeSource(storage, digest), service = lifecycle(source);
  const first = await service.activate(campaignCommandId(uuid(301)), a), second = await service.activate(campaignCommandId(uuid(302)), a);
  assert.equal(first.applied, true); assert.equal(second.applied, true);
  assert.notEqual(first.context!.contextToken, second.context!.contextToken);
  const r1 = await source.registry.read(first.context!), r2 = await source.registry.read(second.context!);
  assert.equal(r1.kind, "confirmed"); assert.equal(r2.kind, "confirmed");
  if (r1.kind !== "confirmed" || r2.kind !== "confirmed") return;
  assert.notEqual(r1.projection.projectionDigest, r2.projection.projectionDigest);
  assert.equal((await source.registry.verify(r1.projection)).kind, "current");
  const inventory = await source.inventory.read(r2.projection, worldA);
  assert.equal(inventory.kind, "confirmed");
  if (inventory.kind === "confirmed") assert.equal(inventory.inventory.context.contextToken, second.context!.contextToken);
  assert.equal((await source.entries())[0]?.name, "Salzmarsch");
});

test("runtime source fails closed for stale, duplicated, trashed and malformed manifests", async () => {
  const storage = new Storage(), path = "Kampagnen/SaltMarcher/a.campaign.json";
  storage.set([{ path, bytes: manifest(a, worldA) }]);
  const source = new CampaignRuntimeSource(storage, digest), service = lifecycle(source),
    activation = await service.activate(campaignCommandId(uuid(303)), a), read = await source.registry.read(activation.context!);
  assert.equal(read.kind, "confirmed"); if (read.kind !== "confirmed") return;
  storage.set([{ path, bytes: manifest(a, worldA, "Geändert", 2) }]);
  assert.equal((await source.registry.verify(read.projection)).kind, "unavailable");
  assert.equal((await source.inventory.read(read.projection, worldA)).kind, "unavailable");
  storage.set([{ path, bytes: manifest(a, worldA) },
    { path: "Kampagnen/SaltMarcher/duplicate.campaign.json", bytes: manifest(a, worldA) }]);
  const entries = await source.entries();
  assert.equal(entries.length, 2); assert.ok(entries.every((entry) => entry.status === "unavailable"));
  assert.equal(await source.lifecycle.read(a), null);
  const damaged = JSON.parse(manifest(b, worldB)); damaged.registry.registryContentDigest = sha("foreign");
  assert.throws(() => parseCampaignRuntimeManifest(JSON.stringify(damaged), digest), /Digest/);
});

test("runtime manifest requires canonical owner policy and complete Registry to Atlas inventory coverage", () => {
  const policy = JSON.parse(manifest(a, worldA)); policy.registry.owners[0].policyDigest = sha("foreign-policy");
  assert.throws(() => parseCampaignRuntimeManifest(resign(policy), digest), /Policy-Digest/);
  const incomplete = JSON.parse(manifest(a, worldA));
  incomplete.registry.owners[0].records.push({ id: uuid(120), recordType: "location", references: [],
    payloadDigest: sha("location"), media: null });
  assert.throws(() => parseCampaignRuntimeManifest(resign(incomplete), digest), /nicht vollständig/);
  const extraFile = JSON.parse(manifest(a, worldA));
  extraFile.atlas.files.push({ kind: "location", id: uuid(121), path: "Orte/extra.location.md", savedDigest: sha("extra") });
  assert.throws(() => parseCampaignRuntimeManifest(JSON.stringify(extraFile), digest), /zusätzliche unregistrierte Datei/);
});

test("runtime source exposes no create or rename publication path", async () => {
  const storage = new Storage(), source = new CampaignRuntimeSource(storage, digest), service = lifecycle(source);
  const staged = service.stageCreate(campaignCommandId(uuid(304)), "Neu"), result = await service.execute(staged.commandId);
  assert.equal(result.status, "conflict"); assert.deepEqual(storage.files, []);
  source.close(); assert.equal(storage.listener, undefined);
});

test("navigation provider exposes the exact Campaign ports and announces activation and source changes", async () => {
  const storage = new Storage(); storage.set([{ path: "Kampagnen/SaltMarcher/a.campaign.json", bytes: manifest(a, worldA) }]);
  const source = new CampaignRuntimeSource(storage, digest), service = lifecycle(source),
    provider = new CampaignRuntimeNavigationProvider(source, service);
  let changes = 0; const stop = provider.subscribeContextChanged(() => { changes++; });
  const result = await provider.activate(campaignCommandId(uuid(305)), a, "open");
  assert.equal(result.applied, true); assert.equal(provider.currentContext()?.campaignId, a); assert.equal(changes, 1);
  storage.set([{ path: "Kampagnen/SaltMarcher/a.campaign.json", bytes: manifest(a, worldA, "Geändert", 2) }]);
  assert.equal(changes, 2); assert.equal(provider.currentContext(), null);
  stop(); provider.close(); storage.set([]); assert.equal(changes, 2);
});

test("navigation provider blocks pending Vault reads unless one exact own save is already prepared", async () => {
  const foreign = await acknowledgmentFixture(312, "transaction:no-lease", "saved-no-lease");
  foreign.storage.listener?.({ kind: "modify", phase: "pending", eventId: 1, path: foreign.path });
  assert.equal(foreign.provider.currentContext(), null);
  const fresh = await foreign.provider.activate(campaignCommandId(uuid(316)), a, "open");
  foreign.storage.listener?.({ kind: "modify", phase: "resolved", eventId: 1, path: foreign.path,
    bytes: foreign.beforeBytes });
  assert.equal(foreign.provider.currentContext()?.contextToken, fresh.context?.contextToken);

  const overlap = await acknowledgmentFixture(317, "transaction:obsolete", "saved-obsolete");
  overlap.storage.listener?.({ kind: "modify", phase: "pending", eventId: 1, path: overlap.path });
  const replacement = await overlap.provider.activate(campaignCommandId(uuid(318)), a, "open"),
    replacementContext = replacement.context!, replacementRead = await overlap.source.registry.read(replacementContext);
  assert.equal(replacementRead.kind, "confirmed");
  if (replacementRead.kind !== "confirmed") throw new Error("Replacement benötigt bestätigte Registry.");
  const replacementSave = saveAcknowledgments(overlap.participant, overlap.beforeBytes, replacementContext,
    replacementRead.projection, "transaction:replacement", "saved-replacement", "318");
  overlap.provider.prepareSaveAcknowledgment(replacementSave.prepared);
  const replacementPromise = overlap.provider.acknowledgeCommittedSave(replacementSave.committed);
  overlap.storage.files = [{ path: overlap.path, bytes: replacementSave.prepared.afterManifestBytes }];
  overlap.storage.listener?.({ kind: "modify", phase: "pending", eventId: 2, path: overlap.path });
  overlap.storage.listener?.({ kind: "modify", phase: "resolved", eventId: 1, path: overlap.path,
    bytes: overlap.beforeBytes });
  assert.equal(overlap.provider.currentContext()?.contextToken, replacementContext.contextToken);
  overlap.storage.listener?.({ kind: "modify", phase: "resolved", eventId: 2, path: overlap.path,
    bytes: replacementSave.prepared.afterManifestBytes });
  assert.equal((await replacementPromise).context.contextToken, replacementContext.contextToken);

  const exact = await acknowledgmentFixture(313, "transaction:deferred-exact", "saved-exact");
  exact.provider.prepareSaveAcknowledgment(exact.prepared);
  const exactPromise = exact.provider.acknowledgeCommittedSave(exact.committed);
  exact.storage.files = [{ path: exact.path, bytes: exact.prepared.afterManifestBytes }];
  exact.storage.listener?.({ kind: "modify", phase: "pending", eventId: 1, path: exact.path });
  assert.equal(exact.provider.currentContext()?.contextToken, exact.context.contextToken);
  exact.storage.listener?.({ kind: "modify", phase: "resolved", eventId: 1, path: exact.path,
    bytes: exact.prepared.afterManifestBytes });
  assert.equal((await exactPromise).context.contextToken, exact.context.contextToken);

  const wrong = await acknowledgmentFixture(314, "transaction:deferred-wrong", "saved-expected");
  wrong.provider.prepareSaveAcknowledgment(wrong.prepared);
  const wrongPromise = wrong.provider.acknowledgeCommittedSave(wrong.committed);
  wrong.storage.listener?.({ kind: "modify", phase: "pending", eventId: 1, path: wrong.path });
  assert.equal(wrong.provider.currentContext()?.contextToken, wrong.context.contextToken);
  wrong.storage.listener?.({ kind: "modify", phase: "resolved", eventId: 1, path: wrong.path, bytes: "wrong" });
  await assert.rejects(wrongPromise, /fremdes Storageevent/);
  assert.equal(wrong.provider.currentContext(), null);

  const repeated = await acknowledgmentFixture(315, "transaction:deferred-repeated", "saved-once");
  repeated.provider.prepareSaveAcknowledgment(repeated.prepared);
  const repeatedPromise = repeated.provider.acknowledgeCommittedSave(repeated.committed);
  repeated.storage.listener?.({ kind: "modify", phase: "pending", eventId: 1, path: repeated.path });
  repeated.storage.listener?.({ kind: "modify", phase: "pending", eventId: 2, path: repeated.path });
  await assert.rejects(repeatedPromise, /fremdes Storageevent/);
  assert.equal(repeated.provider.currentContext(), null);
});

test("navigation provider releases only the exact rolled-back preparation before any manifest event", async () => {
  const rolledBack = await acknowledgmentFixture(319, "transaction:rolled-back", "saved-never-written");
  let contextChanges = 0; rolledBack.provider.subscribeContextChanged(() => contextChanges++);
  rolledBack.provider.prepareSaveAcknowledgment(rolledBack.prepared);
  const waitingAcknowledgment = rolledBack.provider.acknowledgeCommittedSave(rolledBack.committed);
  const rollback = rolledBack.participant.createRollbackAcknowledgment({ prepared: rolledBack.prepared,
    receipt: rolledBack.issueRollback(rolledBack.prepared) });
  rolledBack.provider.cancelSaveAcknowledgment(rollback);
  await assert.rejects(waitingAcknowledgment, /zurückgerollt/);
  assert.equal(rolledBack.provider.currentContext()?.contextToken, rolledBack.context.contextToken);
  assert.equal(contextChanges, 0);
  await assert.rejects(rolledBack.provider.acknowledgeCommittedSave(rolledBack.committed), /zurückgerollt/);
  assert.equal(rolledBack.provider.currentContext()?.contextToken, rolledBack.context.contextToken);
  assert.equal(contextChanges, 0);
  assert.throws(() => rolledBack.provider.cancelSaveAcknowledgment(rollback), /bereits bestätigt/);
  assert.throws(() => rolledBack.provider.prepareSaveAcknowledgment(rolledBack.prepared), /bereits zurückgerollt/);
  assert.equal(rolledBack.provider.currentContext()?.contextToken, rolledBack.context.contextToken);
  const retry = saveAcknowledgments(rolledBack.participant, rolledBack.beforeBytes, rolledBack.context,
    rolledBack.prepared.beforeRegistry, "transaction:retry", "saved-retry", "320");
  assert.doesNotThrow(() => rolledBack.provider.prepareSaveAcknowledgment(retry.prepared));

  const observed = await acknowledgmentFixture(321, "transaction:event-observed", "saved-observed");
  observed.provider.prepareSaveAcknowledgment(observed.prepared);
  observed.storage.listener?.({ kind: "modify", phase: "pending", eventId: 1, path: observed.path });
  const observedRollback = observed.participant.createRollbackAcknowledgment({ prepared: observed.prepared,
    receipt: observed.issueRollback(observed.prepared) });
  assert.throws(() => observed.provider.cancelSaveAcknowledgment(observedRollback), /bereits ein Manifestevent/);
  assert.equal(observed.provider.currentContext(), null);

  const forged = await acknowledgmentFixture(322, "transaction:forged-rollback", "saved-forged");
  forged.provider.prepareSaveAcknowledgment(forged.prepared);
  const validRollback = forged.participant.createRollbackAcknowledgment({ prepared: forged.prepared,
    receipt: forged.issueRollback(forged.prepared) });
  assert.throws(() => forged.provider.cancelSaveAcknowledgment({ ...validRollback }), /nicht vom zuständigen Participant/);
  assert.equal(forged.provider.currentContext()?.contextToken, forged.context.contextToken);
  forged.provider.cancelSaveAcknowledgment(validRollback);
  assert.equal(forged.provider.currentContext()?.contextToken, forged.context.contextToken);
});

test("navigation provider keeps one mount only for the participant-sealed exact save event", async () => {
  const storage = new Storage(), path = "Kampagnen/SaltMarcher/a.campaign.json",
    beforeBytes = manifest(a, worldA), nativePath = `Atlanten/${worldA}.overworld`,
    participant = new CampaignRuntimeManifestSaveParticipant(path, digest,
      [{ ownerId: "atlas", verify: () => undefined }]);
  storage.set([{ path, bytes: beforeBytes }]);
  const source = new CampaignRuntimeSource(storage, digest, participant), service = lifecycle(source),
    provider = new CampaignRuntimeNavigationProvider(source, service);
  let contextChanges = 0; provider.subscribeContextChanged(() => contextChanges++);
  const activation = await provider.activate(campaignCommandId(uuid(307)), a, "open"),
    context = activation.context!, beforeRead = await source.registry.read(context),
    before = parseCampaignRuntimeManifest(beforeBytes, digest);
  assert.equal(beforeRead.kind, "confirmed"); if (beforeRead.kind !== "confirmed") return;
  const nextOwner = { ...before.registry.owners[0]!, ownerRevision: "owner:2", snapshotRevision: "snapshot:2",
    source: { ...before.registry.owners[0]!.source, generation: "source:2" },
    records: before.registry.owners[0]!.records.map((record) => ({ ...record, payloadDigest: sha("saved-bytes") })) };
  const nativeWrite = { path: nativePath, before: "bytes", after: "saved-bytes" },
    [manifestWrite] = participant.prepare({ beforeManifestBytes: beforeBytes, nativeWrites: [nativeWrite],
      beforeOwners: before.registry.owners, afterOwners: [nextOwner] }),
    prepared = participant.createAcknowledgment({ context, beforeRegistry: beforeRead.projection,
      journal: { transactionId: "transaction:1", state: "prepared", writes: [nativeWrite, manifestWrite!] } });
  assert.throws(() => provider.prepareSaveAcknowledgment({ ...prepared }), /nicht vom zuständigen Participant/);
  provider.prepareSaveAcknowledgment(prepared);
  const committed = participant.createAcknowledgment({ context, beforeRegistry: beforeRead.projection,
      journal: { ...prepared.journal, state: "committed" } }),
    acknowledgmentPromise = provider.acknowledgeCommittedSave(committed),
    duplicatePromise = provider.acknowledgeCommittedSave(committed);
  assert.equal(duplicatePromise, acknowledgmentPromise);
  await Promise.resolve();
  assert.equal(provider.currentContext()?.contextToken, context.contextToken);
  storage.set([{ path, bytes: prepared.afterManifestBytes }]);
  assert.equal(provider.currentContext()?.contextToken, context.contextToken);
  assert.equal(contextChanges, 1);
  const acknowledged = await acknowledgmentPromise;
  assert.equal(await duplicatePromise, acknowledged);
  assert.equal(provider.currentContext()?.contextToken, context.contextToken);
  assert.equal(contextChanges, 1);
  assert.notEqual(acknowledged.registry.registryRevision, beforeRead.projection.registryRevision);
  assert.equal(acknowledged.inventory.files[0]?.savedDigest, sha("saved-bytes"));
  assert.equal(await provider.acknowledgeCommittedSave(committed), acknowledged);
  const saved = parseCampaignRuntimeManifest(prepared.afterManifestBytes, digest), savedOwner = saved.registry.owners[0]!,
    nextOwnerAgain = { ...savedOwner, ownerRevision: "owner:3", snapshotRevision: "snapshot:3",
      source: { ...savedOwner.source, generation: "source:3" },
      records: savedOwner.records.map((record) => ({ ...record, payloadDigest: sha("saved-again") })) },
    secondNativeWrite = { path: nativePath, before: "saved-bytes", after: "saved-again" },
    [secondManifestWrite] = participant.prepare({ beforeManifestBytes: prepared.afterManifestBytes,
      nativeWrites: [secondNativeWrite], beforeOwners: saved.registry.owners, afterOwners: [nextOwnerAgain] }),
    secondPrepared = participant.createAcknowledgment({ context, beforeRegistry: acknowledged.registry,
      journal: { transactionId: "transaction:2", state: "prepared",
        writes: [secondNativeWrite, secondManifestWrite!] } });
  provider.prepareSaveAcknowledgment(secondPrepared);
  const secondCommitted = participant.createAcknowledgment({ context, beforeRegistry: acknowledged.registry,
      journal: { ...secondPrepared.journal, state: "committed" } }),
    secondPromise = provider.acknowledgeCommittedSave(secondCommitted);
  storage.set([{ path, bytes: secondPrepared.afterManifestBytes }]);
  assert.equal(provider.currentContext()?.contextToken, context.contextToken);
  storage.listener?.({ kind: "modify", path: "Kampagnen/SaltMarcher/foreign.campaign.json", bytes: "{}" });
  assert.equal(provider.currentContext(), null); assert.equal(contextChanges, 2);
  await assert.rejects(secondPromise, /fremdes Storageevent|fremde Eventfolge|verlor seine vorbereitete Source-Lease/);
  await assert.rejects(provider.acknowledgeCommittedSave(committed), /nicht mehr aktuell|Context oder Save-Receipt/);
  const reopened = await provider.activate(campaignCommandId(uuid(308)), a, "open"),
    reopenedContext = reopened.context!;
  assert.notEqual(reopenedContext.contextToken, context.contextToken);
  await assert.rejects(provider.acknowledgeCommittedSave(committed), /fremden aktuellen Context/);
  assert.equal(provider.currentContext()?.contextToken, reopenedContext.contextToken);
  const reopenedRead = await source.registry.read(reopenedContext);
  assert.equal(reopenedRead.kind, "confirmed"); if (reopenedRead.kind !== "confirmed") return;
  const current = parseCampaignRuntimeManifest(secondPrepared.afterManifestBytes, digest),
    currentOwner = current.registry.owners[0]!,
    finalOwner = { ...currentOwner, ownerRevision: "owner:4", snapshotRevision: "snapshot:4",
      source: { ...currentOwner.source, generation: "source:4" },
      records: currentOwner.records.map((record) => ({ ...record, payloadDigest: sha("saved-final") })) },
    finalNativeWrite = { path: nativePath, before: "saved-again", after: "saved-final" },
    [finalManifestWrite] = participant.prepare({ beforeManifestBytes: secondPrepared.afterManifestBytes,
      nativeWrites: [finalNativeWrite], beforeOwners: current.registry.owners, afterOwners: [finalOwner] }),
    finalPrepared = participant.createAcknowledgment({ context: reopenedContext, beforeRegistry: reopenedRead.projection,
      journal: { transactionId: "transaction:3", state: "prepared",
        writes: [finalNativeWrite, finalManifestWrite!] } }),
    finalCommitted = participant.createAcknowledgment({ context: reopenedContext, beforeRegistry: reopenedRead.projection,
      journal: { ...finalPrepared.journal, state: "committed" } }),
    originalAcknowledge = source.acknowledgeCommittedSave.bind(source);
  let switchedContext = reopenedContext;
  source.acknowledgeCommittedSave = async (proof, lease) => {
    const result = await originalAcknowledge(proof, lease);
    const switched = await provider.activate(campaignCommandId(uuid(309)), a, "open");
    switchedContext = switched.context!;
    return result;
  };
  provider.prepareSaveAcknowledgment(finalPrepared);
  const finalPromise = provider.acknowledgeCommittedSave(finalCommitted);
  storage.set([{ path, bytes: finalPrepared.afterManifestBytes }]);
  await assert.rejects(finalPromise, /während der Speicherbestätigung/);
  source.acknowledgeCommittedSave = originalAcknowledge;
  assert.equal(provider.currentContext()?.contextToken, switchedContext.contextToken);
  const switchedRead = await source.registry.read(switchedContext);
  assert.equal(switchedRead.kind, "confirmed"); if (switchedRead.kind !== "confirmed") return;
  const finalManifest = parseCampaignRuntimeManifest(finalPrepared.afterManifestBytes, digest),
    finalCurrentOwner = finalManifest.registry.owners[0]!,
    fourthOwner = { ...finalCurrentOwner, ownerRevision: "owner:5", snapshotRevision: "snapshot:5",
      source: { ...finalCurrentOwner.source, generation: "source:5" },
      records: finalCurrentOwner.records.map((record) => ({ ...record, payloadDigest: sha("saved-fourth") })) },
    fourthNativeWrite = { path: nativePath, before: "saved-final", after: "saved-fourth" },
    [fourthManifestWrite] = participant.prepare({ beforeManifestBytes: finalPrepared.afterManifestBytes,
      nativeWrites: [fourthNativeWrite], beforeOwners: finalManifest.registry.owners, afterOwners: [fourthOwner] }),
    fourthPrepared = participant.createAcknowledgment({ context: switchedContext, beforeRegistry: switchedRead.projection,
      journal: { transactionId: "transaction:4", state: "prepared",
        writes: [fourthNativeWrite, fourthManifestWrite!] } }),
    fourthCommitted = participant.createAcknowledgment({ context: switchedContext, beforeRegistry: switchedRead.projection,
      journal: { ...fourthPrepared.journal, state: "committed" } }),
    mismatchedCommitted = participant.createAcknowledgment({ context: switchedContext, beforeRegistry: switchedRead.projection,
      journal: { ...fourthPrepared.journal, transactionId: "transaction:foreign", state: "committed" } });
  provider.prepareSaveAcknowledgment(fourthPrepared);
  const fourthPromise = provider.acknowledgeCommittedSave(fourthCommitted),
    mismatchedPromise = provider.acknowledgeCommittedSave(mismatchedCommitted);
  await assert.rejects(mismatchedPromise, /Save-Receipt wechselte/);
  await assert.rejects(fourthPromise, /fremdes Save-Receipt/);
  assert.equal(provider.currentContext(), null);
  provider.close();
  assert.equal(provider.currentContext(), null);
  await assert.rejects(provider.activate(campaignCommandId(uuid(310)), a, "open"), /geschlossen/);
});

test("runtime source binds an acknowledgment lease to its exact prepared proof", async () => {
  const storage = new Storage(), path = "Kampagnen/SaltMarcher/a.campaign.json",
    beforeBytes = manifest(a, worldA), nativePath = `Atlanten/${worldA}.overworld`,
    participant = new CampaignRuntimeManifestSaveParticipant(path, digest,
      [{ ownerId: "atlas", verify: () => undefined }]);
  storage.set([{ path, bytes: beforeBytes }]);
  const source = new CampaignRuntimeSource(storage, digest, participant), service = lifecycle(source),
    activation = await service.activate(campaignCommandId(uuid(311)), a), context = activation.context!,
    beforeRead = await source.registry.read(context), before = parseCampaignRuntimeManifest(beforeBytes, digest);
  assert.equal(beforeRead.kind, "confirmed"); if (beforeRead.kind !== "confirmed") return;
  const changedOwner = (savedBytes: string, revision: string) => ({
      ...before.registry.owners[0]!, ownerRevision: `owner:${revision}`, snapshotRevision: `snapshot:${revision}`,
      source: { ...before.registry.owners[0]!.source, generation: `source:${revision}` },
      records: before.registry.owners[0]!.records.map((record) => ({
        ...record, payloadDigest: sha(savedBytes),
      })),
    }),
    prepared = (savedBytes: string, revision: string) => {
      const nativeWrite = { path: nativePath, before: "bytes", after: savedBytes },
        [manifestWrite] = participant.prepare({ beforeManifestBytes: beforeBytes, nativeWrites: [nativeWrite],
          beforeOwners: before.registry.owners, afterOwners: [changedOwner(savedBytes, revision)] });
      return participant.createAcknowledgment({ context, beforeRegistry: beforeRead.projection,
        journal: { transactionId: "transaction:lease-binding", state: "prepared",
          writes: [nativeWrite, manifestWrite!] } });
    },
    proofA = prepared("saved-a", "2"), proofB = prepared("saved-b", "3"),
    leaseA = source.prepareSaveAcknowledgment(proofA),
    committedB = participant.createAcknowledgment({ context, beforeRegistry: beforeRead.projection,
      journal: { ...proofB.journal, state: "committed" } });
  assert.notEqual(proofA.afterManifestBytes, committedB.afterManifestBytes);
  await assert.rejects(source.acknowledgeCommittedSave(committedB, leaseA), /vorbereiteten Source-Lease/);
});

test("registry verify detects an Atlas-only manifest edit", async () => {
  const storage = new Storage(), path = "Kampagnen/SaltMarcher/a.campaign.json", raw = manifest(a, worldA);
  storage.set([{ path, bytes: raw }]);
  const source = new CampaignRuntimeSource(storage, digest), service = lifecycle(source),
    activation = await service.activate(campaignCommandId(uuid(306)), a), read = await source.registry.read(activation.context!);
  assert.equal(read.kind, "confirmed"); if (read.kind !== "confirmed") return;
  const edited = JSON.parse(raw); edited.atlas.files[0].savedDigest = sha("changed-atlas-bytes");
  storage.set([{ path, bytes: JSON.stringify(edited) }]);
  assert.equal((await source.registry.read(activation.context!)).kind, "confirmed");
  assert.equal((await source.registry.verify(read.projection)).kind, "stale");
});

test("runtime source rejects an out-of-order list answer and keeps the newest manifest set", async () => {
  let releaseOld!: (files: readonly CampaignRuntimeFile[]) => void,
    releaseNew!: (files: readonly CampaignRuntimeFile[]) => void, calls = 0;
  const storage: CampaignRuntimeStorage = { list: () => new Promise((resolve) => {
    if (++calls === 1) releaseOld = resolve; else releaseNew = resolve;
  }) };
  const source = new CampaignRuntimeSource(storage, digest), oldRead = source.entries(), newRead = source.entries();
  releaseNew([{ path: "new.campaign.json", bytes: manifest(b, worldB, "Neu") }]);
  assert.equal((await newRead)[0]?.campaignId, b);
  releaseOld([{ path: "old.campaign.json", bytes: manifest(a, worldA, "Alt") }]);
  await assert.rejects(oldRead, /während des Lesens geändert/);
});
