import test from "node:test";
import assert from "node:assert/strict";
import { createHash } from "node:crypto";
import {
  campaignContext,
  campaignContextToken,
  campaignId,
  campaignLocalId,
  campaignNamespace,
  campaignRevision,
  campaignSnapshot,
} from "../../../src/features/campaign/campaign-contracts";
import {
  MwsImportMediaInventory,
  type MwsImportMediaFilePort,
  type MwsImportMediaManifestV1,
} from "../../../src/features/campaign/mws-import-media-inventory";

const encoder = new TextEncoder(), id = campaignLocalId("00000000-0000-4000-8000-000000000050"),
  context = campaignContext(campaignSnapshot({
    schemaVersion: 1,
    campaignId: campaignId("00000000-0000-4000-8000-000000000001"),
    revision: campaignRevision(7),
    name: "Salzmarsch",
    namespace: campaignNamespace("00000000-0000-4000-8000-000000000002"),
    lifecycle: "active",
  }), campaignContextToken("context.mws.v1")),
  request = {
    context,
    registryId: "e2e01.registry",
    registryRevision: "registry.v1",
    projectionDigest: `sha256:${"a".repeat(64)}`,
    audioSourceIds: [id],
  },
  digest = (bytes: Uint8Array) => `sha256:${createHash("sha256").update(bytes).digest("hex")}`;

const manifest = (asset: MwsImportMediaManifestV1["assets"][number] = {
  sourceId: id,
  availability: "available",
  metadataPath: "metadata/audio-50.json",
  bytePath: "assets/audio-50.ogg",
}): MwsImportMediaManifestV1 => ({
  version: 1,
  importId: "import.mws.v1",
  revision: "inventory.v1",
  context: {
    campaignId: context.campaignId,
    campaignRevision: context.revision,
    campaignName: context.name,
    namespace: context.namespace,
    lifecycle: context.lifecycle,
    contextToken: context.contextToken,
  },
  registry: {
    registryId: request.registryId,
    registryRevision: request.registryRevision,
    projectionDigest: request.projectionDigest,
  },
  assets: [asset],
});

class Files implements MwsImportMediaFilePort {
  readonly values = new Map<string, Uint8Array>();
  afterRead?: (path: string, count: number) => void;
  beforeRead?: (path: string, count: number) => Promise<void>;
  private reads = new Map<string, number>();
  set(path: string, value: string | Uint8Array): void {
    this.values.set(path, typeof value === "string" ? encoder.encode(value) : value);
  }
  async read(path: string): Promise<Uint8Array | null> {
    const count = (this.reads.get(path) ?? 0) + 1;
    this.reads.set(path, count);
    await this.beforeRead?.(path, count);
    const value = this.values.get(path), result = value ? value.slice() : null;
    this.afterRead?.(path, count);
    return result;
  }
}

function setup(value = manifest()) {
  const files = new Files(), root = "Importe/import.mws.v1",
    inventory = new MwsImportMediaInventory(files, root, digest);
  files.set(`${root}/media-inventory.json`, JSON.stringify(value));
  files.set(`${root}/metadata/audio-50.json`, "{\"title\":\"Hafenwind\"}");
  files.set(`${root}/assets/audio-50.ogg`, new Uint8Array([1, 2, 3, 4]));
  return { files, inventory, root };
}

test("materialized media inventory hashes actual stable metadata and asset bytes", async () => {
  const { inventory } = setup(), outcome = await inventory.read(request);
  assert.equal(outcome.kind, "confirmed");
  if (outcome.kind !== "confirmed") return;
  assert.deepEqual(outcome.inventory, {
    version: 1,
    importId: "import.mws.v1",
    revision: "inventory.v1",
    assets: [{ sourceId: id, availability: "available",
      metadataDigest: digest(encoder.encode("{\"title\":\"Hafenwind\"}")),
      byteDigest: digest(new Uint8Array([1, 2, 3, 4])) }],
  });
  assert.deepEqual(await inventory.verify(outcome.inventory), { kind: "current" });
});

test("inventory verification rejects a late byte change without trusting the manifest revision", async () => {
  const { files, inventory, root } = setup(), outcome = await inventory.read(request);
  assert.equal(outcome.kind, "confirmed");
  if (outcome.kind !== "confirmed") return;
  files.set(`${root}/assets/audio-50.ogg`, new Uint8Array([9, 9, 9]));
  assert.deepEqual(await inventory.verify(outcome.inventory), { kind: "stale" });
});

test("inventory read fails closed for a manifest or asset race", async () => {
  for (const changed of ["manifest", "asset"] as const) {
    const { files, inventory, root } = setup();
    files.afterRead = (path, count) => {
      if (changed === "manifest" && path.endsWith("media-inventory.json") && count === 1)
        files.set(path, JSON.stringify({ ...manifest(), revision: "inventory.v2" }));
      if (changed === "asset" && path.endsWith("audio-50.ogg") && count === 1)
        files.set(path, new Uint8Array([4, 3, 2, 1]));
    };
    assert.deepEqual(await inventory.read(request), { kind: "unknown" }, `${changed} race`);
    assert.equal(root, "Importe/import.mws.v1");
  }
});

