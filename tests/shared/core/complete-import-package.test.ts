import assert from "node:assert/strict";
import { createHash } from "node:crypto";
import test from "node:test";
import {
  CompleteImportPackageInventory,
  type CompleteImportPackageBindingV1,
  type CompleteImportPackageFilePort,
} from "../../../src/features/campaign/complete-import-package";
import {
  campaignId,
  campaignNamespace,
  campaignRevision,
  campaignSnapshot,
} from "../../../src/features/campaign/campaign-contracts";

const encoder = new TextEncoder();
const digest = (bytes: Uint8Array) => `sha256:${createHash("sha256").update(bytes).digest("hex")}`;
const root = "Imports/current";
const binding: CompleteImportPackageBindingV1 = Object.freeze({
  importId: "import-1",
  revision: "package-r1",
  source: campaignSnapshot({
    schemaVersion: 1,
    campaignId: campaignId("00000000-0000-4000-8000-000000000001"),
    revision: campaignRevision(7),
    name: "Quellkampagne",
    namespace: campaignNamespace("00000000-0000-4000-8000-000000000002"),
    lifecycle: "active",
  }),
  registryId: "registry-1",
  registryRevision: "registry-r1",
  projectionDigest: digest(encoder.encode("projection")),
});

function packageFiles(overrides: Record<string, Uint8Array> = {}): Map<string, Uint8Array> {
  const payloads = {
    "campaign/data.json": encoder.encode('{"campaign":true}'),
    "media/theme.ogg": new Uint8Array([0, 1, 2, 3, 255]),
    ...overrides,
  };
  const manifest = {
    version: 1,
    importId: binding.importId,
    revision: binding.revision,
    source: {
      campaignId: binding.source.campaignId,
      campaignRevision: binding.source.revision,
      campaignName: binding.source.name,
      namespace: binding.source.namespace,
      lifecycle: binding.source.lifecycle,
    },
    registry: {
      registryId: binding.registryId,
      registryRevision: binding.registryRevision,
      projectionDigest: binding.projectionDigest,
    },
    files: Object.entries(payloads).map(([path, bytes]) => ({ path, bytes: bytes.length, sha256: digest(bytes) })),
  };
  return new Map([
    [`${root}/complete-import-package.json`, encoder.encode(JSON.stringify(manifest))],
    ...Object.entries(payloads).map(([path, bytes]) => [`${root}/${path}`, bytes] as const),
  ]);
}

class MemoryFiles implements CompleteImportPackageFilePort {
  readonly files: Map<string, Uint8Array>;
  afterRead?: (path: string, count: number) => void;
  afterList?: (folder: string, count: number) => void;
  reads = 0;
  lists = 0;
  readonly readAttempts = new Map<string, number>();
  readonly deliveredReads = new Map<string, number>();
  ignoreBudget = false;

  constructor(files = packageFiles()) { this.files = files; }

  async list(folder: string): Promise<readonly string[] | null> {
    const result = [...this.files.keys()].filter((path) => path.startsWith(`${folder}/`)).sort();
    this.afterList?.(folder, ++this.lists);
    return result;
  }

  async read(path: string, maxBytes: number): Promise<Uint8Array | null> {
    const value = this.files.get(path), count = ++this.reads;
    this.readAttempts.set(path, (this.readAttempts.get(path) ?? 0) + 1);
    this.afterRead?.(path, count);
    if (value && !this.ignoreBudget && value.length > maxBytes)
      throw new Error(`Host-Lesegrenze überschritten: ${path}`);
    if (value) this.deliveredReads.set(path, (this.deliveredReads.get(path) ?? 0) + 1);
    return value ? new Uint8Array(value) : null;
  }
}

test("complete import package binds exact stable files and verifies the same snapshot", async () => {
  const files = new MemoryFiles(), reader = new CompleteImportPackageInventory(files, root, digest),
    result = await reader.read(binding);
  assert.equal(result.kind, "confirmed");
  if (result.kind !== "confirmed") return;
  assert.equal(Object.isFrozen(result.inventory), true);
  assert.equal(Object.isFrozen(result.inventory.files), true);
  assert.deepEqual(result.inventory.files.map((file) => file.path), ["campaign/data.json", "media/theme.ogg"]);
  assert.equal(result.inventory.totalBytes, 22);
  assert.equal((await reader.verify(result.inventory)).kind, "current");
});

test("complete import package rejects traversal, extras, duplicates, corruption and size claims", async () => {
  const mutateManifest = async (mutate: (value: any) => void, pattern: RegExp) => {
    const files = new MemoryFiles(), path = `${root}/complete-import-package.json`,
      manifest = JSON.parse(new TextDecoder().decode(files.files.get(path)!));
    mutate(manifest);
    files.files.set(path, encoder.encode(JSON.stringify(manifest)));
    await assert.rejects(() => new CompleteImportPackageInventory(files, root, digest).read(binding), pattern);
  };
  await mutateManifest((value) => value.files[0].path = "../escape", /Vault-Pfad/);
  await mutateManifest((value) => value.files.push({ ...value.files[0] }), /Doppelter/);
  await mutateManifest((value) => value.files[0].bytes += 1, /beschädigt/);
  await mutateManifest((value) => value.files[0].sha256 = digest(encoder.encode("other")), /beschädigt/);
  await mutateManifest((value) => value.importId = 7, /Import-ID/);
  await mutateManifest((value) => value.source.campaignRevision = "7", /Campaign-Revision/);
  await mutateManifest((value) => value.files[0].path = false, /Dateipfad/);
  const extra = new MemoryFiles();
  extra.files.set(`${root}/unlisted.bin`, new Uint8Array([1]));
  await assert.rejects(() => new CompleteImportPackageInventory(extra, root, digest).read(binding), /nicht exakt/);
  await assert.rejects(() => new CompleteImportPackageInventory(new MemoryFiles(), root, digest, {
    maxFiles: 1, maxManifestBytes: 1024 * 1024, maxFileBytes: 1024, maxTotalBytes: 2048,
  }).read(binding), /zu viele Dateien/);
});

