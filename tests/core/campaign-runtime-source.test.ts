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
  type CampaignId,
} from "../../src/features/campaign/campaign-contracts";
import { CampaignLifecycle } from "../../src/features/campaign/campaign-lifecycle";
import { campaignOwnershipDigestValue } from "../../src/features/campaign/campaign-ownership";
import {
  CampaignRuntimeSource,
  CampaignRuntimeNavigationProvider,
  parseCampaignRuntimeManifest,
  type CampaignRuntimeFile,
  type CampaignRuntimeStorage,
} from "../../src/features/campaign/campaign-runtime-source";

const uuid = (n: number) => `00000000-0000-4000-8000-${String(n).padStart(12, "0")}`;
const sha = (value: string) => `sha256:${createHash("sha256").update(value).digest("hex")}`;
const digest = (canonical: string) => sha(canonical);
const a = campaignId(uuid(1)), b = campaignId(uuid(2)), worldA = uuid(101), worldB = uuid(102);

function manifest(id: CampaignId, worldId: string, name = "Salzmarsch", revision = 1): string {
  const snapshot = campaignSnapshot({ schemaVersion: 1, campaignId: id, revision, name,
    namespace: campaignNamespace(id === a ? uuid(11) : uuid(12)), lifecycle: "active" });
  const owners = [{ ownerId: "atlas", ownerRevision: "owner:1", schemaRevision: "schema:1",
    snapshotRevision: "snapshot:1", policyRevision: "policy:1", policyDigest: sha("policy"),
    availability: "confirmed", emptyConfirmed: false, referenceSchemas: ["atlas:1"],
    source: { adapterType: "native-atlas", generation: "source:1" },
    records: [{ id: worldId, recordType: "world", references: [], payloadDigest: sha("world"), media: null }],
    transferPolicies: [] }];
  const registryContent = { version: 1, registryId: "registry:1", registryRevision: "registry-revision:1",
    campaignId: id, campaignRevision: revision, namespace: snapshot.namespace, owners };
  return JSON.stringify({ version: 1, snapshot,
    registry: { ...registryContent, registryContentDigest: campaignOwnershipDigestValue(registryContent, digest) },
    atlas: { worldId, files: [{ kind: "world", id: worldId, path: `Atlanten/${worldId}.overworld`, savedDigest: sha("bytes") }],
      records: [{ id: worldId, kind: "world", documentId: worldId, ownerId: "atlas", availability: "available" }] } });
}
class Storage implements CampaignRuntimeStorage {
  files: CampaignRuntimeFile[] = [];
  listener?: () => void;
  async list() { return this.files; }
  subscribe(changed: () => void) { this.listener = changed; return () => { this.listener = undefined; }; }
  set(files: CampaignRuntimeFile[]) { this.files = files; this.listener?.(); }
}
function lifecycle(source: CampaignRuntimeSource) {
  let token = 0, receipt = 0;
  return new CampaignLifecycle(source.lifecycle, { campaignId: () => a, namespace: () => campaignNamespace(uuid(20)),
    contextToken: () => campaignContextToken(`runtime:${++token}`), receiptId: () => campaignReceiptId(uuid(200 + ++receipt)) });
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
  damaged.registry.registryContentDigest = campaignOwnershipDigestValue({ ...damaged.registry,
    registryContentDigest: undefined }, digest);
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
  assert.equal(changes, 2);
  stop(); provider.close(); storage.set([]); assert.equal(changes, 2);
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