test("binding, complete IDs and safe unique relative paths are mandatory", async () => {
  const foreign = setup();
  await assert.rejects(() => foreign.inventory.read({ ...request, registryRevision: "registry.v2" }),
    /fremden oder veralteten/);
  const extra = setup();
  await assert.rejects(() => extra.inventory.read({ ...request,
    audioSourceIds: [id, campaignLocalId("00000000-0000-4000-8000-000000000051")] }),
    /unvollständig oder fremd/);
  for (const asset of [
    { sourceId: id, availability: "available" as const, metadataPath: "../escape", bytePath: "asset.bin" },
    { sourceId: id, availability: "available" as const, metadataPath: "same.bin", bytePath: "same.bin" },
    { sourceId: id, availability: "missing" as const, metadataPath: "metadata.json", bytePath: null },
  ]) {
    const invalid = setup(manifest(asset));
    await assert.rejects(() => invalid.inventory.read(request), /Vault-Pfad|doppelt|Fehlendes Medium/);
  }
});

test("one import revision cannot authorize two Campaign bindings", async () => {
  const { files, inventory, root } = setup(), first = await inventory.read(request);
  assert.equal(first.kind, "confirmed");
  if (first.kind !== "confirmed") return;
  const other = campaignContext(campaignSnapshot({
    schemaVersion: 1,
    campaignId: campaignId("00000000-0000-4000-8000-000000000003"),
    revision: campaignRevision(1),
    name: "Andere Kampagne",
    namespace: campaignNamespace("00000000-0000-4000-8000-000000000004"),
    lifecycle: "active",
  }), campaignContextToken("context.mws.other"));
  files.set(`${root}/media-inventory.json`, JSON.stringify({ ...manifest(), context: {
    campaignId: other.campaignId,
    campaignRevision: other.revision,
    campaignName: other.name,
    namespace: other.namespace,
    lifecycle: other.lifecycle,
    contextToken: other.contextToken,
  } }));
  const second = await inventory.read({ ...request, context: other });
  assert.equal(second.kind, "confirmed");
  assert.deepEqual(await inventory.verify(first.inventory), { kind: "unknown" });

  files.set(`${root}/media-inventory.json`, JSON.stringify(manifest()));
  const third = await inventory.read(request);
  assert.equal(third.kind, "confirmed");
  if (third.kind === "confirmed")
    assert.deepEqual(await inventory.verify(third.inventory), { kind: "unknown" });
});

test("verification cannot outlive a concurrent conflicting Campaign binding", async () => {
  const { files, inventory, root } = setup(), first = await inventory.read(request);
  assert.equal(first.kind, "confirmed");
  if (first.kind !== "confirmed") return;
  const other = campaignContext(campaignSnapshot({
    schemaVersion: 1,
    campaignId: campaignId("00000000-0000-4000-8000-000000000003"),
    revision: campaignRevision(1),
    name: "Andere Kampagne",
    namespace: campaignNamespace("00000000-0000-4000-8000-000000000004"),
    lifecycle: "active",
  }), campaignContextToken("context.mws.other"));
  let enter!: () => void, release!: () => void;
  const entered = new Promise<void>((resolve) => { enter = resolve; }),
    blocked = new Promise<void>((resolve) => { release = resolve; });
  files.beforeRead = async (path, count) => {
    if (path.endsWith("media-inventory.json") && count === 3) {
      enter();
      await blocked;
    }
  };
  const verifying = inventory.verify(first.inventory);
  await entered;
  files.beforeRead = undefined;
  files.set(`${root}/media-inventory.json`, JSON.stringify({ ...manifest(), context: {
    campaignId: other.campaignId,
    campaignRevision: other.revision,
    campaignName: other.name,
    namespace: other.namespace,
    lifecycle: other.lifecycle,
    contextToken: other.contextToken,
  } }));
  assert.equal((await inventory.read({ ...request, context: other })).kind, "confirmed");
  files.set(`${root}/media-inventory.json`, JSON.stringify(manifest()));
  release();
  assert.deepEqual(await verifying, { kind: "unknown" });
});

test("a stable declared or observed missing asset stays explicit and cannot masquerade as verified", async () => {
  const declared = setup(manifest({ sourceId: id, availability: "missing", metadataPath: null, bytePath: null })),
    first = await declared.inventory.read(request);
  assert.equal(first.kind, "confirmed");
  if (first.kind === "confirmed") assert.deepEqual(first.inventory.assets[0], {
    sourceId: id, availability: "missing", metadataDigest: null, byteDigest: null,
  });

  const observed = setup();
  observed.files.values.delete(`${observed.root}/assets/audio-50.ogg`);
  const second = await observed.inventory.read(request);
  assert.equal(second.kind, "confirmed");
  if (second.kind === "confirmed") assert.equal(second.inventory.assets[0]!.availability, "missing");
});