test("complete import package fails closed on binding reuse and read/verify races", async () => {
  const wrong: CompleteImportPackageBindingV1 = { ...binding, registryRevision: "registry-r2" };
  await assert.rejects(() => new CompleteImportPackageInventory(new MemoryFiles(), root, digest).read(wrong),
    /fremden oder veralteten/);

  const racingFiles = new MemoryFiles(), racing = new CompleteImportPackageInventory(racingFiles, root, digest);
  racingFiles.afterRead = (path, count) => {
    if (path.endsWith("complete-import-package.json") && count === 4)
      racingFiles.files.set(`${root}/campaign/data.json`, encoder.encode('{"changed":true}'));
  };
  assert.equal((await racing.read(binding)).kind, "unknown");

  const lateExtraFiles = new MemoryFiles(), lateExtra = new CompleteImportPackageInventory(lateExtraFiles, root, digest);
  lateExtraFiles.afterList = (_folder, count) => {
    if (count === 2) lateExtraFiles.files.set(`${root}/late-extra.bin`, new Uint8Array([1]));
  };
  assert.equal((await lateExtra.read(binding)).kind, "unknown");

  const files = new MemoryFiles(), reader = new CompleteImportPackageInventory(files, root, digest),
    first = await reader.read(binding);
  assert.equal(first.kind, "confirmed");
  if (first.kind !== "confirmed") return;
  const changedPayload = encoder.encode('{"changed":true}'), changedManifestPath = `${root}/complete-import-package.json`,
    changedManifest = JSON.parse(new TextDecoder().decode(files.files.get(changedManifestPath)!)),
    changedEntry = changedManifest.files.find((file: { path: string }) => file.path === "campaign/data.json");
  changedEntry.bytes = changedPayload.length;
  changedEntry.sha256 = digest(changedPayload);
  files.files.set(`${root}/campaign/data.json`, changedPayload);
  files.files.set(changedManifestPath, encoder.encode(JSON.stringify(changedManifest)));
  assert.equal((await reader.verify(first.inventory)).kind, "stale");
  assert.equal((await reader.read(binding)).kind, "confirmed");
  assert.equal((await reader.verify(first.inventory)).kind, "unknown");

  const ambiguousFiles = new MemoryFiles(), ambiguous = new CompleteImportPackageInventory(ambiguousFiles, root, digest),
    accepted = await ambiguous.read(binding);
  assert.equal(accepted.kind, "confirmed");
  if (accepted.kind !== "confirmed") return;
  const changedBinding: CompleteImportPackageBindingV1 = { ...binding, registryRevision: "registry-r2" };
  const manifestPath = `${root}/complete-import-package.json`, manifest = JSON.parse(
    new TextDecoder().decode(ambiguousFiles.files.get(manifestPath)!));
  manifest.registry.registryRevision = changedBinding.registryRevision;
  ambiguousFiles.files.set(manifestPath, encoder.encode(JSON.stringify(manifest)));
  assert.equal((await ambiguous.read(changedBinding)).kind, "confirmed");
  assert.equal((await ambiguous.verify(accepted.inventory)).kind, "unknown");
});

test("complete import package enforces host budgets and aborts before a second oversized read", async () => {
  const files = new MemoryFiles(), manifestPath = `${root}/complete-import-package.json`,
    payloadPath = `${root}/campaign/data.json`, manifest = JSON.parse(
      new TextDecoder().decode(files.files.get(manifestPath)!));
  manifest.files[0].bytes = 0;
  files.files.set(manifestPath, encoder.encode(JSON.stringify(manifest)));
  await assert.rejects(() => new CompleteImportPackageInventory(files, root, digest).read(binding), /Lesegrenze/);
  assert.equal(files.readAttempts.get(payloadPath), 1);
  assert.equal(files.deliveredReads.get(payloadPath) ?? 0, 0);

  const nonCompliant = new MemoryFiles(new Map(files.files));
  nonCompliant.ignoreBudget = true;
  await assert.rejects(() => new CompleteImportPackageInventory(nonCompliant, root, digest).read(binding),
    /tatsächliche Host-Größenbegrenzung/);
  assert.equal(nonCompliant.readAttempts.get(payloadPath), 1);

  const smallManifest = new MemoryFiles();
  await assert.rejects(() => new CompleteImportPackageInventory(smallManifest, root, digest, {
    maxFiles: 4, maxManifestBytes: 8, maxFileBytes: 1024, maxTotalBytes: 2048,
  }).read(binding), /Lesegrenze/);
  assert.equal(smallManifest.deliveredReads.get(manifestPath) ?? 0, 0);
});
